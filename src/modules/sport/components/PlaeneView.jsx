import { useState } from 'react';
import PlanSuggestions from './PlanSuggestions';
import PlanEditor from './PlanEditor';
import RestBadge from './RestBadge';
import { MusclePreview } from './EinheitenListShared';
import { ActivatePlanSheet, EndPlanSheet, EditPlanConfirmSheet, DeletePlanSheet, PickPlanSheet } from './PlanSheets';
import { addDaysIso, diffDays, planDayFor, planImpact } from '../../../core/lib/sportPlanSync';
import { parseIso, todayIso } from '../../../core/lib/wizardDates';
import { muscleLabels, planCounts, resolvePlanMuscleGroups } from '../lib/planMuscles';
import { resolveTypeLabel } from '../lib/typeLabel';

// Seite "Pläne" in drei Stufen, oben immer EINE Karte:
//   1. Kein Plan ausgewählt: gestrichelte Karte mit "Plan auswählen" / "Neuer Plan"
//   2. Plan ausstehend (Start in der Zukunft) und
//   3. Plan aktiv: dieselbe Heute-Karte, gleicher Aufbau, damit man alle Angaben
//      in beiden Fällen an derselben Stelle findet. Ausstehend zeigt die erste
//      Einheit (Tag 1) statt der heutigen, leere Segmente und den Start.
// Muskelbilder: nur in dieser Karte und in den aufgeklappten Plänen; die Karte
// zeigt sie nur für den heutigen Tag (bzw. Tag 1 vor dem Start), die nächsten
// Tage stehen als Text. An einem Ruhetag steht das Ruhetag-Symbol.

const WD = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
const fmtDM = (iso) => { const d = parseIso(iso); return `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.`; };
const fmtShort = (iso) => `${WD[parseIso(iso).getDay()]} ${fmtDM(iso)}`;
const inDays = (n) => (n === 1 ? 'morgen' : `in ${n} Tagen`);

const itemTitle = (item) => (item.is_rest ? 'Ruhetag' : item.title);

function unitSubline(item, units) {
  const labels = muscleLabels(resolvePlanMuscleGroups(item, units));
  return labels || resolveTypeLabel(item.type_key) || '';
}

function Icon({ d, size = 16 }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={d} />
    </svg>
  );
}
const CLOCK = 'M12 3.5a8.5 8.5 0 1 0 0 17 8.5 8.5 0 0 0 0-17zM12 7.5V12l3 2';
const PLUS = 'M12 5v14M5 12h14';
const CHEVRON = 'm6 9 6 6 6-6';

// Stufe 1
function PlanEmpty({ hasPlans, onPick, onNew }) {
  return (
    <div className="pl-hero0">
      <div className="pl-hero0-ey">Kein Plan ausgewählt</div>
      <div className="pl-hero0-mid">
        <div>
          <div className="pl-hero0-ft">{hasPlans ? 'Plan auswählen' : 'Noch kein Plan'}</div>
          <div className="pl-hero0-fm">
            {hasPlans
              ? 'Ein Plan füllt deinen Kalender von selbst. Er ist freiwillig, ohne Plan trägst du Einheiten einzeln ein.'
              : 'Leg einen Plan an, damit sich dein Kalender von selbst füllt. Er ist freiwillig, Einheiten trägst du auch einzeln ein.'}
          </div>
        </div>
        <span className="pl-hero0-ring"><Icon d={PLUS} size={26} /></span>
      </div>
      <div className="pl-hero0-row">
        {hasPlans && <button type="button" className="btn btn-primary" onClick={onPick}>Plan auswählen</button>}
        <button type="button" className={`btn ${hasPlans ? 'btn-secondary' : 'btn-primary'}`} onClick={onNew}>Neuer Plan</button>
      </div>
    </div>
  );
}

