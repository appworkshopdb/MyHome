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
import OverviewSection from './components/OverviewSection';
import EinheitenView from './components/EinheitenView';
import VerlaufView from './components/VerlaufView';
import PlaeneView from './components/PlaeneView';
import AuswertungView from './components/AuswertungView';
import WeightTimeline from './components/WeightTimeline';

registerRequirement('profile', async (session) => {
  const body = await getBodyProfile(session);
  return getMissingFields(SPORT_REQUIRED_FIELDS, body);
});

// NEU (UMBAU-PLAN.md Schritt 7): kein Stapel aus vier PageSection-Blöcken
// mehr — ohne `view` zeigt sich die Übersicht (Heute-Fokuskarte,
// Wochenraster, Bereiche), mit `view` genau EIN Bereich als Vollbild-
// Detail-Screen.
//
// Der frühere kalenderAnchorRef/scrollIntoView entfällt: "Starten aus
// Plan" setzt jetzt das Formular und navigiert direkt auf den Kalender-
// Screen, auf dem das Formular ohnehin lebt. Kein Scrollen mehr nötig.
//
// Einheiten und Pläne neu anlegen läuft weiterhin ausschließlich über
// den globalen FAB (core/components/GlobalFab.jsx → SportQuickSheet).
//
// Hält den gesamten Modul-Zustand: Einheiten (Workouts im Kalender),
// die Einheiten-Bibliothek, Plan-Vorlagen, die im Profil gewählten
// Sportarten und das Profil-Gewicht. Alles wird EINMAL geladen und an
// Übersicht und Detail-Screens durchgereicht.
const DETAIL_TITLES = {
  kalender:   'Kalender',
  einheiten:  'Einheiten',
  plaene:     'Pläne',
  auswertung: 'Auswertung',
  gewicht:    'Gewicht',
};

export default function SportModule({ view, onNavigateView, hasWarnings }) {
  const { session } = useAuth();
  const { showToast } = useUi();

  const [workouts, setWorkouts] = useState([]);
  const [units, setUnits] = useState([]);
  const [plans, setPlans] = useState([]);
  const [userSports, setUserSports] = useState([]);
  const [bodyWeight, setBodyWeight] = useState(null);
  const [loading, setLoading] = useState(true);

  // formInitial steuert das Formular INNERHALB des Kalender-Screens
  // (VerlaufView) — beim Bearbeiten eines Workouts oder Anlegen eines
  // geplanten Trainings ersetzt es dort kurz die Kalenderansicht.
  const [formInitial, setFormInitial] = useState(false);
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
      // Gewicht kommt aus demselben body_profile-Aufruf, der ohnehin für
      // die Sportarten läuft — für die Bereichszeile "Gewicht" ist
      // deshalb kein zusätzlicher Request nötig.
      setBodyWeight(profile.weight || null);
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
  // an — ohne dieses Event würde SportModule davon nichts mitbekommen.
  useEffect(() => {
    window.addEventListener('sport:data-changed', load);
    return () => window.removeEventListener('sport:data-changed', load);
  }, [load]);

  function backToOverview() {
    setFormInitial(false);
    onNavigateView(null);
  }

  // Formular öffnen heißt jetzt immer: auf den Kalender-Screen wechseln,
  // wo das Formular lebt.
  function openForm(initial) {
    setFormInitial(initial);
    if (view !== 'kalender') onNavigateView('kalender');
  }

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

  function handleEdit(workout)   { openForm(workout); }
  function handlePlanNew(date)   { openForm({ occurred_on: date, status: 'planned' }); }

  // "Starten" bei einem Plan-Vorschlag sitzt im Pläne-Bereich, das
  // Formular lebt im Kalender-Bereich — openForm wechselt dorthin.
  function startFromPlan(preset) {
    openForm({ type_key: preset.type_key, title: preset.title });
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
      onNavigateView('kalender');
    } catch (e) {
      console.error(e);
      showToast('Plan konnte nicht eingetragen werden');
    }
  }

  // ── Detail-Screens: ein Bereich pro Screen ──
  if (view && DETAIL_TITLES[view]) {
    return (
      <>
        <ModuleTopBar onBack={backToOverview} title={DETAIL_TITLES[view]} hasWarnings={hasWarnings} />
        <div className="sport-module-content with-topbar-space">
          {view === 'kalender' && (
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
          )}

          {view === 'einheiten' && <EinheitenView units={units} loading={loading} />}

          {view === 'plaene' && (
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
          )}

          {view === 'auswertung' && <AuswertungView workouts={workouts} loading={loading} />}

          {view === 'gewicht' && <WeightTimeline />}
        </div>
      </>
    );
  }

  // ── Übersicht ──
  return (
    <>
      <ModuleTopBar hasWarnings={hasWarnings} />
      <div className="sport-module-content with-topbar-space">
        <OverviewSection
          workouts={workouts}
          units={units}
          plans={plans}
          bodyWeight={bodyWeight}
          loading={loading}
          onToggleDone={handleToggleDone}
          onEdit={handleEdit}
          onPlanToday={() => handlePlanNew(new Date().toISOString().slice(0, 10))}
          onNavigate={onNavigateView}
        />
      </div>
    </>
  );
}
