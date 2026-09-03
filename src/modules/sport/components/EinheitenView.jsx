import UnitEditor from './UnitEditor';
import { resolveTypeLabel } from '../lib/typeLabel';
import { getMuscleVisual, muscleImagePath } from '../lib/data/muscleGroups';

// Frühere "Training"-Ansicht (direktes Eintragen einer Einheit) wurde
// hierzu — einzelne Trainingseinheiten sind jetzt eine eigene, wieder-
// verwendbare Bibliothek. Ins Kalender eingetragen wird weiterhin über
// den Kalender-Tab selbst ("+ Einzelne Einheit"), das Anlegen einer
// wiederverwendbaren Vorlage passiert hier.
export default function EinheitenView({ units, loading, userSports, editing, onNewUnit, onEditUnit, onDeleteUnit, onSaveUnit, onCancelEdit, showToast }) {
  if (editing) {
    return (
      <div className="page">
        <UnitEditor
          initialUnit={editing.id ? editing : null}
          userSports={userSports}
          onSave={onSaveUnit}
          onCancel={onCancelEdit}
          showToast={showToast}
        />
      </div>
    );
  }

  return (
    <div className="page">
      <button className="btn btn-primary" style={{ width: '100%', marginBottom: 12 }} onClick={onNewUnit}>
        + Einheit erstellen
      </button>

      <div className="card">
        <div className="card-title">Deine Einheiten</div>
        {loading ? (
          <p style={{ color: 'var(--text-secondary)', margin: 0 }}>Lädt…</p>
        ) : units.length === 0 ? (
          <p style={{ color: 'var(--text-secondary)', margin: 0 }}>
            Noch keine Einheit angelegt. Eine Einheit ist ein einzelnes Training
            wie „Arme" oder „Legday" — im Pläne-Tab setzt du daraus später
            einen Mehrtages-Plan zusammen.
          </p>
        ) : (
          units.map((unit) => (
            <div key={unit.id} className="row-actions">
              <div className="row-actions-info">
                <div style={{ fontWeight: 600 }}>{unit.title}</div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                  {resolveTypeLabel(unit.type_key) ?? 'Kein Typ'}
                  {unit.duration_min ? ` · ${unit.duration_min} Min.` : ''}
                </div>
                {/* Fehlt ein Bild (noch nicht hochgeladen), blendet sich
                    die Miniatur per onError unsichtbar aus statt als
                    kaputtes Icon zu erscheinen. */}
                {unit.muscle_groups?.length > 0 && (
                  <div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
                    {unit.muscle_groups.map((key) => {
                      const m = getMuscleVisual(key);
                      if (!m) return null;
                      return (
                        <img
                          key={key} src={muscleImagePath(m)} alt=""
                          style={{ width: 22, height: 22, borderRadius: 4, objectFit: 'cover', border: '1px solid var(--border)' }}
                          onError={(e) => { e.currentTarget.style.display = 'none'; }}
                        />
                      );
                    })}
                  </div>
                )}
              </div>
              <div className="row-actions-buttons">
                <button className="btn btn-secondary" onClick={() => onEditUnit(unit)}>Bearbeiten</button>
                <button className="btn btn-secondary" onClick={() => onDeleteUnit(unit.id)}>×</button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