// Stufe 2 und 3
function PlanHero({ active, units, onEdit, onEnd }) {
  const { plan } = active;
  const today = todayIso();
  const pending = active.start_date > today;
  // vor dem Start zeigt die Karte die erste Einheit (Tag 1) und die zwei danach
  const ref = pending ? active.start_date : today;
  const day = planDayFor(plan.items, active.start_date, ref);
  const count = plan.items.length;

  let progress = null;
  let next = [];
  if (day) {
    const done = pending ? -1 : day.index;
    progress = count <= 10
      ? (
        <div className="pl-seg7" aria-hidden="true">
          {Array.from({ length: count }, (_, i) => <i key={i} className={i < done ? 'on' : i === done ? 'cur' : ''} />)}
        </div>
      )
      : <div className="pl-seg7 pl-seg7--bar" aria-hidden="true"><i style={{ width: pending ? '0%' : `${Math.round(((day.index + 1) / count) * 100)}%` }} /></div>;
    next = [1, 2].map((k) => planDayFor(plan.items, active.start_date, addDaysIso(ref, k))).filter(Boolean);
  }

  const muscles = day && !day.item.is_rest ? resolvePlanMuscleGroups(day.item, units) : [];
  let picture = null;
  if (day?.item.is_rest) picture = <RestBadge size={62} />;
  else if (muscles.length) picture = <MusclePreview tags={muscles} size={52} />;

  const lineA = pending ? `${plan.title} · startet ${fmtShort(active.start_date)}` : `${plan.title} · seit ${fmtDM(active.start_date)}`;
  const lineB = pending ? `${inDays(diffDays(today, active.start_date))} · bis auf weiteres` : 'bis auf weiteres';

  return (
    <div className={`pl-hero${pending ? ' is-pend' : ''}`}>
      <div className="pl-hero-ey">
        {pending
          ? <span className="pl-hero-pill"><Icon d={CLOCK} size={14} /> Noch nicht aktiv</span>
          : <span>Aktiver Plan</span>}
        <span>{day ? `Tag ${day.index + 1} von ${count}` : `${count} Tage`}</span>
      </div>
      <div className="pl-hero-mid">
        <div className="pl-hero-tx">
          <div className="pl-hero-ft">{day ? itemTitle(day.item) : plan.title}</div>
          <div className="pl-hero-fm">
            {day ? (day.item.is_rest ? 'Erholung eingeplant' : unitSubline(day.item, units)) : planCounts(plan.items)}
          </div>
        </div>
        {picture}
      </div>
      {progress}
      {next.length > 0 && (
        <div className="pl-hero-next">
          {next.map((n) => (
            <div key={n.index}><span>Tag {n.index + 1}</span><b>{itemTitle(n.item)}</b></div>
          ))}
        </div>
      )}
      <div className="pl-hero-status">
        <b>{lineA}</b>
        <span>{lineB}</span>
      </div>
      <div className="pl-hero-row">
        <button type="button" className="pl-hero-btn pl-hero-btn--o" onClick={() => onEdit(plan)}>Bearbeiten</button>
        <button type="button" className="pl-hero-btn" onClick={onEnd}>Beenden</button>
      </div>
    </div>
  );
}

function PlanRow({ plan, units, onActivate, onEdit, onMore }) {
  return (
    <details className="pl-plan">
      <summary>
        <span className="pl-plan-tx">
          <b>{plan.title}</b>
          <small>{planCounts(plan.items)}</small>
          <span className="pl-plan-seq">{plan.items.map(itemTitle).join(' · ')}</span>
        </span>
        <span className="pl-plan-chev"><Icon d={CHEVRON} size={18} /></span>
      </summary>
      <div className="pl-pnl">
        <div className="pl-tl">
          {plan.items.map((item, i) => {
            const tags = item.is_rest ? [] : resolvePlanMuscleGroups(item, units);
            const sub = item.is_rest ? '' : unitSubline(item, units);
            return (
              <div key={item.id ?? i} className={`pl-tl-r${item.is_rest ? ' is-rest' : ''}`}>
                <span className="pl-tl-n"><i>{i + 1}</i></span>
                <span className="pl-tl-t">
                  <b>{itemTitle(item)}</b>
                  {sub && <small>{sub}</small>}
                </span>
                <span className="pl-tl-v">
                  {item.is_rest ? <RestBadge size={34} /> : tags.length > 0 && <MusclePreview tags={tags} size={34} />}
                </span>
              </div>
            );
          })}
        </div>
      </div>
      <div className="pl-plan-acts">
        <button type="button" className="btn btn-primary" onClick={() => onActivate(plan)}>Aktivieren</button>
        <button type="button" className="btn btn-secondary" onClick={() => onEdit(plan)}>Bearbeiten</button>
        <button type="button" className="btn btn-secondary pl-more" onClick={() => onMore(plan)} aria-label={`Mehr zu ${plan.title}`}>
          <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true">
            <circle cx="5" cy="12" r="1.5" /><circle cx="12" cy="12" r="1.5" /><circle cx="19" cy="12" r="1.5" />
          </svg>
        </button>
      </div>
    </details>
  );
}

