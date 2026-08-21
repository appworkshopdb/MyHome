// modules/shopping/lib/shoData.js
// Alle Supabase-Zugriffe für das Einkauf-Modul.
// Muster identisch zu habData.js — getOwnerIdFromToken() aus localStorage,
// getSupabase() für alle Abfragen, Soft Delete via deleted_at.

import { getSupabase } from '../../../core/lib/supabaseClient.js';

// owner_id aus dem JWT-Token lesen (sub-claim = user UUID).
// Analog zu rawAuth.js: kein supabase.auth.getUser(),
// stattdessen Token selbst dekodieren.
function getOwnerIdFromToken() {
  try {
    const token = JSON.parse(localStorage.getItem('zuhause_session') || '{}').access_token;
    if (!token) throw new Error('Kein Token gefunden');
    const payload = JSON.parse(atob(token.split('.')[1]));
    return payload.sub; // sub = user UUID
  } catch (e) {
    throw new Error('Nicht eingeloggt oder Token ungültig');
  }
}

// ─── Listen ───────────────────────────────────────────────────

export async function loadLists() {
  const sb = getSupabase();
  const { data, error } = await sb
    .from('sho_lists')
    .select('*')
    .is('deleted_at', null)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function saveList(list) {
  const sb = getSupabase();
  if (list.id) {
    const { data, error } = await sb
      .from('sho_lists')
      .update({
        name:       list.name,
        icon:       list.icon ?? null,
        sort_order: list.sort_order ?? 0,
      })
      .eq('id', list.id)
      .select()
      .single();
    if (error) throw error;
    return data;
  } else {
    const owner_id = getOwnerIdFromToken();
    const { data, error } = await sb
      .from('sho_lists')
      .insert({
        owner_id,
        name:       list.name,
        icon:       list.icon ?? null,
        sort_order: list.sort_order ?? 0,
      })
      .select()
      .single();
    if (error) throw error;
    return data;
  }
}

export async function deleteList(listId) {
  const sb = getSupabase();
  const { error } = await sb
    .from('sho_lists')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', listId);
  if (error) throw error;
}

// ─── Artikel ──────────────────────────────────────────────────

export async function loadItems(listId) {
  const sb = getSupabase();
  const { data, error } = await sb
    .from('sho_items')
    .select('*')
    .eq('list_id', listId)
    .is('deleted_at', null)
    .order('done', { ascending: true })      // offene Artikel zuerst
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function saveItem(item) {
  const sb = getSupabase();
  if (item.id) {
    const { data, error } = await sb
      .from('sho_items')
      .update({
        name:       item.name,
        category:   item.category ?? null,
        quantity:   item.quantity ?? null,
        unit:       item.unit ?? null,
        note:       item.note ?? null,
        sort_order: item.sort_order ?? 0,
      })
      .eq('id', item.id)
      .select()
      .single();
    if (error) throw error;
    return data;
  } else {
    const owner_id = getOwnerIdFromToken();
    const { data, error } = await sb
      .from('sho_items')
      .insert({
        owner_id,
        list_id:    item.list_id,
        name:       item.name,
        category:   item.category ?? null,
        quantity:   item.quantity ?? null,
        unit:       item.unit ?? null,
        note:       item.note ?? null,
        done:       false,
        sort_order: item.sort_order ?? 0,
      })
      .select()
      .single();
    if (error) throw error;
    return data;
  }
}

export async function toggleItemDone(itemId, done) {
  const sb = getSupabase();
  const { data, error } = await sb
    .from('sho_items')
    .update({ done })
    .eq('id', itemId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteItem(itemId) {
  const sb = getSupabase();
  const { error } = await sb
    .from('sho_items')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', itemId);
  if (error) throw error;
}

// Alle erledigten Artikel einer Liste entfernen (Soft Delete).
// Wird nach dem Einkauf verwendet — "Liste leeren".
export async function clearDoneItems(listId) {
  const sb = getSupabase();
  const { error } = await sb
    .from('sho_items')
    .update({ deleted_at: new Date().toISOString() })
    .eq('list_id', listId)
    .eq('done', true)
    .is('deleted_at', null);
  if (error) throw error;
}

// Alle Artikel einer Liste auf "nicht erledigt" zurücksetzen.
// Nützlich für wiederkehrende Listen (gleiche Liste neu nutzen).
export async function resetAllItems(listId) {
  const sb = getSupabase();
  const { error } = await sb
    .from('sho_items')
    .update({ done: false })
    .eq('list_id', listId)
    .is('deleted_at', null);
  if (error) throw error;
}
