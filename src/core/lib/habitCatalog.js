// core/lib/habitCatalog.js
// EINE Quelle für alle Gewohnheits-Vorlagen: Kategorie, Häufigkeit und Ziel stehen
// pro Vorlage fest. Die Vorlagen-Auswahl im Modul (HABIT_LIBRARY in habUtils.js) und
// die Tour (HABIT_AREAS in habitTemplates.js) leiten sich beide hieraus ab.
//
// Ziel-Arten (goal.type):
//   'check' — Ja/Nein: einfach abhaken (unit null, target_count 1)
//   'count' — Zähler mit fester Einheit und Zielwert (unit + target_count)
//   'time'  — feste Uhrzeit (goal_time 'HH:MM', in `step` Minuten wählbar); abgehakt wird wie Ja/Nein
//
// Eine Kategorie pro Gewohnheit. Vorlagen sind gesperrt (Kategorie/Ziel-Art fest),
// nur Liter bei "Wasser trinken" und die Uhrzeiten lassen sich anpassen.

export const HABIT_CATEGORIES = [
  'Bewegung', 'Ernährung', 'Schlaf', 'Mental', 'Produktivität',
  'Lernen', 'Haushalt', 'Soziales', 'Sonstiges',
];

// Einheiten für Zähler (eigene Gewohnheiten und Vorlagen)
export const HABIT_UNITS = [
  'Min', 'Std', 'Gläser', 'L', 'Portionen', 'Mahlzeiten', 'Dinge', 'Seiten', 'Schritte', 'km', 'Sätze',
];

const CHECK = { type: 'check' };

export const HABIT_CATALOG = [
  // Bewegung
  { name: '30 Min bewegen',              icon: '🏃', category: 'Bewegung',      frequency: 'daily',    time_slot: 'midday',  goal: CHECK },
  { name: 'Spazieren gehen',             icon: '🚶', category: 'Bewegung',      frequency: 'daily',    time_slot: 'midday',  goal: CHECK },
  { name: 'Sport / Gym',                 icon: '💪', category: 'Bewegung',      frequency: 'custom',   frequency_days: [0, 2, 4], time_slot: 'midday', goal: CHECK },
  { name: 'Dehnen & Stretching',         icon: '🧘', category: 'Bewegung',      frequency: 'daily',    time_slot: 'morning', goal: CHECK },
  { name: 'Treppe statt Aufzug',         icon: '🪜', category: 'Bewegung',      frequency: 'weekdays', time_slot: 'anytime', goal: CHECK },
  // Ernährung
  { name: 'Wasser trinken',              icon: '💧', category: 'Ernährung',     frequency: 'daily',    time_slot: 'anytime', goal: { type: 'count', unit: 'L', target: 2 } },
  { name: 'Gemüse essen',                icon: '🥦', category: 'Ernährung',     frequency: 'daily',    time_slot: 'anytime', goal: CHECK },
  { name: 'Obst essen',                  icon: '🍎', category: 'Ernährung',     frequency: 'daily',    time_slot: 'anytime', goal: CHECK },
  { name: 'Kein Zucker',                 icon: '🚫', category: 'Ernährung',     frequency: 'daily',    time_slot: 'anytime', goal: CHECK },
  { name: 'Zu Hause kochen',             icon: '🍳', category: 'Ernährung',     frequency: 'daily',    time_slot: 'midday',  goal: CHECK },
  // Schlaf
  { name: 'Vor 23 Uhr ins Bett',         icon: '😴', category: 'Schlaf',        frequency: 'daily',    time_slot: 'evening', goal: CHECK },
  { name: 'Kein Handy vor dem Schlafen', icon: '📵', category: 'Schlaf',        frequency: 'daily',    time_slot: 'evening', goal: CHECK },
  { name: 'Feste Aufstehzeit',           icon: '⏰', category: 'Schlaf',        frequency: 'daily',    time_slot: 'morning', goal: { type: 'time', step: 10, time: '06:30' } },
  { name: 'Kein Koffein nach 14 Uhr',    icon: '☕', category: 'Schlaf',        frequency: 'daily',    time_slot: 'anytime', goal: { type: 'time', step: 30, time: '14:00' } },
  // Mental
  { name: 'Meditieren',                  icon: '🧠', category: 'Mental',        frequency: 'daily',    time_slot: 'morning', goal: CHECK },
  { name: 'Atemübungen',                 icon: '🌬️', category: 'Mental',       frequency: 'daily',    time_slot: 'anytime', goal: CHECK },
  { name: 'Dankbarkeit notieren',        icon: '🙏', category: 'Mental',        frequency: 'daily',    time_slot: 'evening', goal: CHECK },
  { name: 'Journaling',                  icon: '📓', category: 'Mental',        frequency: 'daily',    time_slot: 'evening', goal: CHECK },
  { name: 'Digitale Pause',              icon: '🌿', category: 'Mental',        frequency: 'daily',    time_slot: 'evening', goal: CHECK },
  // Produktivität
  { name: 'Tagesplanung machen',         icon: '📋', category: 'Produktivität', frequency: 'weekdays', time_slot: 'morning', goal: CHECK },
  { name: 'Kein Handy morgens',          icon: '📱', category: 'Produktivität', frequency: 'daily',    time_slot: 'morning', goal: CHECK },
  { name: 'Deep-Work-Block',             icon: '🎯', category: 'Produktivität', frequency: 'weekdays', time_slot: 'morning', goal: CHECK },
  { name: 'Abend-Review',                icon: '✅', category: 'Produktivität', frequency: 'daily',    time_slot: 'evening', goal: CHECK },
  { name: 'Post/Mails checken',          icon: '📬', category: 'Produktivität', frequency: 'weekdays', time_slot: 'anytime', goal: CHECK },
  // Lernen
  { name: 'Lesen',                       icon: '📚', category: 'Lernen',        frequency: 'daily',    time_slot: 'evening', goal: CHECK },
  // Haushalt
  { name: 'Bett machen',                 icon: '🛏️', category: 'Haushalt',     frequency: 'daily',    time_slot: 'morning', goal: CHECK },
  { name: 'Pflanzen gießen',             icon: '🌱', category: 'Haushalt',      frequency: 'custom',   frequency_days: [0, 3], time_slot: 'anytime', goal: CHECK },
];

