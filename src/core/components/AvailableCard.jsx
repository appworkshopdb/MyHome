// core/components/AvailableCard.jsx
//
// Die Finanz-Fokuskarte "Verfügbar jetzt" — überall dieselbe: Finanzen-Übersicht, Buchungen,
// Offene Posten und Hub. Oben der laufende Stand (alle Eingänge minus alles Bezahlte, ohne die
// offenen Zahlungen), darunter "Nach N offenen Zahlungen: X". Rechnung: core/lib/finAvailable.js.
//
// stand: { verf, eingaenge, bezahlt, offenCount, offenSum } (standSummary)
// flow: zusätzlich "+ Eingänge … − Bezahltes …" (Finanzen-Übersicht, Buchungen, Offene Posten)
// onPress/label: ganze Karte antippbar (Finanzen: öffnet die Einnahmen)
// right: Element rechts in der Kopfzeile (Hub: Auge, Finanzen: "Einnahmen ›")
// onOpenPosten: Zeile unten "N offene Zahlungen · X" mit "Ansehen" (Hub)
import FocusCard from './FocusCard';
import Money from './Money';
import { offeneZahlungenText } from '../lib/paymentParts';

export default function AvailableCard({ stand, loading = false, hide = false, flow = false, onPress, label, right, onOpenPosten, className = '' }) {
  const n = stand?.offenCount ?? 0;
  return (
    <FocusCard family="fin" className={className} onPress={onPress} label={label}>
      <FocusCard.Eyebrow right={right}>Verfügbar jetzt</FocusCard.Eyebrow>
      <FocusCard.Value>{loading || !stand ? '—' : <Money value={stand.verf} hide={hide} />}</FocusCard.Value>
      {!loading && stand && n > 0 && (
        <FocusCard.Meta>
          <span>Nach {n === 1 ? '1 offenen Zahlung' : `${n} offenen Zahlungen`}: <b><Money value={stand.verf - stand.offenSum} hide={hide} /></b></span>
        </FocusCard.Meta>
      )}
      {flow && !loading && stand && (
        <FocusCard.Meta>
          <span>+ Eingänge <b><Money value={stand.eingaenge} hide={hide} /></b></span>
          <span>− Bezahltes <b><Money value={stand.bezahlt} hide={hide} /></b></span>
        </FocusCard.Meta>
      )}
      {onOpenPosten && !loading && stand && n > 0 && (
        <FocusCard.Footer>
          <span>{offeneZahlungenText(n)} · <Money value={stand.offenSum} hide={hide} /></span>
          <FocusCard.Pill onPress={onOpenPosten}>Ansehen</FocusCard.Pill>
        </FocusCard.Footer>
      )}
    </FocusCard>
  );
}
