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
