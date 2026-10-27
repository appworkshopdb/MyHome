// core/lib/wizardDates.js
// Datums-Helfer der Eingabe-Wizards. Alles in LOKALER Zeit: new Date().toISOString()
// liefert das UTC-Datum — in Deutschland ist "heute" damit zwischen 0 und 1/2 Uhr
// noch der Vortag.

export const MONTHS_FULL = [
  'Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
  'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember',
];
const MONTHS_SHORT = ['Jan.', 'Feb.', 'März', 'Apr.', 'Mai', 'Juni', 'Juli', 'Aug.', 'Sept.', 'Okt.', 'Nov.', 'Dez.'];
const WEEKDAYS = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];

const pad = (n) => (n < 10 ? `0${n}` : String(n));

export function isoLocal(d) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function todayIso() {
  return isoLocal(new Date());
}

export function parseIso(iso) {
  const [y, m, d] = String(iso).split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

// "Do., 15. Okt. 2026"
export function fmtDate(iso) {
  if (!iso) return '';
  const d = parseIso(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${WEEKDAYS[d.getDay()]}., ${d.getDate()}. ${MONTHS_SHORT[d.getMonth()]} ${d.getFullYear()}`;
}

// Kommazahl aus einem Eingabefeld ("38,15" / "38.15") → Zahl, sonst 0
export function parseNum(v) {
  const n = parseFloat(String(v ?? '').replace(',', '.'));
  return Number.isNaN(n) ? 0 : n;
}
