import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '../../../core/lib/AuthContext';
import { useUi } from '../../../core/lib/UiContext';
import { useEntrySheet } from '../../../core/lib/EntrySheetContext';
import { MONTHS_DE, formatEur, sumCat } from '../lib/finance';
import { formatRelativeDate } from '../../../core/lib/format';
import * as db from '../lib/finData';
import EntryModal from './EntryModal';
import { IconChevronLeft, IconChevronRight } from '../../../core/components/Icons';

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

function EntryRow({ e, onOpenModal, onTogglePaid }) {
  const isIncome = e.category === 'fixeinnahmen' || e.category === 'sonstige_einnahmen';
  const checkRef = useRef(null);

  function handleCheck(ev) {
    ev.stopPropagation();
    const el = checkRef.current;
    if (el) {
      el.classList.remove('flash');
      void el.offsetWidth;
      el.classList.add('flash');
      setTimeout(() => el.classList.remove('flash'), 420);
    }
    onTogglePaid(e);
  }

  return (
    <div className="fin-row" onClick={() => onOpenModal({ entry: e, defaultCategory: e.category })}>
      {!isIncome && (
        <div ref={checkRef} className={`fin-row-check ${e.paid ? 'checked' : ''}`} onClick={handleCheck} role="checkbox" aria-checked={e.paid}>
          {e.paid && '✓'}
        </div>
      )}
      <div className="fin-row-info">
        <div className={`fin-row-name ${e.paid ? 'paid' : ''}`}>{e.name}</div>
        <div className="fin-row-meta">{e.payment}{e.created_at ? ` · ${formatRelativeDate(e.created_at)}` : ''}</div>
        {e.note && <div className="fin-row-note">{e.note}</div>}
      </div>
      <div className={`fin-row-amount ${e.paid ? 'paid' : ''}`}>{formatEur(e.amount).replace('€', '').trim()}</div>
    </div>
  );
}

function OffenList({ entries, onOpenModal, onTogglePaid }) {
  const offene = entries.filter((e) => !e.paid && e.category !== 'fixeinnahmen' && e.category !== 'sonstige_einnahmen');
  const gesamtOffen = offene.reduce((s, e) => s + Number(e.amount || 0), 0);
  const sorted = sortByCreated(offene, 'asc');
  if (offene.length === 0) return <div className="fin-offen-empty"><span className="t-body" style={{ color: 'var(--status-positive)' }}>✓ Alles bezahlt</span></div>;
  return (
    <div className="fin-offen-list">
      <div className="fin-offen-header">
        <span className="t-meta" style={{ color: 'var(--text-muted)' }}>{offene.length} offene Posten</span>
        <span className="t-body" style={{ fontWeight: 700, color: 'var(--status-critical)' }}>{formatEur(gesamtOffen)}</span>
      </div>
      {sorted.map((e) => <EntryRow key={e.id} e={e} onOpenModal={onOpenModal} onTogglePaid={onTogglePaid} />)}
    </div>
  );
}

function CollapseSection({ col, entries, onOpenModal, onTogglePaid }) {
  const [open, setOpen] = useState(false);
  const visible = entries.filter((e) => col.cats.includes(e.category));
  if (visible.length === 0) return null;
  const total = visible.reduce((s, e) => s + Number(e.amount || 0), 0);
  const sorted = col.cats.length > 1 ? sortByCreated(visible, 'asc') : sortByCreated(visible, (col.key === 'sonstige' || col.key === 'variable') ? 'desc' : 'asc');
  return (
    <div className="fin-collapse">
      <button className={`fin-collapse-header ${open ? 'open' : ''}`} onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        <span className="fin-collapse-label t-body">{col.label}</span>
        <div className="fin-collapse-meta">
          <span className="fin-collapse-count t-meta">{visible.length} Posten</span>
          <span className="fin-collapse-total t-body">{formatEur(total)}</span>
          <span className={`fin-collapse-chevron ${open ? 'open' : ''}`}>›</span>
        </div>
      </button>
      {open && <div className="fin-collapse-body">{sorted.map((e) => <EntryRow key={e.id} e={e} onOpenModal={onOpenModal} onTogglePaid={onTogglePaid} />)}</div>}
    </div>
  );
}

