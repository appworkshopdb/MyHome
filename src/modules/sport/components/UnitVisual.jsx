import { MusclePreview } from './EinheitenListShared';

// Bild(er) einer Einheit: die Muskelbilder, sonst das Platzhalter-Symbol
// (Ausdauer, Beweglichkeit, Sportarten), sonst nichts. max begrenzt die Zahl der
// Bilder (ohne max zeigt MusclePreview bis zu 3 und ein "+N").
export default function UnitVisual({ tags = [], icon = '', size = 34, max }) {
  if (tags.length > 0) return <MusclePreview tags={max ? tags.slice(0, max) : tags} size={size} />;
  if (icon) {
    return (
      <span className="pl-emo" style={{ width: size, height: size, fontSize: Math.round(size * 0.5) }} aria-hidden="true">{icon}</span>
    );
  }
  return null;
}
