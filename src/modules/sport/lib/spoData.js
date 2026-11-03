import { getSupabase } from '../../../core/lib/supabaseClient';
import { track } from '../../../core/lib/analytics';
import { hideAutoRowsOn, isPlanFeatureAvailable } from '../../../core/lib/sportPlanSync';

function ownerId(session) {
  return session.user.id;
}

// ---------------------------------------------------------------------
// Trainingseinheiten (spo_workouts)
// ---------------------------------------------------------------------

export async function getWorkouts(session, limit = 500) {
  const { data, error } = await getSupabase()
    .from('spo_workouts')
    .select('*')
    .eq('owner_id', ownerId(session))
    .is('deleted_at', null)
    .order('occurred_on', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data;
}

export async function saveWorkout(session, workout) {
  const payload = {
    ...workout,
    owner_id: ownerId(session),
    status: workout.status ?? 'done',
  };
  // Wer eine Plan-Einheit bearbeitet, macht daraus einen eigenen Eintrag.
  // Nur setzen, wenn die Zeile das Flag schon kennt (Migration eingespielt).
  if ('auto_planned' in payload) payload.auto_planned = false;
  const { data, error } = await getSupabase().from('spo_workouts').upsert(payload).select().single();
  if (error) throw error;

  // Eigene Einträge haben Vorrang vor dem Plan: die Plan-Zeile desselben
  // Tages wird ausgeblendet. Löscht man den eigenen Eintrag wieder, legt der
  // Auffüller sie beim nächsten Laden neu an (core/lib/sportPlanSync.js).
  if (isPlanFeatureAvailable() !== false) {
    try { await hideAutoRowsOn(session, data.occurred_on, data.id); }
    catch (e) { console.warn('[spoData] Plan-Zeile ausblenden fehlgeschlagen:', e); }
  }
  track('workout_saved', { status: payload.status });
  return data;
}

export async function setWorkoutStatus(id, done) {
  const { error } = await getSupabase()
    .from('spo_workouts')
    .update({
      status: done ? 'done' : 'planned',
      completed_at: done ? new Date().toISOString() : null,
    })
    .eq('id', id);
  if (error) throw error;
}

export async function deleteWorkout(id) {
  const { error } = await getSupabase()
    .from('spo_workouts')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw error;
}

// ---------------------------------------------------------------------
// Einheiten-Bibliothek (spo_units)
// ---------------------------------------------------------------------

export async function getUnits(session) {
  const { data, error } = await getSupabase()
    .from('spo_units')
    .select('*')
    .eq('owner_id', ownerId(session))
    .is('deleted_at', null)
    .order('title', { ascending: true });
  if (error) throw error;
  return data;
}

export async function saveUnit(session, unit) {
  const payload = {
    ...(unit.id ? { id: unit.id } : {}),
    owner_id: ownerId(session),
    title: unit.title,
    type_key: unit.type_key || null,
    duration_min: unit.duration_min ?? null,
    muscle_groups: unit.muscle_groups ?? [],
  };
  const { data, error } = await getSupabase().from('spo_units').upsert(payload).select().single();
  if (error) throw error;
  return data;
}

export async function deleteUnit(id) {
  const { error } = await getSupabase()
    .from('spo_units')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw error;
}

// ---------------------------------------------------------------------
// Trainingsplan-Vorlagen (spo_plans + spo_plan_items)
// ---------------------------------------------------------------------
// spo_plan_items speichert die Referenz auf die Einheit und deren
// Text-/Typ-/Dauerwerte. Muskelgruppen gehören zu spo_units und werden
// für die Planvorschau dort aufgelöst. Es gibt in spo_plan_items keine
// muscle_groups-Spalte.

export async function getPlans(session) {
  const { data, error } = await getSupabase()
    .from('spo_plans')
    .select('*, items:spo_plan_items(*)')
    .eq('owner_id', ownerId(session))
    .is('deleted_at', null)
    .order('created_at', { ascending: false });
  if (error) throw error;

  return (data ?? []).map((plan) => ({
    ...plan,
    items: (plan.items ?? [])
      .filter((i) => !i.deleted_at)
      .sort((a, b) => a.day_index - b.day_index),
  }));
}

function planItemComparable(item) {
  return {
    day_index: item.day_index,
    unit_id: item.unit_id ?? null,
    title: item.title ?? '',
    type_key: item.type_key ?? null,
    duration_min: item.duration_min ?? null,
    is_rest: item.is_rest ?? false,
    notes: item.notes ?? null,
  };
}

function samePlanItems(existingItems, nextItems) {
  if (existingItems.length !== nextItems.length) return false;
  return nextItems.every((item, index) => {
    const a = planItemComparable(existingItems[index]);
    const b = planItemComparable({ ...item, day_index: index });
    return JSON.stringify(a) === JSON.stringify(b);
  });
}

export async function savePlan(session, plan, items) {
  const owner = ownerId(session);
  const supabase = getSupabase();

  let existingItems = [];
  if (plan.id) {
    const { data, error } = await supabase
      .from('spo_plan_items')
      .select('*')
      .eq('plan_id', plan.id)
      .is('deleted_at', null)
      .order('day_index', { ascending: true });
    if (error) throw error;
    existingItems = data ?? [];
  }

  const { data: savedPlan, error: planError } = await supabase
    .from('spo_plans')
    .upsert({
      ...(plan.id ? { id: plan.id } : {}),
      owner_id: owner,
      title: plan.title,
      notes: plan.notes ?? null,
    })
    .select()
    .single();
  if (planError) throw planError;

  // Reine Namens-/Notizänderungen müssen die Plan-Tage nicht anfassen.
  if (plan.id && samePlanItems(existingItems, items)) {
    return { ...savedPlan, _itemsChanged: false };
  }

  const { error: delError } = await supabase
    .from('spo_plan_items')
    .delete()
    .eq('plan_id', savedPlan.id);
  if (delError) throw delError;

  if (items.length > 0) {
    const { error: itemError } = await supabase
      .from('spo_plan_items')
      .insert(items.map((item, index) => ({
        owner_id: owner,
        plan_id: savedPlan.id,
        day_index: index,
        unit_id: item.unit_id ?? null,
        title: item.title,
        type_key: item.type_key ?? null,
        duration_min: item.duration_min ?? null,
        is_rest: item.is_rest ?? false,
        notes: item.notes ?? null,
      })));
    if (itemError) throw itemError;
  }

  return { ...savedPlan, _itemsChanged: true };
}

export async function deletePlan(id) {
  const { error } = await getSupabase()
    .from('spo_plans')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw error;
}

// Aktiver Plan (Dauerplan): Aktivieren, Wechseln, Beenden und das Auffüllen
// des Kalenders liegen in core/lib/sportPlanSync.js, weil der Hub es ebenfalls braucht.
