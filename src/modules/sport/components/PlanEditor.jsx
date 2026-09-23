import { useState } from 'react';
import PlanDaysEditor from './PlanDaysEditor';

// Baukasten für eine Mehrtages-Vorlage — für das nachträgliche
// Bearbeiten eines bereits angelegten Plans (Pläne-Liste → "Bearbeiten").
// Das eigentliche Neuanlegen läuft über den FAB (SportQuickSheet.jsx,
// Schritt 2 nutzt dieselbe PlanDaysEditor-Komponente) — beide teilen
// sich damit dieselbe Einheiten-Auswahl UND denselben Muskel-Snapshot.
export default function PlanEditor({ initialPlan, units = [], onSave, onCancel, showToast }) {
  const [title, setTitle] = useState(initialPlan?.title ?? '');
  const [notes, setNotes] = useState(initialPlan?.notes ?? '');
  const [days, setDays] = useState(
    initialPlan?.items?.length
      ? initialPlan.items.map((i) => ({
          unit_id: i.unit_id ?? '', title: i.title ?? '', type_key: i.type_key ?? '',
          duration_min: i.duration_min != null ? String(i.duration_min) : '',
          muscle_groups: i.muscle_groups ?? [],
          is_rest: i.is_rest,
        }))
      : [{ unit_id: '', title: '', type_key: '', duration_min: '', muscle_groups: [], is_rest: false }]
  );

  function submit() {
    if (!title.trim()) return showToast('Bitte einen Namen für den Plan eingeben');
    if (days.length === 0) return showToast('Der Plan braucht mindestens einen Tag');

    const missing = days.some((d) => !d.is_rest && !d.unit_id && !d._selectedUnitKey);
    if (missing) return showToast('Bitte jedem Trainingstag eine Einheit zuweisen');

    onSave(
      { ...(initialPlan?.id ? { id: initialPlan.id } : {}), title: title.trim(), notes: notes.trim() || null },
      days.map((d) => ({
        unit_id: d.is_rest ? null : (d.unit_id || null),
        title: d.is_rest ? (d.title.trim() || 'Ruhetag') : d.title,
        type_key: d.is_rest ? null : (d.type_key || null),
        duration_min: d.duration_min === '' ? null : parseInt(d.duration_min, 10),
        muscle_groups: d.is_rest ? [] : (d.muscle_groups ?? []),
        is_rest: d.is_rest,
      }))
    );
  }

  return (
    <div className="card">
      <div className="card-title">{initialPlan?.id ? 'Plan bearbeiten' : 'Neuer Trainingsplan'}</div>

      <div className="form-group">
        <label>Name</label>
        <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="z.B. Ganzkörper 5 Tage" />
      </div>

      <div className="form-group">
        <label>Notiz (optional)</label>
        <input type="text" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="z.B. für Einsteiger, 3× pro Woche" />
      </div>

      <PlanDaysEditor days={days} onChange={setDays} units={units} />

      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 12 }}>
        <button className="btn btn-secondary" onClick={onCancel}>Abbrechen</button>
        <button className="btn btn-primary" onClick={submit}>Speichern</button>
      </div>
    </div>
  );
}
