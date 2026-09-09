import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '../../core/lib/AuthContext';
import { useUi } from '../../core/lib/UiContext';
import { getBodyProfile } from '../../core/lib/bodyProfileData';
import { registerRequirement } from '../../core/lib/requiredDataRegistry';
import { getMissingFields } from '../../core/lib/requiredData';
import { SPORT_REQUIRED_FIELDS } from './lib/requiredFields';
import * as db from './lib/spoData';
import ModuleTopBar from '../../core/components/ModuleTopBar';
import PageSection from '../../core/components/PageSection';
import { fb } from '../../core/lib/feedback';
import EinheitenView from './components/EinheitenView';
import VerlaufView from './components/VerlaufView';
import PlaeneView from './components/PlaeneView';
import AuswertungView from './components/AuswertungView';

registerRequirement('profile', async (session) => {
  const body = await getBodyProfile(session);
  return getMissingFields(SPORT_REQUIRED_FIELDS, body);
});

// KEINE TABS MEHR: Kalender/Einheiten/Pläne/Auswertung liegen als vier
// PageSection-Blöcke untereinander, in derselben Reihenfolge wie die
// früheren Tabs. Einheiten und Pläne neu anlegen läuft ausschließlich
// über den globalen FAB (core/components/GlobalFab.jsx → SportQuickSheet)
// — die früheren eigenen "+"-Buttons in EinheitenView/PlaeneView sind
// entfernt, "Bearbeiten" bestehender Einträge bleibt jeweils bestehen.
//
// Hält den gesamten Modul-Zustand: Einheiten (Workouts im Kalender),
// die Einheiten-Bibliothek, Plan-Vorlagen und die im Profil gewählten
// Sportarten. Alles wird EINMAL geladen und an die Sektionen
// durchgereicht — dadurch arbeiten Kalender, Pläne und Auswertung
// garantiert auf demselben Stand.
export default function SportModule({ hasWarnings }) {
  const { session } = useAuth();
  const { showToast } = useUi();

  const [workouts, setWorkouts] = useState([]);
  const [units, setUnits] = useState([]);
  const [plans, setPlans] = useState([]);
  const [userSports, setUserSports] = useState([]);
  const [loading, setLoading] = useState(true);

  // formInitial steuert das Formular INNERHALB der Kalender-Sektion
  // (VerlaufView) — beim Bearbeiten eines Workouts oder Anlegen eines
  // geplanten Trainings für einen Kalendertag ersetzt es dort kurz die
  // Kalenderansicht. Beides passiert innerhalb der Kalender-Sektion
  // selbst, kein Scrollen nötig.
  const [formInitial, setFormInitial] = useState(false);
  const [editingPlan, setEditingPlan] = useState(null);   // Plan-Editor
  const [applyingPlan, setApplyingPlan] = useState(null); // Anwenden-Dialog

  // Sprungziel für "Starten" bei einem Plan-Vorschlag (sitzt in der
  // Pläne-Sektion, das Formular erscheint aber oben in der Kalender-
  // Sektion) — ersetzt den früheren Tab-Wechsel durch Hochscrollen.
  const kalenderAnchorRef = useRef(null);
  function scrollToKalenderSection() {
    kalenderAnchorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

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

  // Der FAB (GlobalFab → SportQuickSheet) sitzt außerhalb dieses Moduls
  // in App.jsx und legt/ändert Einheiten/Workouts/Pläne direkt in der DB
  // an — ohne dieses Event würde SportModule davon nichts mitbekommen
  // und die Listen blieben bis zum nächsten manuellen Reload veraltet.
  useEffect(() => {
    window.addEventListener('sport:data-changed', load);
    return () => window.removeEventListener('sport:data-changed', load);
  }, [load]);

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

  // Bearbeiten und "Training für diesen Tag" passieren innerhalb der
  // Kalender-Sektion selbst — kein Sprung nötig, formInitial genügt.
  function handleEdit(workout) {
    setFormInitial(workout);
  }

  function handlePlanNew(date) {
    setFormInitial({ occurred_on: date, status: 'planned' });
  }

  // "Starten" bei einem Plan-Vorschlag sitzt in der Pläne-Sektion, das
  // Formular lebt aber in der Kalender-Sektion weiter oben — dorthin
  // scrollen, damit der Sprung nicht verwirrt.
  function startFromPlan(preset) {
    setFormInitial({ type_key: preset.type_key, title: preset.title });
    scrollToKalenderSection();
  }

  // Einheiten anlegen/bearbeiten/löschen läuft komplett über den FAB
  // (SportQuickSheet.jsx, Modus "Neue Einheit") — hier gibt es dafür
  // bewusst keine eigene Speicher-Logik, siehe sport:data-changed-
  // Listener oben.

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
      scrollToKalenderSection();
    } catch (e) {
      console.error(e);
      showToast('Plan konnte nicht eingetragen werden');
    }
  }

  return (
    <>
      <ModuleTopBar hasWarnings={hasWarnings} />

      <div className="sport-module-content with-topbar-space">
        <div ref={kalenderAnchorRef} />
        <PageSection title="Kalender">
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
        </PageSection>

        <PageSection title="Einheiten">
          <EinheitenView units={units} loading={loading} />
        </PageSection>

        <PageSection title="Pläne">
          <PlaeneView
            session={session}
            plans={plans}
            units={units}
            loading={loading}
            userSports={userSports}
            editing={editingPlan}
            applying={applyingPlan}
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
        </PageSection>

        <PageSection title="Auswertung">
          <AuswertungView workouts={workouts} loading={loading} />
        </PageSection>
      </div>
    </>
  );
}
