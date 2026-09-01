import { getSupabase } from '../../../core/lib/supabaseClient';
import { templateAppliesTo, MONTHS_DE } from './finance';

function ownerId(session) {
  return session.user.id;
}

// ---------------------------------------------------------------------
// Entries
// ---------------------------------------------------------------------

export async function getEntriesByMonth(session, year, month) {
  const { data, error } = await getSupabase()
    .from('fin_entries')
    .select('*')
    .eq('owner_id', ownerId(session))
    .eq('year', year)
    .eq('month', month)
    .is('deleted_at', null)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data;
}

export async function getAllEntries(session) {
  const { data, error } = await getSupabase()
    .from('fin_entries')
    .select('*')
    .eq('owner_id', ownerId(session))
    .is('deleted_at', null);
  if (error) throw error;
  return data;
}

export async function saveEntry(session, entry) {
  const payload = { ...entry, owner_id: ownerId(session) };
  const { data, error } = await getSupabase().from('fin_entries').upsert(payload).select().single();
  if (error) throw error;
  return data;
}

export async function deleteEntry(id) {
  const { error } = await getSupabase()
    .from('fin_entries')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw error;
}

export async function togglePaid(id, paid) {
  const { error } = await getSupabase().from('fin_entries').update({ paid }).eq('id', id);
  if (error) throw error;
}

// ---------------------------------------------------------------------
// Fixe Vorlagen
// ---------------------------------------------------------------------

export async function getFixTemplates(session) {
  const { data, error } = await getSupabase()
    .from('fin_fixtemplates')
    .select('*')
    .eq('owner_id', ownerId(session))
    .is('deleted_at', null);
  if (error) throw error;
  return data;
}

// Felder die NICHT in fin_fixtemplates gespeichert werden dürfen
// (React-interne Flags, Join-Felder aus ContractsView etc.)
const TEMPLATE_STRIP = ['_src', 'updated_at'];

export async function saveFixTemplate(session, tpl) {
  const isUpdate = !!tpl.id;
  // Payload bereinigen: unbekannte Felder entfernen, leere Strings → null
  const payload = Object.fromEntries(
    Object.entries({ ...tpl, owner_id: ownerId(session) })
      .filter(([k]) => !TEMPLATE_STRIP.includes(k))
      .map(([k, v]) => [k, v === '' ? null : v])
  );
  const { data: saved, error } = await getSupabase()
    .from('fin_fixtemplates')
    .upsert(payload)
    .select()
    .single();
  if (error) throw error;

  // Bei einem Update: abhängige fin_entries synchronisieren.
  // Nur nicht-bezahlte Einträge werden aktualisiert — bezahlte sind
  // bereits abgerechnet und sollen die historische Wahrheit bewahren.
  if (isUpdate) {
    await syncTemplateEntries(session, saved);
  }

  return saved;
}

