// Vorlagen für die ersten Gewohnheiten (HabitTemplatePicker.jsx, Tour „Gewohnheiten“).
// Übernommen aus dem früheren Gewohnheiten-Einrichtungs-Wizard. Jede Vorlage hat
// genau die Felder, die saveHabit() (modules/habits/lib/habData.js) erwartet.
// frequency_days: 0 = Montag … 6 = Sonntag.

export const HABIT_AREAS = [
  {
    key: 'gesundheit', label: 'Gesundheit & Bewegung', icon: '🏃',
    desc: 'Mehr Bewegung, Sport und körperliches Wohlbefinden',
    habits: [
      { name: '30 Min bewegen', icon: '🏃', category: 'Bewegung', frequency: 'daily', target_count: 1, unit: null },
      { name: 'Spazieren gehen', icon: '🚶', category: 'Bewegung', frequency: 'daily', target_count: 1, unit: null },
      { name: 'Sport / Gym', icon: '💪', category: 'Bewegung', frequency: 'custom', frequency_days: [0, 2, 4], target_count: 1, unit: null },
      { name: 'Dehnen & Stretching', icon: '🧘', category: 'Bewegung', frequency: 'daily', target_count: 1, unit: null },
      { name: 'Wasser trinken', icon: '💧', category: 'Ernährung', frequency: 'daily', target_count: 2, unit: 'L' },
    ],
  },
  {
    key: 'schlaf', label: 'Schlaf & Erholung', icon: '😴',
    desc: 'Besser schlafen, ausgeruhter aufwachen',
    habits: [
      { name: 'Vor 23 Uhr ins Bett', icon: '😴', category: 'Schlaf', frequency: 'daily', target_count: 1, unit: null },
      { name: 'Kein Handy vor dem Schlafen', icon: '📵', category: 'Schlaf', frequency: 'daily', target_count: 1, unit: null },
      { name: 'Feste Aufstehzeit', icon: '⏰', category: 'Schlaf', frequency: 'daily', target_count: 1, unit: null },
      { name: 'Digitale Pause am Abend', icon: '🌿', category: 'Mental', frequency: 'daily', target_count: 30, unit: 'Min' },
      { name: 'Kein Koffein nach 14 Uhr', icon: '☕', category: 'Schlaf', frequency: 'daily', target_count: 1, unit: null },
    ],
  },
  {
    key: 'mental', label: 'Mental & Achtsamkeit', icon: '🧠',
    desc: 'Mehr Ruhe, Fokus und innere Balance',
    habits: [
      { name: 'Meditieren', icon: '🧠', category: 'Mental', frequency: 'daily', target_count: 10, unit: 'Min' },
      { name: 'Dankbarkeit notieren', icon: '🙏', category: 'Mental', frequency: 'daily', target_count: 3, unit: 'Ding' },
      { name: 'Journaling', icon: '📓', category: 'Mental', frequency: 'daily', target_count: 1, unit: null },
      { name: 'Digitale Pause', icon: '🌿', category: 'Mental', frequency: 'daily', target_count: 30, unit: 'Min' },
      { name: 'Atemübungen', icon: '🌬️', category: 'Mental', frequency: 'daily', target_count: 1, unit: null },
    ],
  },
  {
    key: 'produktivitaet', label: 'Produktivität & Lernen', icon: '📋',
    desc: 'Mehr schaffen, fokussierter arbeiten, dazulernen',
    habits: [
      { name: 'Tagesplanung machen', icon: '📋', category: 'Produktivität', frequency: 'weekdays', target_count: 1, unit: null },
      { name: 'Kein Handy morgens', icon: '📱', category: 'Produktivität', frequency: 'daily', target_count: 1, unit: null },
      { name: 'Lesen', icon: '📚', category: 'Lernen', frequency: 'daily', target_count: 1, unit: null },
      { name: 'Deep-Work-Block', icon: '🎯', category: 'Produktivität', frequency: 'weekdays', target_count: 1, unit: null },
      { name: 'Abend-Review', icon: '✅', category: 'Produktivität', frequency: 'daily', target_count: 1, unit: null },
    ],
  },
  {
    key: 'ernaehrung', label: 'Ernährung', icon: '🥦',
    desc: 'Gesünder essen, bewusster trinken',
    habits: [
      { name: 'Wasser trinken', icon: '💧', category: 'Ernährung', frequency: 'daily', target_count: 8, unit: 'Gläser' },
      { name: 'Gemüse essen', icon: '🥦', category: 'Ernährung', frequency: 'daily', target_count: 1, unit: null },
      { name: 'Kein Zucker', icon: '🚫', category: 'Ernährung', frequency: 'daily', target_count: 1, unit: null },
      { name: 'Zu Hause kochen', icon: '🍳', category: 'Ernährung', frequency: 'daily', target_count: 1, unit: null },
      { name: 'Achtsam essen', icon: '🍽️', category: 'Ernährung', frequency: 'daily', target_count: 1, unit: null },
    ],
  },
  {
    key: 'alltag', label: 'Haushalt & Alltag', icon: '🏠',
    desc: 'Ordnung, Routinen und kleine tägliche Aufgaben',
    habits: [
      { name: 'Bett machen', icon: '🛏️', category: 'Haushalt', frequency: 'daily', target_count: 1, unit: null },
      { name: 'Küche abends aufräumen', icon: '🧹', category: 'Haushalt', frequency: 'daily', target_count: 1, unit: null },
      { name: '10 Min aufräumen', icon: '🏠', category: 'Haushalt', frequency: 'daily', target_count: 1, unit: null },
      { name: 'Pflanzen gießen', icon: '🌱', category: 'Haushalt', frequency: 'custom', frequency_days: [0, 3], target_count: 1, unit: null },
      { name: 'Post/Mails checken', icon: '📬', category: 'Alltag', frequency: 'weekdays', target_count: 1, unit: null },
    ],
  },
];

export const MAX_TEMPLATES = 3;

const DAY_SHORT = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];

// „Täglich“ · „Mo – Fr“ · „Mo, Mi, Fr“ (+ „· 2 L“ bei Mengenzielen)
export function habitMeta(h) {
  let freq = '';
  if (h.frequency === 'daily') freq = 'Täglich';
  else if (h.frequency === 'weekdays') freq = 'Mo – Fr';
  else if (h.frequency === 'custom') freq = (h.frequency_days || []).map((d) => DAY_SHORT[d]).join(', ');
  return h.target_count > 1 && h.unit ? `${freq} · ${h.target_count} ${h.unit}` : freq;
}
