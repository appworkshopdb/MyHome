import { useState } from 'react';
import { useAuth } from '../lib/AuthContext';
import { saveHabit } from '../../modules/habits/lib/habData';
import { HABIT_CATEGORIES, HABIT_ICONS } from '../../modules/habits/lib/habUtils';

const FREQ_OPTIONS = [
  { key: 'daily',    label: 'Täglich' },
  { key: 'weekdays', label: 'Mo – Fr' },
  { key: 'custom',   label: 'Eigene Tage' },
];
const DAY_LABELS = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];

const EMPTY = {
  name: '', icon: '⭐', category: 'Gesundheit',
  frequency: 'daily', frequency_days: [0,1,2,3,4],
  target_count: 1, unit: '', active: true,
};

export default function HabitQuickSheet({ onClose, onSaved }) {
  const { session } = useAuth();
  const [form, setForm]   = useState({ ...EMPTY });
  const [step, setStep]   = useState(1); // 1=Basis, 2=Details
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState('');

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  function toggleDay(d) {
    const days = form.frequency_days.includes(d)
      ? form.frequency_days.filter((x) => x !== d)
      : [...form.frequency_days, d].sort();
    set('frequency_days', days);
  }

  async function submit() {
    if (!form.name.trim()) { setError('Bitte einen Namen eingeben'); return; }
    setSaving(true);
    try {
      const saved = await saveHabit({ ...form, name: form.name.trim() });
      onSaved?.(saved);
      onClose();
    } catch { setError('Speichern fehlgeschlagen'); }
    finally { setSaving(false); }
  }

  return (
    <div className="sheet-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="sheet">
        <div className="sheet-header">
          <span className="sheet-title">Neue Gewohnheit</span>
          <button className="sheet-cancel" onClick={onClose}>Abbrechen</button>
        </div>

        {step === 1 && (
          <div className="qsheet-body">
            {/* Icon-Picker */}
            <div className="qsheet-icon-grid">
              {HABIT_ICONS.map((ic) => (
                <button key={ic} className={`qsheet-icon-btn ${form.icon === ic ? 'active' : ''}`}
                  onClick={() => set('icon', ic)}>{ic}</button>
              ))}
            </div>

            {/* Name */}
            <input className="qsheet-input qsheet-input--lg" type="text"
              placeholder="Name der Gewohnheit"
              value={form.name} onChange={(e) => set('name', e.target.value)}
              autoFocus onKeyDown={(e) => e.key === 'Enter' && form.name.trim() && setStep(2)} />

            {/* Kategorie */}
            <div className="qsheet-chip-row">
              {HABIT_CATEGORIES.map((c) => (
                <button key={c} className={`qsheet-chip ${form.category === c ? 'active' : ''}`}
                  onClick={() => set('category', c)}>{c}</button>
              ))}
            </div>

            {error && <div className="qsheet-error">{error}</div>}
            <button className="sheet-save" disabled={!form.name.trim()}
              onClick={() => form.name.trim() && setStep(2)}>
              Weiter →
            </button>
          </div>
        )}

        {step === 2 && (
          <div className="qsheet-body">
            <div className="qsheet-preview">{form.icon} {form.name}</div>

            {/* Häufigkeit */}
            <div className="qsheet-label">Häufigkeit</div>
            <div className="qsheet-seg">
              {FREQ_OPTIONS.map((f) => (
                <button key={f.key} className={form.frequency === f.key ? 'active' : ''}
                  onClick={() => set('frequency', f.key)}>{f.label}</button>
              ))}
            </div>

            {form.frequency === 'custom' && (
              <div className="qsheet-day-row">
                {DAY_LABELS.map((d, i) => (
                  <button key={i} className={`qsheet-day ${form.frequency_days.includes(i) ? 'active' : ''}`}
                    onClick={() => toggleDay(i)}>{d}</button>
                ))}
              </div>
            )}

            {/* Zielanzahl */}
            <div className="qsheet-label" style={{ marginTop: 16 }}>Ziel pro Tag</div>
            <div className="qsheet-count-row">
              <button className="qsheet-count-btn" onClick={() => set('target_count', Math.max(1, form.target_count - 1))}>−</button>
              <span className="qsheet-count-val">{form.target_count}×</span>
              <button className="qsheet-count-btn" onClick={() => set('target_count', form.target_count + 1)}>+</button>
            </div>

            {error && <div className="qsheet-error">{error}</div>}
            <div className="qsheet-btn-row">
              <button className="sheet-cancel" onClick={() => setStep(1)}>← Zurück</button>
              <button className="sheet-save" style={{ flex: 1 }} disabled={saving} onClick={submit}>
                {saving ? 'Wird gespeichert…' : 'Gewohnheit anlegen'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
