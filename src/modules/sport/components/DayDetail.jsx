import { formatRelativeDate } from '../../../core/lib/format';
import { resolveTypeLabel } from '../lib/typeLabel';
import { IconCheck, IconEdit, IconTrash } from '../../../core/components/Icons';

// Zeigt alle Einheiten des gewählten Tages. Das Abhaken passiert direkt
// hier über die Checkbox (Konzept-Entscheidung) — ein Klick genügt,
// kein Umweg über das Formular. Der DB-Trigger übernimmt daraufhin die
// Auswertungs-Kennzahlen.
export default function DayDetail({ date, workouts, plans, onToggleDone, onEdit, onDelete, onPlanNew, onPickPlan }) {
  const dayWorkouts = workouts.filter((w) => w.occurred_on === date);

  // "Tag X von Y" nur berechenbar, wenn plan_day_index gesetzt ist
  // (erst seit dieser Migration) UND der zugehörige Plan noch existiert
  // (nicht gelöscht wurde) — sonst bewusst kein Fortschritt anzeigen
  // statt zu raten.
  function planProgress(w) {
    if (w.plan_id == null || w.plan_day_index == null) return null;
    const plan = plans?.find((p) => p.id === w.plan_id);
    if (!plan) return null;
    return `Tag ${w.plan_day_index + 1} von ${plan.items.length} · ${plan.title}`;
  }

  return (
    <div className="card">
      <div className="card-title">{formatRelativeDate(date)}</div>

      {dayWorkouts.length === 0 ? (
        <p style={{ color: 'var(--text-secondary)', marginTop: 0 }}>Keine Einheit an diesem Tag.</p>
      ) : (
        dayWorkouts.map((w) => {
          // Ruhetag: eigene, bewusst ruhigere Darstellung — kein
          // Abhaken (es gibt nichts zu erledigen) und kein Bearbeiten
          // (WorkoutForm kennt is_rest nicht, würde es beim Speichern
          // verlieren). Löschen bleibt möglich, falls der Tag doch
          // Training bekommen soll.
          if (w.is_rest) {
            return (
              <div
                key={w.id}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '10px 0', borderBottom: '1px solid var(--border)',
                  color: 'var(--text-secondary)',
                }}
              >
                <div style={{
                  width: 26, height: 26, flexShrink: 0, borderRadius: 'var(--radius-xs)',
                  background: 'var(--border-strong)',
                }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600 }}>{w.title}</div>
                  {planProgress(w) && (
                    <div style={{ fontSize: '0.75rem', opacity: 0.85 }}>{planProgress(w)}</div>
                  )}
                </div>
                <button className="btn btn-secondary" onClick={() => onDelete(w.id)} aria-label="Löschen"><IconTrash /></button>
              </div>
            );
          }

          const done = w.status === 'done';
          const typeLabel = resolveTypeLabel(w.type_key);
          return (
            <div
              key={w.id}
              style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '10px 0', borderBottom: '1px solid var(--border)',
              }}
            >
              <button
                onClick={() => onToggleDone(w)}
                aria-label={done ? 'Als offen markieren' : 'Als erledigt markieren'}
                style={{
                  width: 26, height: 26, flexShrink: 0, cursor: 'pointer',
                  borderRadius: 'var(--radius-xs)', padding: 0,
                  border: done ? 'none' : '2px solid var(--border-strong)',
                  background: done ? 'var(--accent)' : 'transparent',
                  color: 'var(--on-accent)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
              >
                {done && <IconCheck />}
              </button>

              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, textDecoration: done ? 'none' : 'none' }}>{w.title}</div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                  {done ? 'Erledigt' : 'Geplant'}
                  {w.duration_min ? ` · ${w.duration_min} Min.` : ''}
                  {typeLabel ? ` · ${typeLabel}` : ''}
                </div>
                {w.notes && (
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: 2 }}>{w.notes}</div>
                )}
                {planProgress(w) && (
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 2 }}>{planProgress(w)}</div>
                )}
              </div>

              <button className="btn btn-secondary" onClick={() => onEdit(w)} aria-label="Bearbeiten"><IconEdit /></button>
              <button className="btn btn-secondary" onClick={() => onDelete(w.id)} aria-label="Löschen"><IconTrash /></button>
            </div>
          );
        })
      )}

      <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
        <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => onPlanNew(date)}>
          + Einzelne Einheit
        </button>
        <button className="btn btn-primary" style={{ flex: 1 }} onClick={() => onPickPlan(date)}>
          + Trainingsplan
        </button>
      </div>
    </div>
  );
}
