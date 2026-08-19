import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../../../core/lib/AuthContext';
import { useUi } from '../../../core/lib/UiContext';
import { useEntrySheet } from '../../../core/lib/EntrySheetContext';
import { MONTHS_DE, formatEur, sumCat } from '../lib/finance';
import { formatRelativeDate } from '../../../core/lib/format';
import * as db from '../lib/finData';
import EntryModal from './EntryModal';
import { IconChevronLeft, IconChevronRight } from '../../../core/components/Icons';

// Spaltenaufteilung wie im Original
const COLUMNS = [
  { key: 'einnahmen', label: 'Einnahmen', cats: ['fixeinnahmen', 'sonstige_einnahmen'] },
  { key: 'fixkosten', label: 'Fixkosten', cats: ['fixkosten'] },
  { key: 'variable', label: 'Variable Kosten', cats: ['variable_kosten'] },
  { key: 'sonstige', label: 'Sonstige Ausgaben', cats: ['sonstige_ausgaben'] },
];

const FILTERS = [
  { key: 'alle', label: 'Alle' },
  { key: 'offen', label: 'Offen' },
  { key: 'fix', label: 'Fix' },
  { key: 'ein', label: 'Ein' },
];

function sortByCreated(arr, dir = 'asc') {
  const k = (e) => (e.created_at ? new Date(e.created_at).getTime() : 0);
  return arr.slice().sort((a, b) => (dir === 'desc' ? k(b) - k(a) : k(a) - k(b)));
}

export default function MonthsView() {
  const { session } = useAuth();
  const { showToast } = useUi();
  const { version } = useEntrySheet();
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null);
  const [filter, setFilter] = useState('alle');

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

  // Lädt auch neu, wenn im globalen Erfassen-Sheet (core/components/
  // EntrySheet.jsx) ein Eintrag für Finanzen gespeichert wurde, ohne
  // dass das Sheet diese View direkt kennen muss.
  useEffect(() => { load(); }, [load, version]);

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

  async function togglePaid(entry, e) {
    e.stopPropagation();
    await db.togglePaid(entry.id, !entry.paid);
    showToast(!entry.paid ? '✓ Als bezahlt markiert' : 'Als offen markiert');
    load();
  }

  const fixEin = sumCat(entries, 'fixeinnahmen');
  const sonstEin = sumCat(entries, 'sonstige_einnahmen');
  const totalEin = fixEin + sonstEin;
  const totalAus = sumCat(entries, 'fixkosten') + sumCat(entries, 'variable_kosten') + sumCat(entries, 'sonstige_ausgaben');
  const verfuegbar = totalEin - totalAus;
  const offeneEintraege = entries.filter((e) => !e.paid && e.category !== 'fixeinnahmen' && e.category !== 'sonstige_einnahmen');
  const offeneSumme = offeneEintraege.reduce((s, e) => s + Number(e.amount || 0), 0);
  const spentRatio = totalEin > 0 ? Math.min(100, (totalAus / totalEin) * 100) : 0;
  const openRatio = totalEin > 0 ? Math.min(100 - spentRatio, (offeneSumme / totalEin) * 100) : 0;

  const heuteTag = now.getDate();
  const istAktuellerMonat = year === now.getFullYear() && month === now.getMonth() + 1;

  function visibleColumns() {
    if (filter === 'fix') return COLUMNS.filter((c) => c.key === 'fixkosten');
    if (filter === 'ein') return COLUMNS.filter((c) => c.key === 'einnahmen');
    return COLUMNS;
  }

  function entriesForColumn(col) {
    const colEntries = entries.filter((e) => col.cats.includes(e.category));
    if (filter === 'offen') return colEntries.filter((e) => !e.paid);
    return colEntries;
  }

  function entryRow(e) {
    const showCheck = e.category !== 'fixeinnahmen' && e.category !== 'sonstige_einnahmen';
    return (
      <div
        key={e.id}
        className="fin-row"
        onClick={() => setModal({ entry: e, defaultCategory: e.category })}
      >
        {showCheck && (
          <div
            className={`fin-row-check ${e.paid ? 'checked' : ''}`}
            onClick={(ev) => togglePaid(e, ev)}
          >
            {e.paid && '✓'}
          </div>
        )}
        <div className="fin-row-info">
          <div className={`fin-row-name ${e.paid ? 'paid' : ''}`}>{e.name}</div>
          <div className="fin-row-meta">
            {e.payment}{e.created_at ? ` · ${formatRelativeDate(e.created_at)}` : ''}
          </div>
        </div>
        <div className={`fin-row-amount ${e.paid ? 'paid' : ''}`}>{formatEur(e.amount).replace('€', '').trim()}</div>
      </div>
    );
  }

  return (
    <>
      <div className="fin-header">
        <div className="month-nav">
          <button className="month-nav-btn" onClick={() => shiftMonth(-1)}><IconChevronLeft /></button>
          <span className="month-label">{MONTHS_DE[month - 1]} {String(year).slice(2)}</span>
          <button className="month-nav-btn" onClick={() => shiftMonth(1)}><IconChevronRight /></button>
        </div>
        {istAktuellerMonat && <div className="fin-today-pill">Heute {heuteTag}.</div>}
      </div>

      <div className="fin-lead">
        <div className="hub-eyebrow">Saldo diesen Monat</div>
        <div className="hub-lead-stat">{formatEur(verfuegbar)}</div>
        <div className="hub-lead-substats">
          <span>Ein <b>{formatEur(totalEin)}</b></span>
          <span>Aus <b>{formatEur(totalAus)}</b></span>
          {offeneEintraege.length > 0 && <span style={{ color: 'var(--accent)' }}>{offeneEintraege.length} offen</span>}
        </div>
        <div className="fin-bar">
          <div className="fin-bar-spent" style={{ width: `${spentRatio}%` }} />
          <div className="fin-bar-open" style={{ width: `${openRatio}%` }} />
        </div>
      </div>

      <div className="fin-filter-row">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            className={`fin-filter-cell ${filter === f.key ? 'active' : ''}`}
            onClick={() => setFilter(f.key)}
          >
            {f.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="loading-note">Lädt…</div>
      ) : (
        visibleColumns().map((col) => {
          const colEntries = entriesForColumn(col);
          const total = colEntries.reduce((s, e) => s + Number(e.amount || 0), 0);
          if (filter === 'offen' && colEntries.length === 0) return null;

          return (
            <div className="fin-section" key={col.key}>
              <div className="fin-section-header">
                <div>{col.label}</div>
                <div>{formatEur(total).replace('€', '').trim()}</div>
              </div>
              {col.cats.length > 1
                ? sortByCreated(colEntries, 'asc').map((e) => entryRow(e))
                : sortByCreated(colEntries, (col.key === 'sonstige' || col.key === 'variable') ? 'desc' : 'asc').map((e) => entryRow(e))}
              {colEntries.length === 0 && <div className="fin-row-empty">Keine Einträge</div>}

              <button
                className="fin-add-row"
                onClick={() => setModal({ entry: null, defaultCategory: col.cats[col.cats.length - 1] })}
              >
                + Eintrag zu {col.label.toLowerCase()}
              </button>
            </div>
          );
        })
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
