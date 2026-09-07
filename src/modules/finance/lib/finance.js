// Zentrale Konstanten für das Finanzen-Modul. 1:1 aus dem Original-Tool
// übernommen, damit sich Nutzer sofort zurechtfinden.

export const MONTHS_DE = [
  'Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
  'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember',
];

export const CATEGORIES = {
  fixeinnahmen: 'Fixeinnahmen',
  sonstige_einnahmen: 'Sonstige Einnahmen',
  fixkosten: 'Fixkosten',
  variable_kosten: 'Variable Kosten',
  sonstige_ausgaben: 'Sonstige Ausgaben',
};

export const FIX_TEMPLATE_CATEGORIES = {
  fixeinnahmen: 'Fixeinnahme',
  fixkosten: 'Fixkosten',
};

// ---------------------------------------------------------------------
// Sparschwein — ersetzt das alte manuelle fin_savings-System.
// Erkennung läuft rein über exakten Namen (case-insensitive, getrimmt):
//   • Ausgabe-Eintrag "Ersparnisse" (beliebige Ausgaben-Kategorie)
//     -> Einzahlung ins Sparschwein (+)
//   • Einnahme-Eintrag "Sparschwein" (beliebige Einnahme-Kategorie)
//     -> Entnahme aus dem Sparschwein (-), Geld fließt zurück ins Budget
// Keine eigene Tabelle nötig — läuft direkt über fin_entries, damit
// Timestamp (created_at), Zahlungsart etc. automatisch mitkommen.
// ---------------------------------------------------------------------
export const SPARSCHWEIN_DEPOSIT_NAME = 'Ersparnisse';
export const SPARSCHWEIN_WITHDRAWAL_NAME = 'Sparschwein';

const EXPENSE_CATEGORIES = new Set(['fixkosten', 'variable_kosten', 'sonstige_ausgaben']);
const INCOME_CATEGORIES = new Set(['fixeinnahmen', 'sonstige_einnahmen']);

function normName(name) {
  return (name || '').trim().toLowerCase();
}

export function isSparschweinDeposit(entry) {
  return EXPENSE_CATEGORIES.has(entry.category) &&
    normName(entry.name) === SPARSCHWEIN_DEPOSIT_NAME.toLowerCase();
}

// Entnahme aus dem Sparschwein — zwei Wege:
//  1. Zahlungsart "Sparschwein" auf einem beliebigen Ausgaben-Eintrag,
//     egal welche Kategorie (Fixkosten/Variable/Sonstige) — der
//     eigentliche, primäre Weg. Beispiel: 100€ Variable Kosten "Urlaub",
//     bezahlt mit "Sparschwein" -> Ausgabe im Monat + Entnahme aus dem
//     Sparschwein in einem Schritt.
//  2. Einnahme-Eintrag exakt benannt "Sparschwein" (älterer, weiterhin
//     unterstützter Weg — falls jemand die Entnahme lieber als
//     eigenständige Einnahme verbuchen möchte statt sie einer Ausgabe
//     zuzuordnen).
// Ein Eintrag der bereits als Einzahlung zählt (isSparschweinDeposit)
// wird hier ausgeschlossen, damit "Ersparnisse" nie beides gleichzeitig
// sein kann, selbst wenn versehentlich payment=Sparschwein gewählt wurde.
export function isSparschweinWithdrawal(entry) {
  if (isSparschweinDeposit(entry)) return false;
  const viaPayment = EXPENSE_CATEGORIES.has(entry.category) && entry.payment === 'Sparschwein';
  const viaIncomeName = INCOME_CATEGORIES.has(entry.category) &&
    normName(entry.name) === SPARSCHWEIN_WITHDRAWAL_NAME.toLowerCase();
  return viaPayment || viaIncomeName;
}

export function isSparschweinEntry(entry) {
  return isSparschweinDeposit(entry) || isSparschweinWithdrawal(entry);
}

export const PAYMENTS = ['Bank', 'Bar', 'Paypal', 'SEPA', 'Gutschein', 'Klarna', 'Sparschwein'];

// Intervalle für feste Posten (FixTemplates) und Verträge
// interval-Wert → wie viele Monate zwischen zwei Buchungen
export const INTERVALS = {
  monthly:     { label: 'Monatlich',      months: 1  },
  quarterly:   { label: 'Vierteljährlich (Quartal)', months: 3  },
  biannually:  { label: 'Halbjährlich',   months: 6  },
  annually:    { label: 'Jährlich',       months: 12 },
};

export function intervalLabel(interval) {
  return INTERVALS[interval]?.label ?? 'Monatlich';
}

