// modules/finance/lib/reportPrefs.js
//
// Gespeicherte Ansicht der Auswertung: Reihenfolge, ausgeblendete und
// eingeklappte Bereiche, Filter. Liegt pro Nutzer in Supabase
// (Tabelle fin_report_prefs, eine Zeile mit jsonb), damit die Ansicht auf
// jedem Gerät gleich ist. localStorage dient als Zwischenspeicher und als
// Rückfall, falls die Tabelle (noch) nicht existiert oder der Server nicht
// erreichbar ist — die Auswertung funktioniert dann trotzdem, nur geräte-
// lokal. Migration: supabase/fin_report_prefs_migration.sql

import { getSupabase } from '../../../core/lib/supabaseClient';
import {
  ALL_CATS, TYPES, PAYMENTS, DEFAULT_FILTERS,
} from './analytics.js';

export const SECTION_IDS = [
  'kpi', 'monat', 'verlauf', 'insights', 'tabelle',
  'kategorien', 'posten', 'vertraege', 'fristen', 'zahlung',
];
export const DEFAULT_COLLAPSED = ['insights', 'tabelle', 'fristen'];

const PRESETS = ['month', 'quarter', 'year', 'custom'];
const LS_PREFIX = 'nestua_fin_report_prefs_v1:';

export function defaultPrefs() {
  return {
    v: 1,
    preset: 'year',
    order: [...SECTION_IDS],
    hidden: [],
    collapsed: [...DEFAULT_COLLAPSED],
    local: { vStatus: 'alle', vInterval: 'alle', horizon: 90, postenBy: 'name' },
    filters: { ...DEFAULT_FILTERS },
  };
}

const pickList = (v, allowed, fallback) => {
  if (!Array.isArray(v)) return fallback;
  const out = allowed.filter((x) => v.includes(x));
  return out.length > 0 ? out : fallback;
};
const num = (v) => (v === null || v === undefined || v === '' || !Number.isFinite(Number(v)) ? null : Number(v));

// Unbekanntes verwerfen, Fehlendes mit Standard auffüllen — auch alte oder
// kaputte Einträge dürfen die Auswertung nie zum Absturz bringen.
export function sanitizePrefs(raw) {
  const d = defaultPrefs();
  if (!raw || typeof raw !== 'object') return d;

  let order = Array.isArray(raw.order) ? raw.order.filter((id, i, a) => SECTION_IDS.includes(id) && a.indexOf(id) === i) : [];
  order = [...order, ...SECTION_IDS.filter((id) => !order.includes(id))];

  const ids = (v, fallback) => (Array.isArray(v) ? v.filter((id) => SECTION_IDS.includes(id)) : fallback);
  const l = raw.local && typeof raw.local === 'object' ? raw.local : {};
  const f = raw.filters && typeof raw.filters === 'object' ? raw.filters : {};
  const ivs = ['alle', 'monthly', 'quarterly', 'biannually', 'annually'];

  return {
    v: 1,
    preset: PRESETS.includes(raw.preset) ? raw.preset : d.preset,
    order,
    hidden: ids(raw.hidden, d.hidden),
    collapsed: ids(raw.collapsed, d.collapsed),
    local: {
      vStatus: ['alle', 'aktiv', 'aus', 'abg'].includes(l.vStatus) ? l.vStatus : 'alle',
      vInterval: ivs.includes(l.vInterval) ? l.vInterval : 'alle',
      horizon: [30, 90, 180].includes(l.horizon) ? l.horizon : 90,
      postenBy: l.postenBy === 'category' ? 'category' : 'name',
    },
    filters: {
      types: pickList(f.types, TYPES, d.filters.types),
      categories: pickList(f.categories, ALL_CATS, d.filters.categories),
      payments: pickList(f.payments, PAYMENTS, d.filters.payments),
      status: ['alle', 'bezahlt', 'offen'].includes(f.status) ? f.status : 'alle',
      origin: ['alle', 'vorlage', 'manuell'].includes(f.origin) ? f.origin : 'alle',
      amountMin: num(f.amountMin),
      amountMax: num(f.amountMax),
      name: typeof f.name === 'string' ? f.name.slice(0, 80) : '',
      savingsMode: ['separat', 'ausgabe', 'aus'].includes(f.savingsMode) ? f.savingsMode : 'separat',
      compare: ['none', 'prev', 'year'].includes(f.compare) ? f.compare : 'year',
    },
  };
}

const ownerId = (session) => session.user.id;

function readLocal(session) {
  try { return JSON.parse(localStorage.getItem(LS_PREFIX + ownerId(session))); } catch { return null; }
}
function writeLocal(session, prefs) {
  try { localStorage.setItem(LS_PREFIX + ownerId(session), JSON.stringify(prefs)); } catch { /* privater Modus */ }
}

// -> { prefs, synced }. synced=false: Server nicht nutzbar, nur lokal gespeichert.
export async function loadReportPrefs(session) {
  const local = readLocal(session);
  try {
    const { data, error } = await getSupabase()
      .from('fin_report_prefs')
      .select('layout')
      .eq('owner_id', ownerId(session))
      .maybeSingle();
    if (error) throw error;
    if (data?.layout && Object.keys(data.layout).length > 0) {
      const prefs = sanitizePrefs(data.layout);
      writeLocal(session, prefs);
      return { prefs, synced: true };
    }
    return { prefs: sanitizePrefs(local), synced: true };
  } catch (e) {
    console.warn('fin_report_prefs nicht lesbar, nutze lokale Ansicht:', e?.message || e);
    return { prefs: sanitizePrefs(local), synced: false };
  }
}

export async function saveReportPrefs(session, prefs) {
  writeLocal(session, prefs);
  const { error } = await getSupabase()
    .from('fin_report_prefs')
    .upsert({ owner_id: ownerId(session), layout: prefs }, { onConflict: 'owner_id' });
  if (error) throw error;
}
