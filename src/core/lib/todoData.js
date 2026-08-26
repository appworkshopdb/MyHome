import { getSupabase } from './supabaseClient';

// ── Todos ──────────────────────────────────────────────────────────────
// Einfache persönliche Aufgaben mit optionalem Fälligkeitsdatum und
// Priorität-Flag. Kein Satz-für-Satz-Tracking, kein Projektmanagement.

export async function getTodos(session) {
  const { data, error } = await getSupabase()
    .from('todos')
    .select('*')
    .eq('owner_id', session.user.id)
    .is('deleted_at', null)
    .order('priority', { ascending: false })
    .order('due_date',  { ascending: true,  nullsFirst: false })
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function saveTodo(session, todo) {
  const payload = {
    ...todo,
    owner_id: session.user.id,
  };
  const { data, error } = await getSupabase()
    .from('todos')
    .upsert(payload)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function toggleTodo(id, done) {
  const { error } = await getSupabase()
    .from('todos')
    .update({ done, done_at: done ? new Date().toISOString() : null })
    .eq('id', id);
  if (error) throw error;
}

export async function deleteTodo(id) {
  const { error } = await getSupabase()
    .from('todos')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw error;
}
