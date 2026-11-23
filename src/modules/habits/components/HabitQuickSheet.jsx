// modules/habits/components/HabitQuickSheet.jsx
// Neue Gewohnheit (FAB) im gemeinsamen Wizard-Rahmen (core/components/wizard/WizardKit.jsx):
//   Schritt 1: Auswahl "Aus Vorlage" oder "Manuelle Eingabe" (wie Einkauf/Finanzen).
//              "Aus Vorlage" zeigt die Vorlagen (HabitTemplateLibrary) und springt nach der
//              Wahl direkt zu Schritt 3; Name, Symbol, Kategorie und Ziel-Art sind dann fest.
//   Schritt 2: (nur manuell) Symbol (Dropdown) + Name + Bereich (Wechselregler)
//   Schritt 3: Wiederholung, Wochentage, Wann am Tag, Ziel (manuell: Zahl + Einheit; Vorlage:
//              nur Liter bzw. Uhrzeit, soweit die Vorlage das vorsieht)

import { useState } from 'react';
import { saveHabit } from '../lib/habData';
import { HABIT_CATEGORIES, HABIT_ICONS, HABIT_UNITS, TIME_SLOTS } from '../lib/habUtils';
import { goalKind, formatQty, qtyStep, shiftTime, catalogEntryByName } from '../../../core/lib/habitCatalog';
import { loadHabitsData, useHabitsStore } from '../../../core/lib/habitsStore';
import SheetShell from '../../../core/components/SheetShell';
import { IconEdit } from '../../../core/components/Icons';
import { ChipGroup, IconDropdown, SegGroup, Stepper, WheelPicker, WizardFoot, WizardFrame, missingHint } from '../../../core/components/wizard/WizardKit';
import HabitTemplateLibrary from './HabitTemplateLibrary';

const FREQ_OPTIONS = [
  { value: 'daily',    label: 'Täglich' },
  { value: 'weekdays', label: 'Mo – Fr' },
  { value: 'custom',   label: 'Eigene Tage' },
];
const DAY_OPTIONS = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'].map((d, i) => ({ value: i, label: d }));
const SLOT_OPTIONS = TIME_SLOTS.map((s) => ({ value: s.value, label: `${s.emoji} ${s.label}` }));
// "×" = einfach abhaken (keine Einheit gespeichert)
const UNITS = ['×', ...HABIT_UNITS];

function IconTemplate() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="5" y="4" width="14" height="17" rx="2" />
      <path d="M9 4h6v3H9zM9 12h6M9 16h4" />
    </svg>
  );
}

