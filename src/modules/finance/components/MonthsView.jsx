import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '../../../core/lib/AuthContext';
import { useUi } from '../../../core/lib/UiContext';
import { useEntrySheet } from '../../../core/lib/EntrySheetContext';
import { useFinanceMonth } from '../lib/FinanceMonthContext';
import {
  MONTHS_DE, formatEur, isSparschweinDeposit, isSparschweinDirectWithdrawal, formatPayments, isInstantMethod, entryParts, openAmount, isOpenExpense, offenePostenText, localTodayStr, paidAmount, isFullyPaid, isPartlyPaid, setPartsPaid,
} from '../lib/finance';
import { available, standSummary } from '../../../core/lib/finAvailable';
import AvailableCard from '../../../core/components/AvailableCard';
import { formatRelativeDate } from '../../../core/lib/format';
import * as db from '../lib/finData';
import EntryDetailSheet from './EntryDetailSheet';
import { IconChevronLeft, IconChevronRight, IconEdit, IconTrash } from '../../../core/components/Icons';
import Icon from '../../../core/components/Icon';
import { SkeletonList, confirmDialog } from '../../../core/components/ui';

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
  { key: 'sonst', label: 'Sonstige' },
];

function sortByCreated(arr, dir = 'asc') {
  const k = (e) => (e.created_at ? new Date(e.created_at).getTime() : 0);
  return arr.slice().sort((a, b) => (dir === 'desc' ? k(b) - k(a) : k(a) - k(b)));
}

