import { useEffect, useMemo, useState } from 'react';
import { getCalendarEvents } from '../lib/calendarData';
import { getGoogleCalendars } from '../lib/googleCalendar';
import SheetShell from './SheetShell';

// Icon je Quelle — dieselbe Zuordnung wie in HubCalendar.jsx (bewusst
// dupliziert statt geteilt, analog zu anderen kleinen lokalen Konstanten
// im Projekt, z.B. DIET-Array in ProfilView.jsx).
const SOURCE_ICON = {
  sport:    '💪',
  shopping: '🛒',
  todo:     '✓',
  finance:  '€',
  google:   '📅',
};

// App-Kategorien (eigene Daten) — Label + Farbe. Google-Termine werden
// NICHT über diese Map gefärbt, sondern über die Farbe ihres Google-Kalenders.
const APP_CATEGORIES = {
  sport:    { label: 'Sport',    color: 'var(--action-primary)' },
  shopping: { label: 'Einkauf',  color: 'var(--status-positive)' },
  todo:     { label: 'Aufgaben', color: 'var(--text-muted)' },
  finance:  { label: 'Finanzen', color: 'var(--status-caution)' },
};
const GOOGLE_FALLBACK_COLOR = '#4285f4';
const FILTER_STORAGE_KEY = 'nestua.calendarFilter.v1';

const WEEKDAYS_SHORT = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];
const MONTH_NAMES = [
  'Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
  'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember',
];

// WICHTIG: NICHT d.toISOString() verwenden — das rechnet in UTC um.
// Bei einem lokalen Date-Objekt (z.B. Mitternacht Berlin-Zeit) verschiebt
// die UTC-Umrechnung bei UTC+2 auf den Vortag, wodurch Termine im
// falschen Tages-Bucket landen (Sonntag-Termin erscheint unter Montag).
// Deshalb Jahr/Monat/Tag direkt aus den lokalen Date-Komponenten bauen.
function toDateStr(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
function startOfWeek(date) {
  const d = new Date(date);
  const dow = (d.getDay() + 6) % 7; // 0 = Mo
  d.setDate(d.getDate() - dow);
  return d;
}
function addDays(date, n) {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}
function startOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}
// Monatsraster: Mo der ersten Woche bis So der letzten Woche, damit die
// Gitterzellen immer volle Wochen ergeben (kein abgeschnittener Rand).
function monthGridDays(date) {
  const first = startOfMonth(date);
  const gridStart = startOfWeek(first);
  return Array.from({ length: 42 }, (_, i) => addDays(gridStart, i));
}

function formatTimeRange(ev) {
  if (!ev.event_time) return 'Ganztägig';
  const start = ev.event_time.slice(0, 5);
  const end = ev.event_time_end ? ev.event_time_end.slice(0, 5) : null;
  return end && end !== start ? `${start}–${end} Uhr` : `${start} Uhr`;
}

// Filter-Schlüssel eines Termins: 'app:<modul>' oder 'google:<kalenderId>'.
function filterKey(ev) {
  return ev.source_module === 'google'
    ? `google:${ev.google_calendar_id ?? ''}`
    : `app:${ev.source_module}`;
}

function loadFilter() {
  try {
    const raw = JSON.parse(localStorage.getItem(FILTER_STORAGE_KEY));
    return {
      source: ['alle', 'app', 'google'].includes(raw?.source) ? raw.source : 'alle',
      hidden: Array.isArray(raw?.hidden) ? raw.hidden : [],
    };
  } catch {
    return { source: 'alle', hidden: [] };
  }
}

// Gemeinsame Darstellungsdaten (Farbe, Quelle, Label) für Zeile, Punkte, Chips.
function describeEvent(ev, calMap) {
  if (ev.source_module === 'google') {
    const cal = calMap[ev.google_calendar_id];
    return {
      isGoogle: true,
      color: cal?.color || GOOGLE_FALLBACK_COLOR,
      sourceLabel: 'Google',
      detail: cal?.summary ?? null,
    };
  }
  const cat = APP_CATEGORIES[ev.source_module];
  return {
    isGoogle: false,
    color: cat?.color ?? 'var(--text-muted)',
    sourceLabel: 'App',
    detail: cat?.label ?? ev.source_module,
  };
}

