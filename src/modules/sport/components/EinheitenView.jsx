import UnitEditor from './UnitEditor';
import { resolveTypeLabel } from '../lib/typeLabel';
import { getMuscleVisual, muscleImagePath } from '../lib/data/muscleGroups';
import { PREDEFINED_UNITS } from '../lib/data/predefinedUnits';

// Frühere "Training"-Ansicht (direktes Eintragen einer Einheit) wurde
// hierzu — einzelne Trainingseinheiten sind jetzt eine eigene, wieder-
// verwendbare Bibliothek. Ins Kalender eingetragen wird weiterhin über
// den Kalender-Tab selbst ("+ Einzelne Einheit"), das Anlegen einer
// wiederverwendbaren Vorlage passiert hier.
//
// ZWEI QUELLEN, bewusst unterschiedlich dargestellt:
//   Vordefinierte Einheiten (PREDEFINED_UNITS) — statisch, für jeden
//   Nutzer sofort da (kein DB-Seeding), MIT Bild-Vorschau (die Tags
//   entsprechen 1:1 den Keys aus muscleGroups.js). "Übernehmen" öffnet
//   den Editor vorbefüllt, damit man vor dem Speichern noch Titel/
//   Dauer anpassen kann.
//   Deine Einheiten (spo_units) — persönlich, OHNE Bild-Vorschau in
//   dieser Liste (bewusst entfernt), weiterhin frei bearbeitbar/löschbar.
export default function EinheitenView({ units, loading, userSports, editing, onNewUnit, onAdoptPredefined, onEditUnit, onDeleteUnit, onSaveUnit, onCancelEdit, showToast }) {
  if (editing) {
    return (
      <div className="page">
        <UnitEditor
          initialUnit={editing}
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
        <div className="card-title">Vordefinierte Einheiten</div>
        {PREDEFINED_UNITS.map((preset) => (
          <div key={preset.key} className="row-actions">
            <div className="row-actions-info">
              <div style={{ fontWeight: 600 }}>{preset.title}</div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                {resolveTypeLabel(preset.type_key) ?? 'Kein Typ'}
              </div>
              {preset.muscle_groups.length > 0 && (
                <div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
                  {preset.muscle_groups.map((key) => {
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
              <button className="btn btn-secondary" onClick={() => onAdoptPredefined(preset)}>Übernehmen</button>
            </div>
          </div>
        ))}
      </div>

      <div className="card">
        <div className="card-title">Deine Einheiten</div>
        {loading ? (
          <p style={{ color: 'var(--text-secondary)', margin: 0 }}>Lädt…</p>
        ) : units.length === 0 ? (
          <p style={{ color: 'var(--text-secondary)', margin: 0 }}>
            Noch keine eigene Einheit angelegt. Eine vordefinierte oben
            übernehmen oder eine komplett neue erstellen.
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
