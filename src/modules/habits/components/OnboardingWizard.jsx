// modules/habits/components/OnboardingWizard.jsx
// Geführter Wizard für neue Nutzer ohne Habits.
// Schritt 1: Fokus-Bereich wählen (Kategorie)
// Schritt 2: 1–3 passende Habits aus Vorschlägen wählen
// Schritt 3: Bestätigung + Anlegen

import { useState } from 'react';
import { saveHabit } from '../lib/habData.js';

// Fokus-Bereiche mit passenden Habit-Vorschlägen
const FOCUS_AREAS = [
  {
    key:   'gesundheit',
    label: 'Gesundheit & Bewegung',
    icon:  '🏃',
    desc:  'Mehr Bewegung, Sport und körperliches Wohlbefinden',
    habits: [
      { name: '30 Min bewegen',      icon: '🏃', category: 'Bewegung',   frequency: 'daily',    target_count: 1, unit: null },
      { name: 'Spazieren gehen',     icon: '🚶', category: 'Bewegung',   frequency: 'daily',    target_count: 1, unit: null },
      { name: 'Sport / Gym',         icon: '💪', category: 'Bewegung',   frequency: 'custom',   frequency_days: [0,2,4], target_count: 1, unit: null },
      { name: 'Dehnen & Stretching', icon: '🧘', category: 'Bewegung',   frequency: 'daily',    target_count: 1, unit: null },
      { name: 'Wasser trinken',      icon: '💧', category: 'Ernährung',  frequency: 'daily',    target_count: 8, unit: 'Gläser' },
    ],
  },
  {
    key:   'schlaf',
    label: 'Schlaf & Erholung',
    icon:  '😴',
    desc:  'Besser schlafen, ausgeruhter aufwachen',
    habits: [
      { name: 'Vor 23 Uhr ins Bett',          icon: '😴', category: 'Schlaf', frequency: 'daily', target_count: 1, unit: null },
      { name: 'Kein Handy vor dem Schlafen',   icon: '📵', category: 'Schlaf', frequency: 'daily', target_count: 1, unit: null },
      { name: 'Feste Aufstehzeit',             icon: '⏰', category: 'Schlaf', frequency: 'daily', target_count: 1, unit: null },
      { name: 'Digitale Pause am Abend',       icon: '🌿', category: 'Mental', frequency: 'daily', target_count: 1, unit: null },
      { name: 'Kein Koffein nach 14 Uhr',      icon: '☕', category: 'Schlaf', frequency: 'daily', target_count: 1, unit: null },
    ],
  },
  {
    key:   'mental',
    label: 'Mental & Achtsamkeit',
    icon:  '🧠',
    desc:  'Mehr Ruhe, Fokus und innere Balance',
    habits: [
      { name: 'Meditieren',           icon: '🧠', category: 'Mental',        frequency: 'daily',    target_count: 1, unit: null },
      { name: 'Dankbarkeit notieren', icon: '🙏', category: 'Mental',        frequency: 'daily',    target_count: 1, unit: null },
      { name: 'Journaling',           icon: '📓', category: 'Mental',        frequency: 'daily',    target_count: 1, unit: null },
      { name: 'Digitale Pause',       icon: '🌿', category: 'Mental',        frequency: 'daily',    target_count: 1, unit: null },
      { name: 'Atemübungen',          icon: '🌬️', category: 'Mental',       frequency: 'daily',    target_count: 1, unit: null },
    ],
  },
  {
    key:   'produktivitaet',
    label: 'Produktivität & Lernen',
    icon:  '📋',
    desc:  'Mehr schaffen, fokussierter arbeiten, dazulernen',
    habits: [
      { name: 'Tagesplanung machen', icon: '📋', category: 'Produktivität', frequency: 'weekdays', target_count: 1, unit: null },
      { name: 'Kein Handy morgens',  icon: '📱', category: 'Produktivität', frequency: 'daily',    target_count: 1, unit: null },
      { name: 'Lesen (10 Seiten)',   icon: '📚', category: 'Lernen',        frequency: 'daily',    target_count: 10, unit: 'Seiten' },
      { name: 'Deep-Work-Block',     icon: '🎯', category: 'Produktivität', frequency: 'weekdays', target_count: 1, unit: null },
      { name: 'Abend-Review',        icon: '✅', category: 'Produktivität', frequency: 'daily',    target_count: 1, unit: null },
    ],
  },
  {
    key:   'ernaehrung',
    label: 'Ernährung',
    icon:  '🥦',
    desc:  'Gesünder essen, bewusster trinken',
    habits: [
      { name: 'Wasser trinken',    icon: '💧', category: 'Ernährung', frequency: 'daily', target_count: 8,  unit: 'Gläser' },
      { name: 'Gemüse essen',      icon: '🥦', category: 'Ernährung', frequency: 'daily', target_count: 1,  unit: null },
      { name: 'Kein Zucker',       icon: '🚫', category: 'Ernährung', frequency: 'daily', target_count: 1,  unit: null },
      { name: 'Zu Hause kochen',   icon: '🍳', category: 'Ernährung', frequency: 'daily', target_count: 1,  unit: null },
      { name: 'Achtsam essen',     icon: '🍽️', category: 'Ernährung', frequency: 'daily', target_count: 1,  unit: null },
    ],
  },
  {
    key:   'alltag',
    label: 'Haushalt & Alltag',
    icon:  '🏠',
    desc:  'Ordnung, Routinen und kleine tägliche Aufgaben',
    habits: [
      { name: 'Bett machen',            icon: '🛏️', category: 'Haushalt', frequency: 'daily', target_count: 1, unit: null },
      { name: 'Küche abends aufräumen', icon: '🧹', category: 'Haushalt', frequency: 'daily', target_count: 1, unit: null },
      { name: '10 Min aufräumen',       icon: '🏠', category: 'Haushalt', frequency: 'daily', target_count: 1, unit: null },
      { name: 'Pflanzen gießen',        icon: '🌱', category: 'Haushalt', frequency: 'custom', frequency_days: [0,3], target_count: 1, unit: null },
      { name: 'Post/Mails checken',     icon: '📬', category: 'Alltag',   frequency: 'weekdays', target_count: 1, unit: null },
    ],
  },
];

