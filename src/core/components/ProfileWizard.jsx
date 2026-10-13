// core/components/ProfileWizard.jsx
// Registrierungs-Wizard: läuft nach der ersten Anmeldung (E-Mail ist dann
// bestätigt) und ersetzt die App, solange onboarding_completed_at in
// body_profile fehlt (Gate in App.jsx).
//
// Fortschritt: 6 Schritte, Schritt 1 ist die E-Mail-Bestätigung und gilt hier
// schon als erledigt — die Leiste erscheint also erst jetzt, mit Schritt 2
// (Name) als aktuellem. Danach: Körperdaten, Aktivität/Ziel/Sport, Ernährung &
// Allergene (freiwillig), Vogelwahl (Schritt 6), Abschluss.
//
// Das Ei füllt sich von Schritt zu Schritt mit Farbe (EggFill: 20/40/60/80 %),
// bei der Vogelwahl ist es nicht zu sehen, am Ende ist es voll (das echte
// Vogel-Ei der gewählten Art). Jeder Schritt speichert beim „Weiter“ sofort;
// wer abbricht, findet beim nächsten Login seine Eingaben vorbefüllt. Die
// Vogelwahl ist endgültig (gamificationStore.setBirdSpecies) und wird deshalb
// erst am Ende festgeschrieben. Danach landet die Person im Hub, wo das erste
// Modul-Tutorial wartet (ModuleTutorial.jsx). Styles: styles/onboarding.css.

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
import { SPECIES, SPECIES_KEYS, STAGE_NAMES } from './birds/birdArt';
import EggFill from './EggFill';
import { ModuleIcon, UiIcon } from './ModuleIcons';

const BODY_FIELDS = BODY_REQUIRED_FIELDS.filter((f) => ['gender', 'age', 'height', 'weight'].includes(f.key));
// Wie Profile.jsx: Trainingsfokus gehört zu den Pflichtangaben.
const GOAL_FIELDS = [
  ...BODY_REQUIRED_FIELDS.filter((f) => ['activity', 'goal'].includes(f.key)),
  { key: 'training_focus', label: 'Trainingsfokus' },
];

const TOTAL = 6; // inkl. E-Mail-Bestätigung (Schritt 1, schon erledigt)

// Eingabe-Schritte = Schritt 2 bis 6. egg = Füllstand des Eis (0–1).
const STEPS = [
  { key: 'name', title: 'Wie heißt du?', egg: 0.2, big: true },
  { key: 'body', title: 'Über dich', egg: 0.4 },
  { key: 'goal', title: 'Aktivität & Ziel', egg: 0.6 },
  { key: 'food', title: 'Ernährung', optional: true, egg: 0.8 },
  { key: 'bird', title: 'Wähle deinen Vogel' },
];

// Bereichs-Symbole der Abschlussseite (Reihenfolge wie die Bottom-Nav)
const MODULE_ROW = [
  { id: 'hub', label: 'Hub' }, { id: 'habits', label: 'Gewohn­heiten' }, { id: 'finance', label: 'Finanzen' },
  { id: 'sport', label: 'Sport' }, { id: 'nutrition', label: 'Ernäh­rung' }, { id: 'shopping', label: 'Einkauf' },
];
const WAY = [1, 2, 4, 10, 12]; // Stufen des „Sein Weg“-Streifens (Ei … Phönix)