// Punkte pro Tag: gefüllt = App, Ring = Google (Farbe = Kalender/Kategorie).
function EventDots({ events, calMap }) {
  const seen = new Map();
  for (const ev of events) {
    const k = filterKey(ev);
    if (!seen.has(k)) seen.set(k, describeEvent(ev, calMap));
  }
  return [...seen.entries()].slice(0, 3).map(([k, d]) => (
    <span
      key={k}
      className={`calview-dot ${d.isGoogle ? 'calview-dot--google' : ''}`}
      style={{ '--dot-color': d.color }}
    />
  ));
}

// Eine einzelne Termin-Zeile in der Tagesansicht — zeigt alle
// übernommenen Google-Felder (Notiz, Ort, Erinnerung), wenn vorhanden.
function EventRow({ ev, calMap }) {
  const d = describeEvent(ev, calMap);
  return (
    <div
      className={`calview-event-row ${d.isGoogle ? 'is-google' : 'is-app'} ${ev.done ? 'done' : ''}`}
      style={{ '--ev-color': d.color }}
    >
      <span className="calview-event-icon">{SOURCE_ICON[ev.source_module] ?? '·'}</span>
      <div className="calview-event-content">
        <span className={`calview-source-badge ${d.isGoogle ? 'google' : 'app'}`}>
          {d.sourceLabel}{d.detail ? ` · ${d.detail}` : ''}
        </span>
        <span className="calview-event-title">
          {ev.title}
          {ev.status === 'tentative' && <span className="calview-event-tentative">Vorläufig</span>}
        </span>
        <span className="calview-event-time">{formatTimeRange(ev)}</span>
        {ev.location && (
          <span className="calview-event-meta">📍 {ev.location}</span>
        )}
        {ev.description && (
          <span className="calview-event-desc">{ev.description}</span>
        )}
        {ev.reminder_minutes != null && (
          <span className="calview-event-meta">🔔 {ev.reminder_minutes} Min. vorher</span>
        )}
      </div>
      {ev.done && <span className="calview-event-done">✓</span>}
    </div>
  );
}

