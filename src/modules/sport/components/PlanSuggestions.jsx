import { useEffect, useState } from 'react';
import { getBodyProfile } from '../../../core/lib/bodyProfileData';
import { suggestPlans } from '../lib/matching';

// Ruft die bereits vorhandene, aber bislang ungenutzte matching.js auf.
// Lädt das Profil selbst (statt es von SportModule durchgereicht zu
// bekommen) — hält die Komponente eigenständig einsetzbar, falls sie
// später an anderer Stelle (z.B. Auswertung) wiederverwendet wird.
export default function PlanSuggestions({ session, onStartFromPlan }) {
  const [suggestions, setSuggestions] = useState(null); // null = lädt noch
  const [profileIncomplete, setProfileIncomplete] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const profile = await getBodyProfile(session);
      if (cancelled) return;
      if (!profile.goal || !profile.training_focus) {
        // Kein Fehlerfall — SPORT_REQUIRED_FIELDS/RequiredDataBanner
        // kümmert sich bereits um die Aufforderung, das Profil zu
        // vervollständigen. Hier nur freundlich ausblenden, keine
        // doppelte Warnung.
        setProfileIncomplete(true);
        return;
      }
      setSuggestions(suggestPlans(profile));
    })();
    return () => { cancelled = true; };
  }, [session]);

  if (profileIncomplete) return null;
  if (suggestions === null) return null; // kurzer Ladezustand, kein eigener Spinner nötig
  if (suggestions.length === 0) return null;

  return (
    <div className="card">
      <div className="card-title">Vorschläge für dich</div>
      {suggestions.map(({ plan, reason }) => (
        <div
          key={plan.key}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '10px 0', borderBottom: '1px solid var(--border)',
          }}
        >
          <div>
            <div style={{ fontWeight: 600 }}>{plan.title}</div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{reason}</div>
          </div>
          <button className="btn btn-secondary" onClick={() => onStartFromPlan(plan)}>Starten</button>
        </div>
      ))}
    </div>
  );
}
