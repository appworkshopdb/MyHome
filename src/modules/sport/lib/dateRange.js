import { startOfWeek } from './stats';

// Grenzen als reine ISO-Datumsstrings (YYYY-MM-DD) statt Date-Objekten
// — occurred_on ist ohnehin so gespeichert, und String-Vergleich von
// ISO-Daten sortiert korrekt chronologisch. Vermeidet jede
// Zeitzonen-Falle, die beim Rechnen mit Date-Objekten sonst entsteht.
const pad = (n) => String(n).padStart(2, '0');
const toIso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

const MONTHS = [
  'Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
  'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember',
];

function formatShortRange(start, end) {
  const fmt = (d) => d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' });
  const sameYear = start.getFullYear() === end.getFullYear();
  return sameYear
    ? `${fmt(start)}–${fmt(end)}`
    : `${fmt(start)}.${start.getFullYear()}–${fmt(end)}.${end.getFullYear()}`;
}

// offset zählt in ganzen Wochen/Monaten/Jahren von jetzt aus rückwärts
// (0 = aktuelle Periode, -1 = vorherige, ...) — dieselbe Idee wie die
// Monats-Navigation im Kalender-Tab.
export function weekRange(offset = 0) {
  const start = startOfWeek(new Date());
  start.setDate(start.getDate() + offset * 7);
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  return { startIso: toIso(start), endIso: toIso(end), label: formatShortRange(start, end) };
}

export function monthRange(offset = 0) {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth() + offset, 1);
  const end = new Date(start.getFullYear(), start.getMonth() + 1, 0);
  return { startIso: toIso(start), endIso: toIso(end), label: `${MONTHS[start.getMonth()]} ${start.getFullYear()}` };
}

export function yearRange(offset = 0) {
  const year = new Date().getFullYear() + offset;
  const start = new Date(year, 0, 1);
  const end = new Date(year, 11, 31);
  return { startIso: toIso(start), endIso: toIso(end), label: String(year) };
}

// Freier Zeitraum aus zwei Datumsfeldern. Gibt null zurück, wenn eins
// fehlt oder das Ende vor dem Start liegt — der Aufrufer zeigt dann
// einen Hinweis statt stiller Falschdarstellung.
export function customRange(startIso, endIso) {
  if (!startIso || !endIso || endIso < startIso) return null;
  const start = new Date(`${startIso}T00:00:00`);
  const end = new Date(`${endIso}T00:00:00`);
  return { startIso, endIso, label: formatShortRange(start, end) };
}

export function filterWorkoutsByRange(workouts, range) {
  if (!range) return [];
  return workouts.filter((w) => w.occurred_on >= range.startIso && w.occurred_on <= range.endIso);
}
