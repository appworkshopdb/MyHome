// src/core/lib/financeBridge.js
// Dünne Brücke von core/ zu modules/finance/, damit andere Module (wie
// Einkauf) eine Ausgabe im Finanzmodul verbuchen können, ohne selbst aus
// modules/finance zu importieren (verboten: Module importieren nie
// voneinander, nur aus core/). core/components/EntrySheet.jsx macht das
// bereits direkt für den globalen Erfassen-Wizard — diese Datei bündelt
// dasselbe Muster wiederverwendbar für weitere Module.
//
// owner_id wird bewusst selbst aus dem JWT gelesen (wie in shoData.js /
// habData.js), statt eine echte Supabase-Session per useAuth() zu
// verlangen — das vermeidet den dokumentierten @supabase/auth-js
// Windows/Chromium-Hang und hält Einkauf unabhängig vom Auth-Context.

import { SESSION_STORAGE_KEY } from './rawAuth.js';
import { saveEntry, deleteEntry } from '../../modules/finance/lib/finData.js';

function getOwnerIdFromToken() {
  try {
    const token = JSON.parse(localStorage.getItem(SESSION_STORAGE_KEY) || '{}').access_token;
    if (!token) throw new Error('Kein Token gefunden');
    const payload = JSON.parse(atob(token.split('.')[1]));
    return payload.sub; // sub = user UUID
  } catch (e) {
    throw new Error('Nicht eingeloggt oder Token ungültig');
  }
}

/**
 * Erstellt eine Buchung im Finanzmodul, Kategorie "Sonstige Ausgaben".
 * Wird vom Einkauf-Modul beim Abschließen einer Liste aufgerufen. Meist
 * eine einzige Sammelbuchung pro Liste — nur wenn die Zahlungen gemischt
 * "sofort bezahlt" (Bar/Gutschein) und "noch offen" (Bank/Paypal/SEPA/
 * Klarna) enthalten, ruft ItemsView.jsx diese Funktion zweimal auf (einmal
 * mit paid:true, einmal mit paid:false), da fin_entries pro Zeile nur
 * einen einzigen paid-Status kennt.
 *
 * @param {object} opts
 *   name    {string}       Bezeichnung der Buchung (z.B. Listenname)
 *   amount  {number}       Betrag dieser Teil-Buchung
 *   payment {string}       Zahlungsart (gültiger fin_payment-Wert)
 *   note    {string|null}  Notiz, z.B. Aufschlüsselung mehrerer Zahlungen
 *   paid    {boolean}      Ob dieser Anteil bereits beglichen ist (Default: true)
 *   date    {Date}         Für Jahr/Monat der Buchung (Default: jetzt)
 * @returns {Promise<object>} die erzeugte fin_entries-Zeile (inkl. id)
 */
export async function createShoppingExpense({ name, amount, payment, note, paid = true, date }) {
  const owner_id = getOwnerIdFromToken();
  const session   = { user: { id: owner_id } }; // reicht saveEntry()/ownerId() aus
  const d = date instanceof Date ? date : new Date();

  return saveEntry(session, {
    category: 'sonstige_ausgaben',
    name,
    payment,
    amount,
    paid,
    year:  d.getFullYear(),
    month: d.getMonth() + 1,
    note:  note || null,
  });
}

/**
 * Storniert eine über createShoppingExpense erzeugte Buchung (Soft Delete).
 * Wird verwendet, wenn eine "erledigt"-Liste wieder geöffnet wird und die
 * verknüpfte Buchung damit ungültig wird (Deploy 3).
 */
export async function voidShoppingExpense(finEntryId) {
  if (!finEntryId) return;
  await deleteEntry(finEntryId);
}