// Zahl mit − und + in beliebiger Schrittweite (Stepper aus dem Kit kann weder Komma noch Uhrzeit)
function ValueStepper({ text, onMinus, onPlus, minusLabel, plusLabel }) {
  return (
    <div className="wz-stepper">
      <button type="button" onClick={onMinus} aria-label={minusLabel}>−</button>
      <span className="val">{text}</span>
      <button type="button" onClick={onPlus} aria-label={plusLabel}>+</button>
    </div>
  );
}

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
  const { habits }                = useHabitsStore();
  const [pickTmpl, setPickTmpl]   = useState(false); // Schritt 1: Vorlagenliste statt Auswahl
  const [tmpl, setTmpl]           = useState(null);  // gewählte Vorlage (null = manuell)
  const [goalTime, setGoalTime]   = useState('');

  const kind     = tmpl ? goalKind(tmpl) : null;               // 'check' | 'count' | 'time' | null (manuell)
  const timeStep = tmpl ? (catalogEntryByName(tmpl.name)?.goal?.step ?? 10) : 10;

  function pickTemplate(t) {
    setTmpl(t);
    setName(t.name);
    setIcon(t.icon);
    setArea(t.category);
    setFrequency(t.frequency);
    setDays(t.frequency_days ?? [0, 1, 2, 3, 4]);
    setSlot(t.time_slot ?? 'anytime');
    setTarget(t.target_count ?? 1);
    setUnit(t.unit ?? '×');
    setGoalTime(t.goal_time ?? '');
    setStep(3);
  }

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
        target_count:   tmpl ? (kind === 'count' ? target : 1) : target,
        unit:           tmpl ? (kind === 'count' ? unit : null) : (unit === '×' ? null : unit),
        goal_time:      kind === 'time' ? goalTime : null,
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

  const footer = step === 1 ? undefined : step === 2 ? (
    <WizardFoot one hint={nameOk ? '' : missingHint([['Name', true]])}>
      <button type="button" className="btn btn-primary" disabled={!nameOk} onClick={() => setStep(3)}>Weiter</button>
    </WizardFoot>
  ) : (
    <WizardFoot one hint={daysOk ? '' : 'Bitte mindestens einen Wochentag wählen'}>
      <button type="button" className="btn btn-primary" disabled={!daysOk || saving} onClick={submit}>
        {saving ? 'Wird gespeichert…' : 'Speichern'}
      </button>
    </WizardFoot>
  );

  // Vorlagen-Weg hat nur zwei Schritte (Wahl, Wann & wie oft), manuell drei
  const tmplFlow = pickTmpl || Boolean(tmpl);
  const total    = tmplFlow ? 2 : 3;
  const shown    = tmplFlow && step === 3 ? 2 : step;
  const sub =
    step === 1 ? (pickTmpl ? `Schritt 1 von ${total} · Vorlage wählen` : 'Wie möchtest du starten?')
    : step === 2 ? 'Schritt 2 von 3 · Name & Bereich'
    : `Schritt ${shown} von ${total} · Wann & wie oft`;

  function goBack() {
    if (step === 3) {
      if (tmpl) { setTmpl(null); setPickTmpl(true); setStep(1); } else setStep(2);
    } else if (step === 2) setStep(1);
    else if (pickTmpl) setPickTmpl(false);
  }

  return (
    <SheetShell onClose={onClose} wizard>
      <WizardFrame
        title="Neue Gewohnheit"
        sub={sub}
        step={shown}
        total={total}
        stepKey={`${step}-${pickTmpl}`}
        onBack={step > 1 || pickTmpl ? goBack : undefined}
        onClose={onClose}
        footer={footer}
      >
        {step === 1 && !pickTmpl && (
          <div className="wiz-mode-wrap">
            <div className="wiz-mode-grid">
              <button type="button" className="wiz-mode" onClick={() => setPickTmpl(true)}>
                <span className="wiz-mode-icon"><IconTemplate /></span>
                <span className="wiz-mode-title">Aus Vorlage</span>
                <span className="wiz-mode-sub">Fertige Gewohnheiten</span>
              </button>
              <button type="button" className="wiz-mode" onClick={() => setStep(2)}>
                <span className="wiz-mode-icon"><IconEdit /></span>
                <span className="wiz-mode-title">Manuelle Eingabe</span>
                <span className="wiz-mode-sub">Selbst anlegen</span>
              </button>
            </div>
          </div>
        )}

        {step === 1 && pickTmpl && <HabitTemplateLibrary habits={habits} onPick={pickTemplate} />}

        {step === 2 && (
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
                onKeyDown={(e) => e.key === 'Enter' && nameOk && setStep(3)}
              />
            </IconDropdown>

            <div className="wz-lbl">Bereich</div>
            <WheelPicker items={HABIT_CATEGORIES} value={area} onChange={setArea} label="Bereich" />
            <p className="wz-wheel-hint">Nach oben oder unten wischen</p>
          </>
        )}

        {step === 3 && (
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

            {/* Eigene Gewohnheit: Ziel frei wählbar */}
            {!tmpl && (
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
            )}

            {/* Vorlage: Ziel-Art ist fest, nur Liter bzw. Uhrzeit lassen sich einstellen */}
            {tmpl && kind === 'count' && (
              <>
                <div className="wz-lbl">Ziel pro Tag</div>
                <ValueStepper
                  text={`${formatQty(target)} ${unit}`}
                  minusLabel="weniger" plusLabel="mehr"
                  onMinus={() => setTarget((v) => Math.max(qtyStep(unit), Math.round((v - qtyStep(unit)) * 100) / 100))}
                  onPlus={() => setTarget((v) => Math.min(99, Math.round((v + qtyStep(unit)) * 100) / 100))}
                />
              </>
            )}
            {tmpl && kind === 'time' && (
              <>
                <div className="wz-lbl">Uhrzeit <span className="opt">in {timeStep}-Minuten-Schritten</span></div>
                <ValueStepper
                  text={`${goalTime} Uhr`}
                  minusLabel="früher" plusLabel="später"
                  onMinus={() => setGoalTime((t) => shiftTime(t, -timeStep))}
                  onPlus={() => setGoalTime((t) => shiftTime(t, timeStep))}
                />
              </>
            )}
            {tmpl && kind === 'check' && <p className="wz-wheel-hint">Einfach abhaken, ohne Menge.</p>}

            {error && <p className="wz-hint err" role="alert">{error}</p>}
          </>
        )}
      </WizardFrame>
    </SheetShell>
  );
}
