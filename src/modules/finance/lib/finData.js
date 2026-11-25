import { getSupabase } from '../../../core/lib/supabaseClient';
import { invalidateHubCache } from '../../../core/lib/hubCache';
import { saveEntry, deleteEntry as softDeleteEntry } from '../../../core/lib/finEntries';
import { templateAppliesTo, dueDateFor, MONTHS_DE, isCountedDeposit, isSparschweinWithdrawal, getSparschweinWithdrawalAmount, localTodayStr as localTodayStrFin } from './finance';
import { maxForRate, rateName, rebalanceRates } from './savingsPlans';

function ownerId(session) {
  return session.user.id;
}

// ---------------------------------------------------------------------
// Sparschwein — Ledger + Kontostand
// ---------------------------------------------------------------------

// Sammelt alle Ersparnisse-/Sparschwein-Einträge aus fin_entries und
// berechnet einen laufenden Kontostand. Keine eigene Tabelle — läuft
// direkt über die vorhandenen Buchungen, inkl. deren echtem Timestamp.
export async function getSparschweinLedger(session) {
  const all = await getAllEntries(session);
  // Offene Sparplan-Raten sind noch nicht im Sparschwein (isCountedDeposit)
  const relevant = all.filter((e) => isCountedDeposit(e) || isSparschweinWithdrawal(e));

  // Chronologisch aufsteigend sortieren, um den laufenden Stand
  // korrekt hochzuzählen (created_at, Fallback auf year/month)
  relevant.sort((a, b) => {
    const ta = a.created_at ? new Date(a.created_at).getTime() : 0;
    const tb = b.created_at ? new Date(b.created_at).getTime() : 0;
    if (ta !== tb) return ta - tb;
    return (a.year * 12 + a.month) - (b.year * 12 + b.month);
  });

  let running = 0;
  let totalIn = 0;
  let totalOut = 0;
  const ledger = relevant.map((e) => {
    const isDeposit = isCountedDeposit(e);
    // Bei Teilzahlung: nur den Sparschwein-Anteil verbuchen, nicht Gesamtbetrag
    const effectiveAmount = isDeposit
      ? Number(e.amount)
      : getSparschweinWithdrawalAmount(e);
    const signedAmount = isDeposit ? effectiveAmount : -effectiveAmount;
    running += signedAmount;
    if (isDeposit) totalIn += effectiveAmount; else totalOut += effectiveAmount;
    return {
      id: e.id,
      name: e.name,
      category: e.category,
      direction: isDeposit ? 'in' : 'out',
      signedAmount,
      balanceAfter: running,
      amount: effectiveAmount,
      year: e.year,
      month: e.month,
      payment: e.payment,
      payments: e.payments,
      created_at: e.created_at,
    };
  });

  // Für die Anzeige neueste zuerst
  ledger.reverse();

  return { ledger, balance: running, totalIn, totalOut };
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

// Namensvorschläge aus bisherigen Einträgen aggregieren.
// Zählt Häufigkeit je Name (case-insensitive gruppiert), merkt sich die
// zuletzt genutzte Kategorie + Zahlungsart, und gibt bei einer Eingabe
// die am Wortanfang passenden Namen zurück — häufigste zuerst.
export async function getNameSuggestions(session) {
  const entries = await getAllEntries(session);
  // key = lowercase name; value = { name (Original-Schreibweise der
  // häufigsten Variante), count, cat, payment, lastCreated }
  const map = new Map();
  for (const e of entries) {
    const raw = (e.name || '').trim();
    if (!raw) continue;
    const key = raw.toLowerCase();
    const prev = map.get(key);
    const created = e.created_at ? new Date(e.created_at).getTime() : 0;
    if (!prev) {
      map.set(key, { name: raw, count: 1, cat: e.category, payment: e.payment, payments: e.payments, lastCreated: created });
    } else {
      prev.count += 1;
      // Kategorie/Zahlungsart vom jüngsten Eintrag übernehmen
      if (created >= prev.lastCreated) {
        prev.cat = e.category;
        prev.payment = e.payment;
        if (e.payments) prev.payments = e.payments;
        prev.name = raw; // jüngste Schreibweise gewinnt
        prev.lastCreated = created;
      }
    }
  }
  return Array.from(map.values());
}

// saveEntry/deleteEntry liegen in core/lib/finEntries.js, damit auch die
// Brücke für andere Module (core/lib/financeBridge.js) sie nutzen kann, ohne
// aus modules/ zu importieren. Hier nur weitergereicht.
export { saveEntry };

// Fehlende Spalte (Migration fin_template_overrides_migration.sql noch nicht
// eingespielt): Funktionen fallen dann auf das alte Verhalten zurück, statt zu scheitern.
const isMissingColumn = (e) => Boolean(e)
  && (e.code === '42703' || e.code === 'PGRST204' || /does not exist|Could not find the .* column/i.test(e.message || ''));

const monthKey = (year, month) => `${year}-${String(month).padStart(2, '0')}`;

// Posten löschen. Stammt er aus einer Vorlage (laufender Vertrag), merkt sich die
// Vorlage den Monat (`skipped_months`), damit die Prüfung ihn nicht wieder anlegt,
// und der Posten wird wirklich entfernt. Alle anderen Posten werden wie bisher
// als gelöscht markiert.
export async function deleteEntry(id) {
  const sb = getSupabase();
  const { data: entry, error } = await sb
    .from('fin_entries')
    .select('id, from_template, year, month')
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  if (!entry || !entry.from_template) return softDeleteEntry(id);

  const { data: tpl, error: tplErr } = await sb
    .from('fin_fixtemplates')
    .select('*')
    .eq('id', entry.from_template)
    .maybeSingle();
  if (tplErr) throw tplErr;
  if (tpl) {
    const key = monthKey(entry.year, entry.month);
    const list = Array.isArray(tpl.skipped_months) ? tpl.skipped_months : [];
    if (!list.includes(key)) {
      const { error: upErr } = await sb
        .from('fin_fixtemplates')
        .update({ skipped_months: [...list, key] })
        .eq('id', tpl.id);
      if (upErr && !isMissingColumn(upErr)) throw upErr;
    }
  }
  const { error: delErr } = await sb.from('fin_entries').delete().eq('id', id);
  if (delErr) throw delErr;
  invalidateHubCache();
}

// Ganzen Posten auf bezahlt/offen setzen. `payments` (optional) sind die dazu
// passend umgesetzten Teilzahlungen (setPartsPaid aus paymentParts.js), damit
// Zeile und Teilzahlungen nicht auseinanderlaufen.
export async function togglePaid(id, paid, payments) {
  const patch = Array.isArray(payments) ? { paid, payments } : { paid };
  const { error } = await getSupabase().from('fin_entries').update(patch).eq('id', id);
  if (error) throw error;
  invalidateHubCache();
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
const CONTRACT_FIELDS = ['is_contract', 'cancellation', 'notes'];

export async function saveFixTemplate(session, tpl) {
  const isUpdate = !!tpl.id;
  // Payload bereinigen: unbekannte Felder entfernen, leere Strings → null
  const payload = Object.fromEntries(
    Object.entries({ ...tpl, owner_id: ownerId(session) })
      .filter(([k]) => !TEMPLATE_STRIP.includes(k))
      .map(([k, v]) => [k, v === '' ? null : v])
  );
  let { data: saved, error } = await getSupabase()
    .from('fin_fixtemplates')
    .upsert(payload)
    .select()
    .single();
  // Vertragsfelder fehlen noch (Migration fin_contracts_as_templates_migration.sql):
  // ohne sie speichern, der Vertrag bucht dann als normale Fixkosten
  if (error && isMissingColumn(error) && CONTRACT_FIELDS.some((k) => k in payload)) {
    const rest = Object.fromEntries(Object.entries(payload).filter(([k]) => !CONTRACT_FIELDS.includes(k)));
    ({ data: saved, error } = await getSupabase().from('fin_fixtemplates').upsert(rest).select().single());
  }
  if (error) throw error;

  // Bei einem Update: abhängige fin_entries synchronisieren.
  // Nur nicht-bezahlte Einträge werden aktualisiert — bezahlte sind
  // bereits abgerechnet und sollen die historische Wahrheit bewahren.
  if (isUpdate && saved.category !== 'fixeinnahmen') {
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

    if (!applies && entry.paid && !isFuture) {
      // Bezahlte Posten aus Vergangenheit und laufendem Monat bleiben immer erhalten
      // (z. B. beim Wechsel von monatlich auf Quartal) — sie sind abgerechnete Wahrheit.
      continue;
    }
    if (!applies) {
      // Vorlage gilt für diesen Monat nicht mehr — entweder wegen
      // geändertem Intervall ODER weil der Monat außerhalb von
      // Beginn/Ende liegt. Ein Beginn/Ende-Fenster ist ein Fakt (der
      // Posten konnte in diesem Monat nicht existiert haben), deshalb
      // wird IMMER gelöscht, auch wenn der Eintrag schon bezahlt war —
      // anders als bei Name/Betrag-Änderungen ist das keine nachträgliche
      // Geschäftsregel-Änderung, sondern eine Korrektur eines Fehlers.
      await getSupabase()
        .from('fin_entries')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', entry.id);
    } else if (entry.template_locked) {
      // Der Nutzer hat diesen Posten von Hand geändert (Name, Betrag, Zahlung):
      // gilt nur für diesen Monat, die Vorlage fasst ihn nicht mehr an.
      continue;
    } else {
      // Name, Betrag und Zahlungsart in ALLEN Einträgen nachziehen —
      // auch in bezahlten, damit die Monatsansicht konsistent bleibt.
      // Ausnahme: der amount bezahlter Vergangenheits-Einträge bleibt
      // unverändert (historische Wahrheit), nur Name und Zahlung folgen.
      const isPastPaid = entry.paid && !isFuture;
      // Fälligkeitsdatum folgt dem Tag der Vorlage (nur laufender/zukünftiger Monat; ein
      // von Hand geänderter Posten ist gesperrt und kommt hier gar nicht an)
      const due = isCurrentOrFuture(entry.year, entry.month)
        ? { due_date: tpl.due_day ? dueDateFor(tpl.due_day, entry.year, entry.month) : null }
        : {};
      await getSupabase()
        .from('fin_entries')
        .update(isPastPaid
          ? { name: tpl.name, payment: tpl.payment, ...due }                       // Betrag bleibt
          : { name: tpl.name, amount: tpl.amount, payment: tpl.payment, ...due }
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
    if (isSkippedMonth(tpl, y, m)) continue; // von Hand gelöscht
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

// Hat der Nutzer den Posten dieses Monats aus der Vorlage gelöscht?
function isSkippedMonth(t, year, month) {
  return Array.isArray(t.skipped_months) && t.skipped_months.includes(monthKey(year, month));
}

// Laufender oder zukünftiger Monat? Nur dort bekommen Posten aus Vorlagen ein Fälligkeitsdatum
// (rückwirkend angelegte Posten alter Monate bleiben ohne, sonst wären sie sofort überfällig).
function isCurrentOrFuture(year, month) {
  const n = new Date();
  return year * 12 + month >= n.getFullYear() * 12 + n.getMonth() + 1;
}

function templateToEntry(t, year, month) {
  const due = t.due_day && isCurrentOrFuture(year, month) ? { due_date: dueDateFor(t.due_day, year, month) } : {};
  return {
    ...due,
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
  return applyMissingFixTemplatesWith(session, year, month, templates, monthEntries);
}

// Wie applyMissingFixTemplates, aber mit bereits geladenen Vorlagen und Posten
// des Monats — spart dem Aufrufer zwei Abfragen. Gibt zurück, wie viele Posten
// neu angelegt wurden (bei > 0 die Posten des Monats neu laden).
export async function applyMissingFixTemplatesWith(session, year, month, templates, monthEntries) {
  let added = 0;
  for (const t of templates) {
    if (t.category === 'fixeinnahmen') continue; // Einnahmen werden beim Eingang bestätigt (lib/income.js)
    if (!templateAppliesTo(t, year, month)) continue;
    if (isSkippedMonth(t, year, month)) continue; // der Nutzer hat ihn gelöscht
    const existing = monthEntries.find((e) => e.from_template === t.id);
    if (!existing) {
      await saveEntry(session, templateToEntry(t, year, month));
      added++;
    } else if (t.due_day && !existing.due_date && !existing.template_locked && isCurrentOrFuture(year, month)) {
      // Posten aus der Zeit vor dem Datums-Feld: Fälligkeitsdatum aus dem Tag der Vorlage nachtragen
      await getSupabase().from('fin_entries')
        .update({ due_date: dueDateFor(t.due_day, year, month) }).eq('id', existing.id);
      added++;
    }
  }
  return added;
}

// Beim Anlegen einer neuen Vorlage: auf alle bereits genutzten Monate
// rückwirkend anwenden, plus den aktuell angezeigten Monat.
export async function applyNewTemplateEverywhere(session, tpl, currentYear, currentMonth) {
  if (tpl.category === 'fixeinnahmen') return; // Einnahmen: Eingang bestätigen statt automatisch buchen
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
  for (const table of ['fin_entries', 'fin_savings', 'fin_contracts', 'fin_fixtemplates', 'fin_savings_plans']) {
    const { error } = await getSupabase().from(table).delete().eq('owner_id', owner);
    // Sparpläne gibt es erst mit der Migration fin_savings_plans_migration.sql
    if (error && !(table === 'fin_savings_plans' && isMissingTable(error))) throw error;
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


// ---------------------------------------------------------------------
// Sparpläne (fin_savings_plans, Migration supabase/fin_savings_plans_migration.sql)
// ---------------------------------------------------------------------
// Raten sind Buchungen in fin_entries mit savings_plan_id (lib/savingsPlans.js).
// Ohne Migration liefern die Lesefunktionen null bzw. [], die App blendet die
// Sparpläne dann aus.

const isMissingTable = (e) => Boolean(e)
  && (e.code === '42P01' || e.code === 'PGRST205' || /fin_savings_plans|schema cache/i.test(e.message || ''));

export async function getSavingsPlans(session) {
  const { data, error } = await getSupabase()
    .from('fin_savings_plans')
    .select('*')
    .eq('owner_id', ownerId(session))
    .eq('status', 'aktiv')
    .is('deleted_at', null)
    .order('created_at', { ascending: true });
  if (error) {
    if (isMissingTable(error)) return null;
    throw error;
  }
  return data ?? [];
}

export async function getSavingsPlanRates(session) {
  const { data, error } = await getSupabase()
    .from('fin_entries')
    .select('*')
    .eq('owner_id', ownerId(session))
    .not('savings_plan_id', 'is', null)
    .is('deleted_at', null);
  if (error) {
    if (isMissingColumn(error)) return [];
    throw error;
  }
  return data ?? [];
}

function rateRow(session, plan, r) {
  return {
    owner_id: ownerId(session),
    year: r.year,
    month: r.month,
    category: 'variable_kosten',
    name: rateName(plan.name),
    payment: 'Bank',
    payments: [{ method: 'Bank', amount: r.amount, paid: false }],
    amount: r.amount,
    paid: false,
    due_date: r.due_date,
    savings_plan_id: plan.id,
  };
}

// Plan speichern (neu oder geändert). Bei einer Änderung fallen die offenen Raten
// weg (Soft Delete) und `rates` (geplante Raten: year, month, due_date, amount)
// werden neu angelegt; eingezahlte Raten bleiben und bekommen den neuen Namen.
export async function saveSavingsPlan(session, plan, rates) {
  const sb = getSupabase();
  const payload = {
    owner_id: ownerId(session),
    name: String(plan.name).trim(),
    target_amount: plan.target_amount,
    target_date: plan.target_date || null,
    rhythm: plan.rhythm,
    rate: plan.rate,
    due_day: plan.due_day,
    status: 'aktiv',
    updated_at: new Date().toISOString(),
    ...(plan.id ? { id: plan.id } : {}),
  };
  const { data: saved, error } = await sb.from('fin_savings_plans').upsert(payload).select().single();
  if (error) throw error;
  if (plan.id) {
    const now = new Date().toISOString();
    const { error: delErr } = await sb.from('fin_entries').update({ deleted_at: now })
      .eq('savings_plan_id', saved.id).eq('paid', false).is('deleted_at', null);
    if (delErr) throw delErr;
    const { error: nameErr } = await sb.from('fin_entries').update({ name: rateName(saved.name) })
      .eq('savings_plan_id', saved.id).is('deleted_at', null);
    if (nameErr) throw nameErr;
  }
  if (rates.length) {
    const { error: insErr } = await sb.from('fin_entries').insert(rates.map((r) => rateRow(session, saved, r)));
    if (insErr) throw insErr;
  }
  invalidateHubCache();
  return saved;
}

// Raten auf bezahlt/offen setzen (Einzahlen, Vorziehen, Rückgängig)
export async function setRatesPaid(rates, paid) {
  for (const r of rates) {
    // eslint-disable-next-line no-await-in-loop
    await togglePaid(r.id, paid, [{ method: r.payment || 'Bank', amount: Number(r.amount), paid }]);
  }
}

// Plan beenden: offene Raten fallen weg, Eingezahltes bleibt im Sparschwein
export async function endSavingsPlan(session, planId) {
  const sb = getSupabase();
  const now = new Date().toISOString();
  const { error: delErr } = await sb.from('fin_entries').update({ deleted_at: now })
    .eq('owner_id', ownerId(session)).eq('savings_plan_id', planId).eq('paid', false).is('deleted_at', null);
  if (delErr) throw delErr;
  const { error } = await sb.from('fin_savings_plans').update({ status: 'beendet', updated_at: now }).eq('id', planId);
  if (error) throw error;
  invalidateHubCache();
}

// Höchstbetrag, den eine Rate bekommen darf (was bis zum Ziel fehlt). Gilt für den Plan-Dialog
// und für den Stift in den Buchungen, damit die Summe der Raten nie über dem Ziel liegt.
export async function savingsPlanRateMax(session, planId, rateId) {
  const { data: plan, error } = await getSupabase().from('fin_savings_plans').select('*')
    .eq('owner_id', ownerId(session)).eq('id', planId).single();
  if (error) throw error;
  const rates = (await getSavingsPlanRates(session)).filter((r) => r.savings_plan_id === planId);
  if (!rates.some((r) => r.id === rateId)) throw new Error('Rate nicht gefunden');
  return maxForRate(plan, rates, rateId);
}

// Nach der Änderung einer Rate (Plan oder Stift in den Buchungen) die übrigen Raten
// so anpassen, dass die Summe wieder das Ziel ergibt (lib/savingsPlans.js rebalanceRates).
// Besteht ein Schritt nicht, wird der Stand von vorher wiederhergestellt (siehe unten) und der
// Fehler weitergegeben. Gibt das Ergebnis des Ausgleichs zurück.
export async function rebalanceSavingsPlan(session, planId, changedId) {
  const sb = getSupabase();
  const owner = ownerId(session);
  const { data: plan, error: pErr } = await sb.from('fin_savings_plans').select('*')
    .eq('owner_id', owner).eq('id', planId).single();
  if (pErr) throw pErr;
  const rates = (await getSavingsPlanRates(session)).filter((r) => r.savings_plan_id === planId);
  const res = rebalanceRates(plan, rates, changedId, localTodayStrFin());
  try {
    for (const u of res.updates) {
      const r = rates.find((x) => x.id === u.id);
      // eslint-disable-next-line no-await-in-loop
      const { error } = await sb.from('fin_entries').update({ amount: u.amount, payments: [{ method: r.payment || 'Bank', amount: u.amount, paid: false }] })
        .eq('owner_id', owner).eq('id', u.id);
      if (error) throw error;
    }
    if (res.removes.length) {
      const { error } = await sb.from('fin_entries').update({ deleted_at: new Date().toISOString() })
        .eq('owner_id', owner).in('id', res.removes);
      if (error) throw error;
    }
    if (res.inserts.length) {
      const { error } = await sb.from('fin_entries').insert(res.inserts.map((r) => rateRow(session, plan, r)));
      if (error) throw error;
    }
  } catch (err) {
    // Halb ausgeglichener Plan = falsche Summe: zurück auf den Stand vor dem Ausgleich.
    try { await restoreSavingsPlanRates(session, planId, rates); } catch (e2) { console.error('[Sparplan] Zurücksetzen fehlgeschlagen', e2); }
    throw err;
  }
  invalidateHubCache();
  return res;
}

// Eine Rate auf einen neuen Betrag setzen und den Plan ausgleichen. Rückgabe: Schnappschuss
// aller Raten vorher, mit dem restoreSavingsPlanRates alles zurückholt. Schlägt der Ausgleich
// fehl, steht danach auch die Rate wieder auf dem alten Betrag.
export async function changeSavingsPlanRate(session, planId, rateId, amount) {
  const before = (await getSavingsPlanRates(session)).filter((r) => r.savings_plan_id === planId);
  const me = before.find((r) => r.id === rateId);
  if (!me) throw new Error('Rate nicht gefunden');
  const { error } = await getSupabase().from('fin_entries')
    .update({ amount, payments: [{ method: me.payment || 'Bank', amount, paid: !!me.paid }] })
    .eq('owner_id', ownerId(session)).eq('id', rateId);
  if (error) throw error;
  try {
    await rebalanceSavingsPlan(session, planId, rateId);
  } catch (err) {
    try { await restoreSavingsPlanRates(session, planId, before); } catch (e2) { console.error('[Sparplan] Zurücksetzen fehlgeschlagen', e2); }
    throw err;
  }
  return before;
}

// Raten auf den Stand eines Schnappschusses zurücksetzen ("Rückgängig machen" und Rollback).
// Eine Rate, die inzwischen bezahlt oder wieder offen gesetzt wurde, bleibt unangetastet
// (Zahlung während der Rückgängig-Frist geht nicht verloren). Fehler brechen die Schleife nicht
// ab: es wird so viel wie möglich zurückgesetzt, danach wird der erste Fehler geworfen.
export async function restoreSavingsPlanRates(session, planId, before) {
  const sb = getSupabase();
  const owner = ownerId(session);
  const now = (await getSavingsPlanRates(session)).filter((r) => r.savings_plan_id === planId);
  const old = new Map(before.map((r) => [r.id, r]));
  const nowById = new Map(now.map((r) => [r.id, r]));
  const added = now.filter((r) => !old.has(r.id) && !r.paid).map((r) => r.id);
  let firstError = null;
  if (added.length) {
    const { error } = await sb.from('fin_entries').update({ deleted_at: new Date().toISOString() })
      .eq('owner_id', owner).in('id', added);
    if (error) firstError = error;
  }
  for (const r of before) {
    const cur = nowById.get(r.id);
    if (cur && !!cur.paid !== !!r.paid) continue; // zwischenzeitlich bezahlt/geändert: lassen
    // eslint-disable-next-line no-await-in-loop
    const { error } = await sb.from('fin_entries').update({ amount: r.amount, payments: r.payments, paid: r.paid, deleted_at: null })
      .eq('owner_id', owner).eq('id', r.id);
    if (error && !firstError) firstError = error;
  }
  invalidateHubCache();
  if (firstError) throw firstError;
}

// ---------------------------------------------------------------------
// Einnahmen: Eingang bestätigen (lib/income.js)
// ---------------------------------------------------------------------
// Der Eingang wird auf den Tag gebucht, an dem der Nutzer bestätigt: normale Einnahme-
// Buchung im Monat dieses Tages (zählt in Auswertung und Hub im Eingangsmonat).
export async function confirmIncome(session, tpl, amount, today) {
  const [y, m] = String(today).slice(0, 10).split('-').map(Number);
  return saveEntry(session, {
    category: tpl.category,
    year: y,
    month: m,
    name: tpl.name,
    payment: tpl.payment || 'Bank',
    payments: [{ method: tpl.payment || 'Bank', amount, paid: true }],
    amount,
    paid: true,
    due_date: String(today).slice(0, 10),
    from_template: tpl.id,
    template_locked: true,
  });
}

// Eingang zurücknehmen (Rückgängig): Soft Delete, ohne den Monat für die Vorlage zu sperren
export async function undoIncome(id) {
  await softDeleteEntry(id);
  invalidateHubCache();
}
