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

// Geldbetrag aus einem Eingabefeld → Zahl, bei ungültiger Eingabe NaN.
// "1.234,56" / "1234,56" / "12,5" / "12.5" / "1.000" (= 1000) / "1.234.567".
// Punkt + genau drei Ziffern gilt hier als Tausendertrenner, sonst als Dezimalpunkt
// (höchstens zwei Nachkommastellen). Alles andere ("1,2,3", "1.2.3", ",") ist ungültig.
const MONEY_THOUSANDS = /^[1-9]\d{0,2}(\.\d{3})+$/;
export function parseMoney(v) {
  const s = String(v ?? '').trim();
  if (!/\d/.test(s)) return NaN;
  if (s.includes(',')) {
    if (!/^([1-9]\d{0,2}(\.\d{3})+|\d*),\d*$/.test(s)) return NaN;
    return parseFloat(s.replace(/\./g, '').replace(',', '.')) || 0;
  }
  if (MONEY_THOUSANDS.test(s)) return parseFloat(s.replace(/\./g, ''));
  if (/^\d*\.?\d{0,2}$/.test(s) || /^\d+$/.test(s)) return parseFloat(s) || 0;
  return NaN;
}

// Kommazahl aus einem Eingabefeld ("38,15" / "38.15" / "1.234,56") → Zahl, sonst 0.
// Kommt ein Komma vor, sind Punkte Tausendertrenner ("1.234,56" → 1234.56);
// ohne Komma ist der Punkt das Dezimalzeichen ("38.15" → 38.15).
export function parseNum(v) {
  const s = String(v ?? '');
  const n = parseFloat(s.includes(',') ? s.replace(/\./g, '').replace(',', '.') : s);
  return Number.isNaN(n) ? 0 : n;
}
