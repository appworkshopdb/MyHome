import { useState } from 'react';
import { TRAINING_TYPES, TRAINING_TYPE_GROUPS, trainingTypesByGroup } from '../lib/data/trainingTypes';
import { getSport, sportTypeKey, sportFromTypeKey } from '../../../core/lib/sportsData';

const TODAY = () => new Date().toISOString().slice(0, 10);

// Eine Einheit wird als Ganzes erfasst (kein Satz-für-Satz-Log).
// initialValues deckt drei Fälle ab:
//   - {}                       neue Einheit, heute, erledigt
//   - { occurred_on, status }  neue Einheit für einen Kalendertag
//   - vollständige Workout-Zeile (mit id) → Bearbeiten-Modus
// Der Status ist umschaltbar, weil eine Einheit sowohl vorausgeplant
// ('planned') als auch nachträglich eingetragen ('done') werden kann.
export default function WorkoutForm({ onSave, onCancel, showToast, initialValues, userSports = [] }) {
  const iv = initialValues ?? {};
  const isEdit = Boolean(iv.id);

  const [occurredOn, setOccurredOn] = useState(iv.occurred_on ?? TODAY());
  const [typeKey, setTypeKey] = useState(iv.type_key && iv.type_key !== 'sonstiges' ? iv.type_key : '');
  const [title, setTitle] = useState(iv.title ?? '');
  const [durationMin, setDurationMin] = useState(iv.duration_min != null ? String(iv.duration_min) : '');
  const [notes, setNotes] = useState(iv.notes ?? '');
  const [status, setStatus] = useState(iv.status ?? 'done');

  function handleTypeChange(key) {
    setTypeKey(key);
    // Titel nur vorbelegen, wenn er noch nicht gesetzt ist — sonst
    // überschreibt eine spätere Typ-Auswahl einen eigenen Titel.
    if (!title) {
      const label = TRAINING_TYPES.find((t) => t.key === key)?.label
        ?? sportFromTypeKey(key)?.label;
      if (label) setTitle(label);
    }
  }

  function submit() {
    if (!title.trim()) return showToast('Bitte Bezeichnung eingeben, z.B. "Push" oder "Brust/Bizeps"');
    const duration = durationMin === '' ? null : parseInt(durationMin, 10);
    if (duration !== null && (isNaN(duration) || duration < 0 || duration > 1440)) {
      return showToast('Bitte gültige Dauer eingeben (0–1440 Minuten)');
    }
    onSave({
      // id nur mitgeben, wenn vorhanden — sonst würde das Upsert eine
      // neue Zeile statt eines Updates erzeugen.
      ...(isEdit ? { id: iv.id } : {}),
      occurred_on: occurredOn,
      type_key: typeKey || 'sonstiges',
      title: title.trim(),
      duration_min: duration,
      notes: notes.trim() || null,
      status,
    });
  }

  return (
    <div className="card">
      <div className="card-title">{isEdit ? 'Training bearbeiten' : 'Training eintragen'}</div>

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
        <label>Status</label>
        {/* Bewusst inline gestylt statt mit .segmented: diese Klasse lebt
            in modules/nutrition/nutrition.css und wäre eine versteckte
            Abhängigkeit von Sport auf Ernährung (Architektur-Regel:
            Module importieren nie voneinander). */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
          {[['planned', 'Geplant'], ['done', 'Erledigt']].map(([key, label]) => (
            <button
              key={key}
              onClick={() => setStatus(key)}
              style={{
                padding: '10px 6px', borderRadius: 'var(--radius-xs)',
                border: `1.5px solid ${status === key ? 'var(--accent)' : 'var(--border)'}`,
                background: status === key ? 'var(--accent)' : 'var(--bg-secondary)',
                color: status === key ? 'var(--on-accent)' : 'var(--text-secondary)',
                fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer',
              }}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="form-group">
        <label>Trainingstyp (optional)</label>
        <select value={typeKey} onChange={(e) => handleTypeChange(e.target.value)}>
          <option value="">Frei / kein Typ</option>
          {/* Nach Gruppen (Kraft/Ausdauer/Beweglichkeit) statt einer
              flachen Liste — bei 20+ Typen sonst unlesbar. */}
          {TRAINING_TYPE_GROUPS.map((group) => (
            <optgroup key={group} label={group}>
              {trainingTypesByGroup(group).map((t) => (
                <option key={t.key} value={t.key}>{t.label}</option>
              ))}
            </optgroup>
          ))}
          {/* Nur die im Profil gewählten Sportarten — die volle Liste von
              70+ Einträgen wäre hier unbenutzbar. Wer Fußball spielt,
              sieht Fußball; wer nichts gewählt hat, sieht die Gruppe nicht. */}
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
