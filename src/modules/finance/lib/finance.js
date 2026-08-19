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

export const PAYMENTS = ['Bank', 'Bar', 'Paypal', 'SEPA', 'Gutschein', 'Klarna'];

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
//  - monthly (oder quarterly=false im Altformat): jeden Monat (true)
//  - quarterly / biannually / annually: nur ab Startmonat/-jahr und
//    dann alle N Monate
export function templateAppliesTo(t, year, month) {
  if (!t) return true;

  // Rückwärtskompatibilität: ältere Einträge haben `quarterly: true/false`
  // statt `interval`. Wir übersetzen on-the-fly.
  const interval = t.interval ?? (t.quarterly ? 'quarterly' : 'monthly');
  const intervalMonths = INTERVALS[interval]?.months ?? 1;

  if (intervalMonths <= 1) return true; // monatlich — immer fällig

  const sy = t.start_year || year;
  const sm = t.start_month || 1;
  const start = sy * 12 + (sm - 1);
  const idx = year * 12 + (month - 1);
  return idx >= start && (idx - start) % intervalMonths === 0;
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
