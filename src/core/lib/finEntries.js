// src/core/lib/finEntries.js
// Buchung in fin_entries speichern bzw. stornieren. Liegt in core/, weil neben
// dem Finanzmodul (modules/finance/lib/finData.js reicht beides weiter) auch
// die Brücke für andere Module (core/lib/financeBridge.js, z. B. Einkauf)
// buchen muss, und core/ nicht aus modules/ importieren darf.

import { getSupabase } from './supabaseClient';
import { track } from './analytics';
import { invalidateHubCache } from './hubCache';
import { isInstantMethod } from './paymentParts.js';

function ownerId(session) {
  return session.user.id;
}

export async function saveEntry(session, entry) {
  // Bezahlt-Status je Teilzahlung (core/lib/paymentParts.js): Bar, Sparschwein
  // und Gutschein gelten sofort als bezahlt; sonst zählt das paid-Flag der
  // Teilzahlung, und ein ausdrücklich übergebenes paid:true der Zeile setzt alle
  // Teilzahlungen auf bezahlt. `paid` an der Zeile ist dann "alles bezahlt".
  // Ohne payments-Array gilt ein übergebenes paid unverändert.
  let resolvedPaid = entry.paid;
  let resolvedPayments = entry.payments;
  if (Array.isArray(entry.payments) && entry.payments.length > 0) {
    resolvedPayments = entry.payments.map((p) => ({
      ...p,
      paid: isInstantMethod(p.method) || entry.paid === true || p.paid === true,
    }));
    resolvedPaid = resolvedPayments.every((p) => p.paid);
  }

  // payment-Feld (alter ENUM) für Abwärtskompatibilität:
  // Bei payments-Array: erste Zahlungsart eintragen damit alte
  // Code-Pfade (z.B. PaymentBadge) weiterhin funktionieren.
  let legacyPayment = entry.payment;
  if (Array.isArray(entry.payments) && entry.payments.length > 0) {
    legacyPayment = entry.payments[0].method;
  }

  const payload = {
    ...entry,
    owner_id: ownerId(session),
    paid: resolvedPaid,
    payment: legacyPayment,
    ...(resolvedPayments !== undefined ? { payments: resolvedPayments } : {}),
  };
  const { data, error } = await getSupabase().from('fin_entries').upsert(payload).select().single();
  if (error) throw error;
  track('finance_entry_saved', { category: String(entry.category ?? '') });
  invalidateHubCache();
  return data;
}

export async function deleteEntry(id) {
  const { error } = await getSupabase()
    .from('fin_entries')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw error;
  invalidateHubCache();
}
