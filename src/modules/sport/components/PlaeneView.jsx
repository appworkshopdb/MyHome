import PlanSuggestions from './PlanSuggestions';
import PlanEditor from './PlanEditor';
import ApplyPlanDialog from './ApplyPlanDialog';
import { EinheitRow } from './EinheitenListShared';

// Drei Zustände: Liste (Standard), Editor (Vorlage bauen/bearbeiten),
// Anwenden-Dialog. Neuanlegen läuft über den FAB (SportQuickSheet,
// Modus "Trainingsplan") — "Bearbeiten" bestehender Pläne bleibt hier.
//
// Jeder Plan zeigt jetzt zusätzlich zur Tage/Einheiten-Zusammenfassung
// die komplette Tagesliste mit derselben Muskel-Vorschau wie in
// EinheitenView (EinheitenListShared.jsx) — Ruhetage ohne Bild-Cluster,
// da sie keine Muskeln trainieren.
//
// Achtung: Pläne, die VOR der muscle_groups-Migration auf
// spo_plan_items angelegt wurden, haben leere Tags und zeigen deshalb
// (noch) keine Bilder — kein rückwirkendes Befüllen, erst beim
// nächsten Speichern des Plans entsteht der Snapshot.
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
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8, marginBottom: 8 }}>
                  <div>
                    <div style={{ fontWeight: 600 }}>{plan.title}</div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                      {plan.items.length} Tage · {trainingDays} Einheiten
                    </div>
                    {plan.notes && (
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: 2 }}>{plan.notes}</div>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                    <button className="btn btn-primary" onClick={() => onOpenApply(plan)}>Eintragen</button>
                    <button className="btn btn-secondary" onClick={() => onEditPlan(plan)}>Bearbeiten</button>
                    <button className="btn btn-secondary" onClick={() => onDeletePlan(plan.id)}>×</button>
                  </div>
                </div>

                <div style={{ background: '#fff', borderRadius: 12, padding: '0 12px' }}>
                  {plan.items.map((item, i) => (
                    <EinheitRow
                      key={item.id ?? i}
                      title={`Tag ${i + 1} · ${item.title}`}
                      subtitle={item.is_rest ? 'Ruhetag' : (item.duration_min ? `${item.duration_min} Min.` : '')}
                      tags={item.is_rest ? [] : item.muscle_groups}
                      isLast={i === plan.items.length - 1}
                    />
                  ))}
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
