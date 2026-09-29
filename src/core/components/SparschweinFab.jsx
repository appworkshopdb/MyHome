import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '../lib/AuthContext';
import { useEntrySheet } from '../lib/EntrySheetContext';
import * as finData from '../../modules/finance/lib/finData';
import { formatEur, formatDate, MONTHS_DE } from '../../modules/finance/lib/finance';
import { useFinanceMonth } from '../../modules/finance/lib/FinanceMonthContext';
import SheetShell from './SheetShell';

// Schwebender Sparschwein-Button, sitzt über dem globalen "+"-FAB.
// Nur im Finanzen-Modul sichtbar (activeModule === 'finance').
//
// NEU: Direkte "Sparen"-Funktion — Betrag eingeben → erstellt automatisch
// eine "Ersparnisse"-Buchung im aktuellen Monat, ohne dass der Nutzer
// wissen muss, welche Kategorie er wählen soll.
// Entnahme weiterhin über Zahlungsart "Sparschwein" bei einer Ausgabe.
export default function SparschweinFab() {
  const { session } = useAuth();
  const { version, notifySaved } = useEntrySheet();
  const { activeYear, activeMonth } = useFinanceMonth(); // Monat aus MonthsView (oder aktuell)
  const [balance, setBalance] = useState(null);
  const [ledger,  setLedger]  = useState([]);
  const [totals,  setTotals]  = useState({ totalIn: 0, totalOut: 0 });
  const [open,    setOpen]    = useState(false);
  // Einzahlungs-Formular
  const [saving,  setSaving]  = useState(false);  // true = Einzahlungs-Sheet offen
  const [amount,  setAmount]  = useState('');
  const [saving_status, setSavingStatus] = useState(null);

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
        year:     activeYear,   // Monat aus MonthsView — nicht immer "heute"
        month:    activeMonth,
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

  if (balance === null) return null;

  return (
    <>
      <button
        className="sparschwein-fab"
        onClick={() => setOpen(true)}
        aria-label={`Sparschwein, aktueller Stand ${formatEur(balance)}`}
      >
        <img src="./icons/piggy-bank.png" alt="" className="sparschwein-fab-icon" />
        <span className="sparschwein-fab-badge">{Math.round(balance)}€</span>
      </button>

      {/* ── Hauptsheet: Kontostand + Verlauf ── */}
      {open && (
        <SheetShell onClose={() => setOpen(false)}>
          <div className="sheet-header">
            <div className="sheet-title t-title">Sparschwein</div>
            <button className="sheet-cancel" onClick={() => setOpen(false)}>Schließen</button>
          </div>

          <div className="wiz-body sheet-scroll" style={{ paddingTop: 'var(--space-3)' }}>
            <div className="sparschwein-stat-card">
              <div className="t-meta" style={{ color: 'var(--text-muted)' }}>Aktueller Stand</div>
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

            {/* Einzahlen-Button */}
            <button
              className="btn btn-primary"
              style={{ width: '100%', marginTop: 'var(--space-4)' }}
              onClick={() => { setSaving(true); setOpen(false); }}
            >
              + Betrag sparen
            </button>
            <p className="t-meta" style={{ color: 'var(--text-muted)', marginTop: 'var(--space-2)', textAlign: 'center' }}>
              Entnahme: beim Buchen einer Ausgabe die Zahlungsart „Sparschwein" wählen
            </p>

            <div className="t-meta" style={{ color: 'var(--text-muted)', margin: 'var(--space-5) 0 var(--space-2)' }}>
              Verlauf
            </div>

            {ledger.length === 0 ? (
              <div className="sheet-placeholder">
                <p className="t-body" style={{ color: 'var(--text-muted)', textAlign: 'center' }}>
                  Noch keine Buchungen. Tippe auf „+ Betrag sparen", um einzuzahlen.
                </p>
              </div>
            ) : (
              <div className="sparschwein-ledger">
                {ledger.map((tx) => (
                  <div key={tx.id} className="sparschwein-ledger-row">
                    <div>
                      <div className="t-body" style={{ fontWeight: 600 }}>
                        {tx.direction === 'in' ? 'Einzahlung' : 'Entnahme'}
                        {tx.name !== 'Ersparnisse' ? ` · ${tx.name}` : ''}
                      </div>
                      <div className="t-meta" style={{ color: 'var(--text-muted)' }}>
                        {tx.created_at ? formatDate(tx.created_at) : `${MONTHS_DE[tx.month - 1]} ${tx.year}`}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div className={`sparschwein-ledger-amount ${tx.direction === 'in' ? 'positive' : 'negative'}`}>
                        {tx.direction === 'in' ? '+' : '-'}{formatEur(tx.amount)}
                      </div>
                      <div className="t-meta" style={{ color: 'var(--text-muted)' }}>
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
            <p className="t-body" style={{ color: 'var(--text-muted)', marginBottom: 'var(--space-4)' }}>
              Der Betrag wird direkt ins Sparschwein übertragen und erscheint
              nicht in deinen regulären Ausgaben.
            </p>

            <label className="wiz-label t-meta">Betrag (€)</label>
            <input
              className="wiz-input"
              type="number"
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0,00"
              min="0.01"
              step="0.01"
              autoFocus
              style={{ fontSize: 'max(16px, 1rem)' }}
            />

            {saving_status && (
              <div className={`status-note ${saving_status.type}`} style={{ marginTop: 'var(--space-3)' }}>
                {saving_status.text}
              </div>
            )}
          </div>

          <div className="entry-modal-actions">
            <button
              className="btn btn-secondary"
              onClick={() => { setSaving(false); setSavingStatus(null); setAmount(''); }}
            >
              Abbrechen
            </button>
            <button className="btn btn-primary" onClick={handleSaveDeposit}>
              Sparen
            </button>
          </div>
        </SheetShell>
      )}
    </>
  );
}