export default function PlaeneView({
  session, plans, units, loading, userSports,
  editing, activePlan, workouts,
  onEditPlan, onDeletePlan, onSavePlan, onCancelEdit,
  onActivatePlan, onEndPlan,
  onStartFromPlan, showToast,
}) {
  // { type: 'pick' } | { type: 'activate', plan } | { type: 'end' } | { type: 'delete', plan } | { type: 'editConfirm', plan, items }
  const [sheet, setSheet] = useState(null);
  const [busy, setBusy] = useState(false);

  // activePlan = Zeile aus spo_active_plan (aktiv oder ausstehend); nur anzeigen, wenn der Plan noch existiert
  const activePlanObj = activePlan ? plans.find((p) => p.id === activePlan.plan_id) : null;
  const active = activePlanObj ? { ...activePlan, plan: activePlanObj } : null;

  async function run(fn) {
    setBusy(true);
    try { await fn(); setSheet(null); } finally { setBusy(false); }
  }

  // Neuer Plan: der Editor ohne id legt einen neuen an
  const newPlan = () => { setSheet(null); onEditPlan({}); };

  if (editing) {
    return (
      <div className="page">
        <PlanEditor
          initialPlan={editing.id ? editing : null}
          units={units}
          isActive={Boolean(active && editing.id === active.plan_id)}
          onSave={(plan, items) => {
            // Änderung am aktiven Plan wirkt ab heute auf den Kalender: erst bestätigen lassen
            if (active && plan.id === active.plan_id) setSheet({ type: 'editConfirm', plan, items });
            else onSavePlan(plan, items);
          }}
          onCancel={onCancelEdit}
          showToast={showToast}
        />
        {sheet?.type === 'editConfirm' && (
          <EditPlanConfirmSheet
            title={sheet.plan.title}
            impact={planImpact(workouts, todayIso())}
            busy={busy}
            onClose={() => setSheet(null)}
            onConfirm={() => run(() => onSavePlan(sheet.plan, sheet.items))}
          />
        )}
      </div>
    );
  }

  const others = plans.filter((p) => !active || p.id !== active.plan_id);

  return (
    <div className="page">
      {active
        ? <PlanHero active={active} units={units} onEdit={onEditPlan} onEnd={() => setSheet({ type: 'end' })} />
        : !loading && <PlanEmpty hasPlans={plans.length > 0} onPick={() => setSheet({ type: 'pick' })} onNew={newPlan} />}

      <div className="card">
        <div className="card-title">Deine Pläne</div>
        {loading ? (
          <p style={{ color: 'var(--text-secondary)', margin: 0 }}>Lädt…</p>
        ) : plans.length === 0 ? (
          <p style={{ color: 'var(--text-secondary)', margin: 0 }}>
            Noch kein Plan. Mit „Neuer Plan“ oder dem ＋-Button unten rechts legst du einen an und wählst ihn danach hier aus.
          </p>
        ) : others.length === 0 ? (
          <p style={{ color: 'var(--text-secondary)', margin: 0 }}>
            Weitere Pläne erscheinen hier. Mit dem ＋-Button unten rechts legst du einen neuen an.
          </p>
        ) : (
          others.map((plan) => (
            <PlanRow
              key={plan.id}
              plan={plan}
              units={units}
              onActivate={(p) => setSheet({ type: 'activate', plan: p })}
              onEdit={onEditPlan}
              onMore={(p) => setSheet({ type: 'delete', plan: p })}
            />
          ))
        )}
      </div>

      <PlanSuggestions session={session} onStartFromPlan={onStartFromPlan} />

      {sheet?.type === 'pick' && (
        <PickPlanSheet
          plans={plans}
          onPick={(p) => setSheet({ type: 'activate', plan: p })}
          onNew={newPlan}
          onClose={() => setSheet(null)}
        />
      )}
      {sheet?.type === 'activate' && (
        <ActivatePlanSheet
          plan={sheet.plan}
          hasActive={Boolean(active)}
          busy={busy}
          onClose={() => setSheet(null)}
          onConfirm={(plan, start) => run(() => onActivatePlan(plan, start))}
        />
      )}
      {sheet?.type === 'end' && active && (
        <EndPlanSheet
          plan={active.plan}
          impact={planImpact(workouts, todayIso())}
          busy={busy}
          onClose={() => setSheet(null)}
          onConfirm={() => run(() => onEndPlan())}
        />
      )}
      {sheet?.type === 'delete' && (
        <DeletePlanSheet
          plan={sheet.plan}
          busy={busy}
          onClose={() => setSheet(null)}
          onConfirm={() => run(() => onDeletePlan(sheet.plan.id))}
        />
      )}
    </div>
  );
}
