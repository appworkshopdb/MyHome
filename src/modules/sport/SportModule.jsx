import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../../core/lib/AuthContext';
import { useUi } from '../../core/lib/UiContext';
import { getBodyProfile } from '../../core/lib/bodyProfileData';
import { registerRequirement } from '../../core/lib/requiredDataRegistry';
import { getMissingFields } from '../../core/lib/requiredData';
import { SPORT_REQUIRED_FIELDS } from './lib/requiredFields';
import * as db from './lib/spoData';
import WorkoutForm from './components/WorkoutForm';
import WorkoutList from './components/WorkoutList';
import PlanSuggestions from './components/PlanSuggestions';

// Meldet sich beim zentralen, modulunabhängigen Pflichtdaten-Register an
// (core/lib/requiredDataRegistry.js) — läuft einmalig beim ersten Import
// dieser Datei, unabhängig davon, ob der Hub oder das Modul gerade
// angezeigt wird. Der Hub kennt dadurch "Sport" nicht direkt. Analog zu
// NutritionModule.jsx, aber mit eigener Feld-Spec (SPORT_REQUIRED_FIELDS
// statt BODY_REQUIRED_FIELDS) — siehe lib/requiredFields.js.
registerRequirement('sport', async (session) => {
  const body = await getBodyProfile(session);
  return getMissingFields(SPORT_REQUIRED_FIELDS, body);
});

// Erster Screen: "Training" — direktes Eintragen abgeschlossener
// Einheiten (kein Start/Stop-Zustand, kein Satz-für-Satz-Log, siehe
// Konzept-Entscheidung). Verlauf/Pläne/Auswertung folgen als eigene
// Ansichten, sobald dieser Kern steht.
export default function SportModule() {
  const { session } = useAuth();
  const { showToast } = useUi();

  const [workouts, setWorkouts] = useState([]);
  const [loading, setLoading] = useState(true);
  // false = kein Formular offen; {} = leeres Formular; { type_key, title }
  // = Formular vorbefüllt aus einem gewählten Plan (siehe PlanSuggestions).
  const [formInitial, setFormInitial] = useState(false);

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

  return (
    <div className="page">
      {formInitial !== false ? (
        <WorkoutForm
          onSave={handleSave}
          onCancel={() => setFormInitial(false)}
          showToast={showToast}
          initialValues={formInitial}
        />
      ) : (
        <>
          <button className="btn btn-primary" style={{ width: '100%', marginBottom: 12 }} onClick={() => setFormInitial({})}>
            + Training eintragen
          </button>
          <PlanSuggestions session={session} onStartFromPlan={(plan) => setFormInitial({ type_key: plan.type_key, title: plan.title })} />
        </>
      )}

      {loading ? (
        <div className="card">Lädt…</div>
      ) : (
        <WorkoutList workouts={workouts} onDelete={handleDelete} />
      )}
    </div>
  );
}