export default function MonthsView({ initialFilter = 'alle' }) {
  const { session } = useAuth();
  const { showToast } = useUi();
  const { version, notifySaved, setFinancePeriod } = useEntrySheet();
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null);
  const [filter, setFilter] = useState(initialFilter);

  useEffect(() => {
    setFinancePeriod(year, month);
  }, [year, month, setFinancePeriod]);

  const loadRef = useRef(null);
  loadRef.current = async () => {
    setLoading(true);
    try {
      await db.applyMissingFixTemplates(session, year, month);
      setEntries(await db.getEntriesByMonth(session, year, month));
    } catch (e) {
      showToast('Laden fehlgeschlagen');
      console.error(e);
    }
    setLoading(false);
  };
  const load = useCallback(() => loadRef.current?.(), []);
  useEffect(() => { load(); }, [year, month]); // eslint-disable-line
  useEffect(() => { if (version > 0) load(); }, [version]); // eslint-disable-line

  function shiftMonth(delta) {
    let m = month + delta, y = year;
    if (m < 1) { m = 12; y--; } else if (m > 12) { m = 1; y++; }
    // Sofort synchronisieren, damit ein direkt danach geöffnetes globales
    // Erfassen-Sheet garantiert den neu ausgewählten Monat verwendet.
    setFinancePeriod(y, m);
    setMonth(m);
    setYear(y);
  }

  async function handleSave(entry) {
    await db.saveEntry(session, { ...entry, year, month });
    setModal(null);
    showToast(entry.id ? 'Eintrag aktualisiert' : 'Eintrag hinzugefügt');
    load();
    notifySaved();
  }
  async function handleDelete(id) {
    if (!confirm('Eintrag löschen?')) return;
    await db.deleteEntry(id);
    setModal(null);
    showToast('Eintrag gelöscht');
    load();
    notifySaved();
  }
  function handleTogglePaid(entry) {
    const newPaid = !entry.paid;
    setEntries((prev) => prev.map((e) => e.id === entry.id ? { ...e, paid: newPaid } : e));
    showToast(newPaid ? '✓ Als bezahlt markiert' : 'Als offen markiert');
    db.togglePaid(entry.id, newPaid).catch(() => {
      setEntries((prev) => prev.map((e) => e.id === entry.id ? { ...e, paid: entry.paid } : e));
      showToast('Fehler beim Speichern');
    });
  }

  const totalEin = sumCat(entries, 'fixeinnahmen') + sumCat(entries, 'sonstige_einnahmen');
  const totalAus = sumCat(entries, 'fixkosten') + sumCat(entries, 'variable_kosten') + sumCat(entries, 'sonstige_ausgaben');
  const verfuegbar = totalEin - totalAus;
  const offene = entries.filter((e) => !e.paid && e.category !== 'fixeinnahmen' && e.category !== 'sonstige_einnahmen');
  const offeneSumme = offene.reduce((s, e) => s + Number(e.amount || 0), 0);
  const spentRatio = totalEin > 0 ? Math.min(100, (totalAus / totalEin) * 100) : 0;
  const openRatio = totalEin > 0 ? Math.min(100 - spentRatio, (offeneSumme / totalEin) * 100) : 0;

  function visibleColumns() {
    if (filter === 'fix') return COLUMNS.filter((c) => c.key === 'fixkosten');
    if (filter === 'ein') return COLUMNS.filter((c) => c.key === 'einnahmen');
    return COLUMNS;
  }

  return (
    <>
      <div className="fin-month-nav">
        <button className="month-nav-btn" onClick={() => shiftMonth(-1)} aria-label="Vorheriger Monat"><IconChevronLeft /></button>
        <span className="fin-month-label">{MONTHS_DE[month - 1]} {year}</span>
        <button className="month-nav-btn" onClick={() => shiftMonth(1)} aria-label="Nächster Monat"><IconChevronRight /></button>
      </div>
      <div className="fin-summary-card">
        <div className="fin-summary-eyebrow t-chip">Saldo diesen Monat</div>
        <div className="fin-summary-value t-display">{loading ? '—' : formatEur(verfuegbar)}</div>
        <div className="fin-summary-sub">
          <span>+ <b>{formatEur(totalEin)}</b></span>
          <span>− <b>{formatEur(totalAus)}</b></span>
          {offene.length > 0 && <span style={{ color: 'var(--status-critical)' }}>{offene.length} offen</span>}
        </div>
        <div className="fin-bar" role="progressbar" aria-valuenow={Math.round(spentRatio)}>
          <div className="fin-bar-spent" style={{ width: `${spentRatio}%` }} />
          <div className="fin-bar-open" style={{ width: `${openRatio}%` }} />
        </div>
      </div>
      <div className="fin-filter-pills">
        {FILTERS.map((f) => <button key={f.key} className={`fin-filter-pill ${filter === f.key ? 'active' : ''}`} onClick={() => setFilter(f.key)}>{f.label}</button>)}
      </div>
      {loading ? <div className="loading-note">Lädt…</div> : filter === 'offen' ? <OffenList entries={entries} onOpenModal={setModal} onTogglePaid={handleTogglePaid} /> : <div className="fin-collapse-list">{visibleColumns().map((col) => <CollapseSection key={col.key} col={col} entries={entries} onOpenModal={setModal} onTogglePaid={handleTogglePaid} />)}</div>}
      {modal && <EntryModal entry={modal.entry} defaultCategory={modal.defaultCategory} onSave={handleSave} onDelete={handleDelete} onClose={() => setModal(null)} showToast={showToast} />}
    </>
  );
}
