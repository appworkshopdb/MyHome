// src/core/lib/feedback.js
// Haptik + Sound für die Zuhause-App.
// Sounds liegen als Dateien in public/sounds/ und werden per Audio-API abgespielt.
// Einstellungen liegen in localStorage, kein React-Context nötig.
// Einfach importieren und aufrufen: import { fb } from '../lib/feedback';

const STORAGE_KEY = 'zuhause_feedback';

// ── Einstellungen ─────────────────────────────────────────────────────────────

function getSettings() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
  } catch {
    return {};
  }
}

export function isSoundEnabled() {
  return getSettings().sound !== false; // Default: an
}

export function isHapticEnabled() {
  return getSettings().haptic !== false; // Default: an
}

export function setSoundEnabled(v) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...getSettings(), sound: v }));
}

export function setHapticEnabled(v) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...getSettings(), haptic: v }));
}

// ── Sound-Wiedergabe (Web Audio API) ─────────────────────────────────────────
//
// WICHTIG — nicht auf `new Audio(...)` zurückbauen:
// Ein <audio>-Element gilt für Android und iOS als MEDIENWIEDERGABE. Beim
// Abspielen fordert es den Audiofokus an, und das Betriebssystem pausiert
// dafür laufende Musik oder Podcasts (Spotify blieb stehen, wenn man
// nebenbei eine Gewohnheit abgehakt hat). Für 300-ms-Effekttöne ist das
// die falsche Bauweise.
//
// Die Web Audio API gilt stattdessen als Effektton und mischt sich unter
// die laufende Wiedergabe, statt sie zu verdrängen. Zusätzlich setzen wir
// unten die Audio-Session auf "ambient" — das ist die ausdrückliche
// Ansage an iOS: mitmischen, nichts unterbrechen.
//
// Nebeneffekt: <audio> lädt Dateien über Range-Requests (HTTP 206), die
// der Service Worker nicht cachen kann. fetch() unten liefert normale
// 200er-Antworten, damit sind auch die Cache-Fehler weg.

const SOUND_FILES = {
  erledigt:      './sounds/erledigt.mp3',
  ziel_erreicht: './sounds/ziel_erreicht.mp3',
  ziel_erreicht2:'./sounds/ziel_erreicht2.mp3',
  click:         './sounds/click.mp3',
  click2:        './sounds/click2.mp3',
  swoosh:        './sounds/swoosh.mp3',
  negativ:       './sounds/negativ.mp3',
  zahlung:       './sounds/zahlung.mp3',
  fixkosten_alle:'./sounds/fixkosten_alle.mp3',
};

const VOLUME = 0.5; // Globale Lautstärke 0.0–1.0 — hier zentral anpassen

let _ctx = null;                 // AudioContext, erst bei der ersten Geste erzeugt
const _buffers = {};             // name → decodierter AudioBuffer
const _laufendeLadungen = {};    // name → Promise, verhindert Doppel-Downloads

// iOS ab 16.4: sagt dem System, dass unsere Töne beiläufig sind und
// fremde Wiedergabe nicht unterbrechen dürfen. Andere Browser kennen die
// Eigenschaft nicht — dort ist Web Audio ohnehin schon unkritisch.
function setzeAmbientSession() {
  try {
    if ('audioSession' in navigator) navigator.audioSession.type = 'ambient';
  } catch { /* Eigenschaft nicht schreibbar */ }
}

function getCtx() {
  if (_ctx) return _ctx;
  const Ctor = window.AudioContext || window.webkitAudioContext;
  if (!Ctor) return null;
  setzeAmbientSession();
  // latencyHint 'interactive': kürzeste Verzögerung, passend für UI-Töne
  _ctx = new Ctor({ latencyHint: 'interactive' });
  return _ctx;
}

// Bewusst KEIN Vorladen beim Import mehr: vorher zogen zehn <audio>-
// Elemente mit preload="auto" rund 2 MB WAV beim Start der App, obwohl
// die meisten Töne in einer Sitzung nie vorkommen. Jetzt wird jede Datei
// beim ersten Bedarf geholt und danach als decodierter Puffer behalten.
function ladeBuffer(name) {
  if (_buffers[name]) return Promise.resolve(_buffers[name]);
  if (_laufendeLadungen[name]) return _laufendeLadungen[name];

  const ctx = getCtx();
  const pfad = SOUND_FILES[name];
  if (!ctx || !pfad) return Promise.resolve(null);

  _laufendeLadungen[name] = fetch(pfad)
    .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(String(r.status)))))
    .then((daten) => ctx.decodeAudioData(daten))
    .then((buffer) => { _buffers[name] = buffer; return buffer; })
    .catch(() => null)
    .finally(() => { delete _laufendeLadungen[name]; });

  return _laufendeLadungen[name];
}

function spiele(buffer) {
  const ctx = getCtx();
  if (!ctx || !buffer) return;
  // Nach längerer Untätigkeit legen Browser den Context schlafen
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  const quelle = ctx.createBufferSource();
  const lautstaerke = ctx.createGain();
  quelle.buffer = buffer;
  lautstaerke.gain.value = VOLUME;
  quelle.connect(lautstaerke).connect(ctx.destination);
  quelle.start(0);
  // Aufräumen, damit sich bei schnellem Abhaken keine Knoten stapeln
  quelle.onended = () => { try { quelle.disconnect(); lautstaerke.disconnect(); } catch { /* egal */ } };
}

