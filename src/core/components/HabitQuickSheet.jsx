// core/components/HabitQuickSheet.jsx
// 3-Schritt-Wizard zum Anlegen einer neuen Gewohnheit (via FAB)
//
// Schritt 1: Name + Icon (custom Dropdown)
// Schritt 2: Häufigkeit + Wochentage + Kategorien (Multi-Tags) + Tageszeit
// Schritt 3: Beschreibung/Notiz + Erinnerung (beide optional)

import { useState, useRef, useEffect } from 'react';
import { saveHabit } from '../../modules/habits/lib/habData';
import { HABIT_CATEGORIES, HABIT_ICONS, TIME_SLOTS } from '../../modules/habits/lib/habUtils';
import SheetShell from './SheetShell';

const FREQ_OPTIONS = [
  { key: 'daily',    label: 'Täglich',      emoji: '📅' },
  { key: 'weekdays', label: 'Mo – Fr',       emoji: '💼' },
  { key: 'custom',   label: 'Eigene Tage',   emoji: '✏️' },
];
const DAY_LABELS = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];

const EMPTY = {
  name:           '',
  icon:           '⭐',
  categories:     [],
  frequency:      'daily',
  frequency_days: [0, 1, 2, 3, 4],
  time_slot:      'anytime',
  description:    '',
  reminder_time:  '',
  active:         true,
};

const TOTAL_STEPS = 3;

