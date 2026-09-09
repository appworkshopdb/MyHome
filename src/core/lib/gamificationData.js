// core/lib/gamificationData.js
// DB-Zugriff für das Vogel/Nest-Gamification-System.
//
// Architektur-Regel: Nur dieses File kennt die DB-Struktur —
// alle anderen Dateien rufen awardPoints() auf und wissen nichts
// über Tabellen, Upserts oder Streak-Logik.
//
// ANTI-CHEAT-Garantien dieser Datei:
//  1. Unique-Index in gamification_events verhindert doppeltes Vergeben
//     für (owner_id, action_type, entity_id, event_date).
//     → 409-Konflikt bei doppeltem Insert = Silently ignoriert, kein Fehler.
//  2. Tagesobergrenzen pro Aktionstyp werden DB-seitig gezählt
//     (SELECT COUNT(*) gegen die DB), nicht nur im Frontend.
//  3. event_date ist immer das HEUTIGE Berlin-Datum — niemals rückwirkend.

import { getSupabase } from './supabaseClient.js';

// ─── Konstanten (Gamification.md, abgestimmt) ─────────────────

export const POINTS = {
  habit_check:           5,
  todo_check:            5,
  workout_done:          15,
  shopping_done:         10,
  habit_all_done_bonus:  10,
};

export const DAILY_CAP = {
  habit_check:           8,
  todo_check:            8,
  workout_done:          3,
  shopping_done:         3,
  habit_all_done_bonus:  1,
};

// Level-Schwellen: Level 1 = 0 Punkte, Level 2 = 50, …
const LEVEL_THRESHOLDS = [0, 50, 150, 300, 500, 800, 1200, 1700, 2300, 3000, 4000, 5500, 7500, 10000];

export function calcLevel(pointsTotal) {
  let level = 1;
  for (let i = 0; i < LEVEL_THRESHOLDS.length; i++) {
    if (pointsTotal >= LEVEL_THRESHOLDS[i]) level = i + 1;
    else break;
  }
  return level;
}

// Fortschritt zum nächsten Level (0–1)
export function calcLevelProgress(pointsTotal) {
  const level = calcLevel(pointsTotal);
  const idx   = level - 1;
  if (idx >= LEVEL_THRESHOLDS.length - 1) {
    return { level, progress: 1, current: pointsTotal, needed: 0, next: null, nextThreshold: null };
  }
  const current = pointsTotal - LEVEL_THRESHOLDS[idx];
  const needed  = LEVEL_THRESHOLDS[idx + 1] - LEVEL_THRESHOLDS[idx];
  return {
    level,
    progress:      current / needed,
    current,
    needed,
    next:          idx + 2,
    nextThreshold: LEVEL_THRESHOLDS[idx + 1],
  };
}

// ─── Berlin-Datum ─────────────────────────────────────────────
export function berlinDateStr() {
  return new Date().toLocaleDateString('de-DE', {
    timeZone: 'Europe/Berlin',
    year:  'numeric',
    month: '2-digit',
    day:   '2-digit',
  }).split('.').reverse().join('-'); // DD.MM.YYYY → YYYY-MM-DD
}

// ─── owner_id aus Token ──────────────────────────────────────
function getOwnerId() {
  try {
    const token = JSON.parse(localStorage.getItem('zuhause_session') || '{}').access_token;
    if (!token) throw new Error('kein Token');
    const payload = JSON.parse(atob(token.split('.')[1]));
    return payload.sub;
  } catch {
    throw new Error('[gamificationData] Nicht eingeloggt');
  }
}

// ─── Status laden ─────────────────────────────────────────────

export async function getGamificationStatus() {
  const sb       = getSupabase();
  const owner_id = getOwnerId();

  const { data, error } = await sb
    .from('gamification_status')
    .select('*')
    .eq('owner_id', owner_id)
    .maybeSingle();

  if (error) throw error;

  if (!data) {
    return {
      owner_id,
      points_total:     0,
      current_streak:   0,
      longest_streak:   0,
      last_active_date: null,
    };
  }
  return data;
}

// ─── Punkte vergeben ─────────────────────────────────────────
//
// Rückgabe: { awarded, points, newTotal, newLevel, newStreak }
// awarded = false → Tagesobergrenze oder Dedup → kein Fehler werfen.
//
// entity_id: eindeutige ID des Eintrags (habit.id, todo.id …).
//   Für 'habit_all_done_bonus': 'bonus_' + berlinDateStr()

export async function awardPoints(actionType, entityId) {
  const sb       = getSupabase();
  const owner_id = getOwnerId();
  const today    = berlinDateStr();
  const points   = POINTS[actionType];
  const cap      = DAILY_CAP[actionType];

  if (!points) {
    console.warn('[gamificationData] Unbekannter actionType:', actionType);
    return { awarded: false, points: 0, newTotal: null, newLevel: null };
  }

  // Anti-Cheat: Tagesobergrenze DB-seitig prüfen
  const { count, error: countErr } = await sb
    .from('gamification_events')
    .select('id', { count: 'exact', head: true })
    .eq('owner_id', owner_id)
    .eq('action_type', actionType)
    .eq('event_date', today);

  if (countErr) throw countErr;
  if (count >= cap) {
    return { awarded: false, points: 0, newTotal: null, newLevel: null };
  }

  // Anti-Cheat: Unique-Index-Dedup via Insert
  const { error: insertErr } = await sb
    .from('gamification_events')
    .insert({ owner_id, action_type: actionType, entity_id: String(entityId), event_date: today, points });

  if (insertErr) {
    // 23505 = unique_violation → heute schon gewertet
    if (insertErr.code === '23505') {
      return { awarded: false, points: 0, newTotal: null, newLevel: null };
    }
    throw insertErr;
  }

  // Status aktualisieren
  const current  = await getGamificationStatus();
  const newTotal = (current.points_total ?? 0) + points;

  // Streak in Europe/Berlin
  const lastDate    = current.last_active_date;
  let newStreak     = current.current_streak ?? 0;
  let newLongest    = current.longest_streak ?? 0;

  const yest = new Date();
  yest.setDate(yest.getDate() - 1);
  const yesterdayStr = yest.toLocaleDateString('de-DE', {
    timeZone: 'Europe/Berlin', year: 'numeric', month: '2-digit', day: '2-digit',
  }).split('.').reverse().join('-');

  if (lastDate === today) {
    // Bereits heute aktiv — kein weiterer Streak-Schritt
  } else if (lastDate === yesterdayStr) {
    newStreak += 1;
  } else {
    newStreak = 1;
  }
  if (newStreak > newLongest) newLongest = newStreak;

  const { error: upsertErr } = await sb
    .from('gamification_status')
    .upsert({
      owner_id,
      points_total:     newTotal,
      current_streak:   newStreak,
      longest_streak:   newLongest,
      last_active_date: today,
    }, { onConflict: 'owner_id' });

  if (upsertErr) throw upsertErr;

  return { awarded: true, points, newTotal, newLevel: calcLevel(newTotal), newStreak };
}
