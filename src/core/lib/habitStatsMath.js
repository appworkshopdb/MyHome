// core/lib/habitStatsMath.js
// Reine Rechenhelfer für Gewohnheiten-Rückblicke (Datum, Fälligkeit, Quote).
//
// Liegt in core/, weil sowohl die Statistik im Habits-Modul (StatsView) als
// auch der Wochen-/Monatsüberblick im Hub (core/lib/periodStats.js) dieselben Zahlen
// liefern müssen — und core darf nicht aus modules/ importieren. Das Habits-
// Modul importiert diese Funktionen (habUtils.js reicht sie durch).
//
// Alle Datumsstrings sind lokal (YYYY-MM-DD), nie toISOString().

// ─── Datumshelfer ─────────────────────────────────────────

export function toDateStr(date) {
  if (typeof date === 'string') return date;
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
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

// ─── Fälligkeit ───────────────────────────────────────────

/** Passt der Wochentag zur Häufigkeit des Habits? (ohne Aktiv-/Datums-Prüfung) */
export function matchesFrequency(habit, dateStr) {
  const wd = weekdayMon(dateStr); // 0=Mo ... 6=So

  if (habit.frequency === 'daily') return true;
  if (habit.frequency === 'weekdays') return wd < 5; // Mo–Fr
  if (habit.frequency === 'custom' && Array.isArray(habit.frequency_days)) {
    return habit.frequency_days.includes(wd);
  }
  return true;
}

/**
 * Letzter Tag, an dem ein Habit zählt — für die Statistik der Vergangenheit.
 *  - aktiv:      null (läuft bis heute)
 *  - gelöscht:   Löschtag
 *  - pausiert:   paused_at, sonst letzter Check-in, sonst Erstellungstag
 * Gibt einen Datumsstring oder null zurück.
 */
export function habitEndDate(habit, lastEntryDate) {
  if (habit.deleted_at) return toDateStr(new Date(habit.deleted_at));
  if (habit.active) return null;
  if (habit.paused_at) return toDateStr(new Date(habit.paused_at));
  return lastEntryDate ?? toDateStr(new Date(habit.created_at));
}

/**
 * Wie isDueOn, aber für Rückblicke: ignoriert den aktuellen Aktiv-/Gelöscht-
 * Status und zählt den Habit für alle Tage von created_at bis endDate.
 * So ändern Pausieren, Löschen oder Austauschen die Vergangenheit nicht.
 */
export function isDueHistoric(habit, dateStr, endDate) {
  if (dateStr < toDateStr(new Date(habit.created_at))) return false;
  if (endDate && dateStr > endDate) return false;
  return matchesFrequency(habit, dateStr);
}

// ─── Quote über Habits × Tage ─────────────────────────────

/** Index "habitId|datum" → count, aus den (nicht gelöschten) Einträgen. */
export function buildDoneIndex(entries) {
  const m = new Map();
  for (const e of entries) {
    if (e.deleted_at) continue;
    m.set(`${e.habit_id}|${e.logged_on}`, e.count ?? 1);
  }
  return m;
}

/** Letzter Tag, an dem jede Gewohnheit zählt (null = läuft noch). */
export function buildEndMap(habits, entries) {
  const lastEntry = new Map();
  for (const e of entries) {
    if (e.deleted_at) continue;
    const cur = lastEntry.get(e.habit_id);
    if (!cur || e.logged_on > cur) lastEntry.set(e.habit_id, e.logged_on);
  }
  const m = new Map();
  for (const h of habits) m.set(h.id, habitEndDate(h, lastEntry.get(h.id)));
  return m;
}

/** Zählt fällige und erledigte Einheiten über Habits × Tage. */
export function countHabitRange(habits, doneIdx, endMap, dates) {
  let due = 0;
  let done = 0;
  for (const d of dates) {
    for (const h of habits) {
      if (!isDueHistoric(h, d, endMap.get(h.id))) continue;
      due++;
      if ((doneIdx.get(`${h.id}|${d}`) ?? 0) >= (h.target_count ?? 1)) done++;
    }
  }
  return { due, done, rate: due > 0 ? done / due : null };
}
