import { useState } from 'react';
import { TRAINING_TYPES, TRAINING_TYPE_GROUPS, trainingTypesByGroup } from '../lib/data/trainingTypes';
import { getSport, sportTypeKey, sportFromTypeKey } from '../../../core/lib/sportsData';
import MuscleGroupSelect from './MuscleGroupSelect';

// Eine Einheit ist die kleinste wiederverwendbare Vorlage — Titel, Typ,
// Richtwert-Dauer, trainierte Muskeln (fürs Bild, welche Bereiche eine
// Einheit abdeckt — siehe muscleGroups.js für die drei Ebenen). Kein
// Datum, kein Status: das kommt erst, wenn die Einheit tatsächlich in
// den Kalender eingetragen wird (direkt oder als Teil eines Plans,
// siehe PlanEditor.jsx).
export default function UnitEditor({ initialUnit, userSports = [], onSave, onCancel, showToast }) {
  const [title, setTitle] = useState(initialUnit?.title ?? '');
  const [typeKey, setTypeKey] = useState(initialUnit?.type_key ?? '');
  const [durationMin, setDurationMin] = useState(initialUnit?.duration_min != null ? String(initialUnit.duration_min) : '');
  const [muscleGroups, setMuscleGroups] = useState(initialUnit?.muscle_groups ?? []);

  function handleTypeChange(key) {
    setTypeKey(key);
    if (!title) {
      const label = TRAINING_TYPES.find((t) => t.key === key)?.label ?? sportFromTypeKey(key)?.label;
      if (label) setTitle(label);
    }
  }

  function submit() {
    if (!title.trim()) return showToast('Bitte einen Namen für die Einheit eingeben');
    onSave({
      ...(initialUnit?.id ? { id: initialUnit.id } : {}),
      title: title.trim(),
      type_key: typeKey || null,
      duration_min: durationMin === '' ? null : parseInt(durationMin, 10),
      muscle_groups: muscleGroups,
    });
  }

  return (
    <div className="card">
      <div className="card-title">{initialUnit?.id ? 'Einheit bearbeiten' : 'Neue Einheit'}</div>

      <div className="form-group">
        <label>Trainingstyp (optional)</label>
        <select value={typeKey} onChange={(e) => handleTypeChange(e.target.value)}>
          <option value="">Frei / kein Typ</option>
          {TRAINING_TYPE_GROUPS.map((group) => (
            <optgroup key={group} label={group}>
              {trainingTypesByGroup(group).map((t) => (
                <option key={t.key} value={t.key}>{t.label}</option>
              ))}
            </optgroup>
          ))}
          {userSports.length > 0 && (
            <optgroup label="Deine Sportarten">
              {userSports.map((key) => {
                const sport = getSport(key);
                if (!sport) return null;
                return <option key={key} value={sportTypeKey(key)}>{sport.label}</option>;
              })}
            </optgroup>
          )}
        </select>
      </div>

      <div className="form-row">
        <div className="form-group">
          <label>Bezeichnung</label>
          <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="z.B. Arme, Legday..." />
        </div>
        <div className="form-group">
          <label>Dauer (Min., optional)</label>
          <input type="number" value={durationMin} onChange={(e) => setDurationMin(e.target.value)} min="0" max="1440" placeholder="z.B. 60" />
        </div>
      </div>

      <MuscleGroupSelect value={muscleGroups} onChange={setMuscleGroups} />

      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 4 }}>
        <button className="btn btn-secondary" onClick={onCancel}>Abbrechen</button>
        <button className="btn btn-primary" onClick={submit}>Speichern</button>
      </div>
    </div>
  );
}
