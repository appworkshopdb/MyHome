import { useAnalyticsConsent } from '../lib/useAnalyticsConsent';
import { setConsent } from '../lib/analytics';

// Einmalige Frage nach dem ersten Login. Bleibt sichtbar, bis eine der
// beiden Antworten gewählt wurde; die Entscheidung ist jederzeit im
// Einstellungs-Menü (AppMenu.jsx → "Nutzungsdaten") änderbar.
// Wortlaut ändern → CONSENT_TEXT_VERSION in lib/analytics.js hochzählen.
export default function AnalyticsConsent() {
  const consent = useAnalyticsConsent();
  if (consent !== null) return null;

  return (
    <div className="consent-banner" role="dialog" aria-label="Nutzungsdaten">
      <div className="consent-title">Hilf mit, Nestua zu verbessern</div>
      <p className="consent-text">
        Darf Nestua erfassen, welche Bereiche du öffnest, wie oft du tippst und wenn Fehler auftreten?
        Deine Inhalte (Beträge, Gewicht, Einträge, Notizen) werden nie erfasst. Du kannst das
        jederzeit in den Einstellungen widerrufen.
      </p>
      <div className="consent-actions">
        <button className="btn btn-secondary" onClick={() => setConsent(false)}>Ablehnen</button>
        <button className="btn btn-primary" onClick={() => setConsent(true)}>Zustimmen</button>
      </div>
    </div>
  );
}
