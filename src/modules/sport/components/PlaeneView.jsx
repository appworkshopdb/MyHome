import PlanSuggestions from './PlanSuggestions';
import PlanEditor from './PlanEditor';
import ApplyPlanDialog from './ApplyPlanDialog';
import { MusclePreview } from './EinheitenListShared';

// Pläne zeigen die Einheiten als kompakte Bildvorschau — exakt dieselbe
// runde Vorschau wie in der Einheiten-Bibliothek. Die gespeicherten
// muscle_groups sind bewusst der Snapshot des Plans und bleiben damit
// stabil, wenn eine eigene Einheit später geändert wird.
function PlanUnitImages({ items }) {
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
          <MusclePreview tags={item.muscle_groups} />
        </div>
      ))}
    </div>
  );
}

// Drei Zustände: Liste (Standard), Editor (Vorlage bauen/bearbeiten),
// Anwenden-Dialog. Neuanlegen läuft über den FAB (SportQuickSheet,
// Modus "Trainingsplan") — "Bearbeiten" bestehender Pläne bleibt hier.
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

                <PlanUnitImages items={plan.items} />

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
