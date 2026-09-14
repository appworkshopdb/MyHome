import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../../../core/lib/AuthContext';
import { useUi } from '../../../core/lib/UiContext';
import { useEntrySheet } from '../../../core/lib/EntrySheetContext';
import { MONTHS_DE, formatEur, sumCat } from '../lib/finance';
import { formatRelativeDate } from '../../../core/lib/format';
import * as db from '../lib/finData';
import EntryModal from './EntryModal';
import { IconChevronLeft, IconChevronRight } from '../../../core/components/Icons';

// 4 Spalten — Einnahmen + 3 Ausgaben-Kategorien
const COLUMNS = [
  { key: 'einnahmen', label: 'Einnahmen',        cats: ['fixeinnahmen', 'sonstige_einnahmen'] },
  { key: 'fixkosten', label: 'Fixkosten',         cats: ['fixkosten'] },
  { key: 'variable',  label: 'Variable Kosten',   cats: ['variable_kosten'] },
  { key: 'sonstige',  label: 'Sonstige Ausgaben', cats: ['sonstige_ausgaben'] },
];

const FILTERS = [
  { key: 'alle',  label: 'Alle'  },
  { key: 'offen', label: 'Offen' },
  { key: 'fix',   label: 'Fix'   },
  { key: 'ein',   label: 'Ein'   },
];

function sortByCreated(arr, dir = 'asc') {
  const k = (e) => (e.created_at ? new Date(e.created_at).getTime() : 0);
  return arr.slice().sort((a, b) => (dir === 'desc' ? k(b) - k(a) : k(a) - k(b)));
}

