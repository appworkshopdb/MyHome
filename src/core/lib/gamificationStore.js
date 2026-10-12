// core/lib/gamificationStore.js
// Geteilter State für Gamification-Badges in der TopBar.
//
// Exakt dasselbe Subscribe-Pattern wie habitsStore.js:
//  - Kein React-Context
//  - useGamificationStore() in jeder Komponente → rendert neu bei Änderung
//  - awardPoints() aus gamificationData.js ruft refreshStore() auf,
//    damit die TopBar-Badges live updaten ohne Reload.

import { useState, useEffect } from 'react';
import { getGamificationStatus, calcLevel, calcLevelProgress, saveBirdSpecies } from './gamificationData.js';

// ─── Interner State ───────────────────────────────────────────

let state = {
  points_total:     0,
  current_streak:   0,
  longest_streak:   0,
  last_active_date: null,
  level:            1,
  levelProgress:    null,
  bird_species:     null,
  loaded:           false,
  loading:          false,
};

const listeners = new Set();

function setState(patch) {
  state = { ...state, ...patch };
  listeners.forEach((fn) => fn(state));
}

// ─── Vogelart ────────────────────────────────────────────────
// Liegt in gamification_status.bird_species (Migration:
// supabase/bird_species_migration.sql). Solange die Spalte fehlt oder das
// Speichern scheitert, dient localStorage als Rückfall — dann gilt die Wahl
// nur für dieses Gerät, die App bleibt aber benutzbar.
const SPECIES_LS_KEY = 'nestua:bird-species';
function readLocalSpecies() {
  try { return localStorage.getItem(SPECIES_LS_KEY) || null; } catch { return null; }
}

// Die Wahl ist endgültig (Willkommens-Assistent): ist schon eine Art gesetzt,
// wird ein weiterer Aufruf ignoriert.
export async function setBirdSpecies(species) {
  if (state.bird_species) return;
  try { localStorage.setItem(SPECIES_LS_KEY, species); } catch { /* ignorieren */ }
  setState({ bird_species: species });
  try {
    await saveBirdSpecies(species);
  } catch (e) {
    console.warn('[gamificationStore] Vogelart nicht in der DB gespeichert (Spalte fehlt?):', e?.message || e);
  }
}

// ─── Laden ───────────────────────────────────────────────────

export async function loadGamificationStore({ force = false } = {}) {
  if (state.loading) return;
  if (state.loaded && !force) return;
  setState({ loading: true });
  try {
    const data  = await getGamificationStatus();
    const level = calcLevel(data.points_total ?? 0);
    setState({
      points_total:     data.points_total     ?? 0,
      current_streak:   data.current_streak   ?? 0,
      longest_streak:   data.longest_streak   ?? 0,
      last_active_date: data.last_active_date ?? null,
      level,
      levelProgress:    calcLevelProgress(data.points_total ?? 0),
      bird_species:     data.bird_species ?? readLocalSpecies(),
      loaded:           true,
      loading:          false,
    });
  } catch (e) {
    console.error('[gamificationStore] Laden fehlgeschlagen:', e);
    setState({ loading: false });
  }
}

// Wird nach awardPoints() aufgerufen — TopBar-Badges updaten sofort.
export async function refreshStore() {
  await loadGamificationStore({ force: true });
}

// Optimistisches Update nach awardPoints() — sofort ohne Netzwerk-Roundtrip.
// Danach folgt refreshStore() für den autoritativen Stand.
export function optimisticUpdate({ newTotal, newStreak, newLevel }) {
  if (newTotal == null) return;
  setState({
    points_total:   newTotal,
    current_streak: newStreak ?? state.current_streak,
    level:          newLevel  ?? calcLevel(newTotal),
    levelProgress:  calcLevelProgress(newTotal),
  });
}

// ─── React-Hook ──────────────────────────────────────────────

export function useGamificationStore() {
  const [snapshot, setSnapshot] = useState(state);

  useEffect(() => {
    const listener = (next) => setSnapshot(next);
    listeners.add(listener);
    setSnapshot(state);
    if (!state.loaded && !state.loading) {
      loadGamificationStore().catch(() => {});
    }
    return () => listeners.delete(listener);
  }, []);

  return snapshot;
}
