// core/lib/finAvailable.js
//
// "Verfügbar jetzt" (laufender Stand) für alle Finanz-Fokuskarten: Finanzen-Übersicht, Buchungen/
// Offene Posten und Hub zeigen dieselbe Zahl. Alle Eingänge bis heute minus alles Bezahlte,
// monatsübergreifend ab dem Startmonat (body_profile.fin_start_month); darunter "Nach N offenen
// Zahlungen". Liegt in core/, weil Hub und Finanzen es gemeinsam nutzen (core/ darf nicht aus
// modules/ importieren). Reine Rechenfunktionen plus ein Lader.

import { getSupabase } from './supabaseClient';
import { entryParts, isIncomePending, isOpenExpense, openAmount } from './paymentParts';

const INCOME = new Set(['fixeinnahmen', 'sonstige_einnahmen']);
const EXPENSE = new Set(['fixkosten', 'variable_kosten', 'sonstige_ausgaben']);
const r2 = (n) => Math.round(n * 100) / 100;
const sum = (xs) => xs.reduce((a, b) => a + b, 0);
const monthIdxOf = (y, m) => y * 12 + m - 1;
const entryIdx = (e) => monthIdxOf(e.year, e.month);

// Früher legte die App Einnahmen aus Vorlagen automatisch an (ohne received_on). Wurde der Eingang
// dieser Quelle im selben Monat inzwischen bestätigt, zählt nur die Bestätigung, sonst stünde das
// Gehalt doppelt in den Summen. Nicht bestätigte alte Posten bleiben unverändert.
export function dedupeIncome(entries) {
  const key = (e) => `${e.from_template}:${e.year}-${e.month}`;
  const confirmed = new Set(entries.filter((e) => !e.deleted_at && e.from_template && e.received_on).map(key));
  return entries.filter((e) => !(e.from_template && !e.received_on && INCOME.has(e.category) && confirmed.has(key(e))));
}

// Einnahmen zählen ab ihrem Eingang (nicht, wenn das Datum in der Zukunft liegt) und nur im
// Zeitraum vom Startmonat (startIdx) bis zum laufenden Monat. Bezahltes zählt wie in der
// Monatsrechnung (auch der Sparschwein-Anteil). `today` = lokales 'YYYY-MM-DD'.
export function available(entries, today, startIdx = -Infinity) {
  const [y, m] = String(today).slice(0, 10).split('-').map(Number);
  const cur = monthIdxOf(y, m);
  const inRange = (e) => entryIdx(e) <= cur && entryIdx(e) >= startIdx;
  const live = dedupeIncome(entries.filter((e) => !e.deleted_at));
  const eingaenge = r2(sum(live
    .filter((e) => INCOME.has(e.category) && inRange(e) && !isIncomePending(e, today))
    .map((e) => Number(e.amount || 0))));
  const bezahlt = r2(sum(live
    // Posten künftiger Monate zählen nicht (Bar-Posten aus Vorlagen sind dort schon beim Anlegen "bezahlt");
    // nur eine bewusst vorgezogene Sparrate zählt auch im Voraus (Geld ist schon im Sparschwein)
    .filter((e) => EXPENSE.has(e.category) && entryIdx(e) >= startIdx && (entryIdx(e) <= cur || e.savings_plan_id))
    .map((e) => sum(entryParts(e).filter((p) => p.paid).map((p) => Number(p.amount || 0))))));
  const offen = live.filter((e) => isOpenExpense(e) && inRange(e));
  const offenSum = r2(sum(offen.map((e) => openAmount(e))));
  return { eingaenge, bezahlt, verf: r2(eingaenge - bezahlt), offen, offenSum };
}

// Kurzform für die Karte (und den Hub-Zwischenspeicher): nur Zahlen
export function standSummary(a) {
  return { verf: a.verf, eingaenge: a.eingaenge, bezahlt: a.bezahlt, offenCount: a.offen.length, offenSum: a.offenSum };
}

// Startmonat der Rechnung (body_profile.fin_start_month, Migration fin_income_confirm_migration.sql).
// Beim ersten Aufruf wird der laufende Monat gesetzt. Rückgabe: Monats-Index (Jahr*12+Monat-1).
// Ohne die Spalte: laufender Monat (nicht gespeichert).
export async function getFinStartIdx(session, today) {
  const [y, m] = String(today).slice(0, 7).split('-').map(Number);
  const curIdx = y * 12 + m - 1;
  const sb = getSupabase();
  const uid = session.user.id;
  const { data, error } = await sb.from('body_profile').select('fin_start_month').eq('owner_id', uid).maybeSingle();
  if (error) { console.warn('[Finanzen] fin_start_month nicht lesbar (Migration fin_income_confirm_migration.sql?):', error.message); return curIdx; }
  const v = data?.fin_start_month;
  if (typeof v === 'string' && /^\d{4}-\d{2}$/.test(v)) return Number(v.slice(0, 4)) * 12 + Number(v.slice(5, 7)) - 1;
  if (!data) return curIdx; // noch keine Profilzeile
  const { error: upErr } = await sb.from('body_profile').update({ fin_start_month: String(today).slice(0, 7) }).eq('owner_id', uid);
  if (upErr) console.warn('[Finanzen] fin_start_month nicht speicherbar:', upErr.message);
  return curIdx;
}

// Lädt alle Posten und den Startmonat und gibt die Kurzform zurück (für den Hub)
export async function loadAvailable(session, today) {
  const [{ data, error }, startIdx] = await Promise.all([
    getSupabase().from('fin_entries').select('*').eq('owner_id', session.user.id).is('deleted_at', null),
    getFinStartIdx(session, today),
  ]);
  if (error) throw error;
  return standSummary(available(data ?? [], today, startIdx));
}
