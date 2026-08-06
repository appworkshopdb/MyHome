import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../../../core/lib/AuthContext';
import { useUi } from '../../../core/lib/UiContext';
import { CATEGORIES, MONTHS_DE, formatEur, sumCat } from '../lib/finance';
import * as db from '../lib/finData';
import EntryModal from './EntryModal';
import PaymentBadge from './PaymentBadge';
import { IconChevronLeft, IconChevronRight } from '../../../core/components/Icons';

// Spaltenaufteilung wie im Original
const COLUMNS = [
  { key: 'einnahmen', label: 'Einnahmen', cats: ['fixeinnahmen', 'sonstige_einnahmen'], color: 'var(--success)' },
  { key: 'fixkosten', label: 'Fixkosten', cats: ['fixkosten'], color: 'var(--warning)' },
  { key: 'variable', label: 'Variable Kosten', cats: ['variable_kosten'], color: 'var(--danger)' },
  { key: 'sonstige', label: 'Sonstige Ausgaben', cats: ['sonstige_ausgaben'], color: 'var(--danger)' },
];

function sortByCreated(arr, dir = 'asc') {
  const k = (e) => (e.created_at ? new Date(e.created_at).getTime() : 0);
  return arr.slice().sort((a, b) => (dir === 'desc' ? k(b) - k(a) : k(a) - k(b)));
}

