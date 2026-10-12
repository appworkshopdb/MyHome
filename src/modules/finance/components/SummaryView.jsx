// modules/finance/components/SummaryView.jsx
//
// Auswertung als anpassbares Dashboard: Zeitraum + Filter oben, darunter
// zehn Bereiche (report/sections.jsx), die der Nutzer einklappen, ausblenden
// und per Drag & Drop (oder ↑ ↓) umsortieren kann. Die Ansicht liegt pro
// Nutzer in Supabase (lib/reportPrefs.js), damit sie auf jedem Gerät gleich ist.
//
// Zahlen/Logik: lib/analytics.js (rein, getestet). Dieses File hält nur State
// und Layout. Die Diagramme sind HTML/SVG (report/charts.jsx), kein Chart.js.

import { Component, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  DndContext, closestCenter, PointerSensor, TouchSensor, useSensor, useSensors,
} from '@dnd-kit/core';
import {
  SortableContext, verticalListSortingStrategy, useSortable, arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useAuth } from '../../../core/lib/AuthContext';
import { useUi } from '../../../core/lib/UiContext';
import { useEntrySheet } from '../../../core/lib/EntrySheetContext';
import { getAllEntries, getFixTemplates, getContracts } from '../lib/finData';
import { MONTHS_DE } from '../lib/finance';
import {
  defaultPeriod, periodRange, effectiveRange, compareRange, shiftPeriod, switchPreset,
  periodLabel, rangeText, nowIdx, idxToYM, monthIdx, MONTHS_SHORT, inRange, applyFilters, HONOR,
  activeFilterGroups, entriesToCsv, toDateStr,
} from '../lib/analytics';
import {
  defaultPrefs, sanitizePrefs, loadReportPrefs, saveReportPrefs, DEFAULT_COLLAPSED, SECTION_IDS,
} from '../lib/reportPrefs';
import { SECTIONS } from './report/sections.jsx';
import FilterSheet from './report/FilterSheet.jsx';
import {
  IconChevronDown, IconUp, IconDown, IconFilter, IconRows, IconEye, IconEyeOff, IconDownload, IconGrip,
} from './report/ui.jsx';
import '../report.css';

const PRESET_OPTIONS = [
  { key: 'month', label: 'Monat' }, { key: 'quarter', label: 'Quartal' },
  { key: 'year', label: 'Jahr' }, { key: 'custom', label: 'Eigener' },
];

// Ein abgestürzter Bereich darf nicht die ganze Auswertung mitreißen.
class SectionBoundary extends Component {
  constructor(props) { super(props); this.state = { failed: false }; }
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(err) { console.error('Auswertungs-Bereich fehlgeschlagen:', err); }
  render() {
    if (this.state.failed) return <div className="rp-empty">Dieser Bereich konnte nicht berechnet werden.</div>;
    return this.props.children;
  }
}

function SectionCard({ id, collapsed, onToggle, ctx }) {
  const def = SECTIONS[id];
  const Body = def.Component;
  return (
    <section className="rp-sec">
      <h2 className="rp-sec-h">
        <button type="button" onClick={onToggle} aria-expanded={!collapsed}>
          <span className="rp-sec-title">{def.title}</span>
          <span className={`rp-badge ${def.warn ? 'is-warn' : ''}`}>{def.scope}</span>
          <span className={`rp-chev ${collapsed ? 'is-closed' : ''}`}><IconChevronDown /></span>
        </button>
      </h2>
      {!collapsed && (
        <div className="rp-sec-b">
          {def.hint && <p className="rp-hint">{def.hint}</p>}
          <SectionBoundary><Body ctx={ctx} /></SectionBoundary>
        </div>
      )}
    </section>
  );
}

