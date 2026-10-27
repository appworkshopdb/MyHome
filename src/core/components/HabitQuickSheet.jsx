// core/components/HabitQuickSheet.jsx
// Neue Gewohnheit (FAB) — 2 Schritte im gemeinsamen Wizard-Rahmen
// (core/components/wizard/WizardKit.jsx):
//   Schritt 1: Symbol (Dropdown) + Name + Bereich (Wechselregler)
//   Schritt 2: Wiederholung, Wochentage, Wann am Tag, Ziel pro Tag + Einheit (Regler)

import { useState } from 'react';
import { saveHabit } from '../../modules/habits/lib/habData';
import { HABIT_CATEGORIES, HABIT_ICONS, TIME_SLOTS } from '../../modules/habits/lib/habUtils';
import { loadHabitsData } from '../lib/habitsStore';
import SheetShell from './SheetShell';
import { ChipGroup, IconDropdown, SegGroup, Stepper, WheelPicker, WizardFoot, WizardFrame, missingHint } from './wizard/WizardKit';

const FREQ_OPTIONS = [
  { value: 'daily',    label: 'Täglich' },
  { value: 'weekdays', label: 'Mo – Fr' },
  { value: 'custom',   label: 'Eigene Tage' },
];
const DAY_OPTIONS = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'].map((d, i) => ({ value: i, label: d }));
const SLOT_OPTIONS = TIME_SLOTS.map((s) => ({ value: s.value, label: `${s.emoji} ${s.label}` }));
// "×" = einfach abhaken (keine Einheit gespeichert)
const UNITS = ['×', 'Min', 'Std', 'L', 'Gläser', 'Seiten', 'km', 'Schritte', 'Portionen'];

export default function HabitQuickSheet({ onClose, onSaved }) {
  const [step, setStep]           = useState(1);
  const [name, setName]           = useState('');
  const [icon, setIcon]           = useState('⭐');
  const [area, setArea]           = useState(HABIT_CATEGORIES[0]);
  const [frequency, setFrequency] = useState('daily');
  const [days, setDays]           = useState([0, 1, 2, 3, 4]);
  const [slot, setSlot]           = useState('anytime');
  const [target, setTarget]       = useState(1);
  const [unit, setUnit]           = useState('×');
  const [saving, setSaving]       = useState(false);
  const [error, setError]         = useState('');

  const nameOk = Boolean(name.trim());
  const daysOk = frequency !== 'custom' || days.length > 0;

  async function submit() {
    if (!nameOk || !daysOk) return;
    setSaving(true);
    setError('');
    try {
      const saved = await saveHabit({
        name:           name.trim(),
        icon,
        category:       area,
        categories:     [area],
        frequency,
        frequency_days: frequency === 'custom' ? [...days].sort((a, b) => a - b) : [0, 1, 2, 3, 4],
        time_slot:      slot,
        target_count:   target,
        unit:           unit === '×' ? null : unit,
        description:    null,
        reminder_time:  null,
        active:         true,
        sort_order:     0,
      });
      onSaved?.(saved);
      await loadHabitsData({ force: true });
      onClose();
    } catch {
      setError('Speichern fehlgeschlagen. Bitte erneut versuchen.');
    } finally {
      setSaving(false);
    }
  }

  const footer = step === 1 ? (
    <WizardFoot one hint={nameOk ? '' : missingHint([['Name', true]])}>
      <button type="button" className="btn btn-primary" disabled={!nameOk} onClick={() => setStep(2)}>Weiter</button>
    </WizardFoot>
  ) : (
    <WizardFoot one hint={daysOk ? '' : 'Bitte mindestens einen Wochentag wählen'}>
      <button type="button" className="btn btn-primary" disabled={!daysOk || saving} onClick={submit}>
        {saving ? 'Wird gespeichert…' : 'Speichern'}
      </button>
    </WizardFoot>
  );

  return (
    <SheetShell onClose={onClose} wizard>
      <WizardFrame
        title="Neue Gewohnheit"
        sub={step === 1 ? 'Schritt 1 von 2 · Name & Bereich' : 'Schritt 2 von 2 · Wann & wie oft'}
        step={step}
        total={2}
        stepKey={step}
        onBack={step === 2 ? () => setStep(1) : undefined}
        onClose={onClose}
        footer={footer}
      >
        {step === 1 && (
          <>
            <label className="wz-lbl" htmlFor="wz-habit-name">Symbol und Name</label>
            <IconDropdown icons={HABIT_ICONS} value={icon} onChange={setIcon}>
              <input
                id="wz-habit-name"
                className="wz-input hero"
                type="text"
                placeholder="Name der Gewohnheit"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoFocus
                autoComplete="off"
                maxLength={60}
                enterKeyHint="next"
                onKeyDown={(e) => e.key === 'Enter' && nameOk && setStep(2)}
              />
            </IconDropdown>

            <div className="wz-lbl">Bereich</div>
            <WheelPicker items={HABIT_CATEGORIES} value={area} onChange={setArea} label="Bereich" />
            <p className="wz-wheel-hint">Nach oben oder unten wischen</p>
          </>
        )}

        {step === 2 && (
          <>
            <div className="wz-listpill" style={{ marginBottom: 0 }}>
              <span className="big">{icon}</span>
              <div>{name.trim()}<small>{area}</small></div>
            </div>

            <div className="wz-lbl">Wiederholung</div>
            <SegGroup options={FREQ_OPTIONS} value={frequency} onChange={setFrequency} label="Wiederholung" />
            {frequency === 'custom' && (
              <div style={{ marginTop: 10 }}>
                <ChipGroup options={DAY_OPTIONS} value={days} onChange={setDays} multi label="Wochentage" />
              </div>
            )}

            <div className="wz-lbl">Wann am Tag</div>
            <SegGroup options={SLOT_OPTIONS} value={slot} onChange={setSlot} label="Wann am Tag" />

            <div className="wz-two" style={{ marginTop: 16 }}>
              <div>
                <div className="wz-col-lbl">Ziel pro Tag</div>
                <div style={{ height: 180, display: 'grid', placeItems: 'center' }}>
                  <Stepper value={target} onChange={setTarget} min={1} max={99} />
                </div>
              </div>
              <div>
                <div className="wz-col-lbl">Einheit</div>
                <WheelPicker items={UNITS} value={unit} onChange={setUnit} label="Einheit" />
              </div>
            </div>
            {error && <p className="wz-hint err" role="alert">{error}</p>}
          </>
        )}
      </WizardFrame>
    </SheetShell>
  );
}
