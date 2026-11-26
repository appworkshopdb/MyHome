// modules/finance/lib/income.js
//
// Einnahmen als Eingänge: Einnahmen-Vorlagen (fin_fixtemplates, Kategorie fixeinnahmen)
// buchen NICHT mehr automatisch jeden Monat. Der Nutzer bestätigt den Eingang an dem Tag,
// an dem das Geld da ist; dabei entsteht eine normale Einnahme-Buchung (from_template,
// Monat und due_date = heute). Damit zählt der Eingang im Eingangsmonat (Auswertung, Hub).
//
//  - Fix       (Vorlage hat due_day): Bestätigen ab dem Tag im Monat, bis bestätigt.
//  - Unterschiedlich (kein due_day): Knopf immer sichtbar.
//  - Beides höchstens EINMAL je Kalendermonat und Quelle (kein zweites Bestätigen).
//
// "Verfügbar jetzt" = alle Eingänge bis heute − alles Bezahlte (monatsübergreifend).
// Reine Funktionen ohne React/Supabase.

import { templateAppliesTo, dueDateFor } from './finance.js';

const pad = (n) => String(n).padStart(2, '0');

export const isIncomeTemplate = (t) => t && t.category === 'fixeinnahmen';
export const incomeMode = (t) => (t.due_day ? 'fix' : 'varies');

export function parts(today) {
  const [y, m, d] = String(today).slice(0, 10).split('-').map(Number);
  return { y, m, d };
}

// Fälligkeitstag eines Postens (Posten ohne Datum gelten ab dem 1. ihres Monats)
export const dueOf = (e) => String(e.due_date || `${e.year}-${pad(e.month)}-01`).slice(0, 10);

// Bestätigung dieser Quelle im laufenden Kalendermonat (nicht gelöscht). Nur Posten mit
// received_on (Knopf "Eingang bestätigen") gelten als bestätigt; früher automatisch
// angelegte Einnahme-Posten nicht, sie zählen aber als Einnahme im Monat.
export function confirmedThisMonth(t, entries, today) {
  const ym = String(today).slice(0, 7);
  return entries.find((e) => e.from_template === t.id && !e.deleted_at && e.received_on && String(e.received_on).slice(0, 7) === ym) || null;
}

export function lastConfirmed(t, entries) {
  return entries
    .filter((e) => e.from_template === t.id && !e.deleted_at)
    .sort((a, b) => (dueOf(a) < dueOf(b) ? 1 : -1))[0] || null;
}

// Nächster erwarteter Eingang (nur bei Fix): diesen Monat, falls noch nicht bestätigt, sonst nächsten
export function expectedDate(t, entries, today) {
  if (incomeMode(t) !== 'fix') return null;
  const { y, m } = parts(today);
  const done = confirmedThisMonth(t, entries, today);
  const n = done ? (m === 12 ? { y: y + 1, m: 1 } : { y, m: m + 1 }) : { y, m };
  if (!templateAppliesTo(t, n.y, n.m)) return null;
  return dueDateFor(t.due_day, n.y, n.m);
}

// Zustand einer Einnahmequelle heute
//  'confirmed' bestätigt (Knopf aus), 'due' bestätigen möglich, 'waiting' (Fix) vor dem Tag, 'inactive' gilt diesen Monat nicht
export function incomeState(t, entries, today) {
  const { y, m } = parts(today);
  const done = confirmedThisMonth(t, entries, today);
  const next = expectedDate(t, entries, today);
  if (done) return { state: 'confirmed', entry: done, next, canConfirm: false };
  if (!templateAppliesTo(t, y, m)) return { state: 'inactive', entry: null, next: null, canConfirm: false };
  if (incomeMode(t) === 'fix') {
    const due = dueDateFor(t.due_day, y, m);
    return today >= due ? { state: 'due', entry: null, next: due, canConfirm: true, late: today > due } : { state: 'waiting', entry: null, next: due, canConfirm: false };
  }
  return { state: 'due', entry: null, next: null, canConfirm: true };
}

// Betrag für die Bestätigung: letzter bestätigter Betrag, sonst der der Vorlage
export function suggestedAmount(t, entries) {
  const last = lastConfirmed(t, entries);
  return Number(last ? last.amount : t.amount);
}

// Verfügbar jetzt: Rechnung liegt in core/lib/finAvailable.js (gemeinsam mit dem Hub)
export { available, dedupeIncome } from '../../../core/lib/finAvailable.js';
