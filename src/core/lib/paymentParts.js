// core/lib/paymentParts.js
//
// Teilzahlungen eines Postens: Was ist bezahlt, was noch offen?
//
// Ein Posten kann mehrere Zahlungen haben (`payments`: [{ method, amount, paid }]).
// Bar, Gutschein und Sparschwein gelten SOFORT als bezahlt — nur der Rest ist
// "offen". Der offene Betrag eines Postens ist die Summe der Teilzahlungen, die
// noch nicht bezahlt sind (nicht der Gesamtbetrag).
//
// Wahrheitsregel (`paid` an der Zeile = "alles bezahlt"):
//   • paid === true            → alle Teilzahlungen gelten als bezahlt
//   • sonst, je Teilzahlung    → bezahlt, wenn Bar/Gutschein/Sparschwein
//                                 oder `paid === true` an der Teilzahlung
// Ältere Zeilen ohne Teilzahlungs-Flags funktionieren damit unverändert.
// Liegt dieses Modul in core/lib, weil Hub/Tagesplan (core) und das Finanzen-
// Modul dieselbe Rechnung brauchen (core darf nicht aus modules importieren).

export const INSTANT_METHODS = new Set(['Bar', 'Sparschwein', 'Gutschein']);
export const isInstantMethod = (method) => INSTANT_METHODS.has(method);

const EPS = 0.005;

// Teilzahlungen mit Betrag und Bezahlt-Status. Ohne `payments` zählt das alte
// Einzelfeld `payment`.
export function entryParts(entry) {
  const total = Number(entry.amount || 0);
  const list = Array.isArray(entry.payments) && entry.payments.length > 0
    ? entry.payments
    : [{ method: entry.payment || 'Bank', amount: total }];
  const hasAll = list.every((p) => p.amount !== null && p.amount !== undefined && p.amount !== '' && !Number.isNaN(Number(p.amount)));
  return list.map((p) => ({
    method: p.method,
    amount: hasAll ? Number(p.amount) : total / list.length,
    paid: entry.paid === true || isInstantMethod(p.method) || p.paid === true,
  }));
}

// Noch offener Betrag (0 = alles bezahlt)
export function openAmount(entry) {
  const open = entryParts(entry).filter((p) => !p.paid).reduce((s, p) => s + p.amount, 0);
  return open < EPS ? 0 : open;
}

export const isFullyPaid = (entry) => openAmount(entry) === 0;

// Schon bezahlter Betrag
export function paidAmount(entry) {
  return entryParts(entry).filter((p) => p.paid).reduce((s, p) => s + p.amount, 0);
}

// Teils bezahlt, teils offen
export function isPartlyPaid(entry) {
  const parts = entryParts(entry);
  return parts.some((p) => p.paid && p.amount > EPS) && parts.some((p) => !p.paid && p.amount > EPS);
}

// Alle Teilzahlungen auf bezahlt/offen setzen (sofort bezahlte bleiben bezahlt).
// -> { payments, paid }: `payments` ist null, wenn der Posten kein payments-Array
// hat (dann gilt nur `paid`); `paid` ist der Wert für die Zeile ("alles bezahlt").
export function setPartsPaid(entry, paid) {
  if (!Array.isArray(entry.payments) || entry.payments.length === 0) {
    return { payments: null, paid: paid || isInstantMethod(entry.payment) };
  }
  const payments = entry.payments.map((p) => ({ ...p, paid: isInstantMethod(p.method) ? true : paid }));
  return { payments, paid: payments.every((p) => p.paid) };
}
