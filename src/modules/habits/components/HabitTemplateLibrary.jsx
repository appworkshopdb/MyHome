// modules/habits/components/HabitTemplateLibrary.jsx
// Vorlagen-Auswahl: Startseite mit "Für den Einstieg" + Kategorien, dann je
// Kategorie (oder Suche) eine Liste mit Filter-Sheet (Tageszeit, Häufigkeit, Art).
// Antippen einer Vorlage gibt sie an onPick weiter (öffnet das Formular).

import { useState, useMemo } from 'react';
import SheetShell from '../../../core/components/SheetShell.jsx';
import { HABIT_LIBRARY, HABIT_CATEGORIES, TIME_SLOTS } from '../lib/habUtils.js';

const DAY_SHORT = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];

const FREQ_FILTERS = [
  { value: 'daily',    label: 'Täglich' },
  { value: 'weekdays', label: 'Mo–Fr' },
  { value: 'custom',   label: 'Bestimmte Tage' },
];
const KIND_FILTERS = [
  { value: 'yn',    label: 'Ja / Nein' },
  { value: 'count', label: 'Mit Zähler' },
];

// Einfache Vorschläge für Neulinge
const STARTER_NAMES = ['Spazieren gehen', 'Meditieren', 'Lesen'];

function norm(s) {
  return s.toLowerCase().replace(/ä/g, 'a').replace(/ö/g, 'o').replace(/ü/g, 'u').replace(/ß/g, 'ss');
}

function freqLabel(t) {
  if (t.frequency === 'daily')    return 'Täglich';
  if (t.frequency === 'weekdays') return 'Mo–Fr';
  if (t.frequency === 'custom' && Array.isArray(t.frequency_days)) {
    return t.frequency_days.map((d) => DAY_SHORT[d]).join(', ');
  }
  return 'Täglich';
}

function metaLine(t) {
  const slot = TIME_SLOTS.find((s) => s.value === (t.time_slot ?? 'anytime'))?.label;
  const count = t.unit ? `${t.target_count} ${t.unit}` : null;
  return [freqLabel(t), slot, count].filter(Boolean).join(' · ');
}

function matchesQuery(t, q) {
  return !q || norm(`${t.name} ${t.category}`).includes(norm(q));
}

function toggleIn(list, v) {
  return list.includes(v) ? list.filter((x) => x !== v) : [...list, v];
}

