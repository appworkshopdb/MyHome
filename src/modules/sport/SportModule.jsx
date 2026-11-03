import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../../core/lib/AuthContext';
import { useUi } from '../../core/lib/UiContext';
import { useEntrySheet } from '../../core/lib/EntrySheetContext';
import { getBodyProfile } from '../../core/lib/bodyProfileData';
import { registerRequirement } from '../../core/lib/requiredDataRegistry';
import { getMissingFields } from '../../core/lib/requiredData';
import { SPORT_REQUIRED_FIELDS } from './lib/requiredFields';
import * as db from './lib/spoData';
import { syncActivePlan, activatePlan, endActivePlan, resyncActivePlan } from '../../core/lib/sportPlanSync';
import { todayIso } from '../../core/lib/wizardDates';
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
  // version zählt hoch, sobald der FAB (SportQuickSheet) erfolgreich
  // gespeichert hat — ersetzt das frühere eigene window-Event, jetzt
  // dasselbe etablierte Muster wie bei Finanzen (EntrySheetContext).
  const { version } = useEntrySheet();

  const [workouts, setWorkouts] = useState([]);
  const [units, setUnits] = useState([]);
  const [plans, setPlans] = useState([]);
  const [activePlan, setActivePlan] = useState(null); // Zeile aus spo_active_plan (Dauerplan) oder null
  const [userSports, setUserSports] = useState([]);
  const [bodyWeight, setBodyWeight] = useState(null);
  const [loading, setLoading] = useState(true);

  // formInitial steuert das Formular INNERHALB des Kalender-Screens
  // (VerlaufView) — beim Bearbeiten eines Workouts oder Anlegen eines
  // geplanten Trainings ersetzt es dort kurz die Kalenderansicht.
  const [formInitial, setFormInitial] = useState(false);
  const [editingPlan, setEditingPlan] = useState(null);   // Plan-Editor

  const load = useCallback(async () => {
    setLoading(true);
    try {
      // Zuerst den aktiven Plan auffüllen, dann laden: so steht der Kalender
      // beim Öffnen immer 28 Tage im Voraus (schlägt nie fehl, ohne Plan: null).
      const active = await syncActivePlan(session);
      const [ws, us, ps, profile] = await Promise.all([
        db.getWorkouts(session),
        db.getUnits(session),
        db.getPlans(session),
        getBodyProfile(session),
      ]);
      setWorkouts(ws);
      setUnits(us);
      setPlans(ps);
      setActivePlan(active);
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

  // Lädt initial UND jedes Mal, wenn der FAB (SportQuickSheet) über
  // den EntrySheetContext erfolgreich gespeichert hat (version-Änderung).
  useEffect(() => { load(); }, [load, version]);

  // Der Zurück-Pfeil (ModuleTopBar onBack) galt bisher IMMER als "verlasse
  // den Bereich", unabhängig davon, ob gerade ein Unter-Zustand offen war
  // (Plan-Editor, Anwenden-Dialog, Kalender-Formular) — dadurch sprang er
  // z.B. beim Bearbeiten eines Plans direkt zur Modul-Übersicht statt nur
  // zur Pläne-Liste zurück (zwei Schritte statt einem). Außerdem wurde
  // editingPlan/applyingPlan beim Verlassen nie zurückgesetzt, wodurch ein
  // späteres erneutes Aufrufen von "Pläne" wieder denselben Editor zeigte
  // statt der Liste. handleBack behebt beide Fälle: schließt zuerst den
  // offenen Unter-Zustand (bleibt auf demselben Bereich), erst wenn nichts
  // mehr offen ist, verlässt er wirklich zur Übersicht — und räumt dabei
  // konsequent alle Unter-Zustände auf, damit ein späteres Zurückkehren
  // immer bei der Liste startet.
  function handleBack() {
    if (view === 'plaene' && editingPlan) {
      setEditingPlan(null);
      return;
    }
    if (view === 'kalender' && formInitial !== false) {
      setFormInitial(false);
      return;
    }
    setFormInitial(false);
    setEditingPlan(null);
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
      const saved = await db.savePlan(session, plan, items);
      // Änderung am aktiven Plan: ab heute neu erzeugen, Vergangenes bleibt
      if (activePlan && saved.id === activePlan.plan_id && saved._itemsChanged) {
        await resyncActivePlan(session);
      }
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
      if (activePlan && activePlan.plan_id === id) await endActivePlan(session);
      await db.deletePlan(id);
      await load();
    } catch (e) {
      console.error(e);
      showToast('Plan konnte nicht gelöscht werden');
    }
  }

  // Plan aktivieren oder wechseln — ab startDate, alles davor bleibt.
  async function handleActivatePlan(plan, startDate) {
    try {
      await activatePlan(session, plan.id, startDate);
      showToast(startDate === todayIso() ? `„${plan.title}“ gilt ab heute` : `„${plan.title}“ startet am ${startDate.split('-').reverse().slice(0, 2).join('.')}.`);
      await load();
    } catch (e) {
      console.error(e);
      showToast(e?.code === 'PGRST205' || e?.code === '42P01' ? 'Dauerplan: Datenbank-Migration fehlt noch' : 'Plan konnte nicht aktiviert werden');
    }
  }

  async function handleEndPlan() {
    try {
      await endActivePlan(session);
      showToast('Plan beendet');
      await load();
    } catch (e) {
      console.error(e);
      showToast('Plan konnte nicht beendet werden');
    }
  }

  // "+ Ruhetag" im Kalender: eigener Eintrag, hat Vorrang vor dem Plan
  async function handleAddRest(date) {
    try {
      await db.saveWorkout(session, { occurred_on: date, type_key: null, title: 'Ruhetag', duration_min: null, status: 'done', is_rest: true });
      fb.restDay();
      showToast('Ruhetag eingetragen');
      await load();
    } catch (e) {
      console.error(e);
      showToast('Speichern fehlgeschlagen');
    }
  }

  // Aktiver Plan samt Plan-Daten (null, wenn kein Plan aktiv oder der Plan gelöscht ist)
  const activePlanObj = activePlan ? plans.find((p) => p.id === activePlan.plan_id) : null;
  const activeFull = activePlanObj ? { ...activePlan, plan: activePlanObj } : null;

  // ── Detail-Screens: ein Bereich pro Screen ──
  if (view && DETAIL_TITLES[view]) {
    return (
      <>
        <ModuleTopBar onBack={handleBack} title={DETAIL_TITLES[view]} hasWarnings={hasWarnings} />
        <div className="sport-module-content with-topbar-space">
          {view === 'kalender' && (
            <VerlaufView
              workouts={workouts}
              plans={plans}
              units={units}
              loading={loading}
              activePlan={activeFull}
              onToggleDone={handleToggleDone}
              onEdit={handleEdit}
              onDelete={handleDelete}
              onPlanNew={handlePlanNew}
              onAddRest={handleAddRest}
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
              activePlan={activePlan}
              workouts={workouts}
              onEditPlan={setEditingPlan}
              onDeletePlan={handleDeletePlan}
              onSavePlan={handleSavePlan}
              onCancelEdit={() => setEditingPlan(null)}
              onActivatePlan={handleActivatePlan}
              onEndPlan={handleEndPlan}
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
          activePlan={activeFull}
          bodyWeight={bodyWeight}
          loading={loading}
          onToggleDone={handleToggleDone}
          onEdit={handleEdit}
          onPlanToday={() => handlePlanNew(todayIso())}
          onNavigate={onNavigateView}
        />
      </div>
    </>
  );
}
