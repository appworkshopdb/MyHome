import { useState } from 'react';
import PlanSuggestions from './PlanSuggestions';
import PlanEditor from './PlanEditor';
import { ActivatePlanSheet, EndPlanSheet, EditPlanConfirmSheet } from './PlanSheets';
import { planDayFor, planImpact } from '../../../core/lib/sportPlanSync';
import { parseIso, todayIso } from '../../../core/lib/wizardDates';
import { MusclePreview } from './EinheitenListShared';
import { PREDEFINED_UNITS } from '../lib/data/predefinedUnits';

function resolvePlanMuscleGroups(item, units) {
  if (item.muscle_groups?.length) return item.muscle_groups;

  if (item.unit_id) {
    const unit = units.find((u) => u.id === item.unit_id);
    if (unit?.muscle_groups?.length) return unit.muscle_groups;
  }

  const predefined = PREDEFINED_UNITS.find((u) => u.title === item.title);
  return predefined?.muscle_groups ?? [];
}

const DAY_LABELS = ['Mo.', 'Di.', 'Mi.', 'Do.', 'Fr.', 'Sa.', 'So.'];

function PlanUnitImages({ items, units }) {
  const trainingItems = items
    .filter((item) => !item.is_rest)
    .sort((a, b) => (a.day_index ?? 0) - (b.day_index ?? 0));

  if (trainingItems.length === 0) return null;

  return (
    <div
      aria-label={`${trainingItems.length} Trainingseinheiten`}
      style={{
        display: 'flex',
        gap: 14,
        alignItems: 'flex-start',
        overflowX: 'auto',
        padding: '2px 2px 8px',
        scrollbarWidth: 'none',
      }}
    >
      {trainingItems.map((item, i) => {
        const tags = resolvePlanMuscleGroups(item, units);
        if (!tags.length) return null;

        const dayIndex = Number.isInteger(item.day_index) ? item.day_index : i;
        const dayLabel = DAY_LABELS[dayIndex] ?? `Tag ${dayIndex + 1}`;

        return (
          <div
            key={item.id ?? `${item.day_index ?? i}-${item.title}`}
            title={item.title}
            aria-label={`${item.title}, ${dayLabel}`}
            style={{
              flexShrink: 0,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 3,
            }}
          >
            <span
              style={{
                fontSize: '0.68rem',
                lineHeight: 1,
                fontWeight: 600,
                color: 'var(--text-secondary)',
              }}
            >
              {dayLabel}
            </span>
            <MusclePreview tags={tags} />
          </div>
        );
      })}
    </div>
  );
}

const fmtDM = (iso) => { const d = parseIso(iso); return `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.`; };
const fmtShort = (iso) => `${['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'][parseIso(iso).getDay()]} ${fmtDM(iso)}`;

function LoopIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 12a7 7 0 0 1 12-5l3 3M20 12a7 7 0 0 1-12 5l-3-3M19 5v5h-5M5 19v-5h5" />
    </svg>
  );
}

// Karte "Aktiver Plan": nur hier steht der aktive Plan, nicht noch einmal
// in "Deine Pläne".
function ActivePlanCard({ active, onEdit, onEnd }) {
  const { plan } = active;
  const today = todayIso();
  const running = active.start_date <= today;
  const day = running ? planDayFor(plan.items, active.start_date, today) : null;

  let progress = null;
  if (day) {
    progress = day.count <= 10
      ? (
        <div className="pl-prog" aria-hidden="true">
          {Array.from({ length: day.count }, (_, i) => <i key={i} className={i < day.index ? 'on' : i === day.index ? 'cur' : ''} />)}
        </div>
      )
      : <div className="pl-prog pl-prog--bar" aria-hidden="true"><i style={{ width: `${Math.round(((day.index + 1) / day.count) * 100)}%` }} /></div>;
  }

  return (
    <div className="pl-active">
      <div className="pl-eb"><span className="pl-bd"><LoopIcon /></span>Aktiver Plan</div>
      <b className="pl-name">{plan.title} · {plan.items.length} Tage</b>
      <span className="pl-line">
        {running
          ? (day ? `Heute: Tag ${day.index + 1} von ${day.count} · ${day.item.is_rest ? 'Ruhetag' : day.item.title}` : '')
          : `Startet am ${fmtShort(active.start_date)}`}
      </span>
      {progress}
      <span className="pl-line pl-line--mt">Seit {fmtDM(active.start_date)} · bis auf weiteres</span>
      <div className="pl-row">
        <button type="button" className="btn btn-secondary" onClick={() => onEdit(plan)}>Bearbeiten</button>
        <button type="button" className="btn btn-ghost" onClick={onEnd}>Beenden</button>
      </div>
    </div>
  );
}

export default function PlaeneView({
  session, plans, units, loading, userSports,
  editing, activePlan, workouts,
  onEditPlan, onDeletePlan, onSavePlan, onCancelEdit,
  onActivatePlan, onEndPlan,
  onStartFromPlan, showToast,
}) {
  const [sheet, setSheet] = useState(null); // { type: 'activate', plan } | { type: 'end' } | { type: 'editConfirm', plan, items }
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
        <ActivePlanCard active={active} onEdit={onEditPlan} onEnd={() => setSheet({ type: 'end' })} />
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
          others.map((plan) => {
            const trainingDays = plan.items.filter((i) => !i.is_rest).length;
            return (
              <div key={plan.id} style={{ marginBottom: 16, paddingBottom: 4, borderBottom: '1px solid var(--border)' }}>
                <div style={{ marginBottom: 10 }}>
                  <div style={{ fontWeight: 600 }}>{plan.title}</div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                    {plan.items.length} Tage - {trainingDays} Einheiten
                  </div>
                </div>

                <PlanUnitImages items={plan.items} units={units} />

                <div style={{ display: 'flex', gap: 6, marginTop: 2 }}>
                  <button className="btn btn-primary" onClick={() => setSheet({ type: 'activate', plan })}>Aktivieren</button>
                  <button className="btn btn-secondary" onClick={() => onEditPlan(plan)}>Bearbeiten</button>
                  <button className="btn btn-secondary" onClick={() => onDeletePlan(plan.id)} aria-label="Plan löschen">X</button>
                </div>
              </div>
            );
          })
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
    </div>
  );
}
