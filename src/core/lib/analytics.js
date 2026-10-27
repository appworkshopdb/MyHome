// src/core/lib/analytics.js
// Eigenes, einwilligungsbasiertes Nutzungs-Tracking (Ziel: Supabase-Tabelle
// analytics_events, siehe supabase/migrations/100_analytics.sql).
//
// GRUNDREGELN
//  - Ohne ausdrückliche Einwilligung (getConsent() === 'granted') passiert
//    NICHTS: keine Listener-Aktivität, keine Queue, keine Requests.
//  - Nur eingeloggte Nutzer werden erfasst (user_id kommt aus der Sitzung).
//    Der Login-Screen selbst ist damit bewusst nicht im Tracking.
//  - KEINE Inhalte erfassen: keine Beträge, Gewichte, Lebensmittel, Notizen,
//    Namen. Nur Ereignisnamen und grobe Eigenschaften (props), jeweils kurz.
//
// AUTOMATISCH ERFASST
//  session_start, screen_view (Hash-Routing), heartbeat (alle 60 s bei
//  sichtbarer, bedienter App; trägt die Klickzahl seit dem letzten Heartbeat),
//  js_error. Ein Heartbeat entspricht ca. 1 Minute aktiver Nutzung.
//
// GEZIELT ERFASST
//  Jedes Element mit data-track="ereignis_name" löst beim Klick dieses
//  Ereignis aus (Name: a-z, 0-9, _; 2–48 Zeichen). Zusätzlich manuell:
//  import { track } from '.../analytics'; track('entry_saved', { module: 'finance' });
//
// TRANSPORT
//  Gebündelt (alle 5 s bzw. beim Verlassen der Seite) per fetch an
//  PostgREST. Schlägt der Versand fehl (offline, Token abgelaufen), bleibt
//  die Queue in localStorage und wird später erneut versucht.
//  Bewusst rohes fetch statt supabase-js: nur so geht keepalive beim
//  Schließen der App, und es passt zum Vorgehen in rawAuth.js.

import { supabaseUrl, supabaseAnonKey, supabaseConfigured } from './supabaseClient';
import { SESSION_STORAGE_KEY } from './rawAuth';
import { parseHash } from './useRoute';

// Alt: eine Entscheidung je Gerät. Wird beim ersten Login einmalig dem Nutzer
// zugeschrieben und entfernt; seither gilt die Entscheidung je Nutzer (lokaler
// Zwischenspeicher `nestua_analytics_consent:<userId>`) und liegt zusätzlich in
// body_profile (supabase/consent_migration.sql), damit sie Gerät, Abmelden und
// Neuinstallation überdauert.
const CONSENT_KEY = 'nestua_analytics_consent';
const consentKeyFor = (uid) => `${CONSENT_KEY}:${uid}`;
const QUEUE_KEY = 'nestua_analytics_queue';
const SESSION_KEY = 'nestua_analytics_session'; // sessionStorage

// Bei inhaltlicher Änderung des Einwilligungstextes hochzählen — wird mit
// dem Ereignis consent_granted gespeichert (Nachweis, welcher Text galt).
export const CONSENT_TEXT_VERSION = 1;

const SESSION_IDLE_MS = 30 * 60 * 1000; // danach beginnt eine neue Sitzung
const FLUSH_DELAY_MS = 5_000;
const RETRY_DELAY_MS = 30_000;
const HEARTBEAT_MS = 60_000;
const INTERACTION_IDLE_MS = 2 * 60 * 1000; // ohne Bedienung kein Heartbeat
const BATCH_SIZE = 50;
const QUEUE_MAX = 300;
const MAX_EVENT_AGE_MS = 6 * 24 * 60 * 60 * 1000; // Server lehnt > 7 Tage ab
const MAX_ERRORS_PER_SESSION = 5;
const EVENT_NAME_RE = /^[a-z][a-z0-9_]{1,47}$/;

const ENDPOINT = `${supabaseUrl}/rest/v1/analytics_events`;
const PROFILE_ENDPOINT = `${supabaseUrl}/rest/v1/body_profile`;
const CONSENT_SYNC_TIMEOUT_MS = 8_000;
const APP_VERSION = String(import.meta.env.VITE_APP_VERSION || 'dev').slice(0, 7);

// ── Zustand ───────────────────────────────────────────────────────────────

let queue = loadQueue();
let activeUser = null;        // von syncAnalyticsSession gesetzt
let started = false;          // für den aktuellen Nutzer begonnen?
let sessionId = null;
let currentScreen = { module: '', view: '' };
let clicks = 0;
let errorCount = 0;
let lastInteraction = Date.now();
let flushTimer = null;
let flushing = false;
let initialized = false;
let consentChecked = false;   // Abgleich der Einwilligung mit dem Server für activeUser abgeschlossen?