function SortableRow({ id, first, last, hidden, onMove, onToggleHidden }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style = {
    transform: CSS.Transform.toString(transform), transition,
    opacity: isDragging ? 0.6 : undefined, zIndex: isDragging ? 5 : undefined,
  };
  const title = SECTIONS[id].title;
  return (
    <div ref={setNodeRef} style={style} className={`rp-sec rp-edit-row ${hidden ? 'is-hidden' : ''} ${isDragging ? 'is-dragging' : ''}`}>
      <span className="rp-grip" {...attributes} {...listeners} aria-label={`${title} zum Sortieren ziehen`}><IconGrip /></span>
      <span className="rp-edit-title">{title}</span>
      <button type="button" className="rp-ctl" aria-label={`${title} nach oben`} disabled={first} onClick={() => onMove(-1)}><IconUp /></button>
      <button type="button" className="rp-ctl" aria-label={`${title} nach unten`} disabled={last} onClick={() => onMove(1)}><IconDown /></button>
      <button type="button" className="rp-ctl rp-ctl--eye" aria-label={hidden ? `${title} einblenden` : `${title} ausblenden`} aria-pressed={hidden} onClick={onToggleHidden}>
        {hidden ? <IconEyeOff /> : <IconEye />}
      </button>
    </div>
  );
}

