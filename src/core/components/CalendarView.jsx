import { useEffect, useMemo, useState } from 'react';
import { getCalendarEvents } from '../lib/calendarData';
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

const WEEKDAYS_SHORT = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];
const MONTH_NAMES = [
  'Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
  'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember',
];

function toDateStr(d) {
  return d.toISOString().split('T')[0];
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

// Eine einzelne Termin-Zeile in der Tagesansicht — zeigt alle
// übernommenen Google-Felder (Notiz, Ort, Erinnerung), wenn vorhanden.
function EventRow({ ev }) {
  return (
    <div className={`calview-event-row ${ev.done ? 'done' : ''}`}>
      <span className="calview-event-icon">{SOURCE_ICON[ev.source_module] ?? '·'}</span>
      <div className="calview-event-content">
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
  const [events, setEvents] = useState({}); // Map<dateStr, event[]>
  const [loading, setLoading] = useState(true);
  const [monthDaySheet, setMonthDaySheet] = useState(null); // Date | null — Tagesdetail als Sheet aus der Monatsansicht

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

      {mode === 'tag' && (
        <div className="calview-day-list">
          {loading && <div className="calview-loading">Lädt…</div>}
          {!loading && (events[toDateStr(refDate)] ?? []).length === 0 && (
            <div className="calview-empty">Nichts geplant.</div>
          )}
          {!loading && (events[toDateStr(refDate)] ?? []).map((ev) => <EventRow key={ev.id} ev={ev} />)}
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
                    {[...new Set(dayEvs.map((e) => e.source_module))].slice(0, 3).map((m) => (
                      <span key={m} className={`hub-cal-dot hub-cal-dot--${m}`} />
                    ))}
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
                  {dayEvs.map((ev) => <EventRow key={ev.id} ev={ev} />)}
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
                    {[...new Set(dayEvs.map((e) => e.source_module))].slice(0, 3).map((m) => (
                      <span key={m} className={`hub-cal-dot hub-cal-dot--${m}`} />
                    ))}
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
            {(events[toDateStr(monthDaySheet)] ?? []).map((ev) => <EventRow key={ev.id} ev={ev} />)}
          </div>
        </SheetShell>
      )}
    </div>
  );
}
