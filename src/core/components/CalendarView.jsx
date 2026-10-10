import { useEffect, useMemo, useRef, useState } from 'react';
import { getCalendarEvents } from '../lib/calendarData';
import {
  getGoogleCalendars, getGoogleCalendarStatus, syncGoogleCalendar,
  connectGoogleCalendar, disconnectGoogleCalendar,
} from '../lib/googleCalendar';
import {
  toDateStr, parseDateStr, addDays, startOfWeek, monthGridDays,
  WEEKDAYS_SHORT, MONTH_NAMES, APP_CATEGORIES, GOOGLE_FALLBACK_COLOR,
  filterKey, describeEvent, todoToEvent, sortDay,
} from '../lib/calendarUtils';
import SheetShell from './SheetShell';
import CalendarEventRow from './CalendarEventRow';
import CalendarEventSheet from './CalendarEventSheet';

const FILTER_STORAGE_KEY = 'nestua.calendarFilter.v1';
const AGENDA_STEP_DAYS = 30;
const AUTO_SYNC_AFTER_MIN = 10; // Auto-Sync beim Öffnen, wenn der letzte Sync älter ist

const MONTH_CHIPS_PER_CELL = 2;

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

// Pfeil-Icons (SVG, erben die Textfarbe) statt Textzeichen wie ‹ › oder ->.
function Arrow({ dir, size = 14 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {dir === 'left' ? <path d="M19 12H5M11 6l-6 6 6 6" /> : <path d="M5 12h14M13 6l6 6-6 6" />}
    </svg>
  );
}
function Chevron({ dir }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={dir === 'left' ? 'M15 6l-6 6 6 6' : 'M9 6l6 6-6 6'} />
    </svg>
  );
}

function ago(iso) {
  if (!iso) return 'noch nie';
  const min = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (min < 1) return 'gerade eben';
  if (min < 60) return `vor ${min} Min.`;
  const h = Math.round(min / 60);
  if (h < 24) return `vor ${h} Std.`;
  return `vor ${Math.round(h / 24)} Tagen`;
}

// Punkte pro Tag (Wochenstreifen): gefüllt = App, Ring = Google.
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

// Tagesgruppe (Agenda + Woche): links ein Datums-Block (Wochentag, Tageszahl,
// Monat), rechts die Termine. Zwischen den Tagen trennt eine Linie, der
// heutige Tag ist farbig hervorgehoben.
function DayGroup({ str, today, events, calMap, onOpen, onToggleTodo, showEmpty, groupRef }) {
  const d = parseDateStr(str);
  if (events.length === 0 && !showEmpty) return null;
  const isToday = str === today;
  const isWeekend = d.getDay() === 0 || d.getDay() === 6;
  return (
    <section
      className={`calview-day-group ${isToday ? 'today' : ''} ${isWeekend ? 'weekend' : ''}`}
      id={`cal-day-${str}`}
      ref={groupRef}
    >
      <div className="calview-day-date">
        <span className="calview-day-wd">{WEEKDAYS_SHORT[(d.getDay() + 6) % 7]}</span>
        <span className="calview-day-num">{d.getDate()}</span>
        <span className="calview-day-mon">{MONTH_NAMES[d.getMonth()].slice(0, 3)}</span>
      </div>
      <div className="calview-day-events">
        {events.length === 0 && <div className="calview-group-empty">Nichts geplant</div>}
        {events.map((ev) => (
          <CalendarEventRow key={`${ev.id}:${str}`} ev={ev} calMap={calMap} onOpen={onOpen} onToggleTodo={onToggleTodo} />
        ))}
      </div>
    </section>
  );
}

