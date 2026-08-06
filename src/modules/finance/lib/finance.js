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
//  - normal: jeden Monat (true)
//  - Quartal: nur ab Startmonat/-jahr und dann alle 3 Monate
export function templateAppliesTo(t, year, month) {
  if (!t || !t.quarterly) return true;
  const sy = t.start_year || year;
  const sm = t.start_month || 1;
  const start = sy * 12 + (sm - 1);
  const idx = year * 12 + (month - 1);
  return idx >= start && (idx - start) % 3 === 0;
}

export function getContractStatus(c) {
  if (!c.end_date || c.is_monthly) return 'active';
  const end = new Date(c.end_date);
  if (isNaN(end)) return 'active';
  const now = new Date();
  const diff = (end - now) / (1000 * 60 * 60 * 24);
  if (diff < 0) return 'expired';
  if (diff <= 30) return 'expiring';
  return 'active';
}

export function sumCat(entries, cat) {
  return entries.filter((e) => e.category === cat).reduce((s, e) => s + Number(e.amount || 0), 0);
}