const CONFETTI = [
  { w: 10, h: 10, c: 'var(--warm)', l: 48, t: 40, r: 20 }, { w: 8, h: 14, c: 'var(--data-2)', l: 96, t: 78, r: -30 },
  { w: 12, h: 7, c: '#F2C94C', l: 300, t: 46, r: 40 }, { w: 9, h: 9, c: 'var(--action-primary)', l: 330, t: 110, r: 12 },
  { w: 7, h: 13, c: 'var(--warm)', l: 262, t: 34, r: -20 }, { w: 11, h: 8, c: 'var(--data-3)', l: 34, t: 140, r: -12 },
  { w: 8, h: 8, c: '#F2C94C', l: 70, t: 196, r: 30 }, { w: 10, h: 6, c: 'var(--data-2)', l: 316, t: 190, r: -34 },
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
  const cur = finish ? null : STEPS[step];
  const first = name.trim();
  const level = gami.level || 1;

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

  const bubble = {
    name: 'Willkommen im Nest! Ich bin noch im Ei, aber ich höre schon zu.',
    body: `Super, ${first || 'du'}! Mit ein paar Eckdaten rechne ich Ernährung und Training passend für dich.`,
    goal: 'Halbzeit! Wie aktiv bist du, und wohin soll es gehen?',
    food: 'Nur noch zwei Schritte! Gibt es etwas, das du nicht isst oder nicht verträgst? Das ist freiwillig.',
  }[key];

  const title = finish ? `Geschafft, ${first}!` : cur.title;

  return (
    <div className="onb">
      <BirdDefs />
      <header className="onb-top">
        <span className="onb-wordmark">NESTUA</span>
        <span className="onb-count">{finish ? 'Fertig' : `Schritt ${step + 2} von ${TOTAL}`}</span>
      </header>

      <div className="onb-prog" role="progressbar" aria-valuemin={1} aria-valuemax={TOTAL} aria-valuenow={finish ? TOTAL : step + 2}>
        {Array.from({ length: TOTAL }, (_, j) => (
          <i key={j} className={`onb-seg${finish || j <= step ? ' on' : ''}${!finish && j === step + 1 ? ' cur' : ''}`} />
        ))}
      </div>

      {key === 'name' && (
        <span className="onb-okchip"><i><UiIcon name="check" size={11} strokeWidth={3.4} /></i>E-Mail bestätigt</span>
      )}

      {/* Begleiter-Bühne: Ei füllt sich (R1–R4), in der Vogelwahl keine Bühne, am Ende das echte Ei */}
      {cur && cur.egg != null && (
        <div className={`onb-hero${cur.big ? ' big' : ''}`}>
          <p className="onb-bubble">{bubble}</p>
          <EggFill level={cur.egg} height={cur.big ? 132 : 84} className="onb-egg" />
          {cur.big && (<><i className="onb-spark" style={{ width: 9, height: 9, background: 'var(--warm)', left: 44, bottom: 92 }} /><i className="onb-spark" style={{ width: 6, height: 6, background: 'var(--data-2)', right: 56, bottom: 70 }} /></>)}
        </div>
      )}
      {finish && (
        <div className="onb-hero big finish">
          {CONFETTI.map((c, i) => <i key={i} className="onb-conf" style={{ width: c.w, height: c.h, background: c.c, left: c.l, top: c.t, transform: `rotate(${c.r}deg)` }} />)}
          <span className="onb-level">{`Level ${level} · ${STAGE_NAMES[level]}`}</span>
          <div className="onb-bigbird"><Bird species={pick} stage={level} size={150} /></div>
        </div>
      )}

      <main className="onb-main">
        <h1 className="onb-title">
          {title}
          {cur?.optional && <small>optional</small>}
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
            <p className="profile-section-hint">Nur für deine Berechnungen, nichts davon wird weitergegeben. Du kannst alles später im Profil ändern.</p>
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
            <p className="onb-lead">Dein letzter Schritt! Er begleitet dich vom Ei bis zum Phönix und wächst mit jedem Punkt, den du sammelst.</p>
            <div className="wiz-pick">
              {SPECIES_KEYS.map((k) => (
                <button key={k} type="button" className={`wiz-species${pick === k ? ' on' : ''}`} onClick={() => setPick(k)} aria-pressed={pick === k}>
                  <Bird species={k} stage={4} size={110} />
                  <span className="wiz-species-name">{SPECIES[k].name}</span>
                  <span className="wiz-species-blurb">{SPECIES[k].blurb}</span>
                </button>
              ))}
            </div>
            <div className="card onb-way">
              <span className="onb-label">Sein Weg · 14 Stufen</span>
              <ol>
                {WAY.map((s, i) => (
                  <li key={s} className={i === 0 ? 'on' : ''}><i />{STAGE_NAMES[s]}</li>
                ))}
              </ol>
            </div>
            <p className="wiz-info" role="note">
              <b>Gut überlegen:</b> Die Wahl ist endgültig und lässt sich später nicht mehr ändern.
            </p>
          </>
        )}

        {key === 'finish' && (
          <>
            <p className="onb-lead">
              {level <= 1
                ? `Dein ${SPECIES[pick].name}-Ei ist bereit. Jeder erledigte Punkt wärmt es, bis dein Vogel schlüpft.`
                : `Dein ${SPECIES[pick].name} wartet schon auf dich.`}
            </p>
            <div className="card onb-mods">
              {MODULE_ROW.map((m) => (
                <div key={m.id}><i><ModuleIcon id={m.id} size={22} strokeWidth={1.9} /></i>{m.label}</div>
              ))}
            </div>
            <p className="onb-hint">In jedem Bereich zeigt dir eine kurze Tour beim ersten Besuch, wie alles funktioniert.</p>
          </>
        )}
      </main>

      <div className="onb-nav">
        {step > 0 && !finish && (
          <button type="button" className="btn btn-secondary" disabled={busy} onClick={() => { setTried(false); setStep(step - 1); }}>Zurück</button>
        )}
        {cur?.optional && (
          <button type="button" className="btn onb-ghost" disabled={busy} onClick={() => { setTried(false); setStep(step + 1); }}>Überspringen</button>
        )}
        <button type="button" className="btn btn-primary onb-next" disabled={busy} onClick={next}>
          {busy ? 'Speichert…' : finish ? 'Los geht’s' : 'Weiter'}
        </button>
      </div>
    </div>
  );
}