const consentListeners = new Set();

// ── Einwilligung ──────────────────────────────────────────────────────────

// Entscheidung des gerade angemeldeten Nutzers: 'granted' | 'denied' | null.
export function getConsent() {
  const uid = activeUser || readStoredSession()?.userId;
  if (!uid) return null;
  try {
    const v = localStorage.getItem(consentKeyFor(uid));
    return v === 'granted' || v === 'denied' ? v : null;
  } catch {
    return null;
  }
}

// Für die Oberfläche: wie getConsent(), aber 'pending' solange der Abgleich mit
// dem Server noch läuft — sonst würde das Banner kurz aufblitzen, obwohl der
// Nutzer längst entschieden hat.
export function getConsentSnapshot() {
  const v = getConsent();
  if (v) return v;
  return consentChecked ? null : 'pending';
}

export function subscribeConsent(fn) {
  consentListeners.add(fn);
  return () => consentListeners.delete(fn);
}

export function setConsent(granted) {
  const uid = activeUser || readStoredSession()?.userId;
  const value = granted ? 'granted' : 'denied';
  if (uid) {
    try { localStorage.setItem(consentKeyFor(uid), value); } catch { /* egal */ }
    saveConsentToServer(value);
  }

  if (granted) {
    begin();
    push('consent_granted', { v: CONSENT_TEXT_VERSION });
  } else {
    started = false;
    queue = [];
    persistQueue();
    if (flushTimer) { clearTimeout(flushTimer); flushTimer = null; }
  }
  consentListeners.forEach((fn) => fn());
}

// Altbestand: die frühere gerätebezogene Entscheidung gehört dem Nutzer, der sie
// getroffen hat — also dem ersten, der sich danach anmeldet.
function adoptLegacyConsent(uid) {
  try {
    const legacy = localStorage.getItem(CONSENT_KEY);
    if (legacy === 'granted' || legacy === 'denied') {
      if (!localStorage.getItem(consentKeyFor(uid))) localStorage.setItem(consentKeyFor(uid), legacy);
      localStorage.removeItem(CONSENT_KEY);
    }
  } catch { /* egal */ }
}

function consentHeaders(token) {
  return { 'Content-Type': 'application/json', apikey: supabaseAnonKey, Authorization: `Bearer ${token}` };
}

