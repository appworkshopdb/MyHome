import { useEffect, useState } from 'react';
import { getCalendarEvents } from '../lib/calendarData';

// Icon-Map pro Modul — klein, erkennbar, kein Emoji-Overhead
const MODULE_ICON = {
  sport:    '💪',
  shopping: '🛒',
  todo:     '✓',
  finance:  '€',
};

// Wochentage Mo–So
const WEEKDAYS = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];

function getWeekDates() {
  const today = new Date();
  const dow = (today.getDay() + 6) % 7; // 0=Mo
  const monday = new Date(today);
  monday.setDate(today.getDate() - dow);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d;
  });
}

function toDateStr(d) {
  return d.toISOString().split('T')[0];
}

// Sheet: Events eines Tages
function DaySheet({ date, events, onClose }) {
  const label = date.toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' });
  return (
    <div className="sheet-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="sheet">
        <div className="sheet-header">
          <span className="sheet-title">{label}</span>
          <button className="sheet-cancel" onClick={onClose}>Schließen</button>
        </div>
        <div className="hub-cal-sheet-body">
          {events.length === 0 ? (
            <div className="hub-cal-sheet-empty">Nichts geplant.</div>
          ) : (
            events.map((ev) => (
              <div key={ev.id} className={`hub-cal-sheet-row ${ev.done ? 'done' : ''}`}>
                <span className="hub-cal-sheet-icon">{MODULE_ICON[ev.source_module] ?? '·'}</span>
                <div className="hub-cal-sheet-content">
                  <span className="hub-cal-sheet-title">{ev.title}</span>
                  {ev.event_time && (
                    <span className="hub-cal-sheet-time">{ev.event_time.slice(0, 5)} Uhr</span>
                  )}
                </div>
                {ev.done && <span className="hub-cal-sheet-done">✓</span>}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

export default function HubCalendar() {
  const [events, setEvents]       = useState({});   // Map<dateStr, event[]>
  const [loading, setLoading]     = useState(true);
  const [selectedDay, setSelected] = useState(null); // Date | null

  const days    = getWeekDates();
  const todayStr = toDateStr(new Date());

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const from = toDateStr(days[0]);
        const to   = toDateStr(days[6]);
        const map  = await getCalendarEvents(from, to);
        if (active) { setEvents(map); setLoading(false); }
      } catch (e) {
        console.error('[HubCalendar]', e);
        if (active) setLoading(false);
      }
    }
    load();
    return () => { active = false; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <>
      <div className="hub-cal-week">
        {days.map((d, i) => {
          const str      = toDateStr(d);
          const isToday  = str === todayStr;
          const dayEvs   = events[str] ?? [];
          const hasEvents = dayEvs.length > 0;

          // Welche Module haben Events?
          const modules = [...new Set(dayEvs.map((e) => e.source_module))];

          return (
            <button
              key={str}
              className={`hub-cal-day ${isToday ? 'today' : ''} ${hasEvents ? 'has-events' : ''}`}
              onClick={() => setSelected(d)}
            >
              <span className="hub-cal-wd">{WEEKDAYS[i]}</span>
              <span className="hub-cal-dd">{d.getDate()}</span>
              <div className="hub-cal-dots">
                {loading ? (
                  <span className="hub-cal-dot-skeleton" />
                ) : (
                  modules.slice(0, 3).map((m) => (
                    <span key={m} className={`hub-cal-dot hub-cal-dot--${m}`} />
                  ))
                )}
              </div>
            </button>
          );
        })}
      </div>

      {selectedDay && (
        <DaySheet
          date={selectedDay}
          events={events[toDateStr(selectedDay)] ?? []}
          onClose={() => setSelected(null)}
        />
      )}
    </>
  );
}