export default function MonthsView() {
  const { session } = useAuth();
  const { showToast } = useUi();
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      await db.applyMissingFixTemplates(session, year, month);
      setEntries(await db.getEntriesByMonth(session, year, month));
    } catch (e) {
      showToast('Laden fehlgeschlagen');
      console.error(e);
    }
    setLoading(false);
  }, [session, year, month, showToast]);

  useEffect(() => { load(); }, [load]);

  function shiftMonth(delta) {
    let m = month + delta, y = year;
    if (m < 1) { m = 12; y--; } else if (m > 12) { m = 1; y++; }
    setMonth(m); setYear(y);
  }

  async function handleSave(entry) {
    await db.saveEntry(session, { ...entry, year, month });
    setModal(null);
    showToast(entry.id ? 'Eintrag aktualisiert' : 'Eintrag hinzugefügt');
    load();
  }

  async function handleDelete(id) {
    if (!confirm('Eintrag löschen?')) return;
    await db.deleteEntry(id);
    setModal(null);
    showToast('Eintrag gelöscht');
    load();
  }

  async function togglePaid(entry) {
    await db.togglePaid(entry.id, !entry.paid);
    showToast(!entry.paid ? '✓ Als bezahlt markiert' : 'Als offen markiert');
    load();
  }

  const fixEin = sumCat(entries, 'fixeinnahmen');
  const sonstEin = sumCat(entries, 'sonstige_einnahmen');
  const totalEin = fixEin + sonstEin;
  const totalAus = sumCat(entries, 'fixkosten') + sumCat(entries, 'variable_kosten') + sumCat(entries, 'sonstige_ausgaben');
  const verfuegbar = totalEin - totalAus;

  function entryRow(e, showPaid) {
    return (
      <tr
        key={e.id}
        className="entry-row"
        onClick={() => setModal({ entry: e, defaultCategory: e.category })}
        style={{ cursor: 'pointer', opacity: e.paid ? 0.5 : 1 }}
      >
        <td>
          <span style={e.paid ? { textDecoration: 'line-through', color: 'var(--text-muted)' } : undefined}>
            {e.name}
          </span>
        </td>
        <td><PaymentBadge payment={e.payment} /></td>
        <td className="amount">{formatEur(e.amount)}</td>
        {showPaid && (
          <td style={{ textAlign: 'center' }} onClick={(ev) => ev.stopPropagation()}>
            <input
              type="checkbox" checked={e.paid}
              onChange={() => togglePaid(e)}
              style={{ width: 16, height: 16, accentColor: 'var(--accent)', cursor: 'pointer' }}
              title={e.paid ? 'Als offen markieren' : 'Als bezahlt markieren'}
            />
          </td>
        )}
      </tr>
    );
  }

  return (
    <>
      <div className="page-header">
        <div className="month-nav">
          <button className="month-nav-btn" onClick={() => shiftMonth(-1)}><IconChevronLeft /></button>
          <span className="month-label">{MONTHS_DE[month - 1]} {year}</span>
          <button className="month-nav-btn" onClick={() => shiftMonth(1)}><IconChevronRight /></button>
        </div>
        <select
          value={year}
          onChange={(e) => setYear(Number(e.target.value))}
          style={{ width: 'auto', fontSize: '0.9rem', padding: '6px 28px 6px 10px' }}
        >
          {Array.from({ length: 11 }, (_, i) => 2020 + i).map((y) => <option key={y} value={y}>{y}</option>)}
        </select>
      </div>

      <div className="summary-row" id="month-summary">
        <div className="summary-chip">
          <div className="label">Einnahmen</div>
          <div className="value">{formatEur(totalEin)}</div>
        </div>
        <div className="summary-chip negative">
          <div className="label">Ausgaben</div>
          <div className="value">{formatEur(totalAus)}</div>
        </div>
        <div className={`summary-chip ${verfuegbar >= 0 ? 'positive' : 'negative'}`}>
          <div className="label">Verfügbar</div>
          <div className="value">{formatEur(verfuegbar)}</div>
        </div>
      </div>

      {loading ? (
        <div className="loading-note">Lädt…</div>
      ) : (
        <div id="month-columns" style={{ display: 'grid', gap: 12 }}>
          {COLUMNS.map((col) => {
            const colEntries = entries.filter((e) => col.cats.includes(e.category));
            const total = colEntries.reduce((s, e) => s + Number(e.amount || 0), 0);
            const hasPaid = col.key !== 'einnahmen';

            return (
              <div className="card" key={col.key} style={{ marginBottom: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                  <div className="card-title" style={{ marginBottom: 0, color: col.color }}>{col.label}</div>
                  <button
                    className="btn btn-primary"
                    style={{ padding: '5px 12px', fontSize: '0.82rem' }}
                    onClick={() => setModal({ entry: null, defaultCategory: col.cats[col.cats.length - 1] })}
                  >
                    + Eintrag
                  </button>
                </div>

                <div className="table-wrap">
                  <table className="entry-table month-table">
                    <colgroup>
                      <col className="c-name" /><col className="c-pay" /><col className="c-amt" />
                      {hasPaid && <col className="c-paid" />}
                    </colgroup>
                    <thead>
                      <tr>
                        <th>Name</th>
                        <th>Zahl.</th>
                        <th style={{ textAlign: 'right' }}>Betrag</th>
                        {hasPaid && <th style={{ textAlign: 'center' }}>Bez.</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {col.cats.length > 1
                        ? ['fixeinnahmen', 'sonstige_einnahmen'].flatMap((cat) => [
                            <tr key={`h-${cat}`}>
                              <td
                                colSpan={hasPaid ? 4 : 3}
                                style={{
                                  padding: '10px 8px 4px', fontSize: '0.75rem', fontWeight: 600,
                                  textTransform: 'uppercase', letterSpacing: '0.04em',
                                  color: 'var(--text-muted)', borderBottom: 'none',
                                }}
                              >
                                {CATEGORIES[cat]}
                              </td>
                            </tr>,
                            // Einnahmen: älteste oben, neueste unten
                            ...sortByCreated(entries.filter((e) => e.category === cat), 'asc')
                              .map((e) => entryRow(e, hasPaid)),
                          ])
                        // Sonstige Ausgaben & Variable Kosten: neueste oben; Fixkosten: älteste oben
                        : sortByCreated(colEntries, (col.key === 'sonstige' || col.key === 'variable') ? 'desc' : 'asc')
                            .map((e) => entryRow(e, hasPaid))}
                    </tbody>
                    <tfoot>
                      <tr>
                        <td colSpan="2" style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>Summe</td>
                        <td className="amount" style={{ color: col.color }}>{formatEur(total)}</td>
                        {hasPaid && <td></td>}
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {modal && (
        <EntryModal
          entry={modal.entry}
          defaultCategory={modal.defaultCategory}
          onSave={handleSave}
          onDelete={handleDelete}
          onClose={() => setModal(null)}
          showToast={showToast}
        />
      )}
    </>
  );
}
