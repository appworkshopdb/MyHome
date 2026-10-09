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

const fmtNum = (n) => Math.round(n).toLocaleString('de-DE');

// Ernährungsstand des Tages: kein Haken, zählt nicht bei "x / y erledigt".
// Block antippen → Mahlzeiten (Verlauf + Eintragen), "Ernährung ›" → Modul.
function NutritionBlock({ data, onOpen }) {
  const { kcal, goal, macros, slots, count, hasEstimate, eaten, overKcal } = data;
  const approx = hasEstimate ? '≈ ' : '';
  const over = overKcal > 0;
  const MACROS = [['protein', 'Eiweiß'], ['carbs', 'Kohlenh.'], ['fat', 'Fett']];

  let main;
  let side = null;
  if (!kcal) {
    main = count > 0 ? <>{approx}{fmtNum(eaten.kcal)} <small>kcal gegessen</small></> : <>Noch nichts eingetragen</>;
  } else if (over) {
    main = <>{approx}{fmtNum(overKcal)} kcal drüber</>;
    side = `${approx}${fmtNum(kcal.eaten)} / ${fmtNum(kcal.goal)}`;
  } else {
    main = <>Noch {hasEstimate ? '≈ ' : ''}{fmtNum(kcal.open)} <small>kcal offen</small></>;
    side = `${approx}${fmtNum(kcal.eaten)} / ${fmtNum(kcal.goal)}`;
  }

  return (
    <div className={`dayplan-group dp-nut ${over ? 'over' : ''}`}>
      <div className="dp-nut-head">
        <div className="dayplan-group-label">Ernährung</div>
        <button className="dp-nut-open" onClick={() => onOpen?.('nutrition')}>Ernährung ›</button>
      </div>
      <button className="dp-nut-btn" onClick={() => onOpen?.('nutrition/mahlzeiten')}>
        <div className="dp-nut-top">
          <div className="dp-nut-main">{main}</div>
          {side && <div className="dp-nut-side">{side} ›</div>}
        </div>
        {kcal && <div className="dp-nut-bar"><div className="dp-nut-fill" style={{ width: `${kcal.pct}%` }} /></div>}
        {goal && (
          <div className="dp-macros">
            {MACROS.map(([key, label]) => macros[key] && (
              <div key={key} className="dp-macro">
                <b>{fmtNum(macros[key].open)} g</b>
                <span>{label}</span>
                <i><em style={{ width: `${macros[key].pct}%` }} /></i>
              </div>
            ))}
          </div>
        )}
        <div className="dp-meals">
          {slots.map((s) => (
            <span key={s.key} className={`dp-meal ${s.logged ? 'on' : ''} ${s.next ? 'next' : ''}`}>
              <span aria-hidden="true">{s.emoji}</span>
              <span className="dp-sr">{s.label}{s.logged ? ' eingetragen' : ''}</span>
              {s.logged && <span aria-hidden="true">✓</span>}
            </span>
          ))}
        </div>
        {count === 0 && <div className="dp-cta">＋ Mahlzeit eintragen</div>}
        {!goal && <div className="dp-hint">Trage im Körperprofil Größe, Gewicht und Alter ein, dann zeigt dir der Plan, wie viel noch offen ist.</div>}
        {hasEstimate && count > 0 && <div className="dp-hint">≈ enthält Foto-Schätzungen.</div>}
      </button>
    </div>
  );
}

export function DayPlanSection({ plan, nutrition, onToggleTodo, onToggleWorkout, onToggleHabit, onOpenFinance, onOpenNutrition }) {
  const pct = plan.total > 0 ? plan.done / plan.total : 0;
  return (
    <div className="dayplan-card">
      <div className="dayplan-head">
        <h2 className="dayplan-title">Dein Tagesplan</h2>
        <span className="dayplan-count">{plan.done} / {plan.total} erledigt</span>
      </div>
      <div className="dayplan-bar"><div className="dayplan-bar-fill" style={{ width: `${pct * 100}%` }} /></div>

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

      {nutrition && <NutritionBlock data={nutrition} onOpen={onOpenNutrition} />}

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

      {plan.posten.length > 0 && (
        <Group label="Zahlungen">
          {plan.posten.map((p) => (
            <button key={p.id} className="dayplan-row dayplan-row--link" onClick={onOpenFinance}>
              <span className="dayplan-icon">€</span>
              <span className="dayplan-row-title">{p.title}</span>
              <span className={`dayplan-meta ${p.overdue ? 'critical' : ''}`}>
                {p.overdue ? 'überfällig · ' : 'heute · '}{formatEur(p.amount)}
              </span>
            </button>
          ))}
        </Group>
      )}
    </div>
  );
}
