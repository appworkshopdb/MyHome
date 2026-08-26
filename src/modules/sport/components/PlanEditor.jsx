import { useState } from 'react';
import { resolveTypeLabel } from '../lib/typeLabel';

// Baukasten für eine Mehrtages-Vorlage. KONZEPT-ÄNDERUNG: ein Tag wählt
// jetzt eine bestehende Einheit aus der Bibliothek (spo_units) statt
// Titel/Typ frei einzutippen — "ein Trainingsplan besteht aus mehreren
// Trainingseinheiten". Titel/Typ werden beim Auswählen als Snapshot auf
// den Tag übernommen, damit ein späteres Bearbeiten der Einheit
// bestehende Pläne nicht rückwirkend verändert. Die Dauer bleibt pro
// Tag überschreibbar (dieselbe Einheit kann an verschiedenen Tagen
// unterschiedlich lang dauern). Ruhetage bleiben wie bisher eigene Tage
// ohne Einheit — sie verschieben nur die Folgetage.
export default function PlanEditor({ initialPlan, units = [], onSave, onCancel, showToast }) {
  const [title, setTitle] = useState(initialPlan?.title ?? '');
  const [notes, setNotes] = useState(initialPlan?.notes ?? '');
  const [days, setDays] = useState(
    initialPlan?.items?.length
      ? initialPlan.items.map((i) => ({
          unit_id: i.unit_id ?? '', title: i.title ?? '', type_key: i.type_key ?? '',
          duration_min: i.duration_min != null ? String(i.duration_min) : '',
          is_rest: i.is_rest,
        }))
      : [{ unit_id: '', title: '', type_key: '', duration_min: '', is_rest: false }]
  );

  function updateDay(index, patch) {
    setDays(days.map((d, i) => (i === index ? { ...d, ...patch } : d)));
  }

  function handleUnitChange(index, unitId) {
    const unit = units.find((u) => u.id === unitId);
    updateDay(index, {
      unit_id: unitId,
      title: unit?.title ?? '',
      type_key: unit?.type_key ?? '',
      duration_min: unit?.duration_min != null ? String(unit.duration_min) : '',
    });
  }

  function addDay(isRest) {
    setDays([...days, { unit_id: '', title: isRest ? 'Ruhetag' : '', type_key: '', duration_min: '', is_rest: isRest }]);
  }

  function removeDay(index) {
    setDays(days.filter((_, i) => i !== index));
  }

  function moveDay(index, delta) {
    const target = index + delta;
    if (target < 0 || target >= days.length) return;
    const next = [...days];
    [next[index], next[target]] = [next[target], next[index]];
    setDays(next);
  }

  function submit() {
    if (!title.trim()) return showToast('Bitte einen Namen für den Plan eingeben');
    if (days.length === 0) return showToast('Der Plan braucht mindestens einen Tag');

    const missing = days.some((d) => !d.is_rest && !d.unit_id);
    if (missing) return showToast('Bitte jedem Trainingstag eine Einheit zuweisen');

    onSave(
      { ...(initialPlan?.id ? { id: initialPlan.id } : {}), title: title.trim(), notes: notes.trim() || null },
      days.map((d) => ({
        unit_id: d.is_rest ? null : d.unit_id,
        title: d.is_rest ? (d.title.trim() || 'Ruhetag') : d.title,
        type_key: d.is_rest ? null : (d.type_key || null),
        duration_min: d.duration_min === '' ? null : parseInt(d.duration_min, 10),
        is_rest: d.is_rest,
      }))
    );
  }

  const trainingDays = days.filter((d) => !d.is_rest).length;

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

      {units.length === 0 && (
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
          Noch keine Einheiten angelegt — im Einheiten-Tab lassen sich welche erstellen,
          bevor hier Trainingstage damit befüllt werden können.
        </p>
      )}

      <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: '12px 0 8px' }}>
        {days.length} Tage · {trainingDays} Trainingseinheiten · {days.length - trainingDays} Ruhetage
      </div>

      {days.map((day, index) => (
        <div
          key={index}
          style={{
            padding: 10, marginBottom: 8, borderRadius: 'var(--radius-xs)',
            background: day.is_rest ? 'var(--bg-input)' : 'var(--bg-secondary)',
            border: '1.5px solid var(--border)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
            <strong style={{ fontSize: '0.85rem' }}>Tag {index + 1}{day.is_rest ? ' · Ruhetag' : ''}</strong>
            <div style={{ display: 'flex', gap: 4 }}>
              <button className="btn btn-secondary" onClick={() => moveDay(index, -1)} disabled={index === 0}>↑</button>
              <button className="btn btn-secondary" onClick={() => moveDay(index, 1)} disabled={index === days.length - 1}>↓</button>
              <button className="btn btn-secondary" onClick={() => removeDay(index)}>×</button>
            </div>
          </div>

          {!day.is_rest && (
            <>
              <select
                value={day.unit_id}
                onChange={(e) => handleUnitChange(index, e.target.value)}
                style={{ marginBottom: 6 }}
              >
                <option value="">Einheit wählen…</option>
                {units.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.title}{resolveTypeLabel(u.type_key) ? ` (${resolveTypeLabel(u.type_key)})` : ''}
                  </option>
                ))}
              </select>
              {day.unit_id && (
                <input
                  type="number" value={day.duration_min} min="0" max="1440"
                  onChange={(e) => updateDay(index, { duration_min: e.target.value })}
                  placeholder="Dauer an diesem Tag (Min.)"
                />
              )}
            </>
          )}
        </div>
      ))}

      <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
        <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => addDay(false)}>+ Trainingstag</button>
        <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => addDay(true)}>+ Ruhetag</button>
      </div>

      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 12 }}>
        <button className="btn btn-secondary" onClick={onCancel}>Abbrechen</button>
        <button className="btn btn-primary" onClick={submit}>Speichern</button>
      </div>
    </div>
  );
}
