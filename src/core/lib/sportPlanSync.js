// core/lib/sportPlanSync.js
// Dauerplan (Sport): ein aktiver Trainingsplan füllt den Kalender selbst auf.
// Liegt in core/lib, weil der Hub das Auffüllen vor seiner "Heute"-Abfrage
// braucht und core nichts aus modules importieren darf.
//
// Die Einheiten bleiben echte Zeilen in spo_workouts (auto_planned = true),
// damit Kalender, Hub, Überblicke, Auswertung und Push unverändert rechnen.
// Tabelle/Spalte: supabase/spo_active_plan_migration.sql. Fehlt sie noch,
// bleibt alles still: getActivePlan() liefert null, nichts wird geschrieben.
//
// Alle Kalendertage sind lokale 'YYYY-MM-DD'-Strings (nie toISOString).

import { getSupabase } from './supabaseClient';
import { isoLocal, parseIso, todayIso } from './wizardDates';

export const PLAN_HORIZON_DAYS = 28;

// ── Reine Rechnung ──────────────────────────────────────────────

export function addDaysIso(iso, n) {
  const d = parseIso(iso);
  d.setDate(d.getDate() + n);
  return isoLocal(d);
}

// Differenz in Kalendertagen, unabhängig von der Zeitumstellung
export function diffDays(a, b) {
  const x = parseIso(a);
  const y = parseIso(b);
  return Math.round((Date.UTC(y.getFullYear(), y.getMonth(), y.getDate()) - Date.UTC(x.getFullYear(), x.getMonth(), x.getDate())) / 86400000);
}

// Welcher Plan-Tag fällt auf `date`? items nach day_index sortiert.
// → { item, index, count } oder null (leerer Plan / Datum vor dem Start)
export function planDayFor(items, startDate, date) {
  const list = (items ?? []).filter((i) => !i.deleted_at);
  if (list.length === 0 || date < startDate) return null;
  const count = list.length;
  const index = diffDays(startDate, date) % count;
  return { item: list[index], index, count };
}

// Zeilen für alle Tage von..bis, an denen noch keine lebende Zeile steht.
// taken = Menge der Daten mit einer nicht gelöschten Zeile (egal ob Plan oder eigen).
export function buildPlanRows({ ownerId, planId, items, startDate, from, to, taken }) {
  const rows = [];
  for (let d = from; d <= to; d = addDaysIso(d, 1)) {
    if (taken.has(d)) continue;
    const day = planDayFor(items, startDate, d);
    if (!day) continue;
    const { item } = day;
    rows.push({
      owner_id: ownerId,
      occurred_on: d,
      status: item.is_rest ? 'done' : 'planned',
      is_rest: !!item.is_rest,
      type_key: item.is_rest ? null : (item.type_key || 'sonstiges'),
      title: item.title,
      duration_min: item.duration_min ?? null,
      notes: item.notes ?? null,
      plan_id: planId,
      plan_day_index: item.day_index ?? day.index,
      auto_planned: true,
    });
  }
  return rows;
}

// Zahlen für die Bestätigungen (nur aus dem geladenen Stand, kein Netzwerk):
// open   = unberührte Plan-Einträge ab `from`, die ein Wechsel/Ende ersetzt
// manual = eigene Einträge ab `from`, die bleiben
export function planImpact(workouts, from) {
  let open = 0;
  let manual = 0;
  for (const w of workouts) {
    if (w.occurred_on < from) continue;
    if (w.auto_planned) {
      if (w.is_rest || w.status !== 'done') open += 1;
    } else {
      manual += 1;
    }
  }
  return { open, manual };
}

// ── Datenbank ───────────────────────────────────────────────────

// null = noch unbekannt, false = Tabelle/Spalte fehlt (Migration nicht eingespielt)
let featureOk = null;
export function isPlanFeatureAvailable() { return featureOk; }

function isMissing(error) {
  const c = error?.code;
  return c === '42P01' || c === '42703' || c === 'PGRST205' || c === 'PGRST204'
    || /auto_planned|spo_active_plan/.test(error?.message ?? '');
}

const owner = (session) => session.user.id;
const OPEN_ROWS = 'is_rest.eq.true,status.neq.done';

export async function getActivePlan(session) {
  const { data, error } = await getSupabase()
    .from('spo_active_plan')
    .select('*')
    .eq('owner_id', owner(session))
    .maybeSingle();
  if (error) {
    if (isMissing(error)) { featureOk = false; return null; }
    throw error;
  }
  featureOk = true;
  return data ?? null;
}

