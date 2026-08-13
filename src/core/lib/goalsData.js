import { getSupabase } from './supabaseClient';

// Ziele & Meilensteine. Jedes Ziel gehört einem source_module (analog zu
// measurements) — angelegt/bearbeitet wird im jeweiligen Modul über
// core/components/GoalsSection.jsx, core/Profile.jsx liest nur eine
// modulübergreifende Vorschau.

function ownerId(session) {
  return session.user.id;
}

export async function getGoals(session, sourceModule) {
  let query = getSupabase()
    .from('goals')
    .select('*')
    .eq('owner_id', ownerId(session))
    .is('deleted_at', null)
    .order('created_at', { ascending: true });
  if (sourceModule) query = query.eq('source_module', sourceModule);
  const { data, error } = await query;
  if (error) throw error;
  return data;
}

export async function saveGoal(session, goal) {
  const payload = {
    owner_id: ownerId(session),
    source_module: goal.source_module,
    title: goal.title,
    target_value: goal.target_value ?? null,
    unit: goal.unit ?? null,
    target_date: goal.target_date ?? null,
    milestones: goal.milestones ?? [],
    achieved_at: goal.achieved_at ?? null,
  };
  if (goal.id) payload.id = goal.id;
  const { data, error } = await getSupabase().from('goals').upsert(payload).select().single();
  if (error) throw error;
  return data;
}

export async function deleteGoal(id) {
  const { error } = await getSupabase()
    .from('goals')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw error;
}

export async function toggleMilestone(session, goal, index) {
  const milestones = goal.milestones.map((m, i) => (i === index ? { ...m, done: !m.done } : m));
  return saveGoal(session, { ...goal, milestones });
}
