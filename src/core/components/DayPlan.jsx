import { createPortal } from 'react-dom';
import { formatEur } from '../lib/format';

// Tagesplan im Hub: DayPlanPopup (Einladung am Seitenrand, morgens) und
// DayPlanSection (der Plan selbst, abhakbar). Abhaken läuft über die
// Handler aus dem Hub — hier wird nur dargestellt.

export function DayPlanPopup({ plan, onOpen, onDismiss }) {
  // Portal nach body: .hub-Vorfahren bleiben unberührt (Fixed-Nav-Regel)
  return createPortal(
    <div className="dayplan-popup" role="dialog" aria-label="Dein Tagesplan">
      <button className="dayplan-popup-main" onClick={onOpen}>
        <span className="dayplan-popup-title">Dein Tagesplan</span>
        <span className="dayplan-popup-sub">{plan.total} {plan.total === 1 ? 'Punkt' : 'Punkte'} für heute ›</span>
      </button>
      <button className="dayplan-popup-close" onClick={onDismiss} aria-label="Später">×</button>
    </div>,
    document.body,
  );
}

function Row({ done, onToggle, icon, title, meta, critical }) {
  return (
    <div className={`dayplan-row ${done ? 'done' : ''}`}>
      <button className={`dayplan-check ${done ? 'checked' : ''}`} onClick={onToggle} aria-label={done ? 'Rückgängig' : 'Erledigt'}>
        {done && '✓'}
      </button>
      {icon && <span className="dayplan-icon">{icon}</span>}
      <span className="dayplan-row-title">{title}</span>
      {meta && <span className={`dayplan-meta ${critical ? 'critical' : ''}`}>{meta}</span>}
    </div>
  );
}

function Group({ label, children }) {
  return (
    <div className="dayplan-group">
      <div className="dayplan-group-label">{label}</div>
      {children}
    </div>
  );
}

export function DayPlanSection({ plan, onToggleTodo, onToggleWorkout, onToggleHabit, onOpenFinance }) {
  const pct = plan.total > 0 ? plan.done / plan.total : 0;
  return (
    <div className="dayplan-card">
      <div className="dayplan-head">
        <span className="dayplan-count">{plan.done} / {plan.total} erledigt</span>
        <div className="dayplan-bar"><div className="dayplan-bar-fill" style={{ width: `${pct * 100}%` }} /></div>
      </div>

      {plan.isEmpty && <div className="dayplan-empty">Heute steht nichts an — freier Tag.</div>}

      {plan.events.length > 0 && (
        <Group label="Termine">
          {plan.events.map((e) => (
            <div key={e.id} className="dayplan-row">
              <span className="dayplan-time">{e.time ?? 'ganztägig'}</span>
              <span className="dayplan-row-title">{e.title}</span>
            </div>
          ))}
        </Group>
      )}

      {(plan.workouts.length > 0 || plan.restDay) && (
        <Group label="Training">
          {plan.restDay && <div className="dayplan-row"><span className="dayplan-icon">–</span><span className="dayplan-row-title">Restday</span></div>}
          {plan.workouts.map((w) => (
            <Row key={w.id} done={w.done} icon="💪" title={w.title}
              meta={w.minutes ? `${w.minutes} Min` : null}
              onToggle={() => onToggleWorkout(w.workout)} />
          ))}
        </Group>
      )}

      {plan.todos.length > 0 && (
        <Group label="Aufgaben">
          {plan.todos.map((t) => (
            <Row key={t.id} done={t.done} title={t.title}
              meta={t.overdue ? 'überfällig' : t.priority ? 'Wichtig' : null} critical={t.overdue}
              onToggle={() => onToggleTodo(t.id, t.done)} />
          ))}
        </Group>
      )}

      {plan.habits.length > 0 && (
        <Group label="Gewohnheiten">
          {plan.habits.map((h) => (
            <Row key={h.id} done={h.done} icon={h.icon} title={h.title} onToggle={() => onToggleHabit(h.habit)} />
          ))}
        </Group>
      )}

      {plan.posten.count > 0 && (
        <button className="dayplan-link" onClick={onOpenFinance}>
          {plan.posten.count} offene Posten · {formatEur(plan.posten.sum)} ›
        </button>
      )}
    </div>
  );
}