export default function CalendarView() {
  const [mode, setMode] = useState('woche'); // 'tag' | 'woche' | 'monat'
  const [refDate, setRefDate] = useState(new Date());
  const [allEvents, setEvents] = useState({}); // Map<dateStr, event[]> — ungefiltert
  const [loading, setLoading] = useState(true);
  const [monthDaySheet, setMonthDaySheet] = useState(null); // Date | null — Tagesdetail als Sheet aus der Monatsansicht
  const [googleCals, setGoogleCals] = useState([]);
  const [filter, setFilter] = useState(loadFilter); // { source: 'alle'|'app'|'google', hidden: string[] }

  const calMap = useMemo(
    () => Object.fromEntries(googleCals.map((c) => [c.google_calendar_id, c])),
    [googleCals],
  );

  useEffect(() => {
    getGoogleCalendars().then(setGoogleCals).catch((e) => console.warn('[CalendarView] google_calendars', e));
  }, []);

  useEffect(() => {
    try { localStorage.setItem(FILTER_STORAGE_KEY, JSON.stringify(filter)); } catch { /* privater Modus */ }
  }, [filter]);

  // Gefilterte Sicht auf die geladenen Termine. Die Daten selbst bleiben
  // unverändert — Filter wirkt nur auf die Anzeige.
  const events = useMemo(() => {
    const hidden = new Set(filter.hidden);
    const out = {};
    for (const [date, list] of Object.entries(allEvents)) {
      const kept = list.filter((ev) => {
        const isGoogle = ev.source_module === 'google';
        if (filter.source === 'app' && isGoogle) return false;
        if (filter.source === 'google' && !isGoogle) return false;
        return !hidden.has(filterKey(ev));
      });
      if (kept.length) out[date] = kept;
    }
    return out;
  }, [allEvents, filter]);

  // Chips: alle App-Kategorien + alle Google-Kalender (aus google_calendars,
  // ergänzt um Kalender, die nur in den geladenen Terminen vorkommen).
  const chips = useMemo(() => {
    const list = Object.entries(APP_CATEGORIES).map(([m, c]) => ({
      key: `app:${m}`, label: c.label, color: c.color, isGoogle: false,
    }));
    const known = new Set(googleCals.map((c) => c.google_calendar_id));
    for (const c of googleCals) {
      list.push({ key: `google:${c.google_calendar_id}`, label: c.summary || 'Google', color: c.color || GOOGLE_FALLBACK_COLOR, isGoogle: true });
    }
    for (const evs of Object.values(allEvents)) {
      for (const ev of evs) {
        if (ev.source_module === 'google' && !known.has(ev.google_calendar_id)) {
          known.add(ev.google_calendar_id);
          list.push({ key: filterKey(ev), label: 'Google', color: GOOGLE_FALLBACK_COLOR, isGoogle: true });
        }
      }
    }
    return list.filter((c) => filter.source === 'alle' || (filter.source === 'google') === c.isGoogle);
  }, [googleCals, allEvents, filter.source]);

  function toggleHidden(key) {
    setFilter((f) => ({
      ...f,
      hidden: f.hidden.includes(key) ? f.hidden.filter((k) => k !== key) : [...f.hidden, key],
    }));
  }
  const filterActive = filter.source !== 'alle' || filter.hidden.length > 0;

  const todayStr = toDateStr(new Date());

  // Ladefenster abhängig vom Modus — jeweils leicht gepuffert, damit
  // Navigieren (‹ ›) meist schon geladene Daten trifft.
  const { from, to } = useMemo(() => {
    if (mode === 'tag') {
      return { from: toDateStr(addDays(refDate, -2)), to: toDateStr(addDays(refDate, 2)) };
    }
    if (mode === 'woche') {
      const start = startOfWeek(refDate);
      return { from: toDateStr(addDays(start, -3)), to: toDateStr(addDays(start, 9)) };
    }
    // monat
    const grid = monthGridDays(refDate);
    return { from: toDateStr(grid[0]), to: toDateStr(grid[grid.length - 1]) };
  }, [mode, refDate]);

  useEffect(() => {
    let aktiv = true;
    setLoading(true);
    getCalendarEvents(from, to)
      .then((map) => { if (aktiv) { setEvents(map); setLoading(false); } })
      .catch((e) => { console.error('[CalendarView]', e); if (aktiv) setLoading(false); });
    return () => { aktiv = false; };
  }, [from, to]);

  function goToday() { setRefDate(new Date()); }
  function navigate(dir) {
    if (mode === 'tag') setRefDate((d) => addDays(d, dir));
    else if (mode === 'woche') setRefDate((d) => addDays(d, dir * 7));
    else setRefDate((d) => new Date(d.getFullYear(), d.getMonth() + dir, 1));
  }

  return (
    <div className="calview">
      <div className="calview-mode-toggle">
        {[['tag', 'Tag'], ['woche', 'Woche'], ['monat', 'Monat']].map(([key, label]) => (
          <button key={key} className={mode === key ? 'active' : ''} onClick={() => setMode(key)}>
            {label}
          </button>
        ))}
      </div>

      <div className="calview-nav">
        <button className="calview-nav-arrow" onClick={() => navigate(-1)} aria-label="Zurück">‹</button>
        <button className="calview-nav-label" onClick={goToday}>
          {mode === 'tag' && refDate.toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' })}
          {mode === 'woche' && (() => {
            const s = startOfWeek(refDate), e = addDays(s, 6);
            return `${s.getDate()}.–${e.getDate()}. ${MONTH_NAMES[e.getMonth()]}`;
          })()}
          {mode === 'monat' && `${MONTH_NAMES[refDate.getMonth()]} ${refDate.getFullYear()}`}
        </button>
        <button className="calview-nav-arrow" onClick={() => navigate(1)} aria-label="Weiter">›</button>
      </div>

      <div className="calview-filter">
        <div className="calview-source-toggle" role="group" aria-label="Quelle">
          {[['alle', 'Alle'], ['app', 'Nur App'], ['google', 'Nur Google']].map(([key, label]) => (
            <button
              key={key}
              className={filter.source === key ? 'active' : ''}
              onClick={() => setFilter((f) => ({ ...f, source: key }))}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="calview-chips">
          {chips.map((c) => {
            const off = filter.hidden.includes(c.key);
            return (
              <button
                key={c.key}
                className={`calview-chip ${off ? 'off' : ''}`}
                style={{ '--chip-color': c.color }}
                onClick={() => toggleHidden(c.key)}
                aria-pressed={!off}
              >
                <span className={`calview-dot ${c.isGoogle ? 'calview-dot--google' : ''}`} style={{ '--dot-color': c.color }} />
                {c.label}
              </button>
            );
          })}
          {filterActive && (
            <button className="calview-chip-reset" onClick={() => setFilter({ source: 'alle', hidden: [] })}>
              Zurücksetzen
            </button>
          )}
        </div>
      </div>

      {mode === 'tag' && (
        <div className="calview-day-list">
          {loading && <div className="calview-loading">Lädt…</div>}
          {!loading && (events[toDateStr(refDate)] ?? []).length === 0 && (
            <div className="calview-empty">Nichts geplant.</div>
          )}
          {!loading && (events[toDateStr(refDate)] ?? []).map((ev) => <EventRow key={ev.id} ev={ev} calMap={calMap} />)}
        </div>
      )}

      {mode === 'woche' && (
        <>
          <div className="calview-week-strip">
            {Array.from({ length: 7 }, (_, i) => addDays(startOfWeek(refDate), i)).map((d, i) => {
              const str = toDateStr(d);
              const dayEvs = events[str] ?? [];
              return (
                <button
                  key={str}
                  className={`calview-week-day ${str === todayStr ? 'today' : ''}`}
                  onClick={() => { setRefDate(d); setMode('tag'); }}
                >
                  <span className="calview-week-wd">{WEEKDAYS_SHORT[i]}</span>
                  <span className="calview-week-dd">{d.getDate()}</span>
                  <div className="calview-week-dots">
                    <EventDots events={dayEvs} calMap={calMap} />
                  </div>
                </button>
              );
            })}
          </div>
          <div className="calview-day-list">
            {Array.from({ length: 7 }, (_, i) => addDays(startOfWeek(refDate), i)).map((d) => {
              const str = toDateStr(d);
              const dayEvs = events[str] ?? [];
              if (dayEvs.length === 0) return null;
              return (
                <div key={str} className="calview-week-group">
                  <div className="calview-week-group-label">
                    {d.toLocaleDateString('de-DE', { weekday: 'short', day: 'numeric', month: 'short' })}
                  </div>
                  {dayEvs.map((ev) => <EventRow key={ev.id} ev={ev} calMap={calMap} />)}
                </div>
              );
            })}
          </div>
        </>
      )}

      {mode === 'monat' && (
        <>
          <div className="calview-month-grid">
            {WEEKDAYS_SHORT.map((wd) => (
              <div key={wd} className="calview-month-wd">{wd}</div>
            ))}
            {monthGridDays(refDate).map((d) => {
              const str = toDateStr(d);
              const dayEvs = events[str] ?? [];
              const inMonth = d.getMonth() === refDate.getMonth();
              return (
                <button
                  key={str}
                  className={`calview-month-cell ${str === todayStr ? 'today' : ''} ${!inMonth ? 'outside' : ''}`}
                  onClick={() => setMonthDaySheet(d)}
                >
                  <span className="calview-month-dd">{d.getDate()}</span>
                  <div className="calview-month-dots">
                    <EventDots events={dayEvs} calMap={calMap} />
                  </div>
                </button>
              );
            })}
          </div>
        </>
      )}

      {monthDaySheet && (
        <SheetShell onClose={() => setMonthDaySheet(null)}>
          <div className="sheet-header">
            <span className="sheet-title">
              {monthDaySheet.toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' })}
            </span>
            <button className="sheet-cancel" onClick={() => setMonthDaySheet(null)}>Schließen</button>
          </div>
          <div className="calview-day-list" style={{ padding: '0 20px 20px' }}>
            {(events[toDateStr(monthDaySheet)] ?? []).length === 0 && (
              <div className="calview-empty">Nichts geplant.</div>
            )}
            {(events[toDateStr(monthDaySheet)] ?? []).map((ev) => <EventRow key={ev.id} ev={ev} calMap={calMap} />)}
          </div>
        </SheetShell>
      )}
    </div>
  );
}