async function fillHorizon(session, active) {
  const sb = getSupabase();
  const ownerId = owner(session);
  const today = todayIso();
  const from = active.start_date > today ? active.start_date : today;
  const to = addDaysIso(today, PLAN_HORIZON_DAYS - 1);
  if (from > to) return 0;

  const { data: existing, error: exErr } = await sb
    .from('spo_workouts')
    .select('occurred_on')
    .eq('owner_id', ownerId)
    .is('deleted_at', null)
    .gte('occurred_on', from)
    .lte('occurred_on', to);
  if (exErr) throw exErr;
  const taken = new Set((existing ?? []).map((r) => r.occurred_on));

  // Nur wenn Tage fehlen, den Plan laden
  let missing = false;
  for (let d = from; d <= to; d = addDaysIso(d, 1)) { if (!taken.has(d)) { missing = true; break; } }
  if (!missing) return 0;

  const { data: plan, error: planErr } = await sb
    .from('spo_plans')
    .select('id, deleted_at, items:spo_plan_items(*)')
    .eq('id', active.plan_id)
    .maybeSingle();
  if (planErr) throw planErr;
  if (!plan || plan.deleted_at) return 0;

  const items = (plan.items ?? []).filter((i) => !i.deleted_at).sort((a, b) => a.day_index - b.day_index);
  const rows = buildPlanRows({ ownerId, planId: plan.id, items, startDate: active.start_date, from, to, taken });
  if (rows.length === 0) return 0;

  const { error } = await sb.from('spo_workouts').insert(rows);
  // 23505: ein anderes Gerät hat gleichzeitig aufgefüllt — beim nächsten Mal ergänzt es sich.
  if (error && error.code !== '23505') throw error;
  return error ? 0 : rows.length;
}

// Füllt den aktiven Plan auf 28 Tage im Voraus auf (nur heute und später, nie
// rückwirkend). Gibt den aktiven Plan zurück (oder null). Schlägt nie fehl:
// Aufrufer wie der Hub dürfen daran nicht scheitern.
export async function syncActivePlan(session) {
  try {
    const active = await getActivePlan(session);
    if (!active) return null;
    await fillHorizon(session, active);
    return active;
  } catch (e) {
    console.warn('[sportPlanSync] Auffüllen fehlgeschlagen:', e);
    return null;
  }
}

// Unberührte, offene Plan-Zeilen ab `from` ausblenden (erledigte, bearbeitete
// und eigene Einträge bleiben).
export async function clearFutureAutoRows(session, from) {
  const { error } = await getSupabase()
    .from('spo_workouts')
    .update({ deleted_at: new Date().toISOString() })
    .eq('owner_id', owner(session))
    .eq('auto_planned', true)
    .is('deleted_at', null)
    .gte('occurred_on', from)
    .or(OPEN_ROWS);
  if (error) throw error;
}

// Eigener Eintrag hat Vorrang: Plan-Zeile desselben Tages ausblenden.
export async function hideAutoRowsOn(session, date, exceptId) {
  let q = getSupabase()
    .from('spo_workouts')
    .update({ deleted_at: new Date().toISOString() })
    .eq('owner_id', owner(session))
    .eq('occurred_on', date)
    .eq('auto_planned', true)
    .is('deleted_at', null)
    .or(OPEN_ROWS);
  if (exceptId) q = q.neq('id', exceptId);
  const { error } = await q;
  if (error) throw error;
}

// Plan aktivieren (oder wechseln) ab startDate. Alles vor dem Start bleibt.
export async function activatePlan(session, planId, startDate) {
  // Den bisherigen Plan zuerst bis zum Horizont auffüllen, damit die Tage
  // zwischen heute und dem neuen Start sicher belegt sind.
  await syncActivePlan(session);
  const { error } = await getSupabase()
    .from('spo_active_plan')
    .upsert({ owner_id: owner(session), plan_id: planId, start_date: startDate, updated_at: new Date().toISOString() }, { onConflict: 'owner_id' });
  if (error) throw error;
  await clearFutureAutoRows(session, startDate);
  await fillHorizon(session, { plan_id: planId, start_date: startDate });
}

// Plan beenden: ab heute entfallen die unberührten offenen Plan-Einträge.
export async function endActivePlan(session) {
  const { error } = await getSupabase().from('spo_active_plan').delete().eq('owner_id', owner(session));
  if (error) throw error;
  await clearFutureAutoRows(session, todayIso());
}

// Aktiver Plan wurde geändert: ab heute neu erzeugen, start_date bleibt.
export async function resyncActivePlan(session) {
  const active = await getActivePlan(session);
  if (!active) return;
  await clearFutureAutoRows(session, todayIso());
  await fillHorizon(session, active);
}
