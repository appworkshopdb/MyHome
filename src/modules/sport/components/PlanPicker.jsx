// Zeigt die eigenen Vorlagen zur Auswahl, wenn im Kalender "+
// Trainingsplan" angetippt wurde. Bewusst schlank (nur Titel + Anzahl
// Tage) — die ausführliche Vorschau mit Wochentagen kommt erst danach
// im ApplyPlanDialog, sobald ein Plan gewählt ist.
export default function PlanPicker({ plans, onChoose, onCancel }) {
  return (
    <div className="card">
      <div className="card-title">Plan wählen</div>

      {plans.length === 0 ? (
        <p style={{ color: 'var(--text-secondary)', margin: 0 }}>
          Noch kein Trainingsplan angelegt. Im Pläne-Tab lässt sich eine Vorlage erstellen.
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
              </div>
              <div className="row-actions-buttons">
                <button className="btn btn-primary" onClick={() => onChoose(plan)}>Wählen</button>
              </div>
            </div>
          );
        })
      )}

      <button className="btn btn-secondary" style={{ width: '100%', marginTop: 12 }} onClick={onCancel}>
        Abbrechen
      </button>
    </div>
  );
}