// ── Aufklappbare Kategorie-Sektion ───────────────────────────────────────────
function CollapseSection({ col, entries, filter, onOpenModal }) {
  const [open, setOpen] = useState(false);

  const colEntries = entries.filter((e) => col.cats.includes(e.category));
  const visible    = filter === 'offen'
    ? colEntries.filter((e) => !e.paid)
    : colEntries;

  // Bei Filter "offen": leere Kategorien komplett ausblenden
  if (filter === 'offen' && visible.length === 0) return null;

  const total  = visible.reduce((s, e) => s + Number(e.amount || 0), 0);
  const sorted = col.cats.length > 1
    ? sortByCreated(visible, 'asc')
    : sortByCreated(visible, (col.key === 'sonstige' || col.key === 'variable') ? 'desc' : 'asc');

  function togglePaidInline(e, entry) {
    // Weitergeleitet an Parent via onOpenModal nicht nötig —
    // Abhaken läuft über den Modal. Tap auf die Zeile öffnet Modal.
    e.stopPropagation();
  }

  return (
    <div className="fin-collapse">
      {/* Kopfzeile — immer sichtbar, antippbar */}
      <button
        className={`fin-collapse-header ${open ? 'open' : ''}`}
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
      >
        <span className="fin-collapse-label t-body">{col.label}</span>
        <div className="fin-collapse-meta">
          <span className="fin-collapse-count t-meta">{visible.length} Posten</span>
          <span className="fin-collapse-total t-body">{formatEur(total)}</span>
          <span className={`fin-collapse-chevron ${open ? 'open' : ''}`}>›</span>
        </div>
      </button>

      {/* Aufgeklappter Inhalt */}
      {open && (
        <div className="fin-collapse-body">
          {sorted.map((e) => {
            const isIncome = e.category === 'fixeinnahmen' || e.category === 'sonstige_einnahmen';
            return (
              <div
                key={e.id}
                className="fin-row"
                onClick={() => onOpenModal({ entry: e, defaultCategory: e.category })}
              >
                {!isIncome && (
                  <div className={`fin-row-check ${e.paid ? 'checked' : ''}`}>
                    {e.paid && '✓'}
                  </div>
                )}
                <div className="fin-row-info">
                  <div className={`fin-row-name ${e.paid ? 'paid' : ''}`}>{e.name}</div>
                  <div className="fin-row-meta">
                    {e.payment}{e.created_at ? ` · ${formatRelativeDate(e.created_at)}` : ''}
                  </div>
                  {e.note && <div className="fin-row-note">{e.note}</div>}
                </div>
                <div className={`fin-row-amount ${e.paid ? 'paid' : ''}`}>
                  {formatEur(e.amount).replace('€', '').trim()}
                </div>
              </div>
            );
          })}
          {visible.length === 0 && (
            <div className="fin-row-empty">Keine Einträge</div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Hauptkomponente ──────────────────────────────────────────────────────────
export default function MonthsView({ initialFilter = 'alle' }) {
  const { session }  = useAuth();
  const { showToast } = useUi();
  const { version, notifySaved } = useEntrySheet();

  const now = new Date();
  const [year,  setYear]  = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal,   setModal]   = useState(null);
  const [filter,  setFilter]  = useState(initialFilter);

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

  // Kennzahlen für die Saldo-Karte
  const totalEin    = sumCat(entries, 'fixeinnahmen') + sumCat(entries, 'sonstige_einnahmen');
  const totalAus    = sumCat(entries, 'fixkosten') + sumCat(entries, 'variable_kosten') + sumCat(entries, 'sonstige_ausgaben');
  const verfuegbar  = totalEin - totalAus;
  const offene      = entries.filter((e) => !e.paid && e.category !== 'fixeinnahmen' && e.category !== 'sonstige_einnahmen');
  const offeneSumme = offene.reduce((s, e) => s + Number(e.amount || 0), 0);
  const spentRatio  = totalEin > 0 ? Math.min(100, (totalAus  / totalEin) * 100) : 0;
  const openRatio   = totalEin > 0 ? Math.min(100 - spentRatio, (offeneSumme / totalEin) * 100) : 0;

  // Sichtbare Spalten je nach aktivem Filter
  function visibleColumns() {
    if (filter === 'fix') return COLUMNS.filter((c) => c.key === 'fixkosten');
    if (filter === 'ein') return COLUMNS.filter((c) => c.key === 'einnahmen');
    return COLUMNS;
  }

  return (
    <>
      {/* Monatsnavigation */}
      <div className="fin-month-nav">
        <button className="month-nav-btn" onClick={() => shiftMonth(-1)} aria-label="Vorheriger Monat">
          <IconChevronLeft />
        </button>
        <span className="fin-month-label">{MONTHS_DE[month - 1]} {year}</span>
        <button className="month-nav-btn" onClick={() => shiftMonth(1)} aria-label="Nächster Monat">
          <IconChevronRight />
        </button>
      </div>

      {/* Saldo-Karte mit allen Infos in einer Zeile */}
      <div className="fin-summary-card">
        <div className="fin-summary-eyebrow t-chip">Saldo diesen Monat</div>
        <div className="fin-summary-value t-display">
          {loading ? '—' : formatEur(verfuegbar)}
        </div>
        {/* Infozeile: + Einnahmen  − Ausgaben  N offen  N Buchungen */}
        <div className="fin-summary-sub">
          <span>+ <b>{formatEur(totalEin)}</b></span>
          <span>− <b>{formatEur(totalAus)}</b></span>
          {offene.length > 0 && (
            <span style={{ color: 'var(--status-critical)' }}>
              {offene.length} offen
            </span>
          )}
        </div>
        <div className="fin-bar" role="progressbar" aria-valuenow={Math.round(spentRatio)}>
          <div className="fin-bar-spent" style={{ width: `${spentRatio}%` }} />
          <div className="fin-bar-open"  style={{ width: `${openRatio}%`  }} />
        </div>
      </div>

      {/* Filter — abgerundete Pills */}
      <div className="fin-filter-pills">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            className={`fin-filter-pill ${filter === f.key ? 'active' : ''}`}
            onClick={() => setFilter(f.key)}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Aufklappbare Kategorie-Sektionen */}
      {loading ? (
        <div className="loading-note">Lädt…</div>
      ) : (
        <div className="fin-collapse-list">
          {visibleColumns().map((col) => (
            <CollapseSection
              key={col.key}
              col={col}
              entries={entries}
              filter={filter}
              onOpenModal={setModal}
            />
          ))}
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
