import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../../core/lib/AuthContext';
import { useUi } from '../../core/lib/UiContext';
import { getBodyProfile } from '../../core/lib/bodyProfileData';
import { registerRequirement } from '../../core/lib/requiredDataRegistry';
import { getMissingFields } from '../../core/lib/requiredData';
import { SPORT_REQUIRED_FIELDS } from './lib/requiredFields';
import * as db from './lib/spoData';
import BottomNav from './components/BottomNav';
import TrainingView from './components/TrainingView';
import VerlaufView from './components/VerlaufView';
import PlaeneView from './components/PlaeneView';
import AuswertungView from './components/AuswertungView';

// Meldet sich beim zentralen, modulunabhängigen Pflichtdaten-Register an
// (core/lib/requiredDataRegistry.js) — läuft einmalig beim ersten Import
// dieser Datei. Analog zu NutritionModule.jsx, aber mit eigener Feld-
// Spec (SPORT_REQUIRED_FIELDS statt BODY_REQUIRED_FIELDS) — siehe
// lib/requiredFields.js.
registerRequirement('sport', async (session) => {
  const body = await getBodyProfile(session);
  return getMissingFields(SPORT_REQUIRED_FIELDS, body);
});

// Eigene Leisten-Hülle wie jedes andere Modul (siehe Projektkontext.md,
// "Modul-Leiste"): BottomNav definiert nur die ITEMS, die Optik kommt
// aus core/components/ModuleBottomNav.jsx. Vier Bereiche wie im Konzept
// festgelegt: Training / Verlauf / Pläne / Auswertung.
//
// Formular-Zustand (formInitial) liegt bewusst hier oben und nicht in
// TrainingView, weil "Starten" im Pläne-Tab (PlaeneView) sowohl den Tab
// wechseln als auch das Formular vorbefüllen muss.
export default function SportModule() {
  const { session } = useAuth();
  const { showToast } = useUi();

  const [view, setView] = useState('training');
  const [workouts, setWorkouts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [formInitial, setFormInitial] = useState(false); // false = kein Formular offen

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setWorkouts(await db.getWorkouts(session));
    } catch (e) {
      console.error(e);
      showToast('Trainingseinheiten konnten nicht geladen werden');
    } finally {
      setLoading(false);
    }
  }, [session, showToast]);

  useEffect(() => { load(); }, [load]);

  async function handleSave(workout) {
    try {
      await db.saveWorkout(session, workout);
      setFormInitial(false);
      showToast('Training gespeichert');
      await load();
    } catch (e) {
      console.error(e);
      showToast('Speichern fehlgeschlagen');
    }
  }

  async function handleDelete(id) {
    try {
      await db.deleteWorkout(id);
      await load();
    } catch (e) {
      console.error(e);
      showToast('Löschen fehlgeschlagen');
    }
  }

  function startFromPlan(plan) {
    setFormInitial({ type_key: plan.type_key, title: plan.title });
    setView('training');
  }

  const VIEWS = {
    training: (
      <TrainingView
        formInitial={formInitial}
        onOpenForm={setFormInitial}
        onCancelForm={() => setFormInitial(false)}
        onSave={handleSave}
        showToast={showToast}
      />
    ),
    verlauf: <VerlaufView workouts={workouts} loading={loading} onDelete={handleDelete} />,
    plaene: <PlaeneView session={session} onStartFromPlan={startFromPlan} />,
    auswertung: <AuswertungView />,
  };

  return (
    <>
      {VIEWS[view]}
      <BottomNav active={view} onChange={setView} />
    </>
  );
}