// Monatliche Kosten eines Vertrags berechnen (Betrag ÷ Intervall-Monate)
export function monthlyAmount(amount, interval) {
  const months = INTERVALS[interval]?.months ?? 1;
  return Number(amount || 0) / months;
}

export function formatEur(val) {
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(val || 0);
}

export function formatDate(val) {
  if (!val) return '—';
  const d = new Date(val);
  if (isNaN(d)) return val;
  return d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export function formatDateTime(ts) {
  const d = new Date(ts);
  if (isNaN(d)) return '';
  return (
    d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' }) +
    ', ' +
    d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })
  );
}

// Gilt eine Vorlage in diesem Monat?
//  1. Beginn/Ende (start_date/end_date bzw. contract_duration_months)
//     werden IMMER geprüft, unabhängig vom Intervall — ein Posten mit
//     Beginn 01.09.2026 darf in Juni/Juli/August nie erscheinen.
//  2. Danach das Intervall:
//     - monthly (oder quarterly=false im Altformat): jeden Monat, sofern
//       Punkt 1 zutrifft
//     - quarterly / biannually / annually: nur ab Startmonat/-jahr und
//       dann alle N Monate, sofern Punkt 1 zutrifft
export function templateAppliesTo(t, year, month) {
  if (!t) return true;

  // ---- 1. Beginn/Ende-Fenster (start_date/end_date) ----
  // Monatsvergleich: der 1. des geprüften Monats muss >= Startmonat sein,
  // und < dem Monat NACH dem Enddatum (das Enddatum-Monat zählt noch mit).
  const monthIdx = year * 12 + (month - 1);

  if (t.start_date) {
    const sd = new Date(t.start_date);
    if (!isNaN(sd)) {
      const startIdx = sd.getFullYear() * 12 + sd.getMonth();
      if (monthIdx < startIdx) return false;
    }
  }

  if (!t.is_open) {
    let endIdx = null;
    if (t.end_date) {
      const ed = new Date(t.end_date);
      if (!isNaN(ed)) endIdx = ed.getFullYear() * 12 + ed.getMonth();
    } else if (t.contract_duration_months && t.start_date) {
      const sd = new Date(t.start_date);
      if (!isNaN(sd)) {
        const startIdx = sd.getFullYear() * 12 + sd.getMonth();
        endIdx = startIdx + Number(t.contract_duration_months) - 1;
      }
    }
    if (endIdx !== null && monthIdx > endIdx) return false;
  }

  // ---- 2. Intervall (Rückwärtskompatibilität: quarterly-Flag) ----
  const interval = t.interval ?? (t.quarterly ? 'quarterly' : 'monthly');
  const intervalMonths = INTERVALS[interval]?.months ?? 1;

  if (intervalMonths <= 1) return true; // monatlich — jeden Monat fällig

  const sy = t.start_year || year;
  const sm = t.start_month || 1;
  const start = sy * 12 + (sm - 1);
  return monthIdx >= start && (monthIdx - start) % intervalMonths === 0;
}

// Vertragsstatus: active / expiring (< 30 Tage) / expired
// Unterstützt jetzt auch `contract_duration_months` als Alternative zu
// einem expliziten `end_date`.
export function getContractStatus(c) {
  // Kein Ende definiert oder unbefristet
  if (c.is_open || (!c.end_date && !c.contract_duration_months)) return 'active';

  // Enddatum aus Laufzeit ableiten, falls kein explizites end_date
  let endDate = c.end_date ? new Date(c.end_date) : null;
  if (!endDate && c.contract_duration_months && c.start_date) {
    const start = new Date(c.start_date);
    if (!isNaN(start)) {
      endDate = new Date(start);
      endDate.setMonth(endDate.getMonth() + Number(c.contract_duration_months));
    }
  }

  if (!endDate || isNaN(endDate)) return 'active';

  const now = new Date();
  const diff = (endDate - now) / (1000 * 60 * 60 * 24);
  if (diff < 0) return 'expired';
  if (diff <= 30) return 'expiring';
  return 'active';
}

// Berechnet das Enddatum eines Vertrags für die Anzeige
export function getContractEndDate(c) {
  if (c.is_open) return null;
  if (c.end_date) return new Date(c.end_date);
  if (c.contract_duration_months && c.start_date) {
    const start = new Date(c.start_date);
    if (!isNaN(start)) {
      const end = new Date(start);
      end.setMonth(end.getMonth() + Number(c.contract_duration_months));
      return end;
    }
  }
  return null;
}

export function sumCat(entries, cat) {
  return entries.filter((e) => e.category === cat).reduce((s, e) => s + Number(e.amount || 0), 0);
}
