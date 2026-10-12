// core/components/WelcomeWizard.jsx
// Erster Start: Willkommen → Vogel wählen → Fertig. Erscheint, solange noch
// keine Vogelart gewählt ist (gamificationStore.bird_species). Danach lässt
// sich die Art jederzeit im Fortschritts-Sheet ändern.

import { useState } from 'react';
import { createPortal } from 'react-dom';
import Bird from './birds/Bird';
import { SPECIES, SPECIES_KEYS, STAGE_NAMES } from './birds/birdArt';
import { setBirdSpecies } from '../lib/gamificationStore';

export default function WelcomeWizard({ level = 1 }) {
  const [step, setStep] = useState(0);
  const [pick, setPick] = useState('robin');

  async function finish() { await setBirdSpecies(pick); }

  return createPortal(
    <div className="wiz-overlay" role="dialog" aria-modal="true" aria-label="Willkommen bei Nestua">
      <div className="wiz-card">
        <div className="wiz-dots" aria-hidden="true">
          {[0, 1, 2].map((i) => <span key={i} className={i === step ? 'on' : ''} />)}
        </div>

        {step === 0 && (
          <div className="wiz-body">
            <Bird species="robin" stage={4} size={170} />
            <h1 className="wiz-title">Willkommen bei Nestua</h1>
            <p className="wiz-text">
              Dein Alltag an einem Ort. Und du bekommst einen Begleiter, der mit dir wächst:
              jede erledigte Gewohnheit, jedes To-do und jedes Training bringt Punkte.
            </p>
            <button className="btn btn-primary wiz-btn" onClick={() => setStep(1)}>Weiter</button>
          </div>
        )}

        {step === 1 && (
          <div className="wiz-body">
            <h1 className="wiz-title">Wähle deinen Vogel</h1>
            <p className="wiz-text">Er begleitet dich vom Ei bis zum Phönix. Du kannst ihn später ändern.</p>
            <div className="wiz-pick">
              {SPECIES_KEYS.map((k) => (
                <button key={k} className={`wiz-species${pick === k ? ' on' : ''}`} onClick={() => setPick(k)} aria-pressed={pick === k}>
                  <Bird species={k} stage={4} size={120} />
                  <span className="wiz-species-name">{SPECIES[k].name}</span>
                  <span className="wiz-species-blurb">{SPECIES[k].blurb}</span>
                </button>
              ))}
            </div>
            <div className="wiz-actions">
              <button className="btn btn-secondary" onClick={() => setStep(0)}>Zurück</button>
              <button className="btn btn-primary" onClick={() => setStep(2)}>Weiter</button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="wiz-body">
            <Bird species={pick} stage={level} size={170} />
            <h1 className="wiz-title">{level <= 1 ? `Dein ${SPECIES[pick].name}-Ei` : `Dein ${SPECIES[pick].name}`}</h1>
            <p className="wiz-text">
              {level <= 1
                ? 'Noch ruht alles in der Schale. Erledige Dinge in der App, und es schlüpft.'
                : `Er ist gerade ${STAGE_NAMES[level]} (Level ${level}) und wächst mit jedem Punkt weiter.`}
            </p>
            <div className="wiz-actions">
              <button className="btn btn-secondary" onClick={() => setStep(1)}>Zurück</button>
              <button className="btn btn-primary" onClick={finish}>Los geht’s</button>
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