// Synchronisiert alle fin_entries die von dieser Vorlage stammen:
//  • Name und Betrag werden in noch nicht bezahlten Einträgen aktualisiert
//  • Einträge in Monaten die nach dem Intervall nicht mehr fällig sind
//    werden soft-deleted
//  • Fehlende Einträge in Monaten wo die Vorlage fällig ist werden
//    angelegt (nur für bereits existierende Monate, nicht in der Zukunft
//    über den aktuellen Monat hinaus)
async function syncTemplateEntries(session, tpl) {
  const now = new Date();
  const currentYear  = now.getFullYear();
  const currentMonth = now.getMonth() + 1;

  // Alle Einträge dieser Vorlage holen (inkl. soft-deleted, um
  // Doppelanlage zu vermeiden)
  const { data: allEntries, error } = await getSupabase()
    .from('fin_entries')
    .select('*')
    .eq('owner_id', ownerId(session))
    .eq('from_template', tpl.id);
  if (error) throw error;

  const activeEntries = allEntries.filter((e) => !e.deleted_at);

  for (const entry of activeEntries) {
    const applies = templateAppliesTo(tpl, entry.year, entry.month);
    const isFuture = entry.year > currentYear ||
      (entry.year === currentYear && entry.month > currentMonth);

    if (!applies) {
      // Vorlage gilt nicht mehr für diesen Monat (Intervall geändert) →
      // nur löschen wenn noch nicht bezahlt; bezahlte sind historisch
      if (!entry.paid) {
        await getSupabase()
          .from('fin_entries')
          .update({ deleted_at: new Date().toISOString() })
          .eq('id', entry.id);
      }
    } else {
      // Name, Betrag und Zahlungsart in ALLEN Einträgen nachziehen —
      // auch in bezahlten, damit die Monatsansicht konsistent bleibt.
      // Ausnahme: der amount bezahlter Vergangenheits-Einträge bleibt
      // unverändert (historische Wahrheit), nur Name und Zahlung folgen.
      const isPastPaid = entry.paid && !isFuture;
      await getSupabase()
        .from('fin_entries')
        .update(isPastPaid
          ? { name: tpl.name, payment: tpl.payment }          // Betrag bleibt
          : { name: tpl.name, amount: tpl.amount, payment: tpl.payment }
        )
        .eq('id', entry.id);
    }
  }

  // Fehlende Einträge für bereits existierende Monate anlegen
  // (nur bis inkl. aktuellem Monat — keine Zukunft)
  const existingKeys = new Set(
    allEntries.filter((e) => !e.deleted_at).map((e) => `${e.year}-${e.month}`)
  );
  // Welche Monate wurden überhaupt je für diesen User genutzt?
  const allUserEntries = await getAllEntries(session);
  const usedKeys = new Set(allUserEntries.map((e) => `${e.year}-${e.month}`));
  usedKeys.add(`${currentYear}-${currentMonth}`);

  for (const key of usedKeys) {
    const [y, m] = key.split('-').map(Number);
    const isFutureMonth = y > currentYear || (y === currentYear && m > currentMonth);
    if (isFutureMonth) continue;
    if (existingKeys.has(key)) continue;
    if (!templateAppliesTo(tpl, y, m)) continue;
    await saveEntry(session, templateToEntry(tpl, y, m));
  }
}

// ---------------------------------------------------------------------
// Vorlage löschen — entfernt auch alle abhängigen fin_entries
// ---------------------------------------------------------------------

export async function deleteFixTemplate(session, id) {
  const now = new Date().toISOString();

  // 1. Vorlage selbst soft-deleten
  const { error: tplErr } = await getSupabase()
    .from('fin_fixtemplates')
    .update({ deleted_at: now })
    .eq('id', id);
  if (tplErr) throw tplErr;

  // 2. ALLE fin_entries dieser Vorlage soft-deleten — auch bezahlte.
  //    Begründung: Eine Vorlage ist eine Wiederkehr-Regel. Wird sie
  //    gelöscht, soll sie aus ALLEN Monaten verschwinden, auch aus
  //    vergangenen. Wer einen einzelnen historischen Eintrag behalten
  //    will, trennt ihn manuell vom Template (from_template auf null).
  const { error: entryErr } = await getSupabase()
    .from('fin_entries')
    .update({ deleted_at: now })
    .eq('from_template', id)
    .is('deleted_at', null);
  if (entryErr) throw entryErr;
}

function templateToEntry(t, year, month) {
  return {
    category: t.category,
    year,
    month,
    name: t.name,
    payment: t.payment,
    amount: t.amount,
    paid: t.payment === 'Bar',
    from_template: t.id,
  };
}

// Prüft direkt gegen die Datenbank, welche Vorlagen in diesem Monat noch
// fehlen, und legt sie an.
export async function applyMissingFixTemplates(session, year, month) {
  const [templates, monthEntries] = await Promise.all([
    getFixTemplates(session),
    getEntriesByMonth(session, year, month),
  ]);
  let added = 0;
  for (const t of templates) {
    if (!templateAppliesTo(t, year, month)) continue;
    const exists = monthEntries.some((e) => e.from_template === t.id);
    if (!exists) {
      await saveEntry(session, templateToEntry(t, year, month));
      added++;
    }
  }
  return added;
}

// Beim Anlegen einer neuen Vorlage: auf alle bereits genutzten Monate
// rückwirkend anwenden, plus den aktuell angezeigten Monat.
export async function applyNewTemplateEverywhere(session, tpl, currentYear, currentMonth) {
  const allEntries = await getAllEntries(session);
  const keys = new Set([
    ...allEntries.map((e) => `${e.year}-${e.month}`),
    `${currentYear}-${currentMonth}`,
  ]);
  for (const key of keys) {
    const [year, month] = key.split('-').map(Number);
    if (!templateAppliesTo(tpl, year, month)) continue;
    const exists = allEntries.some(
      (e) => e.year === year && e.month === month && e.from_template === tpl.id
    );
    if (!exists) await saveEntry(session, templateToEntry(tpl, year, month));
  }
}

