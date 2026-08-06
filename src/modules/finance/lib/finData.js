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
  // Soft delete, damit Sync und spätere Auswertungen konsistent bleiben.
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

export async function saveFixTemplate(session, tpl) {
  const payload = { ...tpl, owner_id: ownerId(session) };
  const { data, error } = await getSupabase().from('fin_fixtemplates').upsert(payload).select().single();
  if (error) throw error;
  return data;
}

export async function deleteFixTemplate(id) {
  const { error } = await getSupabase()
    .from('fin_fixtemplates')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw error;
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
// fehlen, und legt sie an. Bewusst ohne lokalen "seeded"-Zwischenspeicher
// (wie es das Original per localStorage tat) — das wäre bei mehreren
// Geräten die falsche Quelle der Wahrheit. Der Datenbestand selbst
// entscheidet, was schon existiert.
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
// Export/Import (Backup, nicht die primäre Sync-Methode)
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
// Alle Daten des Kontos löschen (Einstellungen → "Alle Daten löschen")
// ---------------------------------------------------------------------

export async function deleteAllData(session) {
  const owner = ownerId(session);
  // Hartes Löschen (nicht soft): der Nutzer will die Daten wirklich weg
  // haben. Die measurements im Kern hängen per Trigger an fin_entries und
  // werden dadurch automatisch mitentfernt.
  for (const table of ['fin_entries', 'fin_savings', 'fin_contracts', 'fin_fixtemplates']) {
    const { error } = await getSupabase().from(table).delete().eq('owner_id', owner);
    if (error) throw error;
  }
}

// ---------------------------------------------------------------------
// XLSX-Migration: Buchungen und Ersparnisse aus der alten Excel-/Google-
// Sheets-Tabelle einlesen. Spaltenaufteilung wie im Original:
// A–C Einnahmen, D–F Fixkosten, G–I Sonstige Ausgaben; das Blatt
// "Auswertung" enthält zusätzlich die Ersparnisse pro Monat.
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

      // Einnahmen (Spalten 0-2)
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

      // Fixkosten (Spalten 3-5)
      const nameB = row[3], payB = row[4], amtB = row[5];
      if (nameB && typeof nameB === 'string' &&
          !['Summe', 'Name', 'Fixkosten'].includes(nameB) && typeof amtB === 'number') {
        entries.push({ year: importYear, month, category: 'fixkosten',
          name: nameB.trim(), payment: payB || 'Bank', amount: amtB });
      }

      // Sonstige Ausgaben (Spalten 6-8)
      const nameC = row[6], payC = row[7], amtC = row[8];
      if (nameC && typeof nameC === 'string' &&
          !['Summe', 'Name', 'Sonstige Ausgaben'].includes(nameC) && typeof amtC === 'number') {
        entries.push({ year: importYear, month, category: 'sonstige_ausgaben',
          name: nameC.trim(), payment: payC || 'Bar', amount: amtC });
      }
    }
  }

  // Auswertungsblatt: Ersparnisse lesen
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
  return msOrIso; // bereits ein ISO-String (neues Format)
}

// Repliziert die Heuristik aus dem Original-app.js (migrateVariableKosten):
// Fixkosten-Posten mit "urlaub"/"spargeld" im Namen gehören eigentlich zu
// Variable Kosten. Die "Finanzen 2"-Version (DB_VERSION 1) hatte diese
// Migration nie durchlaufen — beim Import holen wir das hier nach.
function fixLegacyCategory(category, name) {
  if (category === 'fixkosten') {
    const n = (name || '').toLowerCase();
    if (n.includes('urlaub') || n.includes('spargeld')) return 'variable_kosten';
  }
  return category;
}

// Ältere Exporte enthalten teils frei getippte Zahlungsart-Werte (Tippfehler,
// Klammerzusätze wie "Bank (Revolut)", Reste aus einer noch älteren Excel-
// Migration wie "übrig"). Die Datenbank erlaubt nur eine feste Werteliste —
// unbekannte Werte werden hier auf "Bank" normalisiert, statt den Import
// mit einem Datenbankfehler abbrechen zu lassen.
const KNOWN_PAYMENTS = new Set(['Bank', 'Bar', 'Paypal', 'SEPA', 'Gutschein', 'Klarna']);
function normalizePayment(p, counters) {
  const trimmed = (p || '').trim();
  if (KNOWN_PAYMENTS.has(trimmed)) return trimmed;
  counters.paymentFixed++;
  return 'Bank';
}

export async function importLegacyBackup(session, data, currentYear, currentMonth) {
  const counts = { entries: 0, savings: 0, contracts: 0, fixtemplates: 0, paymentFixed: 0 };

  // Reihenfolge bewusst so: erst die eigentlichen Buchungen importieren
  // (das ist die historische Wahrheit, so wie sie tatsächlich passiert
  // ist), danach erst die Vorlagen anlegen — ohne sie rückwirkend auf
  // Monate zu erzwingen. Andersherum (Vorlagen zuerst automatisch
  // anwenden) erzeugt Duplikate für den aktuellen Monat, weil die
  // "gibt's das schon?"-Prüfung zu dem Zeitpunkt noch nichts von den
  // gleich folgenden echten Buchungen weiß.
  for (const e of data.entries || []) {
    const category = fixLegacyCategory(e.category, e.name);
    await saveEntry(session, {
      id: e.id,
      year: e.year,
      month: e.month,
      category,
      name: e.name,
      payment: normalizePayment(e.payment, counts),
      amount: e.amount,
      paid: !!e.paid,
      from_template: e.from_template ?? e.fromTemplate ?? null,
      created_at: toIso(e.created_at ?? e.createdAt),
    });
    counts.entries++;
  }

  for (const t of data.fixtemplates || []) {
    await saveFixTemplate(session, {
      id: t.id,
      category: t.category,
      name: t.name,
      payment: normalizePayment(t.payment, counts),
      amount: t.amount,
      quarterly: !!t.quarterly,
      start_month: t.start_month ?? t.startMonth ?? null,
      start_year: t.start_year ?? t.startYear ?? null,
    });
    counts.fixtemplates++;
    // Bewusst KEIN automatisches Zurückanwenden auf vergangene oder den
    // aktuellen Monat mehr — die importierten Buchungen sind bereits die
    // korrekte historische Wahrheit. Für zukünftige Monate übernimmt die
    // normale App-Logik (applyMissingFixTemplates beim Öffnen eines
    // Monats) die Vorlage automatisch, sobald sie fällig wird.
  }

  for (const s of data.savings || []) {
    await saveSaving(session, {
      year: s.year,
      month: s.month,
      amount: s.amount,
      note: s.note || null,
    });
    counts.savings++;
  }

  for (const c of data.contracts || []) {
    const isMonthly = c.is_monthly ?? c.end === 'monatlich';
    await saveContract(session, {
      id: c.id,
      name: c.name,
      amount: c.amount,
      duration: c.duration || null,
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