export default function SummaryView() {
  const { session } = useAuth();
  const { showToast } = useUi();
  const { version } = useEntrySheet();
  const uid = session?.user?.id;

  const now = useMemo(() => new Date(), []);
  const [data, setData] = useState(null);          // { entries, templates, contracts }
  const [loadError, setLoadError] = useState(false);
  const [prefs, setPrefs] = useState(null);
  const [period, setPeriod] = useState(() => defaultPeriod(now));
  const [editing, setEditing] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);

  // ── Ansicht laden/speichern ───────────────────────────────────────────
  const prefsRef = useRef(null);
  const sessionRef = useRef(session);
  const saveTimer = useRef(null);
  const warned = useRef(false);
  useEffect(() => { sessionRef.current = session; }, [session]);

  const flushSave = useCallback(() => {
    if (!saveTimer.current) return;
    clearTimeout(saveTimer.current);
    saveTimer.current = null;
    saveReportPrefs(sessionRef.current, prefsRef.current).catch((e) => {
      console.warn('Ansicht nicht gespeichert:', e?.message || e);
      if (!warned.current) { warned.current = true; showToast('Ansicht nur auf diesem Gerät gespeichert'); }
    });
  }, [showToast]);

  const updatePrefs = useCallback((fn) => {
    const next = sanitizePrefs(fn(prefsRef.current || defaultPrefs()));
    prefsRef.current = next;
    setPrefs(next);
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(flushSave, 700);
  }, [flushSave]);

  useEffect(() => () => flushSave(), [flushSave]); // beim Verlassen noch ausstehendes Speichern erledigen

  useEffect(() => {
    if (!uid) return undefined;
    let alive = true;
    loadReportPrefs(sessionRef.current).then(({ prefs: p, synced }) => {
      if (!alive) return;
      prefsRef.current = p;
      setPrefs(p);
      setPeriod(defaultPeriod(now, p.preset));
      if (!synced) console.info('Auswertungs-Ansicht: Server-Tabelle fehlt, speichere lokal.');
    });
    return () => { alive = false; };
  }, [uid, now]);

  // ── Daten laden ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!uid) return undefined;
    let alive = true;
    (async () => {
      try {
        const s = sessionRef.current;
        const [entries, templates, contracts] = await Promise.all([getAllEntries(s), getFixTemplates(s), getContracts(s)]);
        if (alive) { setData({ entries, templates, contracts }); setLoadError(false); }
      } catch (e) {
        console.error(e);
        if (alive) setLoadError(true);
      }
    })();
    return () => { alive = false; };
  }, [uid, version]);

  // ── Abgeleitete Werte ─────────────────────────────────────────────────
  const filters = prefs?.filters;
  const range = useMemo(() => periodRange(period), [period]);
  const eff = useMemo(() => effectiveRange(range, now), [range, now]);
  const cmp = useMemo(() => (filters ? compareRange(period, filters.compare, now) : null), [period, filters, now]);

  const ctx = useMemo(() => {
    if (!prefs || !data) return null;
    return {
      now, period, range, eff, cmp,
      filters: prefs.filters, mode: prefs.filters.savingsMode,
      local: prefs.local,
      setLocal: (patch) => updatePrefs((p) => ({ ...p, local: { ...p.local, ...patch } })),
      allEntries: data.entries, templates: data.templates, contracts: data.contracts,
      effText: rangeText(eff), effEndYear: idxToYM(eff.to).year,
    };
  }, [prefs, data, now, period, range, eff, cmp, updatePrefs]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } }),
  );

  if (loadError) {
    return <div className="rp-empty">Die Auswertung konnte nicht geladen werden. Bitte später erneut versuchen.</div>;
  }
  if (!prefs || !data || !ctx) return <div className="loading-note">Lädt…</div>;

  // ── Handler ───────────────────────────────────────────────────────────
  const setFilters = (next) => updatePrefs((p) => ({ ...p, filters: next }));
  const groups = activeFilterGroups(prefs.filters);
  const nowI = nowIdx(now);
  const includesNow = range.from <= nowI && range.to >= nowI;
  const years = (() => {
    const ys = data.entries.map((e) => e.year);
    const min = Math.min(now.getFullYear() - 2, ...ys);
    return Array.from({ length: now.getFullYear() + 1 - min + 1 }, (_, i) => min + i);
  })();

  function pickPreset(key) {
    setPeriod((p) => switchPreset(p, key, now));
    updatePrefs((p) => ({ ...p, preset: key }));
  }
  function setCustom(which, part, value) {
    setPeriod((p) => {
      const cur = idxToYM(which === 'from' ? p.from : p.to);
      const next = monthIdx(part === 'year' ? value : cur.year, part === 'month' ? value : cur.month);
      return { ...p, [which]: next };
    });
  }
  const toggleIn = (list, id) => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);
  function handleDragEnd({ active, over }) {
    if (!over || active.id === over.id) return;
    updatePrefs((p) => {
      const from = p.order.indexOf(active.id); const to = p.order.indexOf(over.id);
      return from < 0 || to < 0 ? p : { ...p, order: arrayMove(p.order, from, to) };
    });
  }
  function move(id, dir) {
    updatePrefs((p) => {
      const i = p.order.indexOf(id); const j = i + dir;
      return j < 0 || j >= p.order.length ? p : { ...p, order: arrayMove(p.order, i, j) };
    });
  }
  function resetLayout() {
    updatePrefs((p) => ({ ...p, order: [...SECTION_IDS], hidden: [], collapsed: [...DEFAULT_COLLAPSED] }));
  }
  function exportCsv() {
    const rows = applyFilters(inRange(data.entries, eff), prefs.filters, HONOR.all);
    const blob = new Blob([entriesToCsv(rows)], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `finanzen-auswertung-${toDateStr(now)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    showToast(`${rows.length} Buchungen exportiert`);
  }

  const visible = prefs.order.filter((id) => !prefs.hidden.includes(id));
  const customRange = periodRange(period);

  // ── Anpassen-Modus ────────────────────────────────────────────────────
  if (editing) {
    return (
      <div className="rp-root">
        <div className="rp-edbar">
          <b>Bereiche anpassen</b>
          <p>Am Griff ziehen oder mit ↑ ↓ verschieben. Das Auge blendet einen Bereich aus. Deine Auswahl wird gespeichert und gilt auf allen Geräten.</p>
          <div className="rp-edbar-row">
            <button type="button" className="rp-edbar-primary" onClick={() => setEditing(false)}>Fertig</button>
            <button type="button" className="rp-edbar-ghost" onClick={resetLayout}>Standard</button>
          </div>
        </div>
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={prefs.order} strategy={verticalListSortingStrategy}>
            {prefs.order.map((id, i) => (
              <SortableRow
                key={id} id={id} first={i === 0} last={i === prefs.order.length - 1}
                hidden={prefs.hidden.includes(id)}
                onMove={(dir) => move(id, dir)}
                onToggleHidden={() => updatePrefs((p) => ({ ...p, hidden: toggleIn(p.hidden, id) }))}
              />
            ))}
          </SortableContext>
        </DndContext>
      </div>
    );
  }

  // ── Normalansicht ─────────────────────────────────────────────────────
  return (
    <div className="rp-root">
      <div className="rp-seg" role="group" aria-label="Zeitraum">
        {PRESET_OPTIONS.map((o) => (
          <button key={o.key} type="button" className={period.preset === o.key ? 'is-on' : ''} aria-pressed={period.preset === o.key} onClick={() => pickPreset(o.key)}>
            {o.label}
          </button>
        ))}
      </div>

      <div className="rp-nav">
        <button type="button" className="month-nav-btn" aria-label="Zurück" onClick={() => setPeriod((p) => shiftPeriod(p, -1))}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 5l-7 7 7 7" /></svg>
        </button>
        <div className="rp-nav-mid">
          <b>{periodLabel(period)}</b>
          <small>{rangeText(eff)}{includesNow ? ' · Monat läuft' : ''}</small>
        </div>
        <button type="button" className="month-nav-btn" aria-label="Weiter" onClick={() => setPeriod((p) => shiftPeriod(p, 1))}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 5l7 7-7 7" /></svg>
        </button>
        <div className="rp-tools">
          <button type="button" className="rp-iconbtn" aria-label={`Filter${groups.length ? `, ${groups.length} aktiv` : ''}`} onClick={() => setFilterOpen(true)}>
            <IconFilter />
            {groups.length > 0 && <span className="rp-count">{groups.length}</span>}
          </button>
          <button type="button" className="rp-iconbtn" aria-label="Bereiche anpassen" onClick={() => setEditing(true)}><IconRows /></button>
        </div>
      </div>

      {period.preset === 'custom' && (
        <div className="rp-custom">
          {['from', 'to'].map((w) => {
            const cur = idxToYM(w === 'from' ? customRange.from : customRange.to);
            return (
              <div key={w} className="rp-custom-col">
                <span>{w === 'from' ? 'Von' : 'Bis'}</span>
                <div>
                  <select className="wiz-input" aria-label={`${w === 'from' ? 'Von' : 'Bis'} Monat`} value={cur.month} onChange={(e) => setCustom(w, 'month', Number(e.target.value))}>
                    {MONTHS_DE.map((m, i) => <option key={m} value={i + 1}>{MONTHS_SHORT[i]}</option>)}
                  </select>
                  <select className="wiz-input" aria-label={`${w === 'from' ? 'Von' : 'Bis'} Jahr`} value={cur.year} onChange={(e) => setCustom(w, 'year', Number(e.target.value))}>
                    {years.map((y) => <option key={y} value={y}>{y}</option>)}
                  </select>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <p className="rp-fnote">Die Filter wirken auf die meisten Bereiche. Wo ein Bereich abweicht, steht es in seiner Kopfzeile.</p>

      {visible.map((id) => (
        <SectionCard
          key={id} id={id} ctx={ctx}
          collapsed={prefs.collapsed.includes(id)}
          onToggle={() => updatePrefs((p) => ({ ...p, collapsed: toggleIn(p.collapsed, id) }))}
        />
      ))}

      {prefs.hidden.length > 0 && (
        <div className="rp-hidden-hint">
          <span>{prefs.hidden.length} {prefs.hidden.length === 1 ? 'Bereich' : 'Bereiche'} ausgeblendet</span>
          <button type="button" onClick={() => setEditing(true)}>Anpassen</button>
        </div>
      )}

      <button type="button" className="rp-export" onClick={exportCsv}>
        <IconDownload /> Gefilterte Buchungen exportieren (CSV)
      </button>

      {filterOpen && (
        <FilterSheet
          filters={prefs.filters}
          onClose={() => setFilterOpen(false)}
          onApply={(f) => { setFilters(f); setFilterOpen(false); }}
        />
      )}
    </div>
  );
}
