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

import { templateAppliesTo, dueDateFor, isIncomePending, isOpenExpense, openAmount, entryParts } from './finance.js';

const INCOME = new Set(['fixeinnahmen', 'sonstige_einnahmen']);
const EXPENSE = new Set(['fixkosten', 'variable_kosten', 'sonstige_ausgaben']);
const pad = (n) => String(n).padStart(2, '0');
const r2 = (n) => Math.round(n * 100) / 100;
const sum = (xs) => xs.reduce((a, b) => a + b, 0);

export const isIncomeTemplate = (t) => t && t.category === 'fixeinnahmen';
export const incomeMode = (t) => (t.due_day ? 'fix' : 'varies');

export function parts(today) {
  const [y, m, d] = String(today).slice(0, 10).split('-').map(Number);
  return { y, m, d };
}
const monthIdxOf = (y, m) => y * 12 + m - 1;
const entryIdx = (e) => monthIdxOf(e.year, e.month);

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

// ---------------------------------------------------------------------
// Verfügbar jetzt
// ---------------------------------------------------------------------
// Einnahmen zählen ab ihrem Eingang (nicht, wenn das Datum in der Zukunft liegt) und nur
// im Zeitraum vom Startmonat (startIdx) bis zum laufenden Monat. Bezahltes zählt wie in der
// Monatsrechnung (auch der Sparschwein-Anteil), sonst stimmt "Verfügbar" nicht mit dem
// bisherigen Saldo überein.
export function available(entries, today, startIdx = -Infinity) {
  const { y, m } = parts(today);
  const cur = monthIdxOf(y, m);
  const inRange = (e) => entryIdx(e) <= cur && entryIdx(e) >= startIdx;
  const live = entries.filter((e) => !e.deleted_at);
  const eingaenge = r2(sum(live
    .filter((e) => INCOME.has(e.category) && inRange(e) && !isIncomePending(e, today))
    .map((e) => Number(e.amount || 0))));
  const bezahlt = r2(sum(live
    .filter((e) => EXPENSE.has(e.category) && entryIdx(e) >= startIdx)
    .map((e) => sum(entryParts(e).filter((p) => p.paid).map((p) => Number(p.amount || 0))))));
  const offen = live.filter((e) => isOpenExpense(e) && inRange(e));
  const offenSum = r2(sum(offen.map((e) => openAmount(e))));
  return { eingaenge, bezahlt, verf: r2(eingaenge - bezahlt), offen, offenSum };
}

// Geplante (noch nicht bezahlte) Ausgaben bis zu einem Tag: alles bis zum laufenden Monat plus
// künftige Posten, die bis dahin fällig sind
export function plannedUntil(entries, until, today, startIdx = -Infinity) {
  const { y, m } = parts(today);
  const cur = monthIdxOf(y, m);
  return r2(sum(entries
    .filter((e) => !e.deleted_at && isOpenExpense(e) && entryIdx(e) >= startIdx && (entryIdx(e) <= cur || dueOf(e) <= until))
    .map((e) => openAmount(e))));
}

// Horizont der Fokuskarte: nächster erwarteter Fix-Eingang, sonst Monatsende
export function horizon(templates, entries, today) {
  const dates = templates.filter((t) => isIncomeTemplate(t) && !t.deleted_at).map((t) => expectedDate(t, entries, today)).filter(Boolean).sort();
  if (dates.length) return { kind: 'gehalt', date: dates[0] };
  const { y, m } = parts(today);
  return { kind: 'monat', date: `${y}-${pad(m)}-${pad(new Date(y, m, 0).getDate())}` };
}
