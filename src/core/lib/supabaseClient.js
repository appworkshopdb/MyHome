import { createClient } from '@supabase/supabase-js';

// .trim() fängt einen häufigen Windows-Stolperstein ab: falls die .env
// mit einem unsichtbaren Zeilenumbruch (CRLF) oder Leerzeichen am Ende
// gespeichert wurde, würde die URL sonst z.B. auf "...supabase.co\r"
// enden.
export const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL || '').trim();
export const supabaseAnonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY || '').trim();

const urlLooksValid = /^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/.test(supabaseUrl);
export const supabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey && urlLooksValid);

if (!supabaseConfigured) {
  console.error(
    '[Supabase] Konfiguration ungültig oder unvollständig.\n' +
      `  VITE_SUPABASE_URL: ${supabaseUrl ? `"${supabaseUrl}"` : '(fehlt)'}\n` +
      `  VITE_SUPABASE_ANON_KEY: ${supabaseAnonKey ? `vorhanden (${supabaseAnonKey.length} Zeichen)` : '(fehlt)'}\n` +
      '  Erwartetes URL-Format: https://xxxxx.supabase.co (ohne /rest/v1 und ohne Anführungszeichen)'
  );
}

const effectiveUrl = urlLooksValid ? supabaseUrl : 'https://placeholder.supabase.co';
const effectiveKey = supabaseAnonKey || 'placeholder';

// WICHTIG: Wir nutzen supabase.auth.* absichtlich NICHT für Login/Logout
// (siehe src/lib/rawAuth.js) — ein aktueller Bug in @supabase/auth-js
// lässt signInWithPassword()/signUp() unter Windows + Chromium-Browsern
// hängen bzw. abstürzen (interner navigator.locks-Deadlock). Login läuft
// stattdessen über einfache HTTP-Requests direkt gegen die Auth-API.
//
// Für Datenbankabfragen (fin_entries etc.) muss der Client aber trotzdem
// wissen, wer eingeloggt ist, damit RLS-Regeln (auth.uid()) greifen.
// Das lösen wir, indem wir bei jedem Token-Wechsel einen neuen Client
// mit dem Access-Token im Authorization-Header erzeugen — ganz ohne
// den kaputten Sessions-Mechanismus von auth-js zu berühren.
let currentClient = createClient(effectiveUrl, effectiveKey, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
});

export function setAccessToken(accessToken) {
  currentClient = createClient(effectiveUrl, effectiveKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: accessToken ? { headers: { Authorization: `Bearer ${accessToken}` } } : {},
  });
}

export function getSupabase() {
  return currentClient;
}
