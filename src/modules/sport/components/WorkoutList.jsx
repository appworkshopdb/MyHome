import { formatRelativeDate } from '../../../core/lib/format';
import { getTrainingType } from '../lib/data/trainingTypes';

// Nutzt formatRelativeDate aus core/lib/format.js — bewusst nicht neu
// implementiert, das ist die zentrale, modulunabhängige Formatierung.
export default function WorkoutList({ workouts, onDelete }) {
  if (workouts.length === 0) {
    return (
      <div className="card">
        <p style={{ color: 'var(--text-secondary)', margin: 0 }}>
          Noch keine Einheiten eingetragen.
        </p>
      </div>
    );
  }

  return (
    <div className="card" style={{ padding: 0 }}>
      {workouts.map((w) => {
        const type = getTrainingType(w.type_key);
        return (
          <div
            key={w.id}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '12px 16px', borderBottom: '1px solid var(--border)',
            }}
          >
            <div>
              <div style={{ fontWeight: 600 }}>{w.title}</div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                {formatRelativeDate(w.occurred_on)}
                {w.duration_min ? ` · ${w.duration_min} Min.` : ''}
                {type ? ` · ${type.label}` : ''}
              </div>
              {w.notes && (
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: 2 }}>{w.notes}</div>
              )}
            </div>
            <button className="btn btn-secondary" onClick={() => onDelete(w.id)}>Löschen</button>
          </div>
        );
      })}
    </div>
  );
}
