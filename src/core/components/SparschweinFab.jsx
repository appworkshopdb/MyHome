import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../lib/AuthContext';
import { useEntrySheet } from '../lib/EntrySheetContext';
import * as finData from '../../modules/finance/lib/finData';
import { formatEur, formatDate, MONTHS_DE } from '../../modules/finance/lib/finance';

// Schwebender Sparschwein-Button, sitzt über dem globalen "+"-FAB.
// Nur im Finanzen-Modul sichtbar (activeModule === 'finance').
//
// Bekannte Regelverletzung wie bei EntrySheet.jsx: importiert direkt aus
// modules/finance/lib — core kennt damit strenggenommen ein Modul. Bewusst
// in Kauf genommen, analog zum bestehenden Muster, siehe Projektkontext.md.
export default function SparschweinFab() {
  const { session } = useAuth();
  const { version } = useEntrySheet(); // steigt nach jedem gespeicherten Eintrag
  const [balance, setBalance] = useState(null);
  const [ledger, setLedger] = useState([]);
  const [totals, setTotals] = useState({ totalIn: 0, totalOut: 0 });
  const [open, setOpen] = useState(false);

  const load = useCallback(async () => {
    if (!session) return;
    const { ledger, balance, totalIn, totalOut } = await finData.getSparschweinLedger(session);
    setBalance(balance);
    setLedger(ledger);
    setTotals({ totalIn, totalOut });
  }, [session]);

  useEffect(() => { load(); }, [load, version]);

  if (balance === null) return null; // noch nicht geladen — kein Flackern

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

      {open && (
        <div className="sheet-overlay" onClick={(e) => e.target === e.currentTarget && setOpen(false)}>
          <div className="sheet">
            <div className="sheet-header">
              <div className="sheet-title t-title">Sparschwein</div>
              <button className="sheet-cancel" onClick={() => setOpen(false)}>Schließen</button>
            </div>

            <div className="wiz-body" style={{ paddingTop: 'var(--space-3)' }}>
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

              <div className="t-meta" style={{ color: 'var(--text-muted)', margin: 'var(--space-5) 0 var(--space-2)' }}>
                Verlauf
              </div>

              {ledger.length === 0 ? (
                <div className="sheet-placeholder">
                  <p className="t-body">
                    Noch keine Buchungen. Trage im Wizard eine Ausgabe „Ersparnisse" ein, um einzuzahlen,
                    oder eine Einnahme „Sparschwein", um etwas zu entnehmen.
                  </p>
                </div>
              ) : (
                <div className="sparschwein-ledger">
                  {ledger.map((tx) => (
                    <div key={tx.id} className="sparschwein-ledger-row">
                      <div>
                        <div className="t-body" style={{ fontWeight: 600 }}>
                          {tx.direction === 'in' ? 'Einzahlung · Ersparnisse' : 'Entnahme · Sparschwein'}
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
          </div>
        </div>
      )}
    </>
  );
}
