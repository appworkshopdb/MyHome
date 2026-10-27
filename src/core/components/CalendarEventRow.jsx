import { SOURCE_ICON, describeEvent, formatTimeRange } from '../lib/calendarUtils';

// Kompakte Termin-Zeile (Agenda / Woche / Tages-Sheet). Details erst im
// Detail-Sheet (Tippen). Aufgaben haben eine Checkbox, die direkt die
// todos-Zeile abhakt (gleicher Handler wie in der Aufgabenliste).
export default function CalendarEventRow({ ev, calMap, onOpen, onToggleTodo }) {
  const d = describeEvent(ev, calMap);
  const isTodo = ev.source_module === 'todo';
  return (
    <div
      className={`calview-event-row ${d.isGoogle ? 'is-google' : 'is-app'} ${ev.done ? 'done' : ''}`}
      style={{ '--ev-color': d.color }}
      role="button"
      tabIndex={0}
      onClick={() => onOpen(ev)}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen(ev); } }}
    >
      {isTodo ? (
        <button
          className={`calview-check ${ev.done ? 'checked' : ''}`}
          aria-label={ev.done ? 'Als offen markieren' : 'Als erledigt markieren'}
          aria-pressed={ev.done}
          onClick={(e) => { e.stopPropagation(); onToggleTodo?.(ev.todoId, ev.done); }}
        >
          {ev.done ? '✓' : ''}
        </button>
      ) : (
        <span className="calview-event-icon">{SOURCE_ICON[ev.source_module] ?? '·'}</span>
      )}
      <div className="calview-event-content">
        <span className={`calview-source-badge ${d.isGoogle ? 'google' : 'app'}`}>
          {d.sourceLabel}{d.detail ? ` · ${d.detail}` : ''}
        </span>
        <span className="calview-event-title">
          {ev.title}
          {ev.priority && !ev.done && <span className="calview-event-tentative">Wichtig</span>}
          {ev.status === 'tentative' && <span className="calview-event-tentative">Vorläufig</span>}
        </span>
        <span className="calview-event-time">{formatTimeRange(ev)}</span>
      </div>
      <span className="calview-event-chevron" aria-hidden="true">›</span>
    </div>
  );
}
