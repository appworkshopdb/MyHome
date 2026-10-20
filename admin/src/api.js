// Zugriff auf Supabase für das Dashboard — bewusst ohne supabase-js:
// Anmeldung und RPC-Aufrufe sind je ein einfacher fetch (gleiches Vorgehen
// wie src/core/lib/rawAuth.js in der Nutzer-App, dort wegen eines
// navigator.locks-Bugs in auth-js).
//
// Es wird nur der öffentliche anon-Key benutzt. Was jemand sehen darf, wird
// in der Datenbank entschieden (analytics_admins + prüfende Funktionen),
// nicht hier im Browser.

const BASE = (import.meta.env.VITE_SUPABASE_URL || '').trim().replace(/\/$/, '');
const KEY = (import.meta.env.VITE_SUPABASE_ANON_KEY || '').trim();
export const configured = Boolean(BASE && KEY);

const STORE = 'nestua_admin_session';
const REFRESH_MARGIN_MS = 60_000;

let session = load();
let refreshing = null;
const listeners = new Set();

function load() {
  try { return JSON.parse(localStorage.getItem(STORE)); } catch { return null; }
}

function save(next) {
  session = next;
  try {
    if (next) localStorage.setItem(STORE, JSON.stringify(next));
    else localStorage.removeItem(STORE);
  } catch { /* Speicher gesperrt — dann gilt die Anmeldung nur bis zum Neuladen */ }
  listeners.forEach((fn) => fn());
}

export function getSession() { return session; }
export function subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); }
export function signOut() { save(null); }

async function authRequest(path, body) {
  const res = await fetch(`${BASE}/auth/v1/${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: KEY },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error_description || data.msg || data.error || 'Anmeldung fehlgeschlagen');
  return { ...data, expires_at: Date.now() + data.expires_in * 1000 };
}

export async function signIn(email, password) {
  save(await authRequest('token?grant_type=password', { email, password }));
}

async function validToken() {
  if (!session) throw new Error('Nicht angemeldet');
  if (session.expires_at - Date.now() > REFRESH_MARGIN_MS) return session.access_token;

  refreshing ||= authRequest('token?grant_type=refresh_token', { refresh_token: session.refresh_token })
    .then((next) => { save(next); return next.access_token; })
    .catch((err) => { save(null); throw err; })
    .finally(() => { refreshing = null; });
  return refreshing;
}

export async function rpc(fn, args = {}) {
  const token = await validToken();
  const res = await fetch(`${BASE}/rest/v1/rpc/${fn}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: KEY, Authorization: `Bearer ${token}` },
    body: JSON.stringify(args),
  });
  if (res.status === 401) { save(null); throw new Error('Sitzung abgelaufen'); }
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    if (data?.code === '42501') throw new Error('Kein Zugriff');
    throw new Error(data?.message || `Fehler ${res.status}`);
  }
  return data;
}
