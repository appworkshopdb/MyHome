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

registerRequirement('sport', async (session) => {
  const body = await getBodyProfile(session);
  return getMissingFields(SPORT_REQUIRED_FIELDS, body);
});

const DEFAULT_VIEW = 'training';

// Hält den gesamten Modul-Zustand: Einheiten, Plan-Vorlagen und die im
// Profil gewählten Sportarten. Alles wird EINMAL geladen und an die
// Views durchgereicht — dadurch arbeiten Kalender, Auswertung und
// Plan-Anwendung garantiert auf demselben Stand.
// view/onNavigateView kommen von App.jsx (URL-Routing) — kein eigener
// useState für die Unteransicht mehr, siehe FinanceModule.jsx/Projektkontext.md.
export default function SportModule({ view, onNavigateView }) {
  const { session } = useAuth();
  const { showToast } = useUi();

  const activeView = ['training', 'verlauf', 'plaene', 'auswertung'].includes(view) ? view : DEFAULT_VIEW;
  const [workouts, setWorkouts] = useState([]);
  const [plans, setPlans] = useState([]);
  const [userSports, setUserSports] = useState([]);
  const [loading, setLoading] = useState(true);

  const [formInitial, setFormInitial] = useState(false); // Workout-Formular
  const [editingPlan, setEditingPlan] = useState(null);  // Plan-Editor
  const [applyingPlan, setApplyingPlan] = useState(null); // Anwenden-Dialog

  const load = useCallback(async () => {
    setLoading(true);
    try {
      // Parallel, weil die drei Quellen unabhängig sind — sequenziell
      // würde das Öffnen des Moduls unnötig dreimal so lange dauern.
      const [ws, ps, profile] = await Promise.all([
        db.getWorkouts(session),
        db.getPlans(session),
        getBodyProfile(session),
      ]);
      setWorkouts(ws);
      setPlans(ps);
      setUserSports(profile.sports ?? []);
    } catch (e) {
      console.error(e);
      showToast('Daten konnten nicht geladen werden');
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

  // Abhaken im Kalender: nur der Statuswechsel. Der DB-Trigger schreibt
  // bzw. entfernt daraufhin die measurements-Zeilen, wodurch die Einheit
  // in Auswertung und Hub auftaucht.
  async function handleToggleDone(workout) {
    try {
      await db.setWorkoutStatus(workout.id, workout.status !== 'done');
      await load();
    } catch (e) {
      console.error(e);
      showToast('Status konnte nicht geändert werden');
    }
  }

  function handleEdit(workout) {
    setFormInitial(workout);
    onNavigateView('training');
  }

  function handlePlanNew(date) {
    setFormInitial({ occurred_on: date, status: 'planned' });
    onNavigateView('training');
  }

  function startFromPlan(preset) {
    setFormInitial({ type_key: preset.type_key, title: preset.title });
    onNavigateView('training');
  }

  // --- Plan-Vorlagen -------------------------------------------------

  async function handleSavePlan(plan, items) {
    try {
      await db.savePlan(session, plan, items);
      setEditingPlan(null);
      showToast('Plan gespeichert');
      await load();
    } catch (e) {
      console.error(e);
      showToast('Plan konnte nicht gespeichert werden');
    }
  }

  async function handleDeletePlan(id) {
    try {
      await db.deletePlan(id);
      await load();
    } catch (e) {
      console.error(e);
      showToast('Plan konnte nicht gelöscht werden');
    }
  }

  // Nach dem Eintragen direkt in den Kalender wechseln — dort sieht man
  // sofort, was angelegt wurde, statt auf eine Erfolgsmeldung zu starren.
  async function handleApplyPlan(plan, startDate) {
    try {
      const count = await db.applyPlan(session, plan, startDate);
      setApplyingPlan(null);
      showToast(`${count} Einheiten eingetragen`);
      await load();
      onNavigateView('verlauf');
    } catch (e) {
      console.error(e);
      showToast('Plan konnte nicht eingetragen werden');
    }
  }

  const VIEWS = {
    training: (
      <TrainingView
        formInitial={formInitial}
        onOpenForm={setFormInitial}
        onCancelForm={() => setFormInitial(false)}
        onSave={handleSave}
        showToast={showToast}
        userSports={userSports}
      />
    ),
    verlauf: (
      <VerlaufView
        workouts={workouts}
        plans={plans}
        loading={loading}
        onToggleDone={handleToggleDone}
        onEdit={handleEdit}
        onDelete={handleDelete}
        onPlanNew={handlePlanNew}
        onApplyPlan={handleApplyPlan}
      />
    ),
    plaene: (
      <PlaeneView
        session={session}
        plans={plans}
        loading={loading}
        userSports={userSports}
        editing={editingPlan}
        applying={applyingPlan}
        onNewPlan={() => setEditingPlan({})}
        onEditPlan={setEditingPlan}
        onDeletePlan={handleDeletePlan}
        onSavePlan={handleSavePlan}
        onCancelEdit={() => setEditingPlan(null)}
        onOpenApply={setApplyingPlan}
        onApplyPlan={handleApplyPlan}
        onCancelApply={() => setApplyingPlan(null)}
        onStartFromPlan={startFromPlan}
        showToast={showToast}
      />
    ),
    auswertung: <AuswertungView workouts={workouts} loading={loading} />,
  };

  return (
    <>
      {VIEWS[activeView]}
      <BottomNav active={activeView} onChange={onNavigateView} />
    </>
  );
}
