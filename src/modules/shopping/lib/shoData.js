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
  // Listen laden inkl. Item-Counts für Status-Berechnung
  const { data, error } = await sb
    .from('sho_lists')
    .select('*, sho_items!sho_items_list_id_fkey(id, done, deleted_at)')
    .is('deleted_at', null)
    .eq('is_template', false)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true });
  if (error) throw error;

  // Item-Counts berechnen und anhängen
  return (data ?? []).map((list) => {
    const allItems = (list.sho_items || []).filter((i) => !i.deleted_at);
    const total    = allItems.length;
    const done     = allItems.filter((i) => i.done).length;
    return {
      ...list,
      sho_items:   undefined, // nicht im State halten
      _total:      total,
      _done:       done,
    };
  });
}

export async function updateListStatus(listId, status) {
  const sb = getSupabase();
  const { error } = await sb
    .from('sho_lists')
    .update({ status })
    .eq('id', listId);
  if (error) throw error;
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
        due_date:   list.due_date  || null,
        due_time:   list.due_time  || null,
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
        due_date:   list.due_date  || null,
        due_time:   list.due_time  || null,
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
    .order('done', { ascending: true })
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
        name:            item.name,
        category:        item.category        ?? null,
        quantity:        item.quantity        ?? null,
        unit:            item.unit            ?? null,
        note:            item.note            ?? null,
        item_store_name: item.item_store_name ?? null,
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
        list_id:         item.list_id,
        name:            item.name,
        category:        item.category        ?? null,
        quantity:        item.quantity        ?? null,
        unit:            item.unit            ?? null,
        note:            item.note            ?? null,
        item_store_name: item.item_store_name ?? null,
        done:            false,
        sort_order:      item.sort_order      ?? 0,
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

// ─── Vorlagen ─────────────────────────────────────────────────
// Eine Vorlage ist eine Liste mit is_template = true.
// Artikel einer Vorlage werden per "Als Liste laden" in eine
// neue normale Liste kopiert — keine eigene Tabelle nötig.

export async function saveListAsTemplate(listId, templateName) {
  const sb = getSupabase();
  const owner_id = getOwnerIdFromToken();

  // Vorlage-Liste anlegen
  const { data: tmpl, error: e1 } = await sb
    .from('sho_lists')
    .insert({ owner_id, name: templateName, icon: '📋', is_template: true })
    .select()
    .single();
  if (e1) throw e1;

  // Alle offenen Artikel der Quellliste kopieren
  const { data: sourceItems, error: e2 } = await sb
    .from('sho_items')
    .select('name, category, quantity, unit, note, sort_order')
    .eq('list_id', listId)
    .is('deleted_at', null)
    .eq('done', false);
  if (e2) throw e2;

  if (sourceItems && sourceItems.length > 0) {
    const copies = sourceItems.map((item) => ({
      owner_id,
      list_id:    tmpl.id,
      name:       item.name,
      category:   item.category,
      quantity:   item.quantity,
      unit:       item.unit,
      note:       item.note,
      sort_order: item.sort_order,
      done:       false,
    }));
    const { error: e3 } = await sb.from('sho_items').insert(copies);
    if (e3) throw e3;
  }
  return tmpl;
}

export async function loadTemplates() {
  const sb = getSupabase();
  const { data, error } = await sb
    .from('sho_lists')
    .select('*')
    .eq('is_template', true)
    .is('deleted_at', null)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function loadFromTemplate(templateId, newListName, newListIcon) {
  const sb = getSupabase();
  const owner_id = getOwnerIdFromToken();

  // Neue Liste anlegen
  const { data: newList, error: e1 } = await sb
    .from('sho_lists')
    .insert({ owner_id, name: newListName, icon: newListIcon ?? '🛒', is_template: false })
    .select()
    .single();
  if (e1) throw e1;

  // Vorlage-Artikel kopieren
  const { data: tmplItems, error: e2 } = await sb
    .from('sho_items')
    .select('name, category, quantity, unit, note, sort_order')
    .eq('list_id', templateId)
    .is('deleted_at', null);
  if (e2) throw e2;

  if (tmplItems && tmplItems.length > 0) {
    const copies = tmplItems.map((item) => ({
      owner_id,
      list_id:    newList.id,
      name:       item.name,
      category:   item.category,
      quantity:   item.quantity,
      unit:       item.unit,
      note:       item.note,
      sort_order: item.sort_order,
      done:       false,
    }));
    const { error: e3 } = await sb.from('sho_items').insert(copies);
    if (e3) throw e3;
  }
  return newList;
}

// Häufig gekaufte Artikel: Alle nicht-gelöschten Items aggregieren,
// nach Artikelname gruppieren und nach Häufigkeit sortieren.
export async function loadFrequentItems(limit = 20) {
  const sb = getSupabase();
  // Nur abgehakte, nicht gelöschte Items aus normalen Listen laden
  const { data, error } = await sb
    .from('sho_items')
    .select('name, category, quantity, unit, list_id')
    .is('deleted_at', null)
    .eq('done', true)            // NUR abgehakte Items zählen
    .order('created_at', { ascending: false })
    .limit(1000);
  if (error) throw error;

  // Client-seitig nach Name gruppieren + zählen
  const counts = {};
  for (const item of (data ?? [])) {
    const key = item.name.trim().toLowerCase();
    if (!counts[key]) {
      counts[key] = {
        name:     item.name,
        category: item.category,
        count:    0,
        quantity: item.quantity,
        unit:     item.unit,
      };
    }
    counts[key].count++;
    // Letzte Menge/Einheit merken (neueste wins durch DESC-Order)
    if (item.quantity || item.unit) {
      counts[key].quantity = item.quantity;
      counts[key].unit     = item.unit;
    }
  }

  const all = Object.values(counts).sort((a, b) => b.count - a.count);

  // Unter 2 verschiedenen Artikel-Typen: alle anzeigen (noch wenig Daten)
  // Ab 2+: nach Häufigkeit sortiert zurückgeben
  return all.slice(0, limit);
}

// ─── Läden pro Liste ──────────────────────────────────────────

export async function loadListStores(listId) {
  const sb = getSupabase();
  const { data, error } = await sb
    .from('sho_list_stores')
    .select('*')
    .eq('list_id', listId)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function saveListStore(listId, storeName) {
  const sb = getSupabase();
  const owner_id = getOwnerIdFromToken();
  const { data, error } = await sb
    .from('sho_list_stores')
    .insert({ owner_id, list_id: listId, store_name: storeName })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteListStore(storeId) {
  // Löscht den Laden — sho_items.list_store_id wird automatisch auf null gesetzt (ON DELETE SET NULL)
  const sb = getSupabase();
  const { error } = await sb
    .from('sho_list_stores')
    .delete()
    .eq('id', storeId);
  if (error) throw error;
}

export async function assignItemToStore(itemId, listStoreId) {
  const sb = getSupabase();
  const { error } = await sb
    .from('sho_items')
    .update({ list_store_id: listStoreId })
    .eq('id', itemId);
  if (error) throw error;
}