export default function HabitTemplateLibrary({ habits, onBack, onPick }) {
  const [cat, setCat]     = useState(null);   // null = Startseite
  const [q, setQ]         = useState('');
  const [slots, setSlots] = useState([]);
  const [freqs, setFreqs] = useState([]);
  const [kinds, setKinds] = useState([]);
  const [sheet, setSheet] = useState(false);

  const activeNames = useMemo(
    () => new Set(habits.filter((h) => !h.deleted_at).map((h) => h.name.trim().toLowerCase())),
    [habits]
  );
  const isActive = (t) => activeNames.has(t.name.trim().toLowerCase());

  const filterCount = slots.length + freqs.length + kinds.length;
  const searching = q.trim() !== '';
  const inList = cat !== null || searching;

  function passes(t) {
    return (cat === null || t.category === cat)
      && matchesQuery(t, q)
      && (!slots.length || slots.includes(t.time_slot ?? 'anytime'))
      && (!freqs.length || freqs.includes(t.frequency))
      && (!kinds.length || kinds.includes(t.unit ? 'count' : 'yn'));
  }

  const items = inList ? HABIT_LIBRARY.filter(passes) : [];

  const categories = useMemo(() => {
    const names = HABIT_CATEGORIES.filter((c) => HABIT_LIBRARY.some((t) => t.category === c));
    return names.map((c) => {
      const list = HABIT_LIBRARY.filter((t) => t.category === c);
      return { name: c, icon: list[0].icon, total: list.length, active: list.filter(isActive).length };
    });
  }, [activeNames]); // eslint-disable-line react-hooks/exhaustive-deps

  function resetFilters() { setSlots([]); setFreqs([]); setKinds([]); }
  function toStart() { setCat(null); setQ(''); resetFilters(); }

  return (
    <div className="hab-tl">
      <div className="hab-tl-top">
        <button
          type="button"
          className="hab-tl-back"
          onClick={inList ? toStart : onBack}
          aria-label={inList ? 'Zurück zu den Kategorien' : 'Zurück zur Liste'}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M19 12H5M11 6l-6 6 6 6" />
          </svg>
        </button>
        <div>
          <h2>{inList ? (cat ?? 'Suchergebnisse') : 'Vorlagen'}</h2>
          <small>{inList ? `${items.length} Vorlagen` : 'Startpunkt wählen, alles ist anpassbar'}</small>
        </div>
      </div>

      <div className="hab-tl-searchrow">
        <label className="hab-tl-search">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
            <circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" />
          </svg>
          <input
            type="search"
            placeholder={inList ? 'Suchen' : 'Alle Vorlagen durchsuchen'}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            aria-label="Vorlagen durchsuchen"
          />
        </label>
        {inList && (
          <button type="button" className="hab-tl-fbtn" onClick={() => setSheet(true)}>
            Filter{filterCount > 0 && <b>{filterCount}</b>}
          </button>
        )}
      </div>

      {!inList && (
        <>
          <div className="hab-tl-lab">Für den Einstieg <span>max. 3–5 Gewohnheiten</span></div>
          <div className="hab-tl-starters">
            {STARTER_NAMES.map((n) => HABIT_LIBRARY.find((t) => t.name === n)).filter(Boolean).map((t) => (
              <button key={t.name} type="button" className="hab-tl-st" onClick={() => onPick(t)}>
                <span className="ic">{t.icon}</span>
                <b>{t.name}</b>
                <small>{metaLine(t)}</small>
                <span className="go">{isActive(t) ? 'Schon aktiv' : '+ Hinzufügen'}</span>
              </button>
            ))}
          </div>

          <div className="hab-tl-lab">Kategorien <span>{HABIT_LIBRARY.length} Vorlagen</span></div>
          <div className="hab-tl-cats">
            {categories.map((c) => (
              <button key={c.name} type="button" className="hab-tl-cat" onClick={() => setCat(c.name)}>
                <span className="ic">{c.icon}</span>
                <b>{c.name}</b>
                <small>{c.total} Vorlagen{c.active > 0 ? ` · ${c.active} aktiv` : ''}</small>
              </button>
            ))}
          </div>
        </>
      )}

      {inList && (
        items.length > 0 ? (
          <div className="hab-tl-list">
            {items.map((t) => {
              const active = isActive(t);
              return (
                <button
                  key={t.name}
                  type="button"
                  className={`hab-tl-row${active ? ' is-active' : ''}`}
                  onClick={() => onPick(t)}
                >
                  <span className="ic">{t.icon}</span>
                  <span className="txt"><b>{t.name}</b><small>{metaLine(t)}</small></span>
                  {active ? <span className="hab-tl-done">Aktiv</span> : <span className="hab-tl-add" aria-hidden="true">+</span>}
                </button>
              );
            })}
          </div>
        ) : (
          <div className="hab-tl-list hab-tl-empty">
            Keine Vorlage passt zu deinen Filtern.
            <button type="button" onClick={() => { setQ(''); resetFilters(); }}>Filter zurücksetzen</button>
          </div>
        )
      )}

      {sheet && (
        <SheetShell onClose={() => setSheet(false)} labelledBy="hab-tl-filter-title">
          <div className="hab-cp-sheet">
            <div className="hab-cp-sheet-head">
              <h2 id="hab-tl-filter-title">Filter</h2>
              <button type="button" className="hab-cp-link" onClick={resetFilters}>Zurücksetzen</button>
            </div>
            <FilterGroup title="Tageszeit" options={TIME_SLOTS.map((s) => ({ value: s.value, label: s.label }))} selected={slots} onToggle={(v) => setSlots(toggleIn(slots, v))} />
            <FilterGroup title="Häufigkeit" options={FREQ_FILTERS} selected={freqs} onToggle={(v) => setFreqs(toggleIn(freqs, v))} />
            <FilterGroup title="Art" options={KIND_FILTERS} selected={kinds} onToggle={(v) => setKinds(toggleIn(kinds, v))} />
            <button type="button" className="btn btn-primary" onClick={() => setSheet(false)}>
              {items.length} Vorlagen anzeigen
            </button>
          </div>
        </SheetShell>
      )}
    </div>
  );
}

function FilterGroup({ title, options, selected, onToggle }) {
  return (
    <div>
      <div className="hab-cp-group-label">{title}</div>
      <div className="hab-tl-chips">
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            className={`hab-tl-chip${selected.includes(o.value) ? ' on' : ''}`}
            aria-pressed={selected.includes(o.value)}
            onClick={() => onToggle(o.value)}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}
