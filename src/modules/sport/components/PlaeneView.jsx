import { useState } from 'react';
import PlanSuggestions from './PlanSuggestions';
import PlanEditor from './PlanEditor';
import RestBadge from './RestBadge';
import { MusclePreview } from './EinheitenListShared';
import { ActivatePlanSheet, EndPlanSheet, EditPlanConfirmSheet, DeletePlanSheet } from './PlanSheets';
import { addDaysIso, planDayFor, planImpact } from '../../../core/lib/sportPlanSync';
import { parseIso, todayIso } from '../../../core/lib/wizardDates';
import { muscleLabels, planCounts, resolvePlanMuscleGroups } from '../lib/planMuscles';
import { resolveTypeLabel } from '../lib/typeLabel';

// Seite "Pläne": oben der aktive Plan als Heute-Karte (nur dort Muskelbilder, nur
// für den heutigen Tag; an einem Ruhetag das Ruhetag-Bild), darunter die übrigen
// Pläne als strukturierte Zeilen ohne Bilder. Die Bilder gibt es beim Bearbeiten.

const WD = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
const fmtDM = (iso) => { const d = parseIso(iso); return `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.`; };
const fmtShort = (iso) => `${WD[parseIso(iso).getDay()]} ${fmtDM(iso)}`;

const itemTitle = (item) => (item.is_rest ? 'Ruhetag' : item.title);

function unitSubline(item, units) {
  const labels = muscleLabels(resolvePlanMuscleGroups(item, units));
  return labels || resolveTypeLabel(item.type_key) || '';
}

function PlanHero({ active, units, onEdit, onEnd }) {
  const { plan } = active;
  const today = todayIso();
  const running = active.start_date <= today;
  const day = running ? planDayFor(plan.items, active.start_date, today) : null;
  const count = plan.items.length;

  let progress = null;
  let next = null;
  if (day) {
    progress = count <= 10
      ? (
        <div className="pl-seg7" aria-hidden="true">
          {Array.from({ length: count }, (_, i) => <i key={i} className={i < day.index ? 'on' : i === day.index ? 'cur' : ''} />)}
        </div>
      )
      : <div className="pl-seg7 pl-seg7--bar" aria-hidden="true"><i style={{ width: `${Math.round(((day.index + 1) / count) * 100)}%` }} /></div>;
    next = [1, 2].map((k) => planDayFor(plan.items, active.start_date, addDaysIso(today, k))).filter(Boolean);
  }

  const muscles = day && !day.item.is_rest ? resolvePlanMuscleGroups(day.item, units) : [];
  let picture = null;
  if (day?.item.is_rest) picture = <RestBadge size={62} />;
  else if (muscles.length) picture = <MusclePreview tags={muscles} size={52} />;

  return (
    <div className="pl-hero">
      <div className="pl-hero-ey">
        <span>Aktiver Plan</span>
        <span>{running ? `Tag ${day.index + 1} von ${count}` : `Ab ${fmtShort(active.start_date)}`}</span>
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
      {next && next.length > 0 && (
        <div className="pl-hero-next">
          {next.map((n) => (
            <div key={n.index}><span>Tag {n.index + 1}</span><b>{itemTitle(n.item)}</b></div>
          ))}
        </div>
      )}
      <div className="pl-hero-since">
        {running ? `${plan.title} · seit ${fmtDM(active.start_date)} · bis auf weiteres` : 'Bis auf weiteres'}
      </div>
      <div className="pl-hero-row">
        <button type="button" className="pl-hero-btn pl-hero-btn--o" onClick={() => onEdit(plan)}>Bearbeiten</button>
        <button type="button" className="pl-hero-btn" onClick={onEnd}>Beenden</button>
      </div>
    </div>
  );
}

function ChevronDown() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="m6 9 6 6 6-6" />
    </svg>
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
        <span className="pl-plan-chev"><ChevronDown /></span>
      </summary>
      <div className="pl-days">
        {plan.items.map((item, i) => (
          <div key={item.id ?? i} className={`pl-day${item.is_rest ? ' is-rest' : ''}`}>
            <span className="pl-day-n">Tag {i + 1}</span>
            <span>
              <b>{itemTitle(item)}</b>
              {!item.is_rest && unitSubline(item, units) && <small>{unitSubline(item, units)}</small>}
            </span>
          </div>
        ))}
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
  // { type: 'activate', plan } | { type: 'end' } | { type: 'delete', plan } | { type: 'editConfirm', plan, items }
  const [sheet, setSheet] = useState(null);
  const [busy, setBusy] = useState(false);

  // activePlan = Zeile aus spo_active_plan; nur anzeigen, wenn der Plan noch existiert
  const activePlanObj = activePlan ? plans.find((p) => p.id === activePlan.plan_id) : null;
  const active = activePlanObj ? { ...activePlan, plan: activePlanObj } : null;

  async function run(fn) {
    setBusy(true);
    try { await fn(); setSheet(null); } finally { setBusy(false); }
  }

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
      {active ? (
        <PlanHero active={active} units={units} onEdit={onEditPlan} onEnd={() => setSheet({ type: 'end' })} />
      ) : plans.length > 0 ? (
        <div className="pl-noact">
          <b>Kein aktiver Plan</b>
          <span>Du brauchst keinen. Aktiviere einen, wenn sich dein Kalender von selbst füllen soll.</span>
        </div>
      ) : null}

      <div className="card">
        <div className="card-title">Deine Pläne</div>
        {loading ? (
          <p style={{ color: 'var(--text-secondary)', margin: 0 }}>Lädt…</p>
        ) : plans.length === 0 ? (
          <p style={{ color: 'var(--text-secondary)', margin: 0 }}>
            Noch kein Plan. Ein Plan ist freiwillig, Einheiten trägst du auch einzeln im Kalender ein.
            Leg über den ＋-Button unten rechts einen an und aktiviere ihn dann hier.
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