// ---------------------------------------------------------------------
// Verträge
// ---------------------------------------------------------------------

export async function getContracts(session) {
  const { data, error } = await getSupabase()
    .from('fin_contracts')
    .select('*')
    .eq('owner_id', ownerId(session))
    .is('deleted_at', null)
    .order('name', { ascending: true });
  if (error) throw error;
  return data;
}

export async function saveContract(session, contract) {
  const payload = { ...contract, owner_id: ownerId(session) };
  const { data, error } = await getSupabase().from('fin_contracts').upsert(payload).select().single();
  if (error) throw error;
  return data;
}

export async function deleteContract(id) {
  const { error } = await getSupabase()
    .from('fin_contracts')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw error;
}

// ---------------------------------------------------------------------
// Ersparnisse
// ---------------------------------------------------------------------

export async function getSavingsByYear(session, year) {
  const { data, error } = await getSupabase()
    .from('fin_savings')
    .select('*')
    .eq('owner_id', ownerId(session))
    .eq('year', year)
    .is('deleted_at', null);
  if (error) throw error;
  return data;
}

export async function saveSaving(session, saving) {
  const payload = { ...saving, owner_id: ownerId(session) };
  const { data, error } = await getSupabase().from('fin_savings').upsert(payload).select().single();
  if (error) throw error;
  return data;
}

// ---------------------------------------------------------------------
// Export/Import
// ---------------------------------------------------------------------

export async function exportAllData(session) {
  const [entries, savings, contracts, fixtemplates] = await Promise.all([
    getAllEntries(session),
    getSupabase().from('fin_savings').select('*').eq('owner_id', ownerId(session)).is('deleted_at', null).then(r => r.data),
    getContracts(session),
    getFixTemplates(session),
  ]);
  return { version: 1, exportedAt: new Date().toISOString(), entries, savings, contracts, fixtemplates };
}

// ---------------------------------------------------------------------
// Alle Daten löschen
// ---------------------------------------------------------------------

export async function deleteAllData(session) {
  const owner = ownerId(session);
  for (const table of ['fin_entries', 'fin_savings', 'fin_contracts', 'fin_fixtemplates']) {
    const { error } = await getSupabase().from(table).delete().eq('owner_id', owner);
    if (error) throw error;
  }
}

// ---------------------------------------------------------------------
// XLSX-Migration
// ---------------------------------------------------------------------

export function parseXlsxWorkbook(XLSX, workbook, importYear) {
  const entries = [];
  const savings = [];

  for (const sheetName of workbook.SheetNames) {
    const monthIdx = MONTHS_DE.indexOf(sheetName);
    if (monthIdx === -1) continue;
    const month = monthIdx + 1;
    const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1, defval: null });

    let currentCat = null;

    for (let r = 2; r < rows.length; r++) {
      const row = rows[r];
      if (!row) continue;

      const nameA = row[0], payA = row[1], amtA = row[2];
      if (nameA && typeof nameA === 'string') {
        if (nameA === 'Fixeinnahmen') currentCat = 'fixeinnahmen';
        else if (nameA === 'Sonstige Einnahmen') currentCat = 'sonstige_einnahmen';
        else if (nameA === 'letzter Monat') {
          if (typeof amtA === 'number' && amtA !== 0) {
            entries.push({ year: importYear, month, category: 'sonstige_einnahmen',
              name: 'Übertrag letzter Monat', payment: payA || 'Bank', amount: amtA });
          }
        } else if (!['Summe', 'Name', 'Einnahmen'].includes(nameA) && typeof amtA === 'number') {
          entries.push({ year: importYear, month, category: currentCat || 'fixeinnahmen',
            name: nameA.trim(), payment: payA || 'Bank', amount: amtA });
        }
      }

      const nameB = row[3], payB = row[4], amtB = row[5];
      if (nameB && typeof nameB === 'string' &&
          !['Summe', 'Name', 'Fixkosten'].includes(nameB) && typeof amtB === 'number') {
        entries.push({ year: importYear, month, category: 'fixkosten',
          name: nameB.trim(), payment: payB || 'Bank', amount: amtB });
      }

      const nameC = row[6], payC = row[7], amtC = row[8];
      if (nameC && typeof nameC === 'string' &&
          !['Summe', 'Name', 'Sonstige Ausgaben'].includes(nameC) && typeof amtC === 'number') {
        entries.push({ year: importYear, month, category: 'sonstige_ausgaben',
          name: nameC.trim(), payment: payC || 'Bar', amount: amtC });
      }
    }
  }

  if (workbook.SheetNames.includes('Auswertung')) {
    const rows = XLSX.utils.sheet_to_json(workbook.Sheets['Auswertung'], { header: 1, defval: null });
    let inSavings = false;
    for (const row of rows) {
      if (!row) continue;
      if (row[0] === 'Ersparnisse') { inSavings = true; continue; }
      if (!inSavings) continue;
      const monthIdx = MONTHS_DE.indexOf(row[0]);
      if (monthIdx !== -1 && typeof row[1] === 'number') {
        savings.push({ year: importYear, month: monthIdx + 1, amount: row[1], note: row[2] ? String(row[2]) : '' });
      }
    }
  }

  return { entries, savings };
}

