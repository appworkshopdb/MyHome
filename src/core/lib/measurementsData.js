import { getSupabase } from './supabaseClient';

// WICHTIG (siehe Projektkontext.md): der Hub liest ausschließlich aus
// "measurements", nie aus Modul-Tabellen wie fin_entries direkt — genau
// dafür gibt es die zentrale Zeitreihe. Das hält den Hub automatisch
// kompatibel mit jedem künftigen Modul, das dort einträgt.

function ownerId(session) {
  return session.user.id;
}

function monthRange(year, month) {
  const from = `${year}-${String(month).padStart(2, '0')}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const to = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
  return { from, to };
}

// Summe eines metric_key im angegebenen Monat, z.B. 'finance.expense'.
export async function getMonthSum(session, metricKey, year, month) {
  const { from, to } = monthRange(year, month);
  const { data, error } = await getSupabase()
    .from('measurements')
    .select('value')
    .eq('owner_id', ownerId(session))
    .eq('metric_key', metricKey)
    .gte('occurred_on', from)
    .lte('occurred_on', to);
  if (error) throw error;
  return data.reduce((sum, row) => sum + Number(row.value), 0);
}

// Letzte Einträge quer über alle Module, für den Aktivitäts-Feed im Hub.
// Sortiert nach created_at (nicht occurred_on) — occurred_on ist bei
// Finanzen z.B. nur der 1. des Monats, nicht der echte Buchungstag.
export async function getRecentMeasurements(session, limit = 5) {
  const { data, error } = await getSupabase()
    .from('measurements')
    .select('*')
    .eq('owner_id', ownerId(session))
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data;
}

// Zeitraum als ISO-Datumsgrenzen, z.B. lastNDaysRange(7) für "diese Woche".
export function lastNDaysRange(days) {
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - (days - 1));
  const fmt = (d) => d.toISOString().split('T')[0];
  return { from: fmt(from), to: fmt(to) };
}

// Heutiges Datum als von/bis (gleicher Tag), für die "Heute"-Übersicht.
export function todayRange() {
  const today = new Date().toISOString().split('T')[0];
  return { from: today, to: today };
}

// Aktueller Kalendermonat als von/bis, für den "Monat"-Filter im Hub.
export function currentMonthRange() {
  const now = new Date();
  return monthRange(now.getFullYear(), now.getMonth() + 1);
}

// Aggregiert measurements über einen Zeitraum, gruppiert nach
// source_module und darunter nach metric_key — generische Basis für
// Wochen-/Monatsberichte. Bleibt bewusst "dumm" (keine .expense/
// .income-Vorzeichenlogik, das wäre modul-spezifisches Wissen) — jede
// Anzeige entscheidet selbst, wie sie ihre eigenen metric_keys liest,
// genau wie es die Aktivitätsliste im Hub schon für "Aktivität" tut.
export async function getPeriodSummary(session, fromDate, toDate) {
  const { data, error } = await getSupabase()
    .from('measurements')
    .select('source_module, metric_key, value, unit')
    .eq('owner_id', ownerId(session))
    .gte('occurred_on', fromDate)
    .lte('occurred_on', toDate);
  if (error) throw error;

  const byModule = {};
  for (const row of data) {
    const mod = (byModule[row.source_module] ||= { count: 0, byMetric: {} });
    mod.count += 1;
    const met = (mod.byMetric[row.metric_key] ||= { count: 0, sum: 0, unit: row.unit });
    met.count += 1;
    met.sum += Number(row.value);
  }
  return byModule;
}
