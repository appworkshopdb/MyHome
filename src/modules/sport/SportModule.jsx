import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../../core/lib/AuthContext';
import { useUi } from '../../core/lib/UiContext';
import { getBodyProfile } from '../../core/lib/bodyProfileData';
import { registerRequirement } from '../../core/lib/requiredDataRegistry';
import { getMissingFields } from '../../core/lib/requiredData';
import { SPORT_REQUIRED_FIELDS } from './lib/requiredFields';
import * as db from './lib/spoData';
import ModuleTopBar from '../../core/components/ModuleTopBar';
import { fb } from '../../core/lib/feedback';
import ModuleTabs from '../../core/components/ModuleTabs';
import EinheitenView from './components/EinheitenView';
import VerlaufView from './components/VerlaufView';
import PlaeneView from './components/PlaeneView';
import AuswertungView from './components/AuswertungView';

registerRequirement('profile', async (session) => {
  const body = await getBodyProfile(session);
  return getMissingFields(SPORT_REQUIRED_FIELDS, body);
});

// KONZEPT-KORREKTUR (vorheriger Stand: Training/Kalender/Pläne/
// Auswertung, "Training" war ein leerer Direkt-Eintragen-Screen):
// einzelne Trainingseinheiten (z.B. "Arme", "Legday") sind jetzt eine
// eigene, wiederverwendbare Bibliothek (Tab "Einheiten") — ein
// Trainingsplan setzt sich aus mehreren Einheiten zusammen, statt dass
// jede Einheit als eigener 1-Tage-"Plan" angelegt werden musste.
const DEFAULT_VIEW = 'verlauf';
const TABS = [
  { key: 'verlauf', label: 'Kalender' },
  { key: 'einheiten', label: 'Einheiten' },
  { key: 'plaene', label: 'Pläne' },
  { key: 'auswertung', label: 'Auswertung' },
];

// Hält den gesamten Modul-Zustand: Einheiten (Workouts im Kalender),
// die Einheiten-Bibliothek, Plan-Vorlagen und die im Profil gewählten
// Sportarten. Alles wird EINMAL geladen und an die Views durchgereicht
// — dadurch arbeiten Kalender, Pläne und Auswertung garantiert auf
// demselben Stand.
// view/onNavigateView kommen von App.jsx (URL-Routing) — kein eigener
// useState für die Unteransicht mehr, siehe FinanceModule.jsx/Projektkontext.md.
export default function SportModule({ view, onNavigateView, hasWarnings }) {
  const { session } = useAuth();
  const { showToast } = useUi();

  const activeView = ['verlauf', 'einheiten', 'plaene', 'auswertung'].includes(view) ? view : DEFAULT_VIEW;
  const [workouts, setWorkouts] = useState([]);
  const [units, setUnits] = useState([]);
  const [plans, setPlans] = useState([]);
  const [userSports, setUserSports] = useState([]);
  const [loading, setLoading] = useState(true);

  // formInitial steuert jetzt das Formular INNERHALB des Kalender-Tabs
  // (VerlaufView) statt eines eigenen "Training"-Tabs — der ist mit der
  // Einheiten-Bibliothek weggefallen. "Bearbeiten"/"+ Einzelne Einheit"
  // im Kalender sowie "Starten" bei einem Vorschlag springen deshalb
  // alle auf 'verlauf'.
  const [formInitial, setFormInitial] = useState(false);
  const [editingUnit, setEditingUnit] = useState(null);   // Einheiten-Editor
  const [editingPlan, setEditingPlan] = useState(null);   // Plan-Editor
  const [applyingPlan, setApplyingPlan] = useState(null); // Anwenden-Dialog

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [ws, us, ps, profile] = await Promise.all([
        db.getWorkouts(session),
        db.getUnits(session),
        db.getPlans(session),
        getBodyProfile(session),
      ]);
      setWorkouts(ws);
      setUnits(us);
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
      if (workout.is_rest) { fb.restDay(); }
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

  async function handleToggleDone(workout) {
    try {
      const wirdErledigt = workout.status !== 'done';
      await db.setWorkoutStatus(workout.id, wirdErledigt);
      if (wirdErledigt) { fb.workoutDone(); }
      await load();
    } catch (e) {
      console.error(e);
      showToast('Status konnte nicht geändert werden');
      fb.error();
    }
  }

  function handleEdit(workout) {
    setFormInitial(workout);
    onNavigateView('verlauf');
  }

  function handlePlanNew(date) {
    setFormInitial({ occurred_on: date, status: 'planned' });
    onNavigateView('verlauf');
  }

  function startFromPlan(preset) {
    setFormInitial({ type_key: preset.type_key, title: preset.title });
    onNavigateView('verlauf');
  }

  // --- Einheiten-Bibliothek --------------------------------------------

  async function handleSaveUnit(unit) {
    try {
      await db.saveUnit(session, unit);
      setEditingUnit(null);
      showToast('Einheit gespeichert');
      await load();
    } catch (e) {
      console.error(e);
      showToast('Einheit konnte nicht gespeichert werden');
    }
  }

  async function handleDeleteUnit(id) {
    try {
      await db.deleteUnit(id);
      await load();
    } catch (e) {
      console.error(e);
      showToast('Einheit konnte nicht gelöscht werden');
    }
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
    verlauf: (
      <VerlaufView
        workouts={workouts}
        plans={plans}
        units={units}
        loading={loading}
        onToggleDone={handleToggleDone}
        onEdit={handleEdit}
        onDelete={handleDelete}
        onPlanNew={handlePlanNew}
        onApplyPlan={handleApplyPlan}
        formInitial={formInitial}
        onOpenForm={setFormInitial}
        onCancelForm={() => setFormInitial(false)}
        onSaveForm={handleSave}
        userSports={userSports}
        showToast={showToast}
      />
    ),
    einheiten: (
      <EinheitenView
        units={units}
        loading={loading}
        userSports={userSports}
        editing={editingUnit}
        onNewUnit={() => setEditingUnit({})}
        onEditUnit={setEditingUnit}
        onDeleteUnit={handleDeleteUnit}
        onSaveUnit={handleSaveUnit}
        onCancelEdit={() => setEditingUnit(null)}
        showToast={showToast}
      />
    ),
    plaene: (
      <PlaeneView
        session={session}
        plans={plans}
        units={units}
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
      <ModuleTopBar title={TABS.find((t) => t.key === activeView)?.label} hasWarnings={hasWarnings} />
      <ModuleTabs items={TABS} active={activeView} onChange={onNavigateView} />
      {VIEWS[activeView]}
    </>
  );
}
