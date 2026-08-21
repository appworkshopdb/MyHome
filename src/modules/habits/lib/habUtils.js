// modules/habits/lib/habUtils.js
// Berechnungen für Streaks, Completion-Rates, Heatmaps, Badges

// ─── Datumshelfer ─────────────────────────────────────────

export function toDateStr(date) {
  if (typeof date === 'string') return date;
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function today() {
  return toDateStr(new Date());
}

/** Gibt alle Datumsstrings zwischen from und to zurück (inklusiv) */
export function dateRange(from, to) {
  const dates = [];
  const cur = new Date(from);
  const end = new Date(to);
  while (cur <= end) {
    dates.push(toDateStr(cur));
    cur.setDate(cur.getDate() + 1);
  }
  return dates;
}

/** Wochentag (0=Mo, 6=So) — normalisiert auf Montag-Basis */
export function weekdayMon(dateStr) {
  const d = new Date(dateStr);
  return (d.getDay() + 6) % 7; // Mo=0 ... So=6
}

// ─── Sollte Habit an diesem Datum aktiv sein? ────────────

/**
 * Gibt true zurück, wenn ein Habit an einem gegebenen Datum
 * laut seiner frequency-Regel "fällig" ist.
 */
export function isDueOn(habit, dateStr) {
  if (!habit.active) return false;
  if (habit.deleted_at) return false;
  // Nur ab Erstellungsdatum
  if (dateStr < toDateStr(new Date(habit.created_at))) return false;

  const wd = weekdayMon(dateStr); // 0=Mo ... 6=So

  if (habit.frequency === 'daily') return true;
  if (habit.frequency === 'weekdays') return wd < 5; // Mo–Fr
  if (habit.frequency === 'custom' && Array.isArray(habit.frequency_days)) {
    return habit.frequency_days.includes(wd);
  }
  return true;
}

// ─── Check-in-Status für einen Habit an einem Datum ───────

/**
 * Gibt den Entry für (habitId, dateStr) aus einem vorgeladenen Entry-Array zurück.
 */
export function getEntry(entries, habitId, dateStr) {
  return entries.find(
    (e) => e.habit_id === habitId && e.logged_on === dateStr && !e.deleted_at
  ) ?? null;
}

export function isDone(entries, habitId, dateStr, targetCount = 1) {
  const entry = getEntry(entries, habitId, dateStr);
  if (!entry) return false;
  return entry.count >= targetCount;
}

// ─── Streak-Berechnung ────────────────────────────────────

/**
 * Berechnet den aktuellen Streak (aufeinanderfolgende Tage bis heute/gestern).
 * Berücksichtigt "Never miss twice": ein einzelner Fehltag bricht den Streak
 * nicht, WENN davor und danach erledigt — wir implementieren das als:
 * ein Fehltag wird ignoriert, zwei aufeinander folgende Fehltage → Ende.
 */
export function calcStreak(habit, entries) {
  const todayStr = today();
  const entrySet = new Set(
    entries
      .filter((e) => e.habit_id === habit.id && !e.deleted_at)
      .map((e) => e.logged_on)
  );

  let streak = 0;
  let missedOnce = false;
  const cur = new Date(todayStr);

  // Maximal 365 Tage zurück
  for (let i = 0; i < 365; i++) {
    const dateStr = toDateStr(cur);
    const due = isDueOn(habit, dateStr);

    if (due) {
      if (entrySet.has(dateStr)) {
        streak++;
        missedOnce = false;
      } else {
        // Heute noch nicht erledigt → noch offen, nicht brechen
        if (i === 0) {
          cur.setDate(cur.getDate() - 1);
          continue;
        }
        if (!missedOnce) {
          missedOnce = true; // einen Fehltag tolerieren
        } else {
          break; // zwei Fehltage → Streak Ende
        }
      }
    }
    cur.setDate(cur.getDate() - 1);
  }
  return streak;
}

/**
 * Längster Streak aller Zeiten für diesen Habit.
 */
export function calcLongestStreak(habit, entries) {
  const entrySet = new Set(
    entries
      .filter((e) => e.habit_id === habit.id && !e.deleted_at)
      .map((e) => e.logged_on)
  );

  if (entrySet.size === 0) return 0;

  // Alle Daten ab Erstellungstag bis heute
  const startStr = toDateStr(new Date(habit.created_at));
  const allDates = dateRange(startStr, today()).filter((d) =>
    isDueOn(habit, d)
  );

  let longest = 0;
  let current = 0;

  for (const d of allDates) {
    if (entrySet.has(d)) {
      current++;
      if (current > longest) longest = current;
    } else {
      current = 0;
    }
  }
  return longest;
}

// ─── Completion-Rate ───────────────────────────────────────

/**
 * Completion-Rate (0–1) für einen Habit in einem Zeitraum.
 */
export function completionRate(habit, entries, from, to) {
  const dueDates = dateRange(from, to).filter((d) => isDueOn(habit, d));
  if (dueDates.length === 0) return 0;

  const done = dueDates.filter((d) =>
    isDone(entries, habit.id, d, habit.target_count)
  ).length;

  return done / dueDates.length;
}

/**
 * Completion-Rate für alle Habits zusammen (Heute-Übersicht).
 */
export function todayCompletionRate(habits, entries) {
  const t = today();
  const due = habits.filter((h) => isDueOn(h, t));
  if (due.length === 0) return 0;
  const done = due.filter((h) => isDone(entries, h.id, t, h.target_count)).length;
  return done / due.length;
}

// ─── Heatmap-Daten ────────────────────────────────────────

/**
 * Gibt für jedes Datum im Jahr ein Objekt { date, total, done } zurück.
 * `total` = Anzahl fälliger Habits, `done` = Anzahl erledigter Habits.
 * Intensity 0–4 für Heatmap-Farbe.
 */
export function buildHeatmap(habits, entries, year) {
  const from = `${year}-01-01`;
  const to   = `${year}-12-31`;
  const allDates = dateRange(from, to);

  return allDates.map((dateStr) => {
    const dueHabits = habits.filter((h) => isDueOn(h, dateStr));
    const doneCount = dueHabits.filter((h) =>
      isDone(entries, h.id, dateStr, h.target_count)
    ).length;
    const total = dueHabits.length;

    let intensity = 0;
    if (total > 0) {
      const ratio = doneCount / total;
      if (ratio > 0)   intensity = 1;
      if (ratio >= 0.5) intensity = 2;
      if (ratio >= 0.75) intensity = 3;
      if (ratio >= 1)   intensity = 4;
    }

    return { date: dateStr, total, done: doneCount, intensity };
  });
}

// ─── Badges ───────────────────────────────────────────────

export const BADGES = [
  { id: 'first_checkin',   label: 'Erster Schritt',    desc: 'Erste Gewohnheit abgehakt',         icon: '🌱', check: (s) => s.totalCheckins >= 1 },
  { id: 'week_1',          label: '7 Tage am Stück',   desc: 'Streak von 7 Tagen erreicht',       icon: '🔥', check: (s) => s.longestStreak >= 7 },
  { id: 'week_3',          label: '21 Tage',           desc: 'Streak von 21 Tagen erreicht',      icon: '⚡', check: (s) => s.longestStreak >= 21 },
  { id: 'month_1',         label: '1 Monat',           desc: '30 Tage Streak',                    icon: '💎', check: (s) => s.longestStreak >= 30 },
  { id: 'month_2',         label: '66 Tage',           desc: 'Wissenschaftliche Habit-Marke',     icon: '🏆', check: (s) => s.longestStreak >= 66 },
  { id: 'habits_3',        label: '3 Gewohnheiten',    desc: '3 aktive Habits gleichzeitig',      icon: '🎯', check: (s) => s.activeHabits >= 3 },
  { id: 'habits_5',        label: '5 Gewohnheiten',    desc: '5 aktive Habits',                   icon: '🌟', check: (s) => s.activeHabits >= 5 },
  { id: 'checkins_50',     label: '50 Check-ins',      desc: '50 Mal abgehakt',                   icon: '✅', check: (s) => s.totalCheckins >= 50 },
  { id: 'checkins_100',    label: '100 Check-ins',     desc: '100 Mal abgehakt',                  icon: '💯', check: (s) => s.totalCheckins >= 100 },
  { id: 'perfect_week',    label: 'Perfekte Woche',    desc: 'Alle Habits eine Woche lang',       icon: '🌈', check: (s) => s.perfectWeeks >= 1 },
  { id: 'perfect_month',   label: 'Perfekter Monat',   desc: 'Alle Habits einen Monat lang',      icon: '👑', check: (s) => s.perfectMonths >= 1 },
  { id: 'early_bird',      label: 'Früher Vogel',      desc: '10 Tage vor 8 Uhr abgehakt',       icon: '🌅', check: (s) => s.earlyCheckins >= 10 },
];

export function calcStats(habits, entries) {
  const activeHabits = habits.filter((h) => h.active && !h.deleted_at).length;
  const totalCheckins = entries.filter((e) => !e.deleted_at).length;

  // Längster Streak über alle Habits
  const longestStreak = Math.max(
    0,
    ...habits.map((h) => calcLongestStreak(h, entries))
  );

  // Perfekte Wochen (alle Habits an allen 5 Werktagen erledigt)
  let perfectWeeks = 0;
  let perfectMonths = 0;
  // Vereinfachung: letzte 52 Wochen prüfen
  const todayStr = today();
  const cur = new Date(todayStr);
  // Zum letzten Montag
  cur.setDate(cur.getDate() - ((cur.getDay() + 6) % 7));
  for (let w = 0; w < 52; w++) {
    const weekStart = toDateStr(cur);
    const weekEnd   = toDateStr(new Date(cur.getTime() + 6 * 86400000));
    const weekDates = dateRange(weekStart, weekEnd);
    const allPerfect = weekDates.every((d) => {
      const due = habits.filter((h) => isDueOn(h, d));
      return due.length === 0 || due.every((h) => isDone(entries, h.id, d, h.target_count));
    });
    if (allPerfect && weekDates.some((d) => d <= todayStr)) perfectWeeks++;
    cur.setDate(cur.getDate() - 7);
  }

  const earlyCheckins = 0; // Keine Tageszeit in DB gespeichert — für spätere Erweiterung

  return { activeHabits, totalCheckins, longestStreak, perfectWeeks, perfectMonths, earlyCheckins };
}

export function getEarnedBadges(habits, entries) {
  const stats = calcStats(habits, entries);
  return BADGES.filter((b) => b.check(stats));
}

// ─── Bibliothek (Vorlagen) ────────────────────────────────

export const HABIT_LIBRARY = [
  // Gesundheit & Bewegung
  { name: '30 Min bewegen',      category: 'Bewegung',      icon: '🏃', frequency: 'daily',    target_count: 1, unit: null },
  { name: 'Spazieren gehen',     category: 'Bewegung',      icon: '🚶', frequency: 'daily',    target_count: 1, unit: null },
  { name: 'Sport / Gym',         category: 'Bewegung',      icon: '💪', frequency: 'custom',   frequency_days: [0,2,4], target_count: 1, unit: null },
  { name: 'Dehnen & Stretching', category: 'Bewegung',      icon: '🧘', frequency: 'daily',    target_count: 1, unit: null },
  { name: 'Treppe statt Aufzug', category: 'Bewegung',      icon: '🪜', frequency: 'weekdays', target_count: 1, unit: null },
  // Ernährung
  { name: 'Wasser trinken',      category: 'Ernährung',     icon: '💧', frequency: 'daily',    target_count: 8, unit: 'Gläser' },
  { name: 'Gemüse essen',        category: 'Ernährung',     icon: '🥦', frequency: 'daily',    target_count: 1, unit: null },
  { name: 'Kein Zucker',         category: 'Ernährung',     icon: '🚫', frequency: 'daily',    target_count: 1, unit: null },
  { name: 'Zu Hause kochen',     category: 'Ernährung',     icon: '🍳', frequency: 'daily',    target_count: 1, unit: null },
  // Schlaf
  { name: 'Vor 23 Uhr ins Bett', category: 'Schlaf',        icon: '😴', frequency: 'daily',    target_count: 1, unit: null },
  { name: 'Kein Handy vor dem Schlafen', category: 'Schlaf', icon: '📵', frequency: 'daily',  target_count: 1, unit: null },
  { name: 'Feste Aufstehzeit',   category: 'Schlaf',        icon: '⏰', frequency: 'daily',    target_count: 1, unit: null },
  // Mental & Achtsamkeit
  { name: 'Meditieren',          category: 'Mental',        icon: '🧠', frequency: 'daily',    target_count: 1, unit: null },
  { name: 'Dankbarkeit notieren',category: 'Mental',        icon: '🙏', frequency: 'daily',    target_count: 1, unit: null },
  { name: 'Journaling',          category: 'Mental',        icon: '📓', frequency: 'daily',    target_count: 1, unit: null },
  { name: 'Digitale Pause',      category: 'Mental',        icon: '🌿', frequency: 'daily',    target_count: 1, unit: null },
  // Produktivität
  { name: 'Tagesplanung machen', category: 'Produktivität', icon: '📋', frequency: 'weekdays', target_count: 1, unit: null },
  { name: 'Kein Handy morgens',  category: 'Produktivität', icon: '📱', frequency: 'daily',    target_count: 1, unit: null },
  // Lernen
  { name: 'Lesen (10 Seiten)',   category: 'Lernen',        icon: '📚', frequency: 'daily',    target_count: 10, unit: 'Seiten' },
  // Haushalt
  { name: 'Bett machen',         category: 'Haushalt',      icon: '🛏️', frequency: 'daily',   target_count: 1, unit: null },
];

export const HABIT_CATEGORIES = [
  'Gesundheit', 'Bewegung', 'Schlaf', 'Ernährung',
  'Mental', 'Produktivität', 'Lernen', 'Soziales', 'Haushalt', 'Sonstiges',
];

export const HABIT_ICONS = [
  '⭐','🏃','🚶','💪','🧘','🛏️','💧','🥦','🍳','📚','📓',
  '🧠','🙏','🌿','📱','📵','⏰','📋','🔥','🎯','💎','🌱',
  '🎵','🎨','🌅','🏆','✅','🌈','⚡','🦷','🌞','💊','🧹',
];
