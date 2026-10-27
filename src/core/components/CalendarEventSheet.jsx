import SheetShell from './SheetShell';
import { describeEvent, formatTimeRange, parseDateStr, addDaysStr } from '../lib/calendarUtils';

function fmtDate(str) {
  return parseDateStr(str).toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

// Detailansicht eines Termins. Aufgaben: abhaken + bearbeiten (öffnet das
// bekannte TodoSheet im Hub). Google-Termine: nur lesen.
export default function CalendarEventSheet({ ev, calMap, onClose, onToggleTodo, onEditTodo }) {
  const d = describeEvent(ev, calMap);
  const isTodo = ev.source_module === 'todo';
  const first = ev.event_date;
  const last = (ev._spanLen ?? 1) > 1 ? addDaysStr(first, ev._spanLen - 1) : first;
  const dateText = last !== first ? `${fmtDate(first)} – ${fmtDate(last)}` : fmtDate(first);
  const reminder = ev.reminder_minutes != null ? `${ev.reminder_minutes} Min. vorher` : null;

  return (
    <SheetShell onClose={onClose}>
      <div className="sheet-header">
        <span className="sheet-title">Termin</span>
        <button className="sheet-cancel" onClick={onClose}>Schließen</button>
      </div>
      <div className="calview-detail" style={{ '--ev-color': d.color }}>
        <span className={`calview-source-badge ${d.isGoogle ? 'google' : 'app'}`}>
          {d.sourceLabel}{d.detail ? ` · ${d.detail}` : ''}
        </span>
        <h3 className={`calview-detail-title ${ev.done ? 'done' : ''}`}>{ev.title}</h3>
        <dl className="calview-detail-list">
          <dt>Wann</dt>
          <dd>{dateText}<br />{formatTimeRange({ ...ev, _spanLen: 1 })}</dd>
          {ev.location && (<><dt>Ort</dt><dd>📍 {ev.location}</dd></>)}
          {reminder && (<><dt>Erinnerung</dt><dd>🔔 {reminder}</dd></>)}
          {ev.status === 'tentative' && (<><dt>Status</dt><dd>Vorläufig</dd></>)}
          {isTodo && ev.priority && (<><dt>Priorität</dt><dd>Wichtig</dd></>)}
          {ev.description && (<><dt>Notiz</dt><dd className="calview-detail-desc">{ev.description}</dd></>)}
        </dl>
        {isTodo && (
          <div className="calview-detail-actions">
            <button className="calview-btn primary" onClick={() => onToggleTodo(ev.todoId, ev.done)}>
              {ev.done ? 'Wieder öffnen' : 'Als erledigt markieren'}
            </button>
            <button className="calview-btn" onClick={() => onEditTodo(ev.todoId)}>Bearbeiten</button>
          </div>
        )}
      </div>
    </SheetShell>
  );
}
