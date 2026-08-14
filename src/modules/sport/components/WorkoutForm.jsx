import { useState } from 'react';
import { TRAINING_TYPES } from '../lib/data/trainingTypes';

const TODAY = () => new Date().toISOString().slice(0, 10);

// Direktes Eintragen: die Einheit ist beim Speichern bereits
// abgeschlossen (kein Start/Stop-Zustand), siehe Konzept-Entscheidung
// "nur die Einheit als Ganzes, nicht Satz für Satz". type_key ist
// optional — "frei starten, Typ optional später".
export default function WorkoutForm({ onSave, onCancel, showToast }) {
  const [occurredOn, setOccurredOn] = useState(TODAY());
  const [typeKey, setTypeKey] = useState('');
  const [title, setTitle] = useState('');
  const [durationMin, setDurationMin] = useState('');
  const [notes, setNotes] = useState('');

  function handleTypeChange(key) {
    setTypeKey(key);
    // Titel nur vorbelegen, wenn er noch nicht manuell verändert wurde —
    // sonst überschreibt eine spätere Typ-Auswahl einen bereits
    // eingetippten eigenen Titel.
    if (!title) {
      const type = TRAINING_TYPES.find((t) => t.key === key);
      if (type) setTitle(type.label);
    }
  }

  function submit() {
    if (!title.trim()) return showToast('Bitte Bezeichnung eingeben, z.B. "Push" oder "Brust/Bizeps"');
    const duration = durationMin === '' ? null : parseInt(durationMin, 10);
    if (duration !== null && (isNaN(duration) || duration < 0 || duration > 1440)) {
      return showToast('Bitte gültige Dauer eingeben (0–1440 Minuten)');
    }
    onSave({
      occurred_on: occurredOn,
      type_key: typeKey || 'sonstiges',
      title: title.trim(),
      duration_min: duration,
      notes: notes.trim() || null,
    });
  }

  return (
    <div className="card">
      <div className="card-title">Training eintragen</div>

      <div className="form-row">
        <div className="form-group">
          <label>Datum</label>
          <input type="date" value={occurredOn} onChange={(e) => setOccurredOn(e.target.value)} />
        </div>
        <div className="form-group">
          <label>Dauer (Min.)</label>
          <input type="number" value={durationMin} onChange={(e) => setDurationMin(e.target.value)} min="0" max="1440" placeholder="z.B. 60" />
        </div>
      </div>

      <div className="form-group">
        <label>Trainingstyp (optional)</label>
        <select value={typeKey} onChange={(e) => handleTypeChange(e.target.value)}>
          <option value="">Frei / kein Typ</option>
          {TRAINING_TYPES.map((t) => (
            <option key={t.key} value={t.key}>{t.label}</option>
          ))}
        </select>
      </div>

      <div className="form-group">
        <label>Bezeichnung</label>
        <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="z.B. Push, Brust/Bizeps, Lauf..." />
      </div>

      <div className="form-group">
        <label>Notiz (optional)</label>
        <input type="text" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="z.B. gut lief's, Knie gespürt..." />
      </div>

      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 4 }}>
        <button className="btn btn-secondary" onClick={onCancel}>Abbrechen</button>
        <button className="btn btn-primary" onClick={submit}>Speichern</button>
      </div>
    </div>
  );
}
