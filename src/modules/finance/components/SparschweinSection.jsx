import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '../../../core/lib/AuthContext';
import { useEntrySheet } from '../../../core/lib/EntrySheetContext';
import SheetShell from '../../../core/components/SheetShell';
import AreaList from '../../../core/components/AreaList.jsx';
import * as finData from '../lib/finData';
import { formatEur, formatDate, MONTHS_DE } from '../lib/finance';
import SavingsPlanRows from './SavingsPlans.jsx';
import Icon from '../../../core/components/Icon';
import { Button } from '../../../core/components/ui';

// Bereich "Sparen" in der Finanzen-Übersicht: direkt unter der Saldo-
// Karte, eine Zeile mit dem Sparschwein-Stand, darunter die Sparpläne (SavingsPlans.jsx). Tippen öffnet das Sparschwein-
// Sheet (Stand, Einzahlen/Entnehmen, Verlauf).
//
// Ersetzt den früheren schwebenden Sparschwein-Button über dem "+"
// (core/components/SparschweinFab.jsx), der Inhalte verdeckt hat. Liegt jetzt
// im Finanzen-Modul statt in core/ — das beseitigt auch den Import von core
// nach modules/finance.
//
// year/month: der Monat, den die Übersicht zeigt (immer der aktuelle) — dort
// landen Einzahlung und Entnahme, damit der Saldo darüber sich sofort ändert.
//
// Direkte "Sparen"-Funktion — Betrag eingeben → erstellt automatisch
// eine "Ersparnisse"-Buchung im aktuellen Monat, ohne dass der Nutzer
// wissen muss, welche Kategorie er wählen soll.
// Entnahme weiterhin über Zahlungsart "Sparschwein" bei einer Ausgabe.
export default function SparschweinSection({ year, month }) {
  const { session } = useAuth();
  const { version, notifySaved } = useEntrySheet();
  const [balance, setBalance] = useState(null);
  const [ledger,  setLedger]  = useState([]);
  const [totals,  setTotals]  = useState({ totalIn: 0, totalOut: 0 });
  const [open,    setOpen]    = useState(false);
  // Einzahlungs-Formular
  const [saving,  setSaving]  = useState(false);  // true = Einzahlungs-Sheet offen
  const [amount,  setAmount]  = useState('');
  const [saving_status, setSavingStatus] = useState(null);
  // Entnahme-Formular
  const [taking,  setTaking]  = useState(false);  // true = Entnahme-Sheet offen
  const [takeAmount, setTakeAmount] = useState('');
  const [take_status, setTakeStatus] = useState(null);

  const sessionRef = useRef(session);
  useEffect(() => { sessionRef.current = session; }, [session]);

  const load = useCallback(async () => {
    if (!sessionRef.current) return;
    const { ledger, balance, totalIn, totalOut } = await finData.getSparschweinLedger(sessionRef.current);
    setBalance(balance);
    setLedger(ledger);
    setTotals({ totalIn, totalOut });
  }, []);

  useEffect(() => { load(); }, [load, version]);

  async function handleSaveDeposit() {
    const amt = parseFloat(String(amount).replace(',', '.'));
    if (isNaN(amt) || amt <= 0) {
      setSavingStatus({ type: 'error', text: 'Bitte gültigen Betrag eingeben' });
      return;
    }
    try {
      await finData.saveEntry(sessionRef.current, {
        year,         // Monat der Übersicht
        month,
        category: 'variable_kosten', // Ausgaben-Kategorie — wird von isSparschweinDeposit erkannt
        name:     'Ersparnisse',     // Genauer Name — Erkennungsmerkmal
        payment:  'Bank',
        payments: [{ method: 'Bank', amount: amt }],
        amount:   amt,
        paid:     true,              // sofort verbucht
      });
      setSavingStatus({ type: 'ok', text: `✓ ${formatEur(amt)} gespart` });
      setAmount('');
      notifySaved(); // andere Views aktualisieren
      await load();
      // Sheet nach kurzer Bestätigung schließen
      setTimeout(() => { setSaving(false); setSavingStatus(null); }, 1200);
    } catch (e) {
      setSavingStatus({ type: 'error', text: '✗ Fehler beim Speichern' });
      console.error(e);
    }
  }

  // Direkte Entnahme aus dem Sparschwein — Gegenstück zur Einzahlung.
  // Legt eine Einnahme "Sparschwein" im aktiven Monat an: Geld fließt
  // aus dem Sparschwein zurück ins Monatsbudget (erhöht den Saldo),
  // OHNE dass eine Ausgabe mit Zahlungsart "Sparschwein" nötig ist.
  async function handleSaveWithdrawal() {
    const amt = parseFloat(String(takeAmount).replace(',', '.'));
    if (isNaN(amt) || amt <= 0) {
      setTakeStatus({ type: 'error', text: 'Bitte gültigen Betrag eingeben' });
      return;
    }
    if (amt > balance) {
      setTakeStatus({ type: 'error', text: `Nur ${formatEur(balance)} im Sparschwein` });
      return;
    }
    try {
      await finData.saveEntry(sessionRef.current, {
        year,         // Monat der Übersicht
        month,
        category: 'sonstige_einnahmen', // Einnahme-Kategorie — von isSparschweinDirectWithdrawal erkannt
        name:     'Sparschwein',        // Genauer Name — Erkennungsmerkmal
        payment:  'Bank',
        payments: [{ method: 'Bank', amount: amt }],
        amount:   amt,
        paid:     true,
      });
      setTakeStatus({ type: 'ok', text: `✓ ${formatEur(amt)} entnommen` });
      setTakeAmount('');
      notifySaved();
      await load();
      setTimeout(() => { setTaking(false); setTakeStatus(null); }, 1200);
    } catch (e) {
      setTakeStatus({ type: 'error', text: '✗ Fehler beim Speichern' });
      console.error(e);
    }
  }

  return (
    <>
      <section className="page-section">
        <AreaList>
          <button
            className="area-row"
            onClick={() => setOpen(true)}
            disabled={balance === null}
            aria-label={balance === null ? 'Sparschwein' : `Sparschwein, aktueller Stand ${formatEur(balance)}`}
          >
            <img src="./icons/piggy-bank.png" alt="" className="area-row-icon" />
            <span className="area-row-label">Sparschwein</span>
            <span className="area-row-value area-row-value--neutral">
              {balance === null ? '—' : formatEur(balance)}
            </span>
            <span className="area-row-chevron" aria-hidden="true"><Icon name="open" size={null} className="glyph" /></span>
          </button>
          {/* Sparpläne (nur mit Migration fin_savings_plans) und "Sparplan anlegen" */}
          <SavingsPlanRows />
        </AreaList>
      </section>

      {/* ── Hauptsheet: Kontostand + Verlauf ── */}
      {open && (
        <SheetShell onClose={() => setOpen(false)}>
          <div className="sheet-header">
            <div className="sheet-title t-title">Sparschwein</div>
            <button className="sheet-cancel" onClick={() => setOpen(false)}>Schließen</button>
          </div>

          <div className="wiz-body sheet-scroll fin-u-pt3">
            <div className="sparschwein-stat-card">
              <div className="t-meta fin-u-mut">Aktueller Stand</div>
              <div className="sparschwein-balance">{formatEur(balance)}</div>
              <div className="sparschwein-stat-row">
                <div className="sparschwein-stat-chip">
                  <div className="t-meta">Eingezahlt</div>
                  <div className="sparschwein-stat-value positive">+{formatEur(totals.totalIn)}</div>
                </div>
                <div className="sparschwein-stat-chip">
                  <div className="t-meta">Entnommen</div>
                  <div className="sparschwein-stat-value negative">-{formatEur(totals.totalOut)}</div>
                </div>
              </div>
            </div>

            {/* Einzahlen / Entnehmen */}
            <div className="fin-u-acts">
              <Button icon="plus" className="fin-u-flex1"
                onClick={() => { setSaving(true); setOpen(false); }}
              >Betrag sparen</Button>
              <Button variant="secondary" icon="minus" className="fin-u-flex1"
                onClick={() => { setTaking(true); setOpen(false); }}
                disabled={balance <= 0}
              >Entnehmen</Button>
            </div>
            <p className="t-meta fin-u-mut-c2">
              Entnahme fließt zurück in den Monat. Alternativ: bei einer Ausgabe die Zahlungsart „Sparschwein" wählen.
            </p>

            <div className="t-meta fin-u-mut-sec">
              Verlauf
            </div>

            {ledger.length === 0 ? (
              <div className="sheet-placeholder">
                <p className="t-body fin-u-mut-c">
                  Noch keine Buchungen. Tippe auf „Betrag sparen“, um einzuzahlen.
                </p>
              </div>
            ) : (
              <div className="sparschwein-ledger">
                {ledger.map((tx) => (
                  <div key={tx.id} className="sparschwein-ledger-row">
                    <div>
                      <div className="t-body fin-u-w6">
                        {tx.direction === 'in' ? 'Einzahlung' : 'Entnahme'}
                        {tx.name !== 'Ersparnisse' ? ` · ${tx.name}` : ''}
                      </div>
                      <div className="t-meta fin-u-mut">
                        {tx.created_at ? formatDate(tx.created_at) : `${MONTHS_DE[tx.month - 1]} ${tx.year}`}
                      </div>
                    </div>
                    <div className="fin-u-right">
                      <div className={`sparschwein-ledger-amount ${tx.direction === 'in' ? 'positive' : 'negative'}`}>
                        {tx.direction === 'in' ? '+' : '-'}{formatEur(tx.amount)}
                      </div>
                      <div className="t-meta fin-u-mut">
                        Stand {formatEur(tx.balanceAfter)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </SheetShell>
      )}

      {/* ── Einzahlungs-Sheet ── */}
      {saving && (
        <SheetShell onClose={() => { setSaving(false); setSavingStatus(null); setAmount(''); }}>
          <div className="sheet-header">
            <div className="sheet-title t-title">Betrag sparen</div>
            <button className="sheet-cancel" onClick={() => { setSaving(false); setSavingStatus(null); setAmount(''); }}>
              Abbrechen
            </button>
          </div>

          <div className="wiz-body">
            <p className="t-body fin-u-mut-mb4">
              Der Betrag wird direkt ins Sparschwein übertragen und erscheint
              nicht in deinen regulären Ausgaben.
            </p>

            <label className="wiz-label t-meta">Betrag (€)</label>
            <input
              className="wiz-input fin-u-f16"
              type="number"
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0,00"
              min="0.01"
              step="0.01"
              autoFocus
             
            />

            {saving_status && (
              <div className={`status-note ${saving_status.type} fin-u-mt3`}>
                {saving_status.text}
              </div>
            )}
          </div>

          <div className="entry-modal-actions">
            <Button variant="secondary"
             
              onClick={() => { setSaving(false); setSavingStatus(null); setAmount(''); }}
            >Abbrechen</Button>
            <Button onClick={handleSaveDeposit}>Sparen</Button>
          </div>
        </SheetShell>
      )}

      {/* ── Entnahme-Sheet ── */}
      {taking && (
        <SheetShell onClose={() => { setTaking(false); setTakeStatus(null); setTakeAmount(''); }}>
          <div className="sheet-header">
            <div className="sheet-title t-title">Betrag entnehmen</div>
            <button className="sheet-cancel" onClick={() => { setTaking(false); setTakeStatus(null); setTakeAmount(''); }}>
              Abbrechen
            </button>
          </div>

          <div className="wiz-body">
            <p className="t-body fin-u-mut-mb4">
              Der Betrag wird aus dem Sparschwein entnommen und fließt zurück
              in den Saldo dieses Monats — ohne einen neuen Ausgaben-Posten.
            </p>

            <label className="wiz-label t-meta">Betrag (€)</label>
            <input
              className="wiz-input fin-u-f16"
              type="number"
              inputMode="decimal"
              value={takeAmount}
              onChange={(e) => setTakeAmount(e.target.value)}
              placeholder="0,00"
              min="0.01"
              step="0.01"
              max={balance}
              autoFocus
             
            />
            <p className="t-meta fin-u-mut-m2">
              Verfügbar: {formatEur(balance)}
            </p>

            {take_status && (
              <div className={`status-note ${take_status.type} fin-u-mt3`}>
                {take_status.text}
              </div>
            )}
          </div>

          <div className="entry-modal-actions">
            <Button variant="secondary"
             
              onClick={() => { setTaking(false); setTakeStatus(null); setTakeAmount(''); }}
            >Abbrechen</Button>
            <Button onClick={handleSaveWithdrawal}>Entnehmen</Button>
          </div>
        </SheetShell>
      )}
    </>
  );
}
