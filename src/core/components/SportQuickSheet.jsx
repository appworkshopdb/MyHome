import { useState } from 'react';
import { useAuth } from '../lib/AuthContext';
import * as db from '../../modules/sport/lib/spoData';
import { TRAINING_TYPES } from '../../modules/sport/lib/data/trainingTypes';

const TODAY = () => new Date().toISOString().slice(0, 10);

const MODES = [
  { key: 'training', label: '💪 Training' },
  { key: 'einheit',  label: '📋 Neue Einheit' },
  { key: 'plan',     label: '🗓 Trainingsplan' },
  { key: 'rest',     label: '😴 Restday' },
];

// Vereinfachte Typ-Gruppen für schnelle Auswahl
const TYPE_GROUPS = [
  { group: 'Kraft',    types: TRAINING_TYPES.filter((t) => t.group === 'Kraft').slice(0, 8) },
  { group: 'Ausdauer', types: TRAINING_TYPES.filter((t) => t.group === 'Ausdauer').slice(0, 6) },
  { group: 'Sonstige', types: TRAINING_TYPES.filter((t) => t.group === 'Sonstige' || !['Kraft','Ausdauer'].includes(t.group)).slice(0, 4) },
];

export default function SportQuickSheet({ onClose, onSaved }) {
  const { session } = useAuth();
  const [mode,    setMode]    = useState('training');
  const [title,   setTitle]   = useState('');
  const [typeKey, setTypeKey] = useState('');
  const [date,    setDate]    = useState(TODAY());
  const [duration, setDuration] = useState('');
  const [status,  setStatus]  = useState('done');  // done | planned
  const [planTitle, setPlanTitle] = useState('');
  const [saving,  setSaving]  = useState(false);
  const [error,   setError]   = useState('');

  function selectType(key, label) {
    setTypeKey(key);
    if (!title) setTitle(label);
  }

  async function submit() {
    setSaving(true); setError('');
    try {
      if (mode === 'training') {
        if (!title.trim()) { setError('Bitte Bezeichnung eingeben'); setSaving(false); return; }
        await db.saveWorkout(session, {
          occurred_on: date,
          type_key: typeKey || 'sonstiges',
          title: title.trim(),
          duration_min: duration ? parseInt(duration, 10) : null,
          status,
          is_rest: false,
        });
      } else if (mode === 'einheit') {
        if (!title.trim()) { setError('Bitte Bezeichnung eingeben'); setSaving(false); return; }
        await db.saveUnit(session, {
          title: title.trim(),
          type_key: typeKey || null,
          duration_min: duration ? parseInt(duration, 10) : null,
        });
      } else if (mode === 'plan') {
        if (!planTitle.trim()) { setError('Bitte Plan-Name eingeben'); setSaving(false); return; }
        await db.savePlan(session, { title: planTitle.trim(), notes: null }, []);
      } else if (mode === 'rest') {
        await db.saveWorkout(session, {
          occurred_on: date,
          type_key: null,
          title: 'Restday',
          duration_min: null,
          status: 'done',
          is_rest: true,
        });
      }
      onSaved?.();
      onClose();
    } catch (e) { setError('Speichern fehlgeschlagen'); }
    finally { setSaving(false); }
  }

  return (
    <div className="sheet-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="sheet">
        <div className="sheet-header">
          <span className="sheet-title">Sport eintragen</span>
          <button className="sheet-cancel" onClick={onClose}>Abbrechen</button>
        </div>

        <div className="qsheet-body">
          {/* Modus-Auswahl */}
          <div className="qsheet-mode-grid">
            {MODES.map((m) => (
              <button key={m.key} className={`qsheet-mode-btn ${mode === m.key ? 'active' : ''}`}
                onClick={() => setMode(m.key)}>{m.label}</button>
            ))}
          </div>

          {/* TRAINING */}
          {mode === 'training' && (
            <>
              <div className="qsheet-label">Status</div>
              <div className="qsheet-seg">
                <button className={status === 'done'    ? 'active' : ''} onClick={() => setStatus('done')}>Erledigt</button>
                <button className={status === 'planned' ? 'active' : ''} onClick={() => setStatus('planned')}>Geplant</button>
              </div>

              <div className="qsheet-label" style={{ marginTop: 14 }}>Datum</div>
              <input className="qsheet-input" type="date" value={date} onChange={(e) => setDate(e.target.value)} />

              <div className="qsheet-label" style={{ marginTop: 14 }}>Trainingstyp</div>
              {TYPE_GROUPS.map(({ group, types }) => (
                <div key={group} className="qsheet-type-group">
                  <div className="qsheet-type-group-label">{group}</div>
                  <div className="qsheet-chip-row">
                    {types.map((t) => (
                      <button key={t.key} className={`qsheet-chip ${typeKey === t.key ? 'active' : ''}`}
                        onClick={() => selectType(t.key, t.label)}>{t.label}</button>
                    ))}
                  </div>
                </div>
              ))}

              <input className="qsheet-input" style={{ marginTop: 14 }} type="text"
                placeholder="Bezeichnung (z.B. Push, Brust/Bizeps)"
                value={title} onChange={(e) => setTitle(e.target.value)} />

              <input className="qsheet-input" type="number" placeholder="Dauer in Minuten (optional)"
                value={duration} onChange={(e) => setDuration(e.target.value)} min="0" max="1440" />
            </>
          )}

          {/* EINHEIT */}
          {mode === 'einheit' && (
            <>
              <div className="qsheet-label">Trainingstyp</div>
              {TYPE_GROUPS.map(({ group, types }) => (
                <div key={group} className="qsheet-type-group">
                  <div className="qsheet-type-group-label">{group}</div>
                  <div className="qsheet-chip-row">
                    {types.map((t) => (
                      <button key={t.key} className={`qsheet-chip ${typeKey === t.key ? 'active' : ''}`}
                        onClick={() => selectType(t.key, t.label)}>{t.label}</button>
                    ))}
                  </div>
                </div>
              ))}
              <input className="qsheet-input" style={{ marginTop: 14 }} type="text"
                placeholder="Name der Einheit (z.B. Legday, Arme)"
                value={title} onChange={(e) => setTitle(e.target.value)} />
              <input className="qsheet-input" type="number" placeholder="Richtwert Dauer in Minuten (optional)"
                value={duration} onChange={(e) => setDuration(e.target.value)} min="0" max="1440" />
            </>
          )}

          {/* PLAN */}
          {mode === 'plan' && (
            <>
              <div className="qsheet-label">Plan-Name</div>
              <input className="qsheet-input" type="text"
                placeholder="z.B. 4-Tage-Split, Push/Pull/Legs"
                value={planTitle} onChange={(e) => setPlanTitle(e.target.value)} autoFocus />

              <div className="qsheet-label" style={{ marginTop: 14 }}>Startdatum</div>
              <input className="qsheet-input" type="date" value={date} onChange={(e) => setDate(e.target.value)} />

              <div className="qsheet-hint">
                Nach dem Anlegen kannst du im Sport-Modul → Pläne die einzelnen Trainingstage hinzufügen.
              </div>
            </>
          )}

          {/* RESTDAY */}
          {mode === 'rest' && (
            <>
              <div className="qsheet-label">Datum</div>
              <input className="qsheet-input" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
              <div className="qsheet-hint">Der Restday wird im Kalender eingetragen und im Hub als "Restday" angezeigt.</div>
            </>
          )}

          {error && <div className="qsheet-error">{error}</div>}

          <button className="sheet-save" disabled={saving} onClick={submit} style={{ marginTop: 20 }}>
            {saving ? 'Wird gespeichert…' :
             mode === 'training' ? 'Training eintragen' :
             mode === 'einheit'  ? 'Einheit speichern' :
             mode === 'plan'     ? 'Plan anlegen' :
             'Restday eintragen'}
          </button>
        </div>
      </div>
    </div>
  );
}
