// core/components/ModuleTutorial.jsx
// Kleines Tutorial beim ersten Besuch eines Bereichs (Hub, Gewohnheiten,
// Ernährung, Finanzen, Sport, Einkauf): ein paar Folien, dann EINE echte
// Interaktion — das Anlege-Sheet des Bereichs öffnet sich, dieselben Sheets wie
// beim Plus-Knopf (GlobalFab.jsx). Inhalte: core/lib/tutorials.js.
//
// Wird einmal in App.jsx gerendert und entscheidet selbst, ob etwas zu zeigen
// ist. Der Zustand „gesehen“ liegt pro Nutzer in body_profile.tutorials_done;
// Überspringen und Abschließen zählen beide. Ohne die Migration (Spalte fehlt)
// bleiben die Tutorials aus.
//
// Sheet-Lebenszyklus: Während ein Sheet offen ist, wird die Karte ausgeblendet.
// Wird es ohne Speichern geschlossen, erscheint die Karte wieder auf der
// Aktionsfolie. Ob gespeichert wurde, erkennt ein onSaved bzw. die Version aus
// EntrySheetContext (Sport/Finanzen rufen notifySaved()).

import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../lib/AuthContext';
import { useEntrySheet } from '../lib/EntrySheetContext';
import { useGamificationStore } from '../lib/gamificationStore';
import { useTutorialsDone, markTutorialDone } from '../lib/onboardingData';
import { track } from '../lib/analytics';
import { TUTORIALS, tutorialIdFor } from '../lib/tutorials';
import Bird from './birds/Bird';
import TodoSheet from './TodoSheet';
import HabitTemplatePicker from './HabitTemplatePicker';
import SportQuickSheet from './SportQuickSheet';
import ShoppingQuickSheet from './ShoppingQuickSheet';
import NutritionFabMenu from './NutritionFabMenu';
import { ModuleIcon } from './ModuleIcons';
import { SlideStage, MissionStage, SuccessStage } from './TutorialStage';

// Events, mit denen Ernährung einen Anlege-Weg startet (siehe NutritionFabMenu.jsx).
const NUTRITION_START_EVENTS = ['nutrition:new-recipe', 'nutrition:new-food', 'nutrition:log-meal', 'nutrition:meal-scanned'];