// ─── Zugriff ──────────────────────────────────────────────

const norm = (s) => String(s ?? '').trim().toLowerCase();

/** Katalog-Eintrag zu einem Namen (oder null → eigene Gewohnheit). */
export function catalogEntryByName(name) {
  const n = norm(name);
  return HABIT_CATALOG.find((e) => norm(e.name) === n) ?? null;
}

/** Katalog-Eintrag → Felder, die saveHabit()/das Formular erwarten. */
export function catalogToHabit(e) {
  const g = e.goal;
  return {
    name:           e.name,
    icon:           e.icon,
    category:       e.category,
    categories:     [e.category],
    frequency:      e.frequency,
    ...(e.frequency === 'custom' ? { frequency_days: e.frequency_days } : {}),
    time_slot:      e.time_slot ?? 'anytime',
    target_count:   g.type === 'count' ? g.target : 1,
    unit:           g.type === 'count' ? g.unit : null,
    goal_time:      g.type === 'time' ? g.time : null,
  };
}

/** Art des Ziels einer Gewohnheit: 'time' | 'count' | 'check'. */
export function goalKind(h) {
  if (h.goal_time) return 'time';
  if (h.unit)      return 'count';
  return 'check';
}

/** Schrittweite der Uhrzeit in Minuten (Vorlage legt sie fest, sonst 10). */
export function timeStepFor(h) {
  return catalogEntryByName(h?.name)?.goal?.step ?? 10;
}

/** Schrittweite des Zählers: Liter in halben Litern, sonst 1. */
export function qtyStep(unit) {
  return unit === 'L' ? 0.5 : 1;
}

/** 2 → "2", 0.5 → "0,5" */
export function formatQty(n) {
  return String(Number(n)).replace('.', ',');
}

/** Uhrzeit 'HH:MM' um delta Minuten verschieben (über 24 h herum). */
export function shiftTime(hhmm, deltaMin) {
  const [h, m] = (hhmm || '07:00').split(':').map(Number);
  const total = (((h * 60 + m + deltaMin) % 1440) + 1440) % 1440;
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

/** Kurztext zum Ziel: "06:30 Uhr", "2 L" oder '' bei Ja/Nein. */
export function goalText(h) {
  if (h.goal_time) return `${h.goal_time} Uhr`;
  if (h.unit)      return `${formatQty(h.target_count ?? 1)} ${h.unit}`;
  return '';
}
