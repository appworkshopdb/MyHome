import PlanSuggestions from './PlanSuggestions';
import PlanEditor from './PlanEditor';
import ApplyPlanDialog from './ApplyPlanDialog';
import { MusclePreview } from './EinheitenListShared';
import { PREDEFINED_UNITS } from '../lib/data/predefinedUnits';

// Alte Pläne können vor dem Muskel-Snapshot angelegt worden sein und haben
// deshalb noch muscle_groups: []. In diesem Fall lösen wir die Einheit über
// ihre unit_id bzw. bei vordefinierten Einheiten über den gespeicherten Titel
// auf. Neue Pläne verwenden weiterhin ihren Snapshot.
function resolvePlanMuscleGroups(item, units) {
  if (item.muscle_groups?.length) return item.muscle_groups;

  if (item.unit_id) {
    const unit = units.find((u) => u.id === item.unit_id);
    if (unit?.muscle_groups?.length) return unit.muscle_groups;
  }

  const predefined = PREDEFINED_UNITS.find((u) => u.title === item.title);
  return predefined?.muscle_groups ?? [];
}

function PlanUnitImages({ items, units }) {
  const trainingItems = items.filter((item) => !item.is_rest);
  if (trainingItems.length === 0) return null;

  return (
    <div
      aria-label={`${trainingItems.length} Trainingseinheiten`}
      style={{
        display: 'flex',
        gap: 14,
        alignItems: 'center',
        overflowX: 'auto',
        padding: '2px 2px 8px',
        scrollbarWidth: 'none',
      }}
    >
      {trainingItems.map((item, i) => (
        <div
          key={item.id ?? `${item.day_index ?? i}-${item.title}`}
          title={item.title}
          aria-label={item.title}
          style={{
            flexShrink: 0,
            display: 'flex',
            alignItems: 'center',
            minWidth: 40,
          }}
        >
          <MusclePreview tags={resolvePlanMuscleGroups(item, units)} />
        </div>
      ))}
    </div>
  );
}

export default function PlaeneView({
  session, plans, units, loading, userSports,
  editing, applying,
  onEditPlan, onDeletePlan, onSavePlan, onCancelEdit,
  onOpenApply, onApplyPlan, onCancelApply,
  onStartFromPlan, showToast,
}) {
  if (editing) {
    return (
      <div className="page">
        <PlanEditor
          initialPlan={editing.id ? editing : null}
          units={units}
          onSave={onSavePlan}
          onCancel={onCancelEdit}
          showToast={showToast}
        />
      </div>
    );
  }

  if (applying) {
    return (
      <div className="page">
        <ApplyPlanDialog plan={applying} onApply={onApplyPlan} onCancel={onCancelApply} />
      </div>
    );
  }

  return (
    <div className="page">
      <div className="card">
        <div className="card-title">Deine Pläne</div>
        {loading ? (
          <p style={{ color: 'var(--text-secondary)', margin: 0 }}>Lädt…</p>
        ) : plans.length === 0 ? (
          <p style={{ color: 'var(--text-secondary)', margin: 0 }}>
            Noch kein eigener Plan. Leg über den ＋-Button unten rechts einen an
            — Vorlage aus mehreren Tagen, ab einem beliebigen Starttag in den
            Kalender eintragbar.
          </p>
        ) : (
          plans.map((plan) => {
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
                  <button className="btn btn-primary" onClick={() => onOpenApply(plan)}>Eintragen</button>
                  <button className="btn btn-secondary" onClick={() => onEditPlan(plan)}>Bearbeiten</button>
                  <button className="btn btn-secondary" onClick={() => onDeletePlan(plan.id)}>X</button>
                </div>
              </div>
            );
          })
        )}
      </div>

      <PlanSuggestions session={session} onStartFromPlan={onStartFromPlan} />
    </div>
  );
}