export default function ModuleTutorial({ activeModule }) {
  const { session } = useAuth();
  const gami = useGamificationStore();
  const { open: openEntrySheet, openFor, getVersion, notifySaved } = useEntrySheet();
  const done = useTutorialsDone(session);

  const id = tutorialIdFor(activeModule);
  const tutorial = id ? TUTORIALS[id] : null;

  const [slide, setSlide] = useState(0);
  const [acting, setActing] = useState(false);
  const [success, setSuccess] = useState(false);
  const [dismissed, setDismissed] = useState(() => new Set());

  const savedRef = useRef(false);
  const openVersionRef = useRef(0);
  const financeOpenedRef = useRef(false);

  // Beim Bereichswechsel von vorn beginnen.
  useEffect(() => { setSlide(0); setActing(false); setSuccess(false); }, [id]);

  // Ernährung: ein Start-Event zählt als „angelegt“ (das Modul öffnet danach selbst den Dialog).
  useEffect(() => {
    if (!acting || id !== 'nutrition') return undefined;
    const mark = () => { savedRef.current = true; };
    NUTRITION_START_EVENTS.forEach((e) => window.addEventListener(e, mark));
    return () => NUTRITION_START_EVENTS.forEach((e) => window.removeEventListener(e, mark));
  }, [acting, id]);

  // Finanzen läuft über den globalen EntrySheet: schließt er, auswerten.
  useEffect(() => {
    if (!acting || id !== 'finance') return;
    if (openFor === 'finance') { financeOpenedRef.current = true; return; }
    if (financeOpenedRef.current && openFor === null) {
      financeOpenedRef.current = false;
      settle();
    }
  }, [openFor]); // eslint-disable-line react-hooks/exhaustive-deps

  // Während die Erfolgsseite steht, bleibt die Tour sichtbar, auch wenn „gesehen“
  // schon gespeichert ist (sonst verschwände sie sofort wieder).
  const visible = Boolean(
    session && tutorial && done && (!done.includes(id) || success) && !dismissed.has(id)
    && gami.loaded && gami.bird_species, // nie über dem Vogel-Willkommens-Assistenten
  );

  // Funnel-Messung: Tutorial gezeigt → abgeschlossen/übersprungen → Aktion ausgeführt.
  useEffect(() => { if (visible && !success) track('tutorial_shown', { tutorial: id }); }, [visible, id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!visible) return null;

  function finish(didAct) {
    track('tutorial_done', { tutorial: id, acted: Boolean(didAct), slide });
    markTutorialDone(session, id);
    setActing(false);
    if (didAct && tutorial.celebrate !== false && tutorial.success) {
      setSuccess(true);
    } else {
      setDismissed((prev) => new Set(prev).add(id));
    }
  }

  // Nach dem Schließen eines Sheets: gespeichert → fertig, sonst zurück zur Karte.
  function settle() {
    const saved = savedRef.current || getVersion() !== openVersionRef.current;
    if (saved) finish(true); else setActing(false);
  }

  function startAction() {
    savedRef.current = false;
    openVersionRef.current = getVersion();
    financeOpenedRef.current = false;
    setActing(true);
    if (tutorial.action.kind === 'finance') openEntrySheet('finance');
  }

  // Sheet offen → nur das Sheet zeigen.
  if (acting) {
    const kind = tutorial.action.kind;
    const onSaved = () => { savedRef.current = true; };
    if (kind === 'todo') return <TodoSheet onClose={settle} onSaved={() => { onSaved(); notifySaved(); }} />;
    if (kind === 'habit') return <HabitTemplatePicker onClose={settle} onSaved={onSaved} />;
    if (kind === 'sport') return <SportQuickSheet onClose={settle} />;
    if (kind === 'shopping') return <ShoppingQuickSheet onClose={settle} onSaved={onSaved} />;
    if (kind === 'nutrition') return <NutritionFabMenu onClose={settle} />;
    return null; // finance: der EntrySheet rendert sich selbst (App.jsx)
  }

  const last = slide >= tutorial.slides.length; // Aktionsfolie
  const current = tutorial.slides[slide];
  const total = tutorial.slides.length + 1;

  function skip() { finish(false); }

  const peekLeft = !success && (last || ['plan', 'habit'].includes(current?.stage?.kind));

  return (
    <div className="tut" role="dialog" aria-modal="true" aria-label={`Tour ${tutorial.name}`}>
      <div className="tut-in">
        <div className="tut-top">
          <div className="tut-pill"><i><ModuleIcon id={tutorial.icon} size={17} strokeWidth={2} /></i>{tutorial.name}</div>
          <span className="onb-count">{success ? 'Geschafft' : `${slide + 1} von ${total}`}</span>
        </div>

        <div className="tut-stage">
          {success ? <SuccessStage /> : last ? <MissionStage mission={tutorial.action.mission} /> : <SlideStage stage={current.stage} moduleIcon={tutorial.icon} />}
          <span className="tut-peek" style={peekLeft ? { left: 14 } : { right: 14 }}>
            <Bird species={gami.bird_species} stage={gami.level} size={64} />
          </span>
        </div>

        <div className="tut-sheet">
          {success ? (
            <>
              <h2 className="tut-title">Geschafft!</h2>
              <p className="tut-text">{tutorial.success}</p>
              <div className="tut-btns">
                <button type="button" className="btn btn-primary" onClick={() => setDismissed((p) => new Set(p).add(id))}>Weiter</button>
              </div>
            </>
          ) : (
            <>
              <div className="tut-dots" aria-hidden="true">
                {Array.from({ length: total }, (_, i) => <span key={i} className={i === slide ? 'on' : ''} />)}
              </div>
              <h2 className="tut-title">{last ? 'Probier es gleich aus' : current.title}</h2>
              <p className="tut-text">{last ? tutorial.action.hint : current.text}</p>
              <div className="tut-btns">
                <button type="button" className="btn btn-secondary" onClick={skip}>{last ? 'Später' : 'Überspringen'}</button>
                {last
                  ? <button type="button" className="btn btn-primary" onClick={startAction}>{tutorial.action.label}</button>
                  : <button type="button" className="btn btn-primary" onClick={() => setSlide(slide + 1)}>Weiter</button>}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
