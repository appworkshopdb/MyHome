import { formatEur } from '../lib/format';

// Betrag mit Sichtschutz (Auge im Hub, core/lib/privacyStore.js). Ausgeblendet wird ein
// Platzhalter weichgezeichnet — der echte Betrag steckt dann gar nicht mehr im DOM
// (nicht per Auswahl/Kopieren/Bildschirmleser auslesbar und per Entzerren nicht zurückzuholen).
const PLACEHOLDER = '99,99 €';

export default function Money({ value, hide = false }) {
  if (!hide) return formatEur(value);
  return (
    <span className="amt-hidden" role="img" aria-label="Betrag ausgeblendet">{PLACEHOLDER}</span>
  );
}
