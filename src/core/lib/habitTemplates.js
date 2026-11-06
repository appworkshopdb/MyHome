// Vorlagen für die ersten Gewohnheiten (HabitTemplatePicker.jsx, Tour „Gewohnheiten“).
// Die Vorlagen selbst stehen in habitCatalog.js und haben genau die Felder, die
// saveHabit() (modules/habits/lib/habData.js) erwartet.
// frequency_days: 0 = Montag … 6 = Sonntag.

import { catalogEntryByName, catalogToHabit, goalText } from './habitCatalog';

// Die Tour gruppiert Katalog-Einträge nach Namen in fünf Bereiche.
// Kategorie und Ziel kommen aus habitCatalog.js, hier steht nur die Zuordnung.
const AREA_DEFS = [
  { key: 'gesundheit', label: 'Gesundheit & Bewegung', icon: '🏃',
    desc: 'Mehr Bewegung, Sport und körperliches Wohlbefinden',
    names: ['30 Min bewegen', 'Spazieren gehen', 'Sport / Gym', 'Dehnen & Stretching', 'Wasser trinken'] },
  { key: 'schlaf', label: 'Schlaf & Erholung', icon: '😴',
    desc: 'Besser schlafen, ausgeruhter aufwachen',
    names: ['Vor 23 Uhr ins Bett', 'Kein Handy vor dem Schlafen', 'Feste Aufstehzeit', 'Digitale Pause', 'Kein Koffein nach 14 Uhr'] },
  { key: 'mental', label: 'Mental & Achtsamkeit', icon: '🧠',
    desc: 'Mehr Ruhe, Fokus und innere Balance',
    names: ['Meditieren', 'Dankbarkeit notieren', 'Journaling', 'Digitale Pause', 'Atemübungen'] },
  { key: 'produktivitaet', label: 'Produktivität & Lernen', icon: '📋',
    desc: 'Mehr schaffen, fokussierter arbeiten, dazulernen',
    names: ['Tagesplanung machen', 'Kein Handy morgens', 'Lesen', 'Deep-Work-Block', 'Abend-Review'] },
  { key: 'ernaehrung', label: 'Ernährung', icon: '🥦',
    desc: 'Gesünder essen, bewusster trinken',
    names: ['Wasser trinken', 'Gemüse essen', 'Obst essen', 'Kein Zucker', 'Zu Hause kochen'] },
  { key: 'alltag', label: 'Haushalt & Alltag', icon: '🏠',
    desc: 'Ordnung, Routinen und kleine tägliche Aufgaben',
    names: ['Bett machen', 'Pflanzen gießen', 'Post/Mails checken'] },
];

export const HABIT_AREAS = AREA_DEFS.map(({ names, ...area }) => ({
  ...area,
  habits: names.map((n) => catalogToHabit(catalogEntryByName(n))),
}));

export const MAX_TEMPLATES = 3;

const DAY_SHORT = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];

// „Täglich“ · „Mo – Fr“ · „Mo, Mi, Fr“ (+ „· 2 L“ bzw. „· 06:30 Uhr“ bei Zielen)
export function habitMeta(h) {
  let freq = '';
  if (h.frequency === 'daily') freq = 'Täglich';
  else if (h.frequency === 'weekdays') freq = 'Mo – Fr';
  else if (h.frequency === 'custom') freq = (h.frequency_days || []).map((d) => DAY_SHORT[d]).join(', ');
  const goal = goalText(h);
  return goal ? `${freq} · ${goal}` : freq;
}