// Speichert die Entscheidung in body_profile (Upsert: nur diese Spalten werden
// überschrieben). Fehlt die Migration oder ist man offline, bleibt die lokale
// Entscheidung bestehen — beim nächsten Login wird sie nachgereicht.
async function saveConsentToServer(value, uid, token) {
  const stored = readStoredSession();
  const user = uid || stored?.userId;
  const tok = token || stored?.token;
  if (!user || !tok || !supabaseConfigured) return;
  try {
    const res = await fetch(`${PROFILE_ENDPOINT}?on_conflict=owner_id`, {
      method: 'POST',
      headers: { ...consentHeaders(tok), Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify({
        owner_id: user,
        analytics_consent: value,
        analytics_consent_at: new Date().toISOString(),
        analytics_consent_version: CONSENT_TEXT_VERSION,
      }),
    });
    if (!res.ok) console.warn('[Analytics] Einwilligung nicht gespeichert (Migration consent_migration.sql?), HTTP', res.status);
  } catch { /* offline — nächster Login versucht es erneut */ }
}

// Beim Anmelden: gespeicherte Entscheidung vom Server holen. Der Server gewinnt
// (Entscheidung auf einem anderen Gerät); gibt es dort noch keine, wird eine
// vorhandene lokale hochgeladen.
async function syncConsentWithServer(session) {
  const uid = session.user.id;
  let server; // 'granted' | 'denied' | null (noch keine) | undefined (nicht abrufbar)
  try {
    const res = await fetch(`${PROFILE_ENDPOINT}?select=analytics_consent&owner_id=eq.${uid}`, {
      headers: consentHeaders(session.access_token),
      signal: typeof AbortSignal.timeout === 'function' ? AbortSignal.timeout(CONSENT_SYNC_TIMEOUT_MS) : undefined,
    });
    if (res.ok) {
      const v = (await res.json())?.[0]?.analytics_consent;
      server = v === 'granted' || v === 'denied' ? v : null;
    }
  } catch { /* offline/Zeitüberschreitung: lokale Entscheidung gilt */ }

  if (activeUser !== uid) return; // inzwischen abgemeldet oder Konto gewechselt

  const local = getConsent();
  if (server && server !== local) {
    try { localStorage.setItem(consentKeyFor(uid), server); } catch { /* egal */ }
    if (server === 'denied') {
      started = false;
      queue = [];
      persistQueue();
    }
  } else if (server === null && local) {
    saveConsentToServer(local, uid, session.access_token);
  }

  consentChecked = true;
  consentListeners.forEach((fn) => fn());
  if (isActive()) begin();
}

// ── Sitzung (App-seitig) ──────────────────────────────────────────────────

// Wird von App.jsx bei jeder Änderung der Anmeldung aufgerufen.
export function syncAnalyticsSession(session) {
  const uid = session?.user?.id || null;
  if (uid !== activeUser) {
    if (activeUser) flush({ keepalive: true });
    activeUser = uid;
    started = false;
    consentChecked = false;
    if (uid) {
      adoptLegacyConsent(uid);
      syncConsentWithServer(session);
    }
    consentListeners.forEach((fn) => fn());
  }
  if (uid && isActive()) begin();
}

// ── Öffentliche API ───────────────────────────────────────────────────────

export function track(name, props) {
  if (!started || !isActive() || !EVENT_NAME_RE.test(name)) return;
  if (ensureSession()) pushScreen();
  push(name, props);
}

export function initAnalytics() {
  if (initialized || typeof window === 'undefined') return;
  initialized = true;

  // Nur mit Anmeldung entscheidbar (die Einwilligung gehört dem Nutzer).
  if (readStoredSession() && getConsent() !== 'granted') {
    queue = [];
    persistQueue();
  }

  window.addEventListener('hashchange', () => {
    if (!started || !isActive()) return;
    flushClicks();
    ensureSession();
    pushScreen();
  });

  document.addEventListener('click', onClick, { capture: true, passive: true });
  for (const type of ['keydown', 'scroll', 'touchstart']) {
    document.addEventListener(type, noteInteraction, { capture: true, passive: true });
  }

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') leave();
  });
  window.addEventListener('pagehide', leave);

  window.addEventListener('error', (e) => reportError(e.message, e.filename, e.lineno));
  window.addEventListener('unhandledrejection', (e) => {
    reportError(e.reason?.message || String(e.reason), '', 0);
  });

  window.setInterval(heartbeat, HEARTBEAT_MS);
  window.addEventListener('online', () => flush());
}

// ── Intern: Ablauf ────────────────────────────────────────────────────────

function isActive() {
  return supabaseConfigured && getConsent() === 'granted' && Boolean(readStoredSession());
}

// Beginnt (einmal pro Nutzer-Anmeldung) die Erfassung: Sitzung + erster Screen.
function begin() {
  if (started || !activeUser || !isActive()) return;
  started = true;
  ensureSession();
  pushScreen();
}

// true, wenn eine neue Sitzung begonnen wurde (erste Nutzung oder > 30 min
// Pause). Eine Sitzung beginnt immer mit session_start + screen_view.
function ensureSession() {
  const now = Date.now();
  let s = null;
  try { s = JSON.parse(sessionStorage.getItem(SESSION_KEY)); } catch { /* egal */ }

  const isNew = !s || now - s.last > SESSION_IDLE_MS;
  if (isNew) {
    s = { id: newId(), last: now };
    errorCount = 0;
  }
  s.last = now;
  try { sessionStorage.setItem(SESSION_KEY, JSON.stringify(s)); } catch { /* egal */ }
  sessionId = s.id;

  if (isNew) push('session_start');
  return isNew;
}

function pushScreen() {
  const { module, view } = parseHash();
  currentScreen = { module: module || 'hub', view: view || '' };
  push('screen_view');
}

function push(name, props = {}) {
  const stored = readStoredSession();
  if (!stored || !sessionId) return;

  queue.push({
    user_id: stored.userId,
    session_id: sessionId,
    client_ts: new Date().toISOString(),
    name,
    module: currentScreen.module.slice(0, 40),
    view: currentScreen.view.slice(0, 60),
    props: sanitize(props),
    app_version: APP_VERSION,
    standalone: isStandalone(),
    viewport_w: window.innerWidth,
  });
  if (queue.length > QUEUE_MAX) queue.splice(0, queue.length - QUEUE_MAX);
  persistQueue();
  scheduleFlush();
}

// ── Intern: Ereignisquellen ───────────────────────────────────────────────

function noteInteraction() {
  lastInteraction = Date.now();
}

