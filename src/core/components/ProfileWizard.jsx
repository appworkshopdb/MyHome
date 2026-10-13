// core/components/ProfileWizard.jsx
// Registrierungs-Wizard: läuft nach der ersten Anmeldung (E-Mail ist dann
// bestätigt) und ersetzt die App, solange onboarding_completed_at in
// body_profile fehlt (Gate in App.jsx).
//
// Schritte: Name → Körperdaten → Aktivität/Ziel/Sport → Ernährung & Allergene
// (freiwillig) → Vogel → Abschluss. Jeder Schritt speichert beim „Weiter“
// sofort; wer abbricht, findet beim nächsten Login seine Eingaben vorbefüllt.
// Die Vogelwahl ist endgültig (siehe gamificationStore.setBirdSpecies) und wird
// deshalb erst am Ende festgeschrieben. Danach landet die Person im Hub, wo das
// erste Modul-Tutorial wartet (ModuleTutorial.jsx).
//
// Optik: dieselben Bausteine wie der Finanz-Wizard (.wiz-progress/.wiz-seg/
// .wiz-nav), plus der Vogel als Begleiter: ein Ei, das mit der Person „zuhört“.

import { useEffect, useState } from 'react';
import { useAuth } from '../lib/AuthContext';
import { useUi } from '../lib/UiContext';
import { getBodyProfile, saveBodyProfile, BODY_REQUIRED_FIELDS } from '../lib/bodyProfileData';
import { getDietProfile, saveDietProfile, DIET_OPTIONS, ALLERGEN_OPTIONS } from '../lib/dietProfileData';
import { saveProfileMeta, getProfileMeta } from '../lib/onboardingData';
import { getMissingFields } from '../lib/requiredData';
import { useGamificationStore, setBirdSpecies } from '../lib/gamificationStore';
import { BodyDataForm, ActivityGoalForm } from './BodyProfileForm';
import Bird from './birds/Bird';
import BirdDefs from './birds/BirdDefs';
import { SPECIES, SPECIES_KEYS } from './birds/birdArt';

const BODY_FIELDS = BODY_REQUIRED_FIELDS.filter((f) => ['gender', 'age', 'height', 'weight'].includes(f.key));
// Wie Profile.jsx: Trainingsfokus gehört zu den Pflichtangaben.
const GOAL_FIELDS = [
  ...BODY_REQUIRED_FIELDS.filter((f) => ['activity', 'goal'].includes(f.key)),
  { key: 'training_focus', label: 'Trainingsfokus' },
];

// Eingabe-Schritte (mit Fortschrittsbalken); danach folgt der Abschluss.
const STEPS = [
  { key: 'name', title: 'Wie heißt du?', bubble: 'Hallo! Ich stecke noch im Ei, aber ich höre schon zu.' },
  { key: 'body', title: 'Über dich', bubble: 'Mit ein paar Eckdaten kann ich Ernährung und Training passend für dich rechnen.' },
  { key: 'goal', title: 'Aktivität & Ziel', bubble: 'Wie aktiv bist du, und wohin soll es gehen?' },
  { key: 'food', title: 'Ernährung', optional: true, bubble: 'Gibt es etwas, das du nicht isst oder nicht verträgst? Das ist freiwillig.' },
  { key: 'bird', title: 'Wähle deinen Vogel' },
];

