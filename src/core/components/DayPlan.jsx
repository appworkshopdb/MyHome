import Money from './Money';
import Ring from './Ring';

// Tagesplan im Hub: DayPlanSection (der Plan selbst, abhakbar, immer sichtbar). Abhaken läuft über die
// Handler aus dem Hub — hier wird nur dargestellt.
//
// Aufbau: Kopf mit Ring, optional "Als Nächstes" (erstes offenes Training, mit
// "Erledigt"), darunter EINE Liste. Jede Zeile trägt einen Chip in der Farbfamilie
// ihres Bereichs (Training = Sport, Gewohnheit = Gewohnheiten, Zahlung = Finanzen,
// Termin/Aufgabe = neutral). Die Ernährung steht NICHT mehr in dieser Liste, sondern
// als eigener Block (NutritionBlock) darunter im Hub.

function Row({ done, onToggle, icon, title, sub, critical, family, tag }) {
  return (
    <div className={`dayplan-row ${done ? 'done' : ''}`}>
      <button className={`dayplan-check ${done ? 'checked' : ''}`} onClick={onToggle} aria-label={done ? 'Rückgängig' : 'Erledigt'}>
        {done && '✓'}
      </button>
      {icon && <span className="dayplan-icon">{icon}</span>}
      <span className="dayplan-row-body">
        <span className="dayplan-row-title">{title}</span>
        {sub && <span className={`dayplan-sub ${critical ? 'critical' : ''}`}>{sub}</span>}
      </span>
      {tag && <span className={`dayplan-chip tone-${family}`}>{tag}</span>}
    </div>
  );
}

const fmtNum = (n) => Math.round(n).toLocaleString('de-DE');

// Ernährungsstand des Tages: kein Haken, zählt nicht bei "x / y erledigt".
// Block antippen → Mahlzeiten (Verlauf + Eintragen), "Ernährung ›" → Modul.
// Wird auch oben auf der Ernährungs-Seite gezeigt (label="Heute", hideOpen: der
// Link ins Modul entfällt dort, variant="hero": große Fokuskarte in Grün).
export function NutritionBlock({ data, onOpen, label = 'Ernährung', hideOpen = false, variant = 'tile' }) {
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
    <div className={`dp-nut tone-food dp-nut--${variant} ${over ? 'over' : ''}`}>
      <div className="dp-nut-head">
        <div className="dp-nut-label">{label}</div>
        {!hideOpen && <button className="dp-nut-open" onClick={() => onOpen?.('nutrition')}>Ernährung ›</button>}
      </div>
      <button className="dp-nut-btn" onClick={() => onOpen?.('nutrition/mahlzeiten')}>
        <div className="dp-nut-top">
          {kcal && (
            <Ring size={variant === 'hero' ? 84 : 72} stroke={variant === 'hero' ? 9 : 8} value={kcal.pct / 100} className="dp-nut-ring">
              <b>{Math.round(kcal.pct)} %</b>
            </Ring>
          )}
          <div className="dp-nut-text">
            <div className="dp-nut-main">{main}</div>
            {side && <div className="dp-nut-side">{side} ›</div>}
          </div>
        </div>
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
        {count === 0 && variant === 'hero' && <div className="dp-cta">＋ Mahlzeit eintragen</div>}
        {!goal && <div className="dp-hint">Trage im Körperprofil Größe, Gewicht und Alter ein, dann zeigt dir der Plan, wie viel noch offen ist.</div>}
        {hasEstimate && count > 0 && <div className="dp-hint">≈ enthält Foto-Schätzungen.</div>}
      </button>
    </div>
  );
}

export function DayPlanSection({ plan, onToggleTodo, onToggleWorkout, onToggleHabit, onPayPosten, onOpenFinance, hideAmounts = false }) {
  const pct = plan.total > 0 ? plan.done / plan.total : 0;
  // Erstes noch offenes Training: eigener "Als Nächstes"-Block mit Erledigt-Knopf,
  // gleiche Aktion wie das Häkchen in der Liste (onToggleWorkout).
  const next = plan.workouts.find((w) => !w.done) ?? null;
  const workouts = plan.workouts.filter((w) => w !== next);

  return (
    <div className="dayplan-card">
      <div className="dayplan-head">
        <h2 className="dayplan-title">Dein Tagesplan</h2>
        <span className="dayplan-count" aria-hidden="true"><b>{plan.done}</b> / {plan.total} erledigt</span>
        <span className="dp-sr">{plan.done} / {plan.total} erledigt</span>
      </div>
      <div className="dayplan-bar" aria-hidden="true">
        <div className="dayplan-bar-fill" style={{ width: `${Math.round(pct * 100)}%` }} />
      </div>

      {next && (
        <div className="dayplan-next tone-sport">
          <div className="dayplan-next-body">
            <span className="dayplan-next-kicker">Als Nächstes</span>
            <span className="dayplan-next-title">{next.title}</span>
            {next.minutes ? <span className="dayplan-next-meta">Training · {next.minutes} Min</span> : <span className="dayplan-next-meta">Training</span>}
          </div>
          <button className="dayplan-next-btn" onClick={() => onToggleWorkout(next.workout)}>Erledigt</button>
        </div>
      )}

      {plan.isEmpty && <div className="dayplan-empty">Heute steht nichts an — freier Tag.</div>}

      {plan.events.length > 0 && (
        <div className="dayplan-list dayplan-list--events">
          {plan.events.map((e) => (
            <div key={e.id} className="dayplan-row">
              <span className="dayplan-time">{e.time ?? 'ganztägig'}</span>
              <span className="dayplan-row-body"><span className="dayplan-row-title">{e.title}</span></span>
              <span className="dayplan-chip tone-n">Termin</span>
            </div>
          ))}
        </div>
      )}

      {(plan.restDay || workouts.length > 0 || plan.todos.length > 0 || plan.habits.length > 0 || plan.posten.length > 0) && (
        <div className="dayplan-list">
          {plan.restDay && (
            <div className="dayplan-row">
              <span className="dayplan-time">–</span>
              <span className="dayplan-row-body"><span className="dayplan-row-title">Restday</span></span>
              <span className="dayplan-chip tone-sport">Training</span>
            </div>
          )}
          {workouts.map((w) => (
            <Row key={w.id} done={w.done} icon="💪" title={w.title} family="sport" tag="Training"
              sub={w.minutes ? `${w.minutes} Min` : null}
              onToggle={() => onToggleWorkout(w.workout)} />
          ))}

          {plan.todos.map((t) => (
            <Row key={t.id} done={t.done} title={t.title} family="n" tag="Aufgabe"
              sub={t.overdue ? 'überfällig' : t.priority ? 'Wichtig' : null} critical={t.overdue}
              onToggle={() => onToggleTodo(t.id, t.done)} />
          ))}

          {plan.habits.map((h) => (
            <Row key={h.id} done={h.done} icon={h.icon} title={h.title}
              onToggle={() => onToggleHabit(h.habit)} />
          ))}

          {plan.posten.map((p) => (
            <div key={p.id} className="dayplan-row">
              <button className="dayplan-check" onClick={() => onPayPosten(p.id)} aria-label="Als bezahlt markieren" />
              <span className="dayplan-row-body">
                <button className="dayplan-row-title dayplan-row-title--link" onClick={onOpenFinance}>{p.title}</button>
                <span className={`dayplan-sub ${p.overdue ? 'critical' : ''}`}><Money value={p.amount} hide={hideAmounts} /> · {p.overdue ? 'überfällig' : 'heute'}</span>
              </span>
              <span className="dayplan-chip tone-fin">Zahlung</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
