// core/components/AreaRow.jsx
// Eine Zeile in der "Bereiche"-Liste: Label links, Kennzahl rechts (Ton
// steuert die Farbe), Chevron. Führt auf einen Detail-Screen (onPress).
// In <AreaList variant="tiles"> wird dieselbe Zeile zur Kachel: Symbol-
// kreis, Label, darunter die Kennzahl. Text, Ton und Link bleiben gleich.
//
// tone: 'neutral' (Standard, --text-muted) | 'caution' (--status-caution,
// z. B. "läuft aus") | 'critical' (--status-critical, z. B. "überfällig")
// icon: Symbol-Id aus AreaIcons.jsx (nur in der Kachel-Variante sichtbar)
// family: 'fin' | 'food' | 'sport' | 'hab' | 'shop' | 'n' — Farbfamilie
//         (nur nötig, wo kein Modul offen ist, z. B. im Hub)
// featured: Kachel in der Tönung der Familie statt weiß
import AreaIcon from './AreaIcons';

export default function AreaRow({ label, value, tone = 'neutral', onPress, icon, family, featured = false }) {
  const cls = [
    'area-row',
    family ? `tone-${family}` : '',
    featured ? 'area-row--featured' : '',
  ].filter(Boolean).join(' ');
  return (
    <button className={cls} onClick={onPress}>
      {icon && <span className="area-row-badge"><AreaIcon id={icon} /></span>}
      <span className="area-row-label">{label}</span>
      {value != null && (
        <span className={`area-row-value area-row-value--${tone}`}>{value}</span>
      )}
      <span className="area-row-chevron" aria-hidden="true">›</span>
    </button>
  );
}