export default function ProfileWizard() {
  const { session } = useAuth();
  const { showToast } = useUi();
  const gami = useGamificationStore(); // lädt den Store, den setBirdSpecies braucht
  const [step, setStep] = useState(0);
  const [name, setName] = useState('');
  const [body, setBody] = useState(null);
  const [diet, setDiet] = useState({ diet: 'alles', allergies: [] });
  const [pick, setPick] = useState('robin');
  const [tried, setTried] = useState(false); // Pflichtfelder erst nach „Weiter“ markieren
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let aktiv = true;
    Promise.all([getBodyProfile(session), getProfileMeta(session), getDietProfile(session)])
      .then(([b, meta, d]) => {
        if (!aktiv) return;
        setBody(b);
        if (meta.display_name) setName(meta.display_name);
        setDiet(d);
      })
      .catch((e) => { console.error('[Onboarding] Laden fehlgeschlagen:', e); if (aktiv) setBody({}); });
    return () => { aktiv = false; };
  }, [session]);

  if (!body) return <div className="loading-note">Lädt…</div>;

  const finish = step >= STEPS.length;
  const key = finish ? 'finish' : STEPS[step].key;

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
      if (key === 'food') await saveDietProfile(session, diet);
      if (key === 'finish') {
        // Erst jetzt festschreiben: die Wahl lässt sich danach nicht mehr ändern.
        await setBirdSpecies(pick);
        // Setzt onboarding_done → App.jsx blendet den Wizard von selbst aus.
        await saveProfileMeta(session, { onboarding_done: true });
        return;
      }
      setTried(false);
      setStep(step + 1);
    } catch (e) {
      console.error('[Onboarding] Speichern fehlgeschlagen:', e);
      showToast('Konnte nicht gespeichert werden. Bitte nochmal versuchen.');
    } finally {
      setBusy(false);
    }
  }

  function toggleAllergen(a) {
    const has = diet.allergies.includes(a);
    setDiet({ ...diet, allergies: has ? diet.allergies.filter((x) => x !== a) : [...diet.allergies, a] });
  }

  const bubble = finish ? null : STEPS[step].bubble;
  const title = finish ? `Alles bereit, ${name.trim()}!` : STEPS[step].title;
  const level = gami.level || 1;

  return (
    <div className="onb">
      <BirdDefs />
      <header className="onb-top">
        <span className="onb-wordmark">NESTUA</span>
        <span className="t-meta">{finish ? 'Fertig' : `Schritt ${step + 1} von ${STEPS.length}`}</span>
      </header>

      <div className="wiz-progress onb-progress">
        {STEPS.map((s, i) => <div key={s.key} className={`wiz-seg ${i <= step || finish ? 'done' : ''}`} />)}
      </div>

      <main className="onb-main">
        {bubble && (
          <div className="onb-companion">
            <Bird species="robin" stage={1} size={64} />
            <p className="onb-bubble">{bubble}</p>
          </div>
        )}

        <h1 className="onb-title">
          {title}
          {!finish && STEPS[step].optional && <span className="wiz-optional"> optional</span>}
        </h1>

        {key === 'name' && (
          <div className="card">
            <label className="wiz-label t-meta" htmlFor="onb-name">
              Dein Name {tried && invalid() && <span className="required-mark">*Pflicht</span>}
            </label>
            <input
              id="onb-name" className="wiz-input wiz-input-name"
              value={name} maxLength={30} autoFocus autoComplete="given-name"
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && next()}
            />
            <p className="profile-section-hint">So sprechen wir dich in der App an.</p>
          </div>
        )}

        {key === 'body' && (
          <div className="card">
            <BodyDataForm value={body} onChange={setBody} requiredFields={tried ? BODY_FIELDS : []} showTitle={false} />
            <p className="profile-section-hint">Du kannst alles später im Profil ändern.</p>
          </div>
        )}

        {key === 'goal' && (
          <div className="card">
            <ActivityGoalForm value={body} onChange={setBody} requiredFields={tried ? GOAL_FIELDS : []} showTitle={false} />
          </div>
        )}

        {key === 'food' && (
          <div className="card">
            <label className="wiz-label t-meta">Ernährungsform</label>
            <div className="segmented cols-2" style={{ marginBottom: 'var(--space-5)' }}>
              {DIET_OPTIONS.map((d) => (
                <button key={d.key} type="button" className={diet.diet === d.key ? 'active' : ''} onClick={() => setDiet({ ...diet, diet: d.key })}>{d.label}</button>
              ))}
            </div>
            <label className="wiz-label t-meta">Allergene und Unverträglichkeiten</label>
            <div className="onb-chips">
              {ALLERGEN_OPTIONS.map((a) => (
                <button
                  key={a} type="button" aria-pressed={diet.allergies.includes(a)}
                  className={`onb-chip${diet.allergies.includes(a) ? ' on' : ''}`}
                  onClick={() => toggleAllergen(a)}
                >{a}</button>
              ))}
            </div>
          </div>
        )}

        {key === 'bird' && (
          <>
            <p className="onb-lead">Er begleitet dich vom Ei bis zum Phönix und wächst mit jedem Punkt.</p>
            <div className="wiz-pick">
              {SPECIES_KEYS.map((k) => (
                <button key={k} type="button" className={`wiz-species${pick === k ? ' on' : ''}`} onClick={() => setPick(k)} aria-pressed={pick === k}>
                  <Bird species={k} stage={4} size={110} />
                  <span className="wiz-species-name">{SPECIES[k].name}</span>
                  <span className="wiz-species-blurb">{SPECIES[k].blurb}</span>
                </button>
              ))}
            </div>
            <p className="wiz-info" role="note">
              <b>Gut überlegen:</b> Die Wahl ist endgültig und lässt sich später nicht mehr ändern.
            </p>
          </>
        )}

        {key === 'finish' && (
          <div className="onb-finish">
            <Bird species={pick} stage={level} size={150} />
            <p className="onb-lead">
              {level <= 1
                ? `Das ist dein ${SPECIES[pick].name}-Ei. Erledige Dinge in der App, und es schlüpft.`
                : `Dein ${SPECIES[pick].name} wartet schon auf dich.`}
            </p>
            <p className="onb-lead">In jedem Bereich zeigt dir eine kurze Tour beim ersten Besuch, wie alles funktioniert.</p>
          </div>
        )}
      </main>

      <div className="wiz-nav onb-nav">
        {step > 0 && !finish && (
          <button type="button" className="btn btn-secondary" disabled={busy} onClick={() => { setTried(false); setStep(step - 1); }}>Zurück</button>
        )}
        {!finish && STEPS[step].optional && (
          <button type="button" className="btn btn-secondary" disabled={busy} onClick={() => { setTried(false); setStep(step + 1); }}>Überspringen</button>
        )}
        <button type="button" className="btn btn-primary onb-next" disabled={busy} onClick={next}>
          {busy ? 'Speichert…' : finish ? 'Los geht’s' : 'Weiter'}
        </button>
      </div>
    </div>
  );
}