function onClick(e) {
  if (!started) return;
  noteInteraction();
  clicks += 1;
  const el = e.target instanceof Element ? e.target.closest('[data-track]') : null;
  if (el) track(el.getAttribute('data-track'));
}

function flushClicks() {
  if (clicks <= 0) return;
  const n = clicks;
  clicks = 0;
  push('heartbeat', { clicks: n });
}

function heartbeat() {
  if (!started || !isActive()) return;
  if (document.visibilityState !== 'visible') return;
  if (Date.now() - lastInteraction > INTERACTION_IDLE_MS) return;
  const n = clicks;
  clicks = 0;
  track('heartbeat', { clicks: n });
}

function leave() {
  if (!started) return;
  flushClicks();
  flush({ keepalive: true });
}

function reportError(message, file, line) {
  if (!started || errorCount >= MAX_ERRORS_PER_SESSION) return;
  errorCount += 1;
  track('js_error', {
    message: String(message || '').slice(0, 120),
    file: String(file || '').split('/').pop().slice(0, 60),
    line: Number(line) || 0,
  });
}

// ── Intern: Versand ───────────────────────────────────────────────────────

function scheduleFlush(delay = FLUSH_DELAY_MS) {
  if (flushTimer) return;
  flushTimer = setTimeout(() => {
    flushTimer = null;
    flush();
  }, delay);
}

async function flush({ keepalive = false } = {}) {
  if (flushing || queue.length === 0) return;

  const stored = readStoredSession();
  // Nicht angemeldet: nichts senden, Queue bleibt (gleicher Nutzer meldet
  // sich ggf. wieder an). Abgelaufenes Token: AuthContext erneuert es gleich.
  if (!stored) return;
  if (stored.expiresAt && stored.expiresAt <= Date.now()) { scheduleFlush(RETRY_DELAY_MS); return; }

  // Ereignisse eines anderen Kontos oder > 6 Tage alte nimmt der Server
  // nicht an (RLS) — gar nicht erst senden, sonst blockieren sie die Queue.
  const cutoff = Date.now() - MAX_EVENT_AGE_MS;
  queue = queue.filter((e) => e.user_id === stored.userId && Date.parse(e.client_ts) > cutoff);
  if (queue.length === 0) { persistQueue(); return; }

  const batch = queue.slice(0, BATCH_SIZE);
  flushing = true;
  let retry = false;
  try {
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      keepalive,
      headers: {
        'Content-Type': 'application/json',
        apikey: supabaseAnonKey,
        Authorization: `Bearer ${stored.token}`,
        Prefer: 'return=minimal',
      },
      body: JSON.stringify(batch),
    });
    if (res.ok) {
      queue.splice(0, batch.length);
    } else if (res.status === 401 || res.status === 429 || res.status >= 500) {
      retry = true;
    } else {
      // Dauerhaft abgelehnt (z.B. Tabelle fehlt noch, Regel verletzt):
      // verwerfen statt endlos zu wiederholen.
      console.warn('[Analytics] Ereignisse verworfen, HTTP', res.status);
      queue.splice(0, batch.length);
    }
  } catch {
    retry = true; // offline o.ä.
  } finally {
    flushing = false;
    persistQueue();
  }

  if (queue.length > 0) scheduleFlush(retry ? RETRY_DELAY_MS : 0);
}

// ── Intern: Hilfsfunktionen ───────────────────────────────────────────────

function readStoredSession() {
  try {
    const s = JSON.parse(localStorage.getItem(SESSION_STORAGE_KEY));
    if (!s?.access_token || !s?.user?.id) return null;
    return { token: s.access_token, userId: s.user.id, expiresAt: s.expires_at };
  } catch {
    return null;
  }
}

function loadQueue() {
  try {
    const q = JSON.parse(localStorage.getItem(QUEUE_KEY));
    return Array.isArray(q) ? q : [];
  } catch {
    return [];
  }
}

function persistQueue() {
  try {
    if (queue.length) localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
    else localStorage.removeItem(QUEUE_KEY);
  } catch { /* Speicher voll/gesperrt — Queue lebt dann nur im Arbeitsspeicher */ }
}

// Nur flache, kurze Werte zulassen — verhindert, dass versehentlich ganze
// Objekte (und damit Inhalte) in die Datenbank wandern.
function sanitize(props) {
  const out = {};
  for (const [k, v] of Object.entries(props || {}).slice(0, 8)) {
    if (typeof v === 'number' || typeof v === 'boolean') out[k] = v;
    else if (typeof v === 'string') out[k] = v.slice(0, 80);
  }
  return out;
}

function isStandalone() {
  return window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true;
}

function newId() {
  return crypto.randomUUID?.() || `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