/**
 * Spielt einen Sound ab. Beim ersten Mal wird die Datei geholt und
 * decodiert (dann startet der Ton minimal verzögert), danach kommt er
 * sofort aus dem Speicher. Mehrfaches Abspielen parallel ist möglich:
 * jede Wiedergabe bekommt eine eigene BufferSource.
 */
function playSound(name) {
  if (!isSoundEnabled()) return;
  try {
    if (_buffers[name]) { spiele(_buffers[name]); return; }
    ladeBuffer(name).then((buffer) => { if (buffer) spiele(buffer); });
  } catch { /* still fail */ }
}

/**
 * Optional beim App-Start aufrufbar, um die häufigsten Töne im
 * Hintergrund vorzubereiten — ohne sie abzuspielen. Nicht automatisch,
 * damit der Start nichts nachlädt, was vielleicht gar nicht gebraucht wird.
 */
export function warmeSoundsVor(namen = ['erledigt', 'click', 'click2']) {
  if (!isSoundEnabled()) return;
  namen.forEach((n) => { ladeBuffer(n); });
}

// ── Haptik (Vibration API) ────────────────────────────────────────────────────
// Funktioniert auf Android Chrome/TWA. iOS Safari ignoriert das stillschweigend.

export function haptic(pattern = 30) {
  if (!isHapticEnabled()) return;
  if ('vibrate' in navigator) {
    navigator.vibrate(pattern);
  }
}

const HAPTIC = {
  check:   () => haptic(40),           // kurzer Pulse — Abhaken
  soft:    () => haptic(20),           // sehr sanft — Hinzufügen
  success: () => haptic([50, 80, 50]), // Doppel-Pulse — Ziel erreicht
  error:   () => haptic([20, 30, 20, 30, 20]), // 3× kurz — Fehler
  neutral: () => haptic(15),           // kaum spürbar — Navigation/Status
};

// ── Öffentliche API ───────────────────────────────────────────────────────────
// Zuordnung laut Tabelle:
//
// Habit abhaken                                → erledigt.mp3
// Letztes Habit (alle done)                   → ziel_erreicht.mp3
// ToDo abhaken                                → click.mp3
// ToDo angelegt                               → click2.mp3
// Alle ToDos erledigt                         → ziel_erreicht.mp3
// Artikel abhaken                             → click2.mp3
// Letzter Artikel (alle done)                 → ziel_erreicht2.mp3
// Liste angelegt                              → erledigt.mp3
// Artikel hinzugefügt                         → click2.mp3
// Listen-Status weiterschalten                → swoosh.mp3
// Workout als erledigt markieren              → ziel_erreicht2.mp3
// Ruhetag eintragen                           → swoosh.mp3
// Training abhaken (Plan-Tag)                 → ziel_erreicht.mp3
// Speichern fehlgeschlagen / Netzwerkfehler   → negativ.mp3
// Fixkosten abhaken                           → zahlung.mp3
// Variable Kosten abhaken                     → zahlung.mp3
// Sonstige Ausgaben abhaken                   → zahlung.mp3
// Fix+Variable+Sonstige alle abgehakt         → fixkosten_alle.mp3

export const fb = {

  // ── Gewohnheiten ──────────────────────────────────────────────────
  habitCheck: () => {
    HAPTIC.check();
    playSound('erledigt');
  },

  habitAllDone: () => {
    HAPTIC.success();
    playSound('ziel_erreicht');
  },

  // ── ToDo ──────────────────────────────────────────────────────────
  todoCheck: () => {
    HAPTIC.check();
    playSound('click');
  },

  todoCreate: () => {
    HAPTIC.soft();
    playSound('click2');
  },

  todoAllDone: () => {
    HAPTIC.success();
    playSound('ziel_erreicht');
  },

  // ── Einkauf ───────────────────────────────────────────────────────
  itemCheck: () => {
    HAPTIC.check();
    playSound('click2');
  },

  itemAllDone: () => {
    HAPTIC.success();
    playSound('ziel_erreicht2');
  },

  listCreate: () => {
    HAPTIC.soft();
    playSound('erledigt');
  },

  itemAdd: () => {
    HAPTIC.soft();
    playSound('click2');
  },

  listStatusCycle: () => {
    HAPTIC.neutral();
    playSound('swoosh');
  },

  // ── Sport ─────────────────────────────────────────────────────────
  workoutDone: () => {
    HAPTIC.success();
    playSound('ziel_erreicht2');
  },

  restDay: () => {
    HAPTIC.neutral();
    playSound('swoosh');
  },

  planDayCheck: () => {
    HAPTIC.check();
    playSound('ziel_erreicht');
  },

  // ── Finanzen ──────────────────────────────────────────────────────
  paymentCheck: () => {
    HAPTIC.check();
    playSound('zahlung');
  },

  paymentAllDone: () => {
    HAPTIC.success();
    playSound('fixkosten_alle');
  },

  // ── Fehler ────────────────────────────────────────────────────────
  error: () => {
    HAPTIC.error();
    playSound('negativ');
  },
};
