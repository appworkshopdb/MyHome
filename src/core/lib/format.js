// Bewusst in core/, nicht in modules/finance/lib/finance.js — der Hub
// darf laut Architektur-Regel nicht aus einem Modul importieren, auch
// nicht nur für eine Formatierungsfunktion.

export function formatEur(val) {
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(val || 0);
}

// ── Zahlen einheitlich deutsch (Redesign) ────────────────────────────────
// Statt toFixed(): toFixed liefert "78.4" und bei leeren Werten "NaN".
// Leere oder ungültige Werte zeigen überall dasselbe Zeichen: "–".
export const EMPTY = '–';
const NBSP = ' ';
const nfCache = new Map();
function nf(min, max) {
  const key = `${min}-${max}`;
  if (!nfCache.has(key)) nfCache.set(key, new Intl.NumberFormat('de-DE', { minimumFractionDigits: min, maximumFractionDigits: max }));
  return nfCache.get(key);
}
const valid = (v) => v !== null && v !== undefined && v !== '' && Number.isFinite(Number(v));

// formatNumber(1248.9) → "1.249"; formatNumber(78.4, 1) → "78,4"; formatNumber(78, 1) → "78"
// fixed: true hält die Nachkommastellen fest (formatNumber(78, 1, { fixed: true }) → "78,0").
export function formatNumber(value, decimals = 0, { fixed = false } = {}) {
  if (!valid(value)) return EMPTY;
  return nf(fixed ? decimals : 0, decimals).format(Number(value));
}

// formatUnit(78.4, 'kg', 1) → "78,4 kg" (geschütztes Leerzeichen, bricht nicht um)
export function formatUnit(value, unit, decimals = 1) {
  if (!valid(value)) return EMPTY;
  return `${formatNumber(value, decimals)}${NBSP}${unit}`;
}

// formatMoney(1248.9) → "1.248,90 €"; formatMoney(-6.6, { sign: true }) → "−6,60 €"
export function formatMoney(value, { sign = false, decimals = 2 } = {}) {
  if (!valid(value)) return EMPTY;
  const n = Number(value);
  const body = `${nf(decimals, decimals).format(Math.abs(n))}${NBSP}€`;
  if (n < 0) return `−${body}`;
  return sign && n > 0 ? `+${body}` : body;
}

// formatEstimate(540, 'kcal') → "≈ 540 kcal" (geschätzte Werte, z. B. aus Foto-Scans)
export function formatEstimate(value, unit, decimals = 0) {
  if (!valid(value)) return EMPTY;
  return `≈${NBSP}${formatUnit(value, unit, decimals)}`;
}

export function formatRelativeDate(isoDate) {
  const date = new Date(isoDate);
  const today = new Date();
  const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diffDays = Math.round((startOfDay(today) - startOfDay(date)) / 86400000);

  if (diffDays === 0) return 'Heute';
  if (diffDays === 1) return 'Gestern';
  if (diffDays > 1 && diffDays < 7) return `Vor ${diffDays} Tagen`;
  return date.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
}
