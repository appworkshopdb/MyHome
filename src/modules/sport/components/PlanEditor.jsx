import { useState } from 'react';
import { TRAINING_TYPES } from '../lib/data/trainingTypes';
import { getSport, sportTypeKey, sportFromTypeKey } from '../../../core/lib/sportsData';

// Baukasten für eine Mehrtages-Vorlage. Die Länge ergibt sich aus der
// Anzahl der Tage — 5, 7, 8 Tage sind gleichermaßen möglich, es gibt
// keine feste Wochenstruktur. Ruhetage sind eigene Tage, weil sie die
// Folgetage verschieben (ein 5-Tage-Plan mit Ruhetag in der Mitte
// erstreckt sich über 5 Kalendertage).
export default function PlanEditor({ initialPlan, userSports = [], onSave, onCancel, showToast }) {
  const [title, setTitle] = useState(initialPlan?.title ?? '');
  const [notes, setNotes] = useState(initialPlan?.notes ?? '');
  const [days, setDays] = useState(
    initialPlan?.items?.length
      ? initialPlan.items.map((i) => ({
          title: i.title ?? '', type_key: i.type_key ?? '',
          duration_min: i.duration_min != null ? String(i.duration_min) : '',
          is_rest: i.is_rest,
        }))
      : [{ title: '', type_key: '', duration_min: '', is_rest: false }]
  );

  function updateDay(index, patch) {
    setDays(days.map((d, i) => (i === index ? { ...d, ...patch } : d)));
  }

  function handleTypeChange(index, key) {
    const label = TRAINING_TYPES.find((t) => t.key === key)?.label ?? sportFromTypeKey(key)?.label;
    // Titel mitziehen, solange der Nutzer keinen eigenen gesetzt hat.
    const patch = { type_key: key };
    if (!days[index].title && label) patch.title = label;
    updateDay(index, patch);
  }

  function addDay(isRest) {
    setDays([...days, { title: isRest ? 'Ruhetag' : '', type_key: '', duration_min: '', is_rest: isRest }]);
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

    const missing = days.some((d) => !d.is_rest && !d.title.trim());
    if (missing) return showToast('Bitte jedem Trainingstag eine Bezeichnung geben');

    onSave(
      { ...(initialPlan?.id ? { id: initialPlan.id } : {}), title: title.trim(), notes: notes.trim() || null },
      days.map((d) => ({
        title: d.is_rest ? (d.title.trim() || 'Ruhetag') : d.title.trim(),
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
                value={day.type_key}
                onChange={(e) => handleTypeChange(index, e.target.value)}
                style={{ marginBottom: 6 }}
              >
                <option value="">Frei / kein Typ</option>
                <optgroup label="Training">
                  {TRAINING_TYPES.map((t) => (
                    <option key={t.key} value={t.key}>{t.label}</option>
                  ))}
                </optgroup>
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
              <div style={{ display: 'flex', gap: 6 }}>
                <input
                  type="text" value={day.title} style={{ flex: 2 }}
                  onChange={(e) => updateDay(index, { title: e.target.value })}
                  placeholder="Bezeichnung, z.B. Push"
                />
                <input
                  type="number" value={day.duration_min} style={{ flex: 1 }} min="0" max="1440"
                  onChange={(e) => updateDay(index, { duration_min: e.target.value })}
                  placeholder="Min."
                />
              </div>
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