export async function saveXlsxImport(session, entries, savings) {
  const counters = { paymentFixed: 0 };
  for (const e of entries) {
    await saveEntry(session, { ...e, payment: normalizePayment(e.payment, counters), paid: false });
  }
  for (const s of savings) {
    await saveSaving(session, s);
  }
  return counters;
}

function toIso(msOrIso) {
  if (!msOrIso) return new Date().toISOString();
  if (typeof msOrIso === 'number') return new Date(msOrIso).toISOString();
  return msOrIso;
}

function fixLegacyCategory(category, name) {
  if (category === 'fixkosten') {
    const n = (name || '').toLowerCase();
    if (n.includes('urlaub') || n.includes('spargeld')) return 'variable_kosten';
  }
  return category;
}

const KNOWN_PAYMENTS = new Set(['Bank', 'Bar', 'Paypal', 'SEPA', 'Gutschein', 'Klarna']);
function normalizePayment(p, counters) {
  const trimmed = (p || '').trim();
  if (KNOWN_PAYMENTS.has(trimmed)) return trimmed;
  counters.paymentFixed++;
  return 'Bank';
}

export async function importLegacyBackup(session, data, currentYear, currentMonth) {
  const counts = { entries: 0, savings: 0, contracts: 0, fixtemplates: 0, paymentFixed: 0 };

  for (const e of data.entries || []) {
    const category = fixLegacyCategory(e.category, e.name);
    await saveEntry(session, {
      id: e.id, year: e.year, month: e.month, category,
      name: e.name, payment: normalizePayment(e.payment, counts),
      amount: e.amount, paid: !!e.paid,
      from_template: e.from_template ?? e.fromTemplate ?? null,
      created_at: toIso(e.created_at ?? e.createdAt),
    });
    counts.entries++;
  }

  for (const t of data.fixtemplates || []) {
    await saveFixTemplate(session, {
      id: t.id, category: t.category, name: t.name,
      payment: normalizePayment(t.payment, counts),
      amount: t.amount, quarterly: !!t.quarterly,
      start_month: t.start_month ?? t.startMonth ?? null,
      start_year: t.start_year ?? t.startYear ?? null,
    });
    counts.fixtemplates++;
  }

  for (const s of data.savings || []) {
    await saveSaving(session, { year: s.year, month: s.month, amount: s.amount, note: s.note || null });
    counts.savings++;
  }

  for (const c of data.contracts || []) {
    const isMonthly = c.is_monthly ?? c.end === 'monatlich';
    await saveContract(session, {
      id: c.id, name: c.name, amount: c.amount, duration: c.duration || null,
      start_date: c.start_date ?? c.start ?? null,
      end_date: isMonthly ? null : (c.end_date ?? (c.end !== 'monatlich' ? c.end : null)) || null,
      is_monthly: isMonthly,
      payment: c.payment ? normalizePayment(c.payment, counts) : null,
      cancellation: c.cancellation || null,
    });
    counts.contracts++;
  }

  return counts;
}

