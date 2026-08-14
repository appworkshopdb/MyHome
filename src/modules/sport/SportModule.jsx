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
// Spec (SPORT_REQUIRED_FIELDS statt BODY_REQUIRED_FIELDS).
registerRequirement('sport', async (session) => {
  const body = await getBodyProfile(session);
  return getMissingFields(SPORT_REQUIRED_FIELDS, body);
});

// Vier Bereiche über die modul-eigene Leiste (siehe Projektkontext.md,
// "Modul-Leiste"): Training / Verlauf (= Kalender) / Pläne / Auswertung.
//
// workouts wird EINMAL hier geladen und an alle Views durchgereicht —
// Kalender, Tagesansicht und Auswertung arbeiten damit garantiert auf
// demselben Stand, und ein Abhaken im Kalender schlägt sofort in der
// Auswertung durch, ohne zweiten Ladevorgang.
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
      showToast(workout.status === 'planned' ? 'Training geplant' : 'Training gespeichert');
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

  // Abhaken im Kalender: nur der Statuswechsel, kein Formular. Der
  // DB-Trigger schreibt bzw. entfernt daraufhin die measurements-Zeilen,
  // wodurch die Einheit in Auswertung und Hub auftaucht.
  async function handleToggleDone(workout) {
    try {
      await db.setWorkoutStatus(workout.id, workout.status !== 'done');
      await load();
    } catch (e) {
      console.error(e);
      showToast('Status konnte nicht geändert werden');
    }
  }

  // Bearbeiten und Neuplanen öffnen dasselbe Formular im Training-Tab —
  // deshalb liegt formInitial hier oben und nicht in einer einzelnen View.
  function handleEdit(workout) {
    setFormInitial(workout);
    setView('training');
  }

  function handlePlanNew(date) {
    setFormInitial({ occurred_on: date, status: 'planned' });
    setView('training');
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
    verlauf: (
      <VerlaufView
        workouts={workouts}
        loading={loading}
        onToggleDone={handleToggleDone}
        onEdit={handleEdit}
        onDelete={handleDelete}
        onPlanNew={handlePlanNew}
      />
    ),
    plaene: <PlaeneView session={session} onStartFromPlan={startFromPlan} />,
    auswertung: <AuswertungView workouts={workouts} loading={loading} />,
  };

  return (
    <>
      {VIEWS[view]}
      <BottomNav active={view} onChange={setView} />
    </>
  );
}
