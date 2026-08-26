import PlanSuggestions from './PlanSuggestions';
import PlanEditor from './PlanEditor';
import ApplyPlanDialog from './ApplyPlanDialog';

// Drei Zustände in einem Tab: Liste (Standard), Editor (Vorlage bauen/
// bearbeiten), Anwenden-Dialog. Der jeweilige Zustand kommt von
// SportModule, weil das Anwenden anschließend in den Kalender wechselt.
export default function PlaeneView({
  session, plans, units, loading, userSports,
  editing, applying,
  onNewPlan, onEditPlan, onDeletePlan, onSavePlan, onCancelEdit,
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
      <button className="btn btn-primary" style={{ width: '100%', marginBottom: 12 }} onClick={onNewPlan}>
        + Trainingsplan erstellen
      </button>

      <div className="card">
        <div className="card-title">Deine Pläne</div>
        {loading ? (
          <p style={{ color: 'var(--text-secondary)', margin: 0 }}>Lädt…</p>
        ) : plans.length === 0 ? (
          <p style={{ color: 'var(--text-secondary)', margin: 0 }}>
            Noch kein eigener Plan. Erstelle eine Vorlage aus mehreren Tagen und
            trage sie ab einem beliebigen Starttag in den Kalender ein.
          </p>
        ) : (
          plans.map((plan) => {
            const trainingDays = plan.items.filter((i) => !i.is_rest).length;
            return (
              <div key={plan.id} className="row-actions">
                <div className="row-actions-info">
                  <div style={{ fontWeight: 600 }}>{plan.title}</div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                    {plan.items.length} Tage · {trainingDays} Einheiten
                  </div>
                  {plan.notes && (
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: 2 }}>{plan.notes}</div>
                  )}
                </div>
                <div className="row-actions-buttons">
                  <button className="btn btn-primary" onClick={() => onOpenApply(plan)}>Eintragen</button>
                  <button className="btn btn-secondary" onClick={() => onEditPlan(plan)}>Bearbeiten</button>
                  <button className="btn btn-secondary" onClick={() => onDeletePlan(plan.id)}>×</button>
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
