// core/lib/privacyStore.js
// "Beträge ausblenden" (Auge in der Saldo-Karte): für Momente in der Öffentlichkeit.
// Gilt für den NUTZER, nicht das Gerät: gespeichert in body_profile.hide_amounts
// (supabase/hide_amounts_migration.sql), je Nutzer zusätzlich im lokalen Zwischenspeicher
// `nestua:hide-amounts:<userId>`, damit der Zustand sofort (auch offline) stimmt.
// Fehlt die Spalte oder ist man offline, bleibt der lokale Wert in Kraft.
//
// Gleiches Muster wie habitsStore/gamificationStore: Modulzustand + Listener, kein Context.

import { useEffect, useState } from 'react';
import { getSupabase } from './supabaseClient';
import { useAuth } from './AuthContext';

const LS_PREFIX = 'nestua:hide-amounts:';

let state = { uid: null, hide: false };
const listeners = new Set();

function setState(patch) {
  state = { ...state, ...patch };
  listeners.forEach((fn) => fn(state));
}

function readLocal(uid) {
  try { return localStorage.getItem(LS_PREFIX + uid) === '1'; } catch { return false; }
}
function writeLocal(uid, hide) {
  try { localStorage.setItem(LS_PREFIX + uid, hide ? '1' : '0'); } catch { /* egal */ }
}

async function loadFromServer(uid) {
  try {
    const { data, error } = await getSupabase()
      .from('body_profile').select('hide_amounts').eq('owner_id', uid).maybeSingle();
    if (error) { console.warn('[Datenschutz] hide_amounts nicht ladbar (Migration hide_amounts_migration.sql?):', error.message); return; }
    if (state.uid !== uid || typeof data?.hide_amounts !== 'boolean') return;
    writeLocal(uid, data.hide_amounts);
    setState({ hide: data.hide_amounts });
  } catch { /* offline: lokaler Wert gilt */ }
}

function activate(uid) {
  if (state.uid === uid) return;
  setState({ uid, hide: uid ? readLocal(uid) : false });
  if (uid) loadFromServer(uid);
}

async function toggleHideAmounts() {
  const uid = state.uid;
  if (!uid) return;
  const next = !state.hide;
  writeLocal(uid, next);
  setState({ hide: next });
  try {
    const { error } = await getSupabase()
      .from('body_profile').upsert({ owner_id: uid, hide_amounts: next }, { onConflict: 'owner_id' });
    if (error) console.warn('[Datenschutz] hide_amounts nicht gespeichert (Migration?):', error.message);
  } catch { /* offline: bleibt lokal */ }
}

// → [ausgeblendet?, umschalten]
export function useHideAmounts() {
  const { session } = useAuth();
  const uid = session?.user?.id ?? null;
  const [snap, setSnap] = useState(state);
  useEffect(() => {
    const fn = (s) => setSnap(s);
    listeners.add(fn);
    activate(uid);
    setSnap(state);
    return () => { listeners.delete(fn); };
  }, [uid]);
  return [snap.uid === uid ? snap.hide : false, toggleHideAmounts];
}
