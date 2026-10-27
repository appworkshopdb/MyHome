// core/lib/savingsBalance.js
// Sparschwein-Stand für den Hub ("Spar" in der Saldo-Karte). Dieselbe Rechnung wie
// "Aktueller Stand" im Finanzen-Modul (finData.getSparschweinLedger + finance.js:
// isSparschweinDeposit/-Withdrawal/getSparschweinWithdrawalAmount), hier dupliziert,
// weil core/ nicht aus modules/ importieren darf. Ändert sich eine Regel dort, hier nachziehen:
//   Einzahlung = Ausgabe "Ersparnisse" (+), Entnahme = Zahlungsart Sparschwein auf einer
//   Ausgabe (nur der Sparschwein-Anteil) oder Einnahme "Sparschwein" (−).

import { getSupabase } from './supabaseClient';

const EXPENSE = new Set(['fixkosten', 'variable_kosten', 'sonstige_ausgaben']);
const INCOME = new Set(['fixeinnahmen', 'sonstige_einnahmen']);
const norm = (s) => (s || '').trim().toLowerCase();

const isDeposit = (e) => EXPENSE.has(e.category) && norm(e.name) === 'ersparnisse';

function withdrawalAmount(e) {
  if (isDeposit(e)) return 0;
  const viaPayments = Array.isArray(e.payments) && EXPENSE.has(e.category)
    && e.payments.some((p) => p.method === 'Sparschwein');
  const viaPayment = EXPENSE.has(e.category) && e.payment === 'Sparschwein';
  const viaIncomeName = INCOME.has(e.category) && norm(e.name) === 'sparschwein';
  if (!(viaPayments || viaPayment || viaIncomeName)) return 0;
  const part = Array.isArray(e.payments) ? e.payments.find((p) => p.method === 'Sparschwein') : null;
  return part?.amount != null ? Number(part.amount) : Number(e.amount);
}

export async function loadSavingsBalance(session) {
  const { data, error } = await getSupabase()
    .from('fin_entries')
    .select('name, amount, category, payment, payments')
    .eq('owner_id', session.user.id)
    .is('deleted_at', null);
  if (error) throw error;
  return (data ?? []).reduce(
    (sum, e) => sum + (isDeposit(e) ? Number(e.amount) : -withdrawalAmount(e)),
    0,
  );
}
