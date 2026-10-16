// modules/finance/components/SparschweinSection.jsx
// Bereich "Sparschwein" in der Finanzen-Übersicht: direkt unter der
// Saldo-Karte, eine Zeile mit dem aktuellen Stand. Tippen öffnet das
// Sparschwein-Sheet (Stand, Ein-/Auszahlungen, Verlauf).
//
// Ersetzt den früheren schwebenden Sparschwein-Button (core/components/
// SparschweinFab.jsx), der Inhalt hinter dem "+" verdeckt hat. Liegt jetzt
// im Finanzen-Modul statt in core/ — damit entfällt auch der Import von
// core nach modules/finance.
//
// Das Sheet wird per Portal an <body> gehängt (wie SheetShell), damit
// position:fixed nicht von einem Elternelement der Übersicht beeinflusst wird.

import { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '../../../core/lib/AuthContext';
import { useEntrySheet } from '../../../core/lib/EntrySheetContext';
import PageSection from '../../../core/components/PageSection.jsx';
import AreaList from '../../../core/components/AreaList.jsx';
import * as finData from '../lib/finData';
import { formatEur, formatDate, MONTHS_DE } from '../lib/finance';

export default function SparschweinSection() {
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

  return (
    <>
      <PageSection title="Sparschwein">
        <AreaList>
          <button
            className="area-row"
            onClick={() => setOpen(true)}
            disabled={balance === null}
            aria-label={balance === null ? 'Sparschwein' : `Sparschwein, aktueller Stand ${formatEur(balance)}`}
          >
            <img src="./icons/piggy-bank.png" alt="" className="area-row-icon" />
            <span className="area-row-label">Aktueller Stand</span>
            <span className="area-row-value area-row-value--neutral">
              {balance === null ? '—' : formatEur(balance)}
            </span>
            <span className="area-row-chevron" aria-hidden="true">›</span>
          </button>
        </AreaList>
      </PageSection>

      {open && createPortal(
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
                          {tx.direction === 'in' ? 'Einzahlung' : 'Entnahme'} · {tx.name}
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
        </div>,
        document.body
      )}
    </>
  );
}