export default function CalendarView({ session, todos = [], onToggleTodo, onEditTodo }) {
  const [mode, setMode] = useState('agenda'); // 'agenda' | 'woche' | 'monat'
  const [refDate, setRefDate] = useState(new Date());
  const [selDay, setSelDay] = useState(toDateStr(new Date())); // Woche: markierter Tag
  const [agendaDays, setAgendaDays] = useState(AGENDA_STEP_DAYS);
  const [dbEvents, setDbEvents] = useState({}); // Map<dateStr, event[]> — nur calendar_events, ungefiltert
  const [loading, setLoading] = useState(true);
  const [monthDaySheet, setMonthDaySheet] = useState(null); // Datumsstring
  const [detail, setDetail] = useState(null); // Termin (Detail-Sheet)
  const [googleCals, setGoogleCals] = useState([]);
  const [filter, setFilter] = useState(loadFilter);
  const groupRefs = useRef({});
  const [conn, setConn] = useState(null);       // google_calendar_connections-Zeile | null
  const [syncing, setSyncing] = useState(false);
  const [syncFailed, setSyncFailed] = useState(null); // Fehlertext des letzten manuellen/auto Syncs
  const [reloadKey, setReloadKey] = useState(0);
  const autoSyncDone = useRef(false);

  const todayStr = toDateStr(new Date());

  const calMap = useMemo(
    () => Object.fromEntries(googleCals.map((c) => [c.google_calendar_id, c])),
    [googleCals],
  );

  useEffect(() => {
    getGoogleCalendars().then(setGoogleCals).catch((e) => console.warn('[CalendarView] google_calendars', e));
  }, [reloadKey]);

  // Sync-Status laden; beim ersten Öffnen automatisch syncen, wenn der
  // letzte Sync länger als AUTO_SYNC_AFTER_MIN her ist (nicht bei bekanntem
  // Verbindungsfehler — der braucht erst ein Neu-Verbinden).
  async function runSync() {
    if (!session || syncing) return;
    setSyncing(true);
    setSyncFailed(null);
    try {
      await syncGoogleCalendar(session);
    } catch (e) {
      setSyncFailed(e.message || 'Synchronisierung fehlgeschlagen');
    }
    try { setConn(await getGoogleCalendarStatus(session)); } catch { /* Status bleibt */ }
    setReloadKey((k) => k + 1);
    setSyncing(false);
  }
  useEffect(() => {
    if (!session) return;
    getGoogleCalendarStatus(session)
      .then((c) => {
        setConn(c);
        const stale = !c?.last_synced_at || Date.now() - new Date(c.last_synced_at).getTime() > AUTO_SYNC_AFTER_MIN * 60000;
        if (c && !c.sync_error && stale && !autoSyncDone.current) {
          autoSyncDone.current = true;
          runSync();
        }
      })
      .catch((e) => console.warn('[CalendarView] sync status', e));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session]);

  async function reconnect() {
    setSyncing(true);
    try {
      await disconnectGoogleCalendar(session);
      await connectGoogleCalendar(session); // leitet zu Google weiter
    } catch (e) {
      setSyncFailed(e.message || 'Verbindung konnte nicht gestartet werden');
      setSyncing(false);
    }
  }

  useEffect(() => {
    try { localStorage.setItem(FILTER_STORAGE_KEY, JSON.stringify(filter)); } catch { /* privater Modus */ }
  }, [filter]);

  const { from, to } = useMemo(() => {
    if (mode === 'agenda') return { from: todayStr, to: toDateStr(addDays(new Date(), agendaDays - 1)) };
    if (mode === 'woche') {
      const start = startOfWeek(refDate);
      return { from: toDateStr(start), to: toDateStr(addDays(start, 6)) };
    }
    const grid = monthGridDays(refDate);
    return { from: toDateStr(grid[0]), to: toDateStr(grid[grid.length - 1]) };
  }, [mode, refDate, agendaDays, todayStr]);

  useEffect(() => {
    let aktiv = true;
    getCalendarEvents(from, to)
      .then((map) => { if (aktiv) { setDbEvents(map); setLoading(false); } })
      .catch((e) => { console.error('[CalendarView]', e); if (aktiv) setLoading(false); });
    return () => { aktiv = false; };
  }, [from, to, reloadKey]);

  // calendar_events + live Aufgaben (todos mit Fälligkeitsdatum) → ein Map.
  const allEvents = useMemo(() => {
    const map = {};
    for (const [day, list] of Object.entries(dbEvents)) map[day] = list.slice();
    for (const t of todos) {
      if (t.deleted_at || !t.due_date || t.due_date < from || t.due_date > to) continue;
      (map[t.due_date] ??= []).push(todoToEvent(t));
    }
    for (const day of Object.keys(map)) map[day] = sortDay(map[day]);
    return map;
  }, [dbEvents, todos, from, to]);

  // Gefilterte Sicht — Filter wirkt nur auf die Anzeige.
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

  // Detail-Sheet: Aufgaben immer live aus dem Hub-State, damit Abhaken im
  // Sheet / in der Liste sofort sichtbar ist.
  const detailEv = useMemo(() => {
    if (!detail) return null;
    if (detail.source_module !== 'todo') return detail;
    const t = todos.find((x) => x.id === detail.todoId && !x.deleted_at);
    return t ? todoToEvent(t) : null;
  }, [detail, todos]);

  // Navigation (Woche/Monat). „Heute“ erscheint nur, wenn man weg von heute ist.
  function navigate(dir) {
    if (mode === 'woche') setRefDate((d) => addDays(d, dir * 7));
    else setRefDate((d) => new Date(d.getFullYear(), d.getMonth() + dir, 1));
  }
  function goToday() { setRefDate(new Date()); setSelDay(todayStr); }
  // Richtung zu „heute“: Liegt der Zeitraum in der Zukunft, steht der Button
  // links vom Datum (Pfeil nach links), in der Vergangenheit rechts.
  const now = new Date();
  let todayDir = null; // 'left' | 'right' | null
  if (mode === 'woche') {
    const cur = toDateStr(startOfWeek(refDate)), nowWeek = toDateStr(startOfWeek(now));
    todayDir = cur > nowWeek ? 'left' : cur < nowWeek ? 'right' : null;
  } else if (mode === 'monat') {
    const cur = refDate.getFullYear() * 12 + refDate.getMonth();
    const nowM = now.getFullYear() * 12 + now.getMonth();
    todayDir = cur > nowM ? 'left' : cur < nowM ? 'right' : null;
  }

  function switchMode(key) {
    setMode(key);
    if (key !== 'agenda') setRefDate(new Date());
    setSelDay(todayStr);
  }

  // Woche: Tag im Streifen antippen → zur Tagesgruppe darunter scrollen.
  function jumpToDay(str) {
    setSelDay(str);
    groupRefs.current[str]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(startOfWeek(refDate), i));
  const rowProps = { calMap, onOpen: setDetail, onToggleTodo };
  const agendaKeys = Object.keys(events).sort();
  const agendaHasToday = agendaKeys.includes(todayStr);

  return (
    <div className="calview">
      <div className="calview-mode-toggle">
        {[['agenda', 'Agenda'], ['woche', 'Woche'], ['monat', 'Monat']].map(([key, label]) => (
          <button key={key} className={mode === key ? 'active' : ''} onClick={() => switchMode(key)}>
            {label}
          </button>
        ))}
      </div>

      {mode !== 'agenda' && (
        <div className="calview-nav">
          <button className="calview-nav-arrow" onClick={() => navigate(-1)} aria-label="Zurück"><Chevron dir="left" /></button>
          <div className="calview-nav-center">
            <span className="calview-nav-label">
              {mode === 'woche' && (() => {
                const s = weekDays[0], e = weekDays[6];
                return `${s.getDate()}.–${e.getDate()}. ${MONTH_NAMES[e.getMonth()]}`;
              })()}
              {mode === 'monat' && `${MONTH_NAMES[refDate.getMonth()]} ${refDate.getFullYear()}`}
            </span>
          </div>
          <button className="calview-nav-arrow" onClick={() => navigate(1)} aria-label="Weiter"><Chevron dir="right" /></button>
        </div>
      )}

      {todayDir && (
        <div className={`calview-today-row ${todayDir}`}>
          <button className="calview-today-btn" onClick={goToday}>
            {todayDir === 'left' ? <><Arrow dir="left" />zu heute</> : <>zu heute<Arrow dir="right" /></>}
          </button>
        </div>
      )}

      {conn && (
        <div className={`calview-sync ${conn.sync_error || syncFailed ? 'error' : ''}`}>
          {conn.sync_error ? (
            <>
              <span className="calview-sync-text">
                <strong>Google-Verbindung abgelaufen.</strong> Bitte neu verbinden, sonst bleiben die Google-Termine veraltet.
              </span>
              <button className="calview-sync-btn primary" disabled={syncing} onClick={reconnect}>Neu verbinden</button>
            </>
          ) : (
            <>
              <span className="calview-sync-text">
                {syncing ? 'Synchronisiere Google…' : syncFailed ? `Sync fehlgeschlagen: ${syncFailed}` : `Google synchronisiert ${ago(conn.last_synced_at)}`}
              </span>
              <button className="calview-sync-btn" disabled={syncing} onClick={runSync} aria-label="Jetzt synchronisieren">
                <span className={syncing ? 'calview-spin' : ''}>↻</span> Aktualisieren
              </button>
            </>
          )}
        </div>
      )}

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

      {mode === 'agenda' && (
        <div className="calview-day-list">
          {loading && <div className="calview-loading">Lädt…</div>}
          {!loading && !agendaHasToday && (
            <DayGroup str={todayStr} today={todayStr} events={[]} showEmpty {...rowProps} />
          )}
          {!loading && agendaKeys.length === 0 && (
            <div className="calview-empty">In den nächsten {agendaDays} Tagen steht nichts an.</div>
          )}
          {!loading && agendaKeys.map((str) => (
            <DayGroup key={str} str={str} today={todayStr} events={events[str]} {...rowProps} />
          ))}
          <button className="calview-more-btn" onClick={() => setAgendaDays((n) => n + AGENDA_STEP_DAYS)}>
            Weitere {AGENDA_STEP_DAYS} Tage laden
          </button>
        </div>
      )}

      {mode === 'woche' && (
        <>
          <div className="calview-week-strip">
            {weekDays.map((d, i) => {
              const str = toDateStr(d);
              return (
                <button
                  key={str}
                  className={`calview-week-day ${str === todayStr ? 'today' : ''} ${str === selDay ? 'selected' : ''}`}
                  onClick={() => jumpToDay(str)}
                >
                  <span className="calview-week-wd">{WEEKDAYS_SHORT[i]}</span>
                  <span className="calview-week-dd">{d.getDate()}</span>
                  <div className="calview-week-dots">
                    <EventDots events={events[str] ?? []} calMap={calMap} />
                  </div>
                </button>
              );
            })}
          </div>
          <div className="calview-day-list">
            {weekDays.map((d) => {
              const str = toDateStr(d);
              return (
                <DayGroup
                  key={str}
                  str={str}
                  today={todayStr}
                  events={events[str] ?? []}
                  showEmpty
                  groupRef={(el) => { groupRefs.current[str] = el; }}
                  {...rowProps}
                />
              );
            })}
          </div>
        </>
      )}

      {mode === 'monat' && (
        <div className="calview-month-grid">
          {WEEKDAYS_SHORT.map((wd) => (
            <div key={wd} className="calview-month-wd">{wd}</div>
          ))}
          {monthGridDays(refDate).map((d) => {
            const str = toDateStr(d);
            const dayEvs = events[str] ?? [];
            const inMonth = d.getMonth() === refDate.getMonth();
            const more = dayEvs.length - MONTH_CHIPS_PER_CELL;
            return (
              <button
                key={str}
                className={`calview-month-cell ${str === todayStr ? 'today' : ''} ${!inMonth ? 'outside' : ''}`}
                onClick={() => setMonthDaySheet(str)}
              >
                <span className="calview-month-dd">{d.getDate()}</span>
                <div className="calview-month-chips">
                  {dayEvs.slice(0, MONTH_CHIPS_PER_CELL).map((ev) => {
                    const dsc = describeEvent(ev, calMap);
                    return (
                      <span
                        key={`${ev.id}:${str}`}
                        className={`calview-mchip ${dsc.isGoogle ? 'google' : 'app'} ${ev.done ? 'done' : ''}`}
                        style={{ '--ev-color': dsc.color }}
                      >
                        {ev.title}
                      </span>
                    );
                  })}
                  {more > 0 && <span className="calview-mchip-more">+{more}</span>}
                </div>
              </button>
            );
          })}
        </div>
      )}

      {monthDaySheet && (
        <SheetShell onClose={() => setMonthDaySheet(null)}>
          <div className="sheet-header">
            <span className="sheet-title">
              {parseDateStr(monthDaySheet).toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' })}
            </span>
            <button className="sheet-cancel" onClick={() => setMonthDaySheet(null)}>Schließen</button>
          </div>
          <div className="calview-day-list" style={{ padding: '0 20px 20px' }}>
            {(events[monthDaySheet] ?? []).length === 0 && <div className="calview-empty">Nichts geplant.</div>}
            {(events[monthDaySheet] ?? []).map((ev) => (
              <CalendarEventRow
                key={`${ev.id}:${monthDaySheet}`}
                ev={ev}
                calMap={calMap}
                onToggleTodo={onToggleTodo}
                onOpen={(e) => { setMonthDaySheet(null); setDetail(e); }}
              />
            ))}
          </div>
        </SheetShell>
      )}

      {detailEv && (
        <CalendarEventSheet
          ev={detailEv}
          calMap={calMap}
          onClose={() => setDetail(null)}
          onToggleTodo={onToggleTodo}
          onEditTodo={(id) => { setDetail(null); onEditTodo?.(todos.find((t) => t.id === id)); }}
        />
      )}
    </div>
  );
}
