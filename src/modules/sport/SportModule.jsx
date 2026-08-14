import { useAuth } from '../../core/lib/AuthContext';
import { getBodyProfile } from '../../core/lib/bodyProfileData';
import { registerRequirement } from '../../core/lib/requiredDataRegistry';
import { getMissingFields } from '../../core/lib/requiredData';
import { SPORT_REQUIRED_FIELDS } from './lib/requiredFields';

// Meldet sich beim zentralen, modulunabhängigen Pflichtdaten-Register an
// (core/lib/requiredDataRegistry.js) — läuft einmalig beim ersten Import
// dieser Datei, unabhängig davon, ob der Hub oder das Modul gerade
// angezeigt wird. Der Hub kennt dadurch "Sport" nicht direkt.
// Analog zu NutritionModule.jsx, aber mit eigener Feld-Spec
// (SPORT_REQUIRED_FIELDS statt BODY_REQUIRED_FIELDS) — siehe
// lib/requiredFields.js für die Begründung.
registerRequirement('sport', async (session) => {
  const body = await getBodyProfile(session);
  return getMissingFields(SPORT_REQUIRED_FIELDS, body);
});

// Grundgerüst — noch ohne eigene Views (Training/Verlauf/Pläne/
// Auswertung, siehe Konzept). Bewusst als eigener, minimaler Schritt:
// erst die Datenbasis (trainingTypes/exercises/plans/matching) stand,
// jetzt hängt das Modul am Pflichtdaten-Register, damit App.jsx/
// modules.js als Nächstes gefahrlos auf built: true gestellt werden
// können, ohne dass Sport im Hub-Warnbanner fehlt.
export default function SportModule() {
  const { session } = useAuth();

  return (
    <div className="page">
      <div className="card">
        <div className="card-title">Sport</div>
        <p style={{ color: 'var(--text-secondary)' }}>
          Modul im Aufbau — Trainingstypen, Übungen und Pläne sind bereits
          hinterlegt, die Ansichten folgen als Nächstes.
        </p>
      </div>
    </div>
  );
}
