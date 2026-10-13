// core/components/ProfileWizard.jsx
// Profil-Einrichtung (Pflichtdaten) nach der ersten Anmeldung — die E-Mail
// ist dann bereits bestätigt. App.jsx zeigt ihn anstelle der App, solange
// onboarding_completed_at in body_profile fehlt. Danach folgt wie bisher der
// WelcomeWizard (Vogelwahl, gamification_status.bird_species) — die Vogelwahl
// ist bewusst NICHT Teil dieses Wizards, sie hat ihr eigenes System.
//
// Neuen Schritt ergänzen = Eintrag in STEPS (+ ggf. eine Gültigkeitsprüfung
// in validate()). Jeder Schritt speichert beim „Weiter“ sofort; wer abbricht
// und sich später wieder anmeldet, findet seine Eingaben vorbefüllt.

import { useEffect, useState } from 'react';
import { useAuth } from '../lib/AuthContext';
import { useUi } from '../lib/UiContext';
import { getBodyProfile, saveBodyProfile, BODY_REQUIRED_FIELDS } from '../lib/bodyProfileData';
import { saveProfileMeta, getProfileMeta } from '../lib/onboardingData';
import { getMissingFields } from '../lib/requiredData';
import { BodyDataForm, ActivityGoalForm } from './BodyProfileForm';

// Wie Profile.jsx: Trainingsfokus gehört zu den Pflichtangaben.
const BODY_FIELDS = BODY_REQUIRED_FIELDS.filter((f) => ['gender', 'age', 'height', 'weight'].includes(f.key));
const GOAL_FIELDS = [
  ...BODY_REQUIRED_FIELDS.filter((f) => ['activity', 'goal'].includes(f.key)),
  { key: 'training_focus', label: 'Trainingsfokus' },
];

const STEPS = [
  { key: 'name',   title: 'Schön, dass du da bist' },
  { key: 'body',   title: 'Über dich' },
  { key: 'goal',   title: 'Aktivität & Ziel' },
  { key: 'finish', title: 'Alles bereit' },
];

export default function ProfileWizard() {
  const { session } = useAuth();
  const { showToast } = useUi();
  const [step, setStep] = useState(0);
  const [name, setName] = useState('');
  const [body, setBody] = useState(null);
  const [tried, setTried] = useState(false); // erst nach „Weiter“ Pflichtfelder markieren
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let aktiv = true;
    Promise.all([getBodyProfile(session), getProfileMeta(session)])
      .then(([b, meta]) => {
        if (!aktiv) return;
        setBody(b);
        if (meta.display_name) setName(meta.display_name);
      })
      .catch((e) => { console.error('[Onboarding] Laden fehlgeschlagen:', e); if (aktiv) setBody({}); });
    return () => { aktiv = false; };
  }, [session]);

  if (!body) return <div className="loading-note">Lädt…</div>;

  const key = STEPS[step].key;

  function invalid() {
    if (key === 'name') return name.trim().length < 2;
    if (key === 'body') return getMissingFields(BODY_FIELDS, body).length > 0;
    if (key === 'goal') return getMissingFields(GOAL_FIELDS, body).length > 0;
    return false;
  }

  async function next() {
    if (invalid()) { setTried(true); return; }
    setBusy(true);
    try {
      if (key === 'name') await saveProfileMeta(session, { display_name: name.trim() });
      if (key === 'body' || key === 'goal') await saveBodyProfile(session, body);
      if (key === 'finish') {
        // Setzt onboarding_done → App.jsx blendet den Wizard von selbst aus.
        await saveProfileMeta(session, { onboarding_done: true });
        return;
      }
      setTried(false);
      setStep(step + 1);
    } catch (e) {
      console.error('[Onboarding] Speichern fehlgeschlagen:', e);
      showToast('Konnte nicht gespeichert werden — bitte nochmal versuchen');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="onb">
      <div className="onb-head">
        <div className="auth-wordmark" style={{ padding: 0 }}>NESTUA</div>
        <div className="onb-dots" aria-label={`Schritt ${step + 1} von ${STEPS.length}`}>
          {STEPS.map((s, i) => <span key={s.key} className={i <= step ? 'on' : ''} />)}
        </div>
      </div>

      <div className="onb-body">
        <h1 className="onb-title">{STEPS[step].title}</h1>

        {key === 'name' && (
          <>
            <p className="onb-lead">
              Ein paar Fragen, damit Nestua zu dir passt. Das dauert etwa eine Minute.
            </p>
            <div className="auth-field">
              <label>Wie sollen wir dich nennen?{tried && invalid() && <span className="required-mark">*Pflicht</span>}</label>
              <input
                value={name} maxLength={30} autoFocus autoComplete="given-name"
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && next()}
              />
            </div>
          </>
        )}

        {key === 'body' && (
          <>
            <p className="onb-lead">Für Ernährung und Sport brauchen wir ein paar Basisdaten. Du kannst sie später im Profil ändern.</p>
            <BodyDataForm value={body} onChange={setBody} requiredFields={tried ? BODY_FIELDS : []} showTitle={false} />
          </>
        )}

        {key === 'goal' && (
          <ActivityGoalForm value={body} onChange={setBody} requiredFields={tried ? GOAL_FIELDS : []} showTitle={false} />
        )}

        {key === 'finish' && (
          <div className="onb-finish">
            <p className="onb-lead">
              Alles eingerichtet, {name.trim()}! Als Nächstes wählst du deinen Vogel,
              der dich durch die App begleitet.
            </p>
          </div>
        )}
      </div>

      <div className="onb-actions">
        {step > 0 && key !== 'finish' && (
          <button type="button" className="btn btn-secondary" disabled={busy} onClick={() => { setTried(false); setStep(step - 1); }}>
            Zurück
          </button>
        )}
        <button type="button" className="btn btn-primary" style={{ flex: 1 }} disabled={busy} onClick={next}>
          {busy ? 'Speichert…' : key === 'finish' ? 'Weiter zur Vogelwahl' : 'Weiter'}
        </button>
      </div>
    </div>
  );
}