export default function OnboardingWizard({ onDone, onSkip }) {
  const [step, setStep]               = useState(1); // 1=Fokus, 2=Habits wählen, 3=Bestätigung
  const [selectedFocus, setFocus]     = useState(null);
  const [selectedHabits, setSelected] = useState([]);
  const [saving, setSaving]           = useState(false);
  const [error, setError]             = useState(null);

  const focusArea = FOCUS_AREAS.find((f) => f.key === selectedFocus);

  function toggleHabit(habit) {
    setSelected((prev) => {
      const exists = prev.find((h) => h.name === habit.name);
      if (exists) return prev.filter((h) => h.name !== habit.name);
      if (prev.length >= 3) return prev; // max 3
      return [...prev, habit];
    });
  }

  async function handleFinish() {
    if (selectedHabits.length === 0) return;
    setSaving(true);
    setError(null);
    try {
      for (let i = 0; i < selectedHabits.length; i++) {
        await saveHabit({ ...selectedHabits[i], sort_order: i });
      }
      onDone();
    } catch (e) {
      setError('Konnte nicht gespeichert werden. Bitte erneut versuchen.');
      setSaving(false);
    }
  }

  // ── Schritt 1: Fokus-Bereich wählen ─────────────────────
  if (step === 1) {
    return (
      <div className="hab-wizard">
        <div className="hab-wizard-header">
          <div className="hab-wizard-step">Schritt 1 von 3</div>
          <h2 className="hab-wizard-title">Was möchtest du verbessern?</h2>
          <p className="hab-wizard-sub">Wähle einen Bereich — wir schlagen dir passende Gewohnheiten vor.</p>
        </div>

        <div className="hab-wizard-progress">
          <div className="hab-wizard-bar" style={{ width: '33%' }} />
        </div>

        <div className="hab-wizard-focus-list">
          {FOCUS_AREAS.map((area) => (
            <button
              key={area.key}
              className={`hab-wizard-focus-item ${selectedFocus === area.key ? 'selected' : ''}`}
              onClick={() => setFocus(area.key)}
            >
              <span className="hab-wizard-focus-icon">{area.icon}</span>
              <div className="hab-wizard-focus-text">
                <div className="hab-wizard-focus-label">{area.label}</div>
                <div className="hab-wizard-focus-desc">{area.desc}</div>
              </div>
              {selectedFocus === area.key && (
                <span className="hab-wizard-check">✓</span>
              )}
            </button>
          ))}
        </div>

        <div className="hab-wizard-actions">
          <button
            className="btn btn-primary"
            onClick={() => { setSelected([]); setStep(2); }}
            disabled={!selectedFocus}
          >
            Weiter →
          </button>
          <button className="hab-wizard-skip" onClick={onSkip}>
            Überspringen
          </button>
        </div>
      </div>
    );
  }

  // ── Schritt 2: Habits auswählen ──────────────────────────
  if (step === 2) {
    return (
      <div className="hab-wizard">
        <div className="hab-wizard-header">
          <div className="hab-wizard-step">Schritt 2 von 3</div>
          <h2 className="hab-wizard-title">Wähle deine Gewohnheiten</h2>
          <p className="hab-wizard-sub">
            Wähle <strong>1–3 Gewohnheiten</strong>. Weniger ist mehr — du kannst später jederzeit weitere hinzufügen.
          </p>
        </div>

        <div className="hab-wizard-progress">
          <div className="hab-wizard-bar" style={{ width: '66%' }} />
        </div>

        {selectedHabits.length === 3 && (
          <div className="hab-wizard-max-hint">
            💡 3 Gewohnheiten ausgewählt — ein guter Start! Du kannst später mehr hinzufügen.
          </div>
        )}

        <div className="hab-wizard-habit-list">
          {focusArea?.habits.map((habit, i) => {
            const isSelected = selectedHabits.find((h) => h.name === habit.name);
            const isDisabled = !isSelected && selectedHabits.length >= 3;
            return (
              <button
                key={i}
                className={`hab-wizard-habit-item ${isSelected ? 'selected' : ''} ${isDisabled ? 'disabled' : ''}`}
                onClick={() => !isDisabled && toggleHabit(habit)}
                disabled={isDisabled}
              >
                <span className="hab-wizard-habit-icon">{habit.icon}</span>
                <div className="hab-wizard-habit-info">
                  <div className="hab-wizard-habit-name">{habit.name}</div>
                  <div className="hab-wizard-habit-meta">
                    {habit.frequency === 'daily' && 'Täglich'}
                    {habit.frequency === 'weekdays' && 'Mo – Fr'}
                    {habit.frequency === 'custom' && 'Mo, Mi, Fr'}
                    {habit.target_count > 1 && ` · ${habit.target_count}× ${habit.unit}`}
                  </div>
                </div>
                <span className={`hab-wizard-habit-check ${isSelected ? 'visible' : ''}`}>✓</span>
              </button>
            );
          })}
        </div>

        <div className="hab-wizard-actions">
          <button
            className="btn btn-primary"
            onClick={() => setStep(3)}
            disabled={selectedHabits.length === 0}
          >
            Weiter → ({selectedHabits.length} gewählt)
          </button>
          <button className="hab-wizard-back" onClick={() => setStep(1)}>
            ← Zurück
          </button>
        </div>
      </div>
    );
  }

  // ── Schritt 3: Bestätigung ───────────────────────────────
  return (
    <div className="hab-wizard">
      <div className="hab-wizard-header">
        <div className="hab-wizard-step">Schritt 3 von 3</div>
        <h2 className="hab-wizard-title">Bereit loszulegen?</h2>
        <p className="hab-wizard-sub">
          Diese {selectedHabits.length} {selectedHabits.length === 1 ? 'Gewohnheit wird' : 'Gewohnheiten werden'} angelegt:
        </p>
      </div>

      <div className="hab-wizard-progress">
        <div className="hab-wizard-bar" style={{ width: '100%' }} />
      </div>

      <div className="hab-wizard-confirm-list">
        {selectedHabits.map((habit, i) => (
          <div key={i} className="hab-wizard-confirm-item">
            <span className="hab-wizard-habit-icon">{habit.icon}</span>
            <div>
              <div className="hab-wizard-habit-name">{habit.name}</div>
              <div className="hab-wizard-habit-meta">
                {habit.frequency === 'daily' && 'Täglich'}
                {habit.frequency === 'weekdays' && 'Mo – Fr'}
                {habit.frequency === 'custom' && 'Mo, Mi, Fr'}
                {habit.target_count > 1 && ` · ${habit.target_count}× ${habit.unit}`}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="hab-wizard-tip">
        <span>💡</span>
        <span>Tipp: Die meisten Menschen, die Gewohnheiten dauerhaft beibehalten, starten mit weniger als 3 — und fügen nach 2–3 Wochen neue hinzu.</span>
      </div>

      {error && <div className="toast toast-error">{error}</div>}

      <div className="hab-wizard-actions">
        <button
          className="btn btn-primary"
          onClick={handleFinish}
          disabled={saving}
        >
          {saving ? 'Wird angelegt …' : '🌱 Jetzt starten'}
        </button>
        <button className="hab-wizard-back" onClick={() => setStep(2)} disabled={saving}>
          ← Zurück
        </button>
      </div>
    </div>
  );
}