// ── Aufklappbare Kategorie-Sektion ───────────────────────────────────────────
// Einzelne Eintragszeile — wiederverwendbar für Collapse und Offen-Liste
function EntryRow({ e, onOpenModal, onTogglePaid, onEdit, onDelete, showOpen = false }) {
  const isIncome = e.category === 'fixeinnahmen' || e.category === 'sonstige_einnahmen';
  // Lokaler Animations-State: kurz "flash" nach Abhaken, unabhängig vom
  // globalen Reload. Verhindert Flackern/Kollabieren der Dropdowns.
  const [flashing, setFlashing] = useState(false);

  // Teilzahlungen: Bar/Gutschein/Sparschwein gelten sofort als bezahlt, offen
  // ist nur der Rest (core/lib/paymentParts.js).
  const fully = isFullyPaid(e);
  // Durchgestrichen/gedämpft wird nur bei Ausgaben — Einnahmen immer normal.
  const partly = !isIncome && isPartlyPaid(e);
  const shownAmount = showOpen ? openAmount(e) : e.amount;
  const paidMethods = entryParts(e).filter((p) => p.paid).map((p) => p.method).join(' · ');

  function handleCheck(ev) {
    ev.stopPropagation();
    setFlashing(true);
    setTimeout(() => setFlashing(false), 400);
    onTogglePaid(e);
  }

  return (
    <div
      className="fin-row"
      onClick={() => onOpenModal({ entry: e, defaultCategory: e.category })}
    >
      {!isIncome && (
        <div
          className={`fin-row-check ${fully ? 'checked' : ''} ${partly ? 'partial' : ''} ${flashing ? 'flash' : ''}`}
          onClick={handleCheck}
          role="checkbox"
          aria-checked={partly ? 'mixed' : fully}
        >
          {fully ? <Icon name="check" size={null} className="glyph" /> : partly ? '–' : ''}
        </div>
      )}
      <div className="fin-row-info">
        <div className={`fin-row-name ${fully && !isIncome ? 'paid' : ''}`}>
          {e.name}
          {/* Notiz: nur ein kleines Symbol hinter dem Namen; den Text gibt es in der Ansicht des Postens */}
          {e.note && (
            <span className="fin-row-noteicon" role="img" aria-label="Notiz vorhanden">
              <Icon name="note" size={14} />
            </span>
          )}
        </div>
        <div className="fin-row-meta">
          {formatPayments(e)}
          {/* Sparplan-Rate: wann sie fällig ist, sonst wann der Posten erfasst wurde */}
          {e.savings_plan_id && e.due_date
            ? ` · fällig ${fmtDue(e.due_date)}`
            : (e.created_at ? ` · ${formatRelativeDate(e.created_at)}` : '')}
          {partly && !showOpen ? ' · teilweise bezahlt' : ''}
        </div>
        {showOpen && partly && (
          <div className="fin-row-meta fin-row-meta--part">
            {formatEur(paidAmount(e))} bezahlt ({paidMethods})
          </div>
        )}
      </div>
      <div className="fin-row-side">
        <div className={`fin-row-amount ${fully && !isIncome ? 'paid' : ''}`}>
          {formatEur(shownAmount).replace('€', '').trim()}
          {showOpen && partly && <span className="fin-row-of">von {formatEur(e.amount)}</span>}
        </div>
        {(onEdit || onDelete) && (
          <div className="fin-row-btns">
            {onEdit && (
              <button type="button" className="fin-row-btn" aria-label={`${e.name} bearbeiten`}
                onClick={(ev) => { ev.stopPropagation(); onEdit(e); }}><IconEdit /></button>
            )}
            {onDelete && (
              <button type="button" className="fin-row-btn fin-row-btn--del" aria-label={`${e.name} löschen`}
                onClick={(ev) => { ev.stopPropagation(); onDelete(e); }}><IconTrash size={16} /></button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// 'YYYY-MM-DD' -> 'TT.MM.JJJJ' ohne Date-Parsing (keine Zeitzonen-Verschiebung)
function fmtDue(str) {
  const [y, m, d] = String(str).slice(0, 10).split('-');
  return `${d}.${m}.${y}`;
}

// Flache Offen-Liste — keine Dropdowns, direkte Auflistung aller offenen
// Ausgaben-Einträge mit Gesamtbetrag oben und Abhak-Funktion.
function OffenList({ entries, onOpenModal, onTogglePaid, onEdit, onDelete }) {
  // Offen ist nur, was noch nicht bezahlt ist: bei geteilter Zahlung der Rest
  // ohne die Bar-/Gutschein-/Sparschwein-Anteile.
  const offene = entries.filter(isOpenExpense);
  const gesamtOffen = offene.reduce((s, e) => s + openAmount(e), 0);
  const sorted = sortByCreated(offene, 'asc');

  if (offene.length === 0) {
    return (
      <div className="fin-offen-empty">
        <span className="t-body fin-u-pos">✓ Alles bezahlt</span>
      </div>
    );
  }

  return (
    <div className="fin-offen-list">
      {/* Gesamtbetrag */}
      <div className="fin-offen-header">
        <span className="t-meta fin-u-mut">
          {offenePostenText(offene.length)}
        </span>
        <span className="t-body fin-u-crit">
          {formatEur(gesamtOffen)}
        </span>
      </div>
      {/* Einträge direkt, keine Dropdowns */}
      {sorted.map((e) => (
        <EntryRow
          key={e.id}
          e={e}
          onOpenModal={onOpenModal}
          onTogglePaid={onTogglePaid}
          onEdit={onEdit}
          onDelete={onDelete}
          showOpen
        />
      ))}
    </div>
  );
}

// Aufklappbare Kategorie-Sektion (für alle anderen Filter)
// defaultOpen: in "Fix" und "Ein" steht der einzelne Bereich gleich aufgeklappt, in "Alle" eingeklappt
function CollapseSection({ col, entries, onOpenModal, onTogglePaid, onEdit, onDelete, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen);

  // Sparschwein-Einlagen ("Ersparnisse") aus normalen Ausgaben-Sektionen
  // herausfiltern — sie sind Sparschwein-Transfers, keine Ausgaben.
  const visible = entries.filter(
    (e) => col.cats.includes(e.category)
      && !isSparschweinDeposit(e)          // Einzahlung raus (Ausgaben-Spalten)
      && !isSparschweinDirectWithdrawal(e) // Entnahme raus (Einnahmen-Spalte)
  );
  // Leere Bereiche bleiben sichtbar (0 Posten · 0,00 €), damit jeder Monat gleich aussieht

  const total  = visible.reduce((s, e) => s + Number(e.amount || 0), 0);
  const sorted = col.cats.length > 1
    ? sortByCreated(visible, 'asc')
    : sortByCreated(visible, (col.key === 'sonstige' || col.key === 'variable') ? 'desc' : 'asc');

  return (
    <div className="fin-collapse">
      <button
        className={`fin-collapse-header ${open ? 'open' : ''}`}
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
      >
        <span className="fin-collapse-label t-body">{col.label}</span>
        <div className="fin-collapse-meta">
          <span className="fin-collapse-count t-meta">{visible.length} Posten</span>
          <span className="fin-collapse-total t-body">{formatEur(total)}</span>
          <span className={`fin-collapse-chevron ${open ? 'open' : ''}`}><Icon name="open" size={null} className="glyph" /></span>
        </div>
      </button>

      {open && (
        <div className="fin-collapse-body">
          {sorted.length === 0 && <div className="fin-collapse-empty">Keine Posten in diesem Monat</div>}
          {sorted.map((e) => (
            <EntryRow
              key={e.id}
              e={e}
              onOpenModal={onOpenModal}
              onTogglePaid={onTogglePaid}
              onEdit={onEdit}
              onDelete={onDelete}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Hauptkomponente ──────────────────────────────────────────────────────────
// showStand: Fokuskarte "Verfügbar jetzt" oben zeigen (Offene Posten ja, Buchungen nein)
export default function MonthsView({ initialFilter = 'alle', showStand = true }) {
  const { session }  = useAuth();
  const { showToast } = useUi();
  const { version, notifySaved } = useEntrySheet();
  const { setActiveMonth: setGlobalActiveMonth } = useFinanceMonth();

  const now = new Date();
  const [year,  setYear]  = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [entries, setEntries] = useState([]);
  const [allEntries, setAllEntries] = useState([]); // alle Monate, für "Verfügbar jetzt"
  const [startIdx, setStartIdx] = useState(-Infinity);
  const [loading, setLoading] = useState(true);
  // Tipp auf einen Posten öffnet die Ansicht (EntryDetailSheet); "Bearbeiten"
  // schaltet darin auf die Bearbeiten-Ansicht um.
  const [detailId, setDetailId] = useState(null);
  const [detailEdit, setDetailEdit] = useState(false); // Ansicht gleich im Bearbeiten-Modus öffnen (Stift in der Zeile)
  const [filter,  setFilter]  = useState(initialFilter);

  // useRef-Muster: session-Objekt stabilisieren, damit load() sich nicht
  // bei jedem Render neu erstellt (session-Ref ändert sich nicht pro Tick)
  const sessionRef = useRef(session);
  useEffect(() => { sessionRef.current = session; }, [session]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const s = sessionRef.current;
      // Posten und Vorlagen in einer Runde laden, fehlende Vorlagen daraus
      // berechnen; nur wenn etwas angelegt wurde, die Posten neu laden.
      const [es0, ts, all, st] = await Promise.all([
        db.getEntriesByMonth(s, year, month),
        db.getFixTemplates(s),
        showStand ? db.getAllEntries(s) : Promise.resolve([]),
        showStand ? db.getFinStartIdx(s, localTodayStr()) : Promise.resolve(-Infinity),
      ]);
      setAllEntries(all);
      setStartIdx(st);
      const added = await db.applyMissingFixTemplatesWith(s, year, month, ts, es0);
      setEntries(added > 0 ? await db.getEntriesByMonth(s, year, month) : es0);
    } catch (e) {
      showToast('Laden fehlgeschlagen');
      console.error(e);
    }
    setLoading(false);
  }, [year, month, showToast, showStand]);

  useEffect(() => { load(); }, [load, version]);

  function shiftMonth(delta) {
    let m = month + delta, y = year;
    if (m < 1) { m = 12; y--; } else if (m > 12) { m = 1; y++; }
    setMonth(m); setYear(y);
    setGlobalActiveMonth(y, m); // EntrySheet weiß, in welchem Monat wir sind
  }

  // Beim ersten Mount den initialen Monat in den Context schreiben
  useEffect(() => {
    setGlobalActiveMonth(year, month);
    // Reset beim Verlassen: zurück auf aktuellen Kalendermonat
    return () => {
      const n = new Date();
      setGlobalActiveMonth(n.getFullYear(), n.getMonth() + 1);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Posten aus einer Vorlage (laufender Vertrag), den der Nutzer von Hand ändert
  // (Name, Betrag, Zahlung, Ausgabenart, Fälligkeit): gilt nur für diesen Monat. Er wird
  // gesperrt, damit eine spätere Änderung der Vorlage ihn nicht überschreibt.
  function changedByHand(old, next) {
    const parts = (e) => JSON.stringify((e.payments || []).map((p) => [p.method, Number(p.amount)]));
    return old.name !== next.name
      || Number(old.amount) !== Number(next.amount)
      || old.category !== next.category
      || (old.due_date || '').slice(0, 10) !== (next.due_date || '').slice(0, 10)
      || parts(old) !== parts(next);
  }

  async function handleSave(entry) {
    const old = entries.find((e) => e.id === entry.id);
    const lock = old?.from_template && !old.template_locked && changedByHand(old, entry);
    const rateChanged = Boolean(entry.savings_plan_id && old && Math.abs(Number(old.amount) - Number(entry.amount)) > 0.004);
    if (rateChanged) {
      // Mehr als bis zum Ziel fehlt lässt sich nicht ausgleichen: dann gar nicht erst speichern.
      const max = await db.savingsPlanRateMax(session, entry.savings_plan_id, entry.id);
      if (Number(entry.amount) > max + 0.004) {
        throw Object.assign(new Error('Rate über dem Sparziel'), { userMessage: `Höchstens ${formatEur(max)} bis zum Ziel` });
      }
    }
    const saved = await db.saveEntry(session, { ...entry, year, month, ...(lock ? { template_locked: true } : {}) });
    // Sparplan-Rate mit neuem Betrag: Schlussraten anpassen, damit das Ziel wieder stimmt
    // (gleiche Wirkung wie "Rate ändern" im Plan)
    let rebalanceFailed = false;
    if (rateChanged) {
      try { await db.rebalanceSavingsPlan(session, entry.savings_plan_id, entry.id); } catch (e) { rebalanceFailed = true; console.error('[Sparplan] Anpassen fehlgeschlagen', e); }
    }
    // Sofort sichtbar machen (Ansicht bleibt offen); der Reload holt den Rest nach
    setEntries((prev) => prev.map((e) => (e.id === saved.id ? saved : e)));
    showToast(rebalanceFailed ? 'Rate gespeichert, Sparplan nicht angepasst' : 'Eintrag aktualisiert');
    load();
    notifySaved();
  }

  async function handleDelete(id) {
    if (!(await confirmDialog({ title: 'Eintrag löschen?' }))) return;
    await db.deleteEntry(id);
    setDetailId(null);
    showToast('Eintrag gelöscht');
    load();
    notifySaved();
  }

  function openEntry({ entry }) { setDetailEdit(false); setDetailId(entry.id); }
  function editEntry(entry) { setDetailEdit(true); setDetailId(entry.id); }

  function handleTogglePaid(entry) {
    // Optimistischer Update: entries sofort lokal umschalten.
    // KEIN notifySaved() — das würde version erhöhen → useEffect →
    // load() → kompletter State-Reset → Dropdowns klappen zu.
    // paid/unpaid ist eine rein lokale Änderung, andere Views
    // (OverviewSection, SparschweinSection) müssen das nicht wissen.
    //
    // Ist noch etwas offen (auch nur ein Teil), markiert der Tipp ALLES als
    // bezahlt; ist schon alles bezahlt, setzt er die nicht-sofort-bezahlten
    // Teilzahlungen wieder auf offen. Bar/Gutschein/Sparschwein bleiben bezahlt.
    const target = !isFullyPaid(entry);
    const next = setPartsPaid(entry, target);
    const updated = { ...entry, paid: next.paid, ...(next.payments ? { payments: next.payments } : {}) };
    if (!target && isFullyPaid(updated)) {
      showToast('Bar-, Gutschein- und Sparschwein-Zahlungen gelten sofort als bezahlt');
      return;
    }
    setEntries((prev) => prev.map((e) => (e.id === entry.id ? updated : e)));
    showToast(target ? '✓ Als bezahlt markiert' : 'Als offen markiert');
    // DB-Schreiben im Hintergrund — bei Fehler State zurückrollen
    db.togglePaid(entry.id, next.paid, next.payments).catch(() => {
      setEntries((prev) => prev.map((e) => (e.id === entry.id ? entry : e)));
      showToast('Fehler beim Speichern');
    });
  }

  // Eine einzelne Teilzahlung abhaken / wieder öffnen (Ansicht des Postens).
  // Sofort bezahlte Arten (Bar, Gutschein, Sparschwein) lassen sich nicht öffnen.
  function handleTogglePart(entry, idx) {
    const parts = entryParts(entry);
    if (!parts[idx] || isInstantMethod(parts[idx].method)) return;
    const payments = parts.map((p, i) => ({ method: p.method, amount: p.amount, paid: i === idx ? !p.paid : p.paid }));
    const paid = payments.every((p) => p.paid);
    const updated = { ...entry, paid, payments };
    setEntries((prev) => prev.map((e) => (e.id === entry.id ? updated : e)));
    db.togglePaid(entry.id, paid, payments).catch(() => {
      setEntries((prev) => prev.map((e) => (e.id === entry.id ? entry : e)));
      showToast('Fehler beim Speichern');
    });
  }

  const detailEntry = detailId ? entries.find((e) => e.id === detailId) : null;

  // "Verfügbar jetzt": laufender Stand über alle Monate (nicht der angezeigte Monat). Die Posten des
  // angezeigten Monats kommen aus dem lokalen Stand, damit Abhaken sofort wirkt.
  const stand = useMemo(
    () => standSummary(available(
      [...allEntries.filter((e) => !(e.year === year && e.month === month)), ...entries],
      localTodayStr(),
      startIdx,
    )),
    [allEntries, entries, year, month, startIdx],
  );

  // Sichtbare Spalten je nach aktivem Filter
  function visibleColumns() {
    if (filter === 'fix') return COLUMNS.filter((c) => c.key === 'fixkosten');
    // "Sonstige" = alle Ausgaben außer Fixkosten (Variable Kosten und Sonstige Ausgaben); Einnahmen stehen in "Alle" und über die Fokuskarte
    if (filter === 'sonst') return COLUMNS.filter((c) => c.key === 'variable' || c.key === 'sonstige');
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

      {/* Fokuskarte: Verfügbar jetzt, dieselbe wie in Übersicht und Hub (nicht in Buchungen) */}
      {showStand && <AvailableCard stand={stand} loading={loading} flow />}

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

      {/* Inhaltsbereich: Offen-Filter → flache Liste, sonst Dropdowns */}
      {loading ? (
        <SkeletonList rows={4} />
      ) : filter === 'offen' ? (
        <OffenList
          entries={entries}
          onOpenModal={openEntry}
          onTogglePaid={handleTogglePaid}
          onEdit={editEntry}
          onDelete={(e) => handleDelete(e.id)}
        />
      ) : (
        <div className="fin-collapse-list">
          {visibleColumns().map((col) => (
            <CollapseSection
              key={`${filter}-${col.key}`} // neu starten, wenn der Filter wechselt (Anfangszustand aufgeklappt/eingeklappt)
              defaultOpen={filter !== 'alle'}
              col={col}
              entries={entries}
              onOpenModal={openEntry}
              onTogglePaid={handleTogglePaid}
              onEdit={editEntry}
              onDelete={(e) => handleDelete(e.id)}
            />
          ))}
        </div>
      )}

      {detailEntry && (
        <EntryDetailSheet
          key={`${detailEntry.id}-${detailEdit}`}
          entry={detailEntry}
          startInEdit={detailEdit}
          onClose={() => setDetailId(null)}
          onSave={handleSave}
          showToast={showToast}
          onDelete={handleDelete}
          onTogglePaid={handleTogglePaid}
          onTogglePart={handleTogglePart}
        />
      )}
    </>
  );
}
