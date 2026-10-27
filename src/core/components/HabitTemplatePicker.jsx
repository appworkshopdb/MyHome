// core/components/HabitTemplatePicker.jsx
// Erste Gewohnheiten aus Vorlagen wählen (Mission der Tour „Gewohnheiten“).
// Zwei Schritte wie der frühere Einrichtungs-Wizard: Bereiche wählen → bis zu
// drei Vorlagen wählen → „Jetzt starten“ legt sie an. Vorlagen: lib/habitTemplates.js.
//
// Hinweis zur Architektur-Regel: wie HabitQuickSheet ruft diese Datei saveHabit()
// aus modules/habits auf (bekannte Ausnahme, es gibt keine core-Variante).

import { createPortal } from 'react-dom';
import { useState } from 'react';
import { saveHabit } from '../../modules/habits/lib/habData';
import { loadHabitsData } from '../lib/habitsStore';
import { HABIT_AREAS, MAX_TEMPLATES, habitMeta } from '../lib/habitTemplates';
import { ModuleIcon } from './ModuleIcons';

export default function HabitTemplatePicker({ onClose, onSaved }) {
  const [step, setStep] = useState(1);
  const [areaKeys, setAreaKeys] = useState([]);
  const [picked, setPicked] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const areas = HABIT_AREAS.filter((a) => areaKeys.includes(a.key));

  function toggleArea(key) {
    const next = areaKeys.includes(key) ? areaKeys.filter((k) => k !== key) : [...areaKeys, key];
    setAreaKeys(next);
    // Vorlagen aus abgewählten Bereichen wieder entfernen
    const names = new Set(HABIT_AREAS.filter((a) => next.includes(a.key)).flatMap((a) => a.habits.map((h) => h.name)));
    setPicked((p) => p.filter((h) => names.has(h.name)));
  }

  function toggleHabit(h) {
    setPicked((p) => {
      if (p.some((x) => x.name === h.name)) return p.filter((x) => x.name !== h.name);
      return p.length >= MAX_TEMPLATES ? p : [...p, h];
    });
  }

  async function start() {
    if (picked.length === 0) return;
    setSaving(true); setError('');
    try {
      for (let i = 0; i < picked.length; i++) {
        await saveHabit({ ...picked[i], categories: [picked[i].category], sort_order: i });
      }
      await loadHabitsData({ force: true });
      onSaved?.();
      onClose();
    } catch (e) {
      console.error('[HabitTemplatePicker]', e);
      setError('Konnte nicht gespeichert werden. Bitte erneut versuchen.');
      setSaving(false);
    }
  }

  return createPortal(
    <div className="ax-page" role="dialog" aria-modal="true" aria-label="Gewohnheiten auswählen">
      <div className="ax-in">
        <div className="ax-top">
          <div className="tut-pill"><i><ModuleIcon id="habits" size={17} strokeWidth={2} /></i>Gewohnheiten</div>
          <span className="onb-count">Schritt {step} von 2</span>
        </div>
        <div className="onb-prog">
          <i className={`onb-seg ${step === 1 ? 'cur' : 'on'}`} />
          <i className={`onb-seg ${step === 2 ? 'cur' : ''}`} />
        </div>

        <div className="ax-scroll">
          {step === 1 && (
            <>
              <div>
                <h1 className="ax-title">Was möchtest du verbessern?</h1>
                <p className="ax-sub">Wähle einen oder mehrere Bereiche. Wir schlagen dir passende Gewohnheiten vor.</p>
              </div>
              <div className="hp-stack">
                {HABIT_AREAS.map((a) => {
                  const on = areaKeys.includes(a.key);
                  return (
                    <button key={a.key} type="button" aria-pressed={on} className={`hp-area${on ? ' on' : ''}`} onClick={() => toggleArea(a.key)}>
                      <span className="et">{a.icon}</span>
                      <div><strong>{a.label}</strong><span className="d">{a.desc}</span></div>
                      <i className="ck" />
                    </button>
                  );
                })}
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <div>
                <h1 className="ax-title">Wähle deine Gewohnheiten</h1>
                <p className="ax-sub">Wähle 1 bis 3. Weniger ist mehr, du kannst später jederzeit weitere hinzufügen.</p>
              </div>
              {picked.length === MAX_TEMPLATES && (
                <div className="hp-banner"><b>3 von 3</b>Ein guter Start!</div>
              )}
              <div className="hp-stack">
                {areas.map((a) => (
                  <div key={a.key} className="hp-stack">
                    <div className="hp-group">{a.label}</div>
                    {a.habits.map((h) => {
                      const on = picked.some((x) => x.name === h.name);
                      const off = !on && picked.length >= MAX_TEMPLATES;
                      return (
                        <button key={h.name} type="button" aria-pressed={on} disabled={off} className={`hp-area sm${on ? ' on' : ''}${off ? ' off' : ''}`} onClick={() => toggleHabit(h)}>
                          <span className="et">{h.icon}</span>
                          <div><strong>{h.name}</strong><span className="d">{habitMeta(h)}</span></div>
                          <i className="ck" />
                        </button>
                      );
                    })}
                  </div>
                ))}
              </div>
            </>
          )}
          {error && <div className="ax-error" role="alert">{error}</div>}
        </div>

        <div className="ax-nav">
          {step === 1 ? (
            <>
              <button type="button" className="btn onb-ghost" onClick={onClose}>Überspringen</button>
              <button type="button" className="btn btn-primary" disabled={areaKeys.length === 0} onClick={() => { setPicked([]); setStep(2); }}>
                {areaKeys.length > 0 ? `Weiter (${areaKeys.length} gewählt)` : 'Weiter'}
              </button>
            </>
          ) : (
            <>
              <button type="button" className="btn btn-secondary" disabled={saving} onClick={() => setStep(1)}>Zurück</button>
              <button type="button" className="btn btn-primary" disabled={saving || picked.length === 0} onClick={start}>
                {saving ? 'Wird angelegt …' : 'Jetzt starten'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