export default function HabitQuickSheet({ onClose, onSaved }) {
  const [form, setForm]         = useState({ ...EMPTY });
  const [step, setStep]         = useState(1);
  const [saving, setSaving]     = useState(false);
  const [error, setError]       = useState('');
  const [iconOpen, setIconOpen] = useState(false);
  const iconRef                 = useRef(null);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  function toggleDay(d) {
    const days = form.frequency_days.includes(d)
      ? form.frequency_days.filter((x) => x !== d)
      : [...form.frequency_days, d].sort();
    set('frequency_days', days);
  }

  function toggleCategory(cat) {
    set('categories',
      form.categories.includes(cat)
        ? form.categories.filter((c) => c !== cat)
        : [...form.categories, cat]
    );
  }

  // Icon-Dropdown schließen bei Klick außerhalb
  useEffect(() => {
    if (!iconOpen) return;
    function handleClick(e) {
      if (iconRef.current && !iconRef.current.contains(e.target)) setIconOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('touchstart', handleClick);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('touchstart', handleClick);
    };
  }, [iconOpen]);

  function nextStep() {
    setError('');
    if (step === 1 && !form.name.trim()) {
      setError('Bitte einen Namen eingeben.');
      return;
    }
    if (step === 2 && form.frequency === 'custom' && form.frequency_days.length === 0) {
      setError('Bitte mindestens einen Wochentag wählen.');
      return;
    }
    setStep((s) => s + 1);
  }

  async function submit() {
    setSaving(true);
    setError('');
    try {
      // Erste Kategorie als legacy-Feld category mitschicken (Bestandscode liest es noch)
      const saved = await saveHabit({
        ...form,
        name:        form.name.trim(),
        description: form.description.trim() || null,
        reminder_time: form.reminder_time || null,
        category:    form.categories[0] ?? 'Sonstiges',
        categories:  form.categories,
        target_count: 1,
        unit:        null,
        sort_order:  0,
      });
      onSaved?.(saved);
      onClose();
    } catch {
      setError('Speichern fehlgeschlagen. Bitte erneut versuchen.');
    } finally {
      setSaving(false);
    }
  }

  // Fortschrittsbalken — 3 Segmente
  function ProgressBar() {
    return (
      <div className="hwiz-progress">
        {Array.from({ length: TOTAL_STEPS }, (_, i) => (
          <div
            key={i}
            className={`hwiz-progress-seg ${i < step ? 'done' : ''} ${i === step - 1 ? 'active' : ''}`}
          />
        ))}
      </div>
    );
  }

  return (
    <SheetShell onClose={onClose}>
      <div className="sheet-header">
        <span className="sheet-title">Neue Gewohnheit</span>
        <button className="sheet-cancel" onClick={onClose}>Abbrechen</button>
      </div>

      <ProgressBar />

      {/* ── Schritt 1: Name + Icon ── */}
      {step === 1 && (
        <div className="hwiz-body">
          <div className="hwiz-step-label">Schritt 1 · Name & Icon</div>

          <div className="hwiz-name-row">
            {/* Icon-Dropdown */}
            <div className="hwiz-icon-wrap" ref={iconRef}>
              <button
                className="hwiz-icon-btn"
                onClick={() => setIconOpen((v) => !v)}
                type="button"
                title="Icon wählen"
              >
                <span className="hwiz-icon-current">{form.icon}</span>
                <span className="hwiz-icon-caret">{iconOpen ? '▲' : '▼'}</span>
              </button>
              {iconOpen && (
                <div className="hwiz-icon-dropdown">
                  {HABIT_ICONS.map((ic) => (
                    <button
                      key={ic}
                      className={`hwiz-icon-option ${form.icon === ic ? 'active' : ''}`}
                      onClick={() => { set('icon', ic); setIconOpen(false); }}
                      type="button"
                    >
                      {ic}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Name */}
            <input
              className="hwiz-name-input"
              type="text"
              placeholder="Name der Gewohnheit"
              value={form.name}
              onChange={(e) => set('name', e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && nextStep()}
              autoFocus
              maxLength={60}
            />
          </div>

          {error && <div className="hwiz-error">{error}</div>}

          <button
            className="btn btn-primary hwiz-next"
            onClick={nextStep}
            disabled={!form.name.trim()}
          >
            Weiter →
          </button>
        </div>
      )}

      {/* ── Schritt 2: Häufigkeit + Kategorien + Tageszeit ── */}
      {step === 2 && (
        <div className="hwiz-body">
          <div className="hwiz-step-label">Schritt 2 · Wann & Wie oft</div>

          {/* Preview */}
          <div className="hwiz-preview">{form.icon} {form.name}</div>

          {/* Häufigkeit */}
          <div className="hwiz-field-label">Häufigkeit</div>
          <div className="hwiz-seg">
            {FREQ_OPTIONS.map((f) => (
              <button
                key={f.key}
                className={`hwiz-seg-btn ${form.frequency === f.key ? 'active' : ''}`}
                onClick={() => set('frequency', f.key)}
                type="button"
              >
                {f.label}
              </button>
            ))}
          </div>

          {form.frequency === 'custom' && (
            <div className="hwiz-day-row">
              {DAY_LABELS.map((d, i) => (
                <button
                  key={i}
                  className={`hwiz-day-btn ${form.frequency_days.includes(i) ? 'active' : ''}`}
                  onClick={() => toggleDay(i)}
                  type="button"
                >
                  {d}
                </button>
              ))}
            </div>
          )}

          {/* Tageszeit */}
          <div className="hwiz-field-label" style={{ marginTop: 20 }}>Wann am Tag</div>
          <div className="hwiz-slot-grid">
            {TIME_SLOTS.map((slot) => (
              <button
                key={slot.value}
                className={`hwiz-slot-btn ${form.time_slot === slot.value ? 'active' : ''}`}
                onClick={() => set('time_slot', slot.value)}
                type="button"
              >
                <span className="hwiz-slot-emoji">{slot.emoji}</span>
                <span className="hwiz-slot-label">{slot.label}</span>
              </button>
            ))}
          </div>

          {/* Kategorien — Multi-Select Tags */}
          <div className="hwiz-field-label" style={{ marginTop: 20 }}>Kategorien</div>
          <div className="hwiz-cat-grid">
            {HABIT_CATEGORIES.map((cat) => (
              <button
                key={cat}
                className={`hwiz-cat-tag ${form.categories.includes(cat) ? 'active' : ''}`}
                onClick={() => toggleCategory(cat)}
                type="button"
              >
                {cat}
              </button>
            ))}
          </div>
          {form.categories.length === 0 && (
            <div className="hwiz-cat-hint">Optional — hilft dir später beim Filtern.</div>
          )}

          {error && <div className="hwiz-error">{error}</div>}

          <div className="hwiz-btn-row">
            <button className="btn btn-secondary hwiz-back" onClick={() => setStep(1)} type="button">
              ← Zurück
            </button>
            <button className="btn btn-primary hwiz-next-flex" onClick={nextStep} type="button">
              Weiter →
            </button>
          </div>
        </div>
      )}

      {/* ── Schritt 3: Beschreibung + Erinnerung ── */}
      {step === 3 && (
        <div className="hwiz-body">
          <div className="hwiz-step-label">Schritt 3 · Details (optional)</div>

          {/* Preview */}
          <div className="hwiz-preview">{form.icon} {form.name}</div>
          {form.categories.length > 0 && (
            <div className="hwiz-preview-cats">
              {form.categories.map((c) => (
                <span key={c} className="hwiz-preview-cat">{c}</span>
              ))}
            </div>
          )}

          {/* Beschreibung */}
          <div className="hwiz-field-label">Notiz / Beschreibung</div>
          <textarea
            className="hwiz-textarea"
            placeholder="z.B. Ziel, Motivation oder Kontext …"
            value={form.description}
            onChange={(e) => set('description', e.target.value)}
            maxLength={120}
            rows={3}
          />

          {/* Erinnerung */}
          <div className="hwiz-field-label" style={{ marginTop: 20 }}>Erinnerung</div>
          <div className="hwiz-reminder-wrap">
            <input
              className="hwiz-time-input"
              type="time"
              value={form.reminder_time}
              onChange={(e) => set('reminder_time', e.target.value)}
            />
            {form.reminder_time && (
              <button
                className="hwiz-reminder-clear"
                onClick={() => set('reminder_time', '')}
                type="button"
                title="Erinnerung entfernen"
              >
                ✕
              </button>
            )}
          </div>
          {form.reminder_time && (
            <div className="hwiz-reminder-hint">
              ⏰ Erinnerung um {form.reminder_time} Uhr — Push-Benachrichtigungen kommen in einem späteren Update.
            </div>
          )}

          {error && <div className="hwiz-error">{error}</div>}

          <div className="hwiz-btn-row">
            <button className="btn btn-secondary hwiz-back" onClick={() => setStep(2)} type="button">
              ← Zurück
            </button>
            <button
              className="btn btn-primary hwiz-next-flex"
              onClick={submit}
              disabled={saving}
              type="button"
            >
              {saving ? 'Wird angelegt …' : 'Gewohnheit anlegen ✓'}
            </button>
          </div>
        </div>
      )}
    </SheetShell>
  );
}
