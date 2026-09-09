// core/lib/gamificationStore.js
// Geteilter State für Gamification-Badges in der TopBar.
//
// Exakt dasselbe Subscribe-Pattern wie habitsStore.js:
//  - Kein React-Context
//  - useGamificationStore() in jeder Komponente → rendert neu bei Änderung
//  - awardPoints() aus gamificationData.js ruft refreshStore() auf,
//    damit die TopBar-Badges live updaten ohne Reload.

import { useState, useEffect } from 'react';
import { getGamificationStatus, calcLevel, calcLevelProgress } from './gamificationData.js';

// ─── Interner State ───────────────────────────────────────────

let state = {
  points_total:     0,
  current_streak:   0,
  longest_streak:   0,
  last_active_date: null,
  level:            1,
  levelProgress:    null,
  loaded:           false,
  loading:          false,
};

const listeners = new Set();

function setState(patch) {
  state = { ...state, ...patch };
  listeners.forEach((fn) => fn(state));
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
