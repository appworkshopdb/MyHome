import { MusclePreview } from './EinheitenListShared';
import SportSymbol from './SportSymbol';
import { isSymbol } from '../lib/sportSymbols';

// Bild(er) einer Einheit: die Muskelbilder, sonst das Symbol (lib/sportSymbols.js)
// im Kreis, sonst nichts. Ein altes Emoji-Symbol wird noch wie früher gezeigt.
// max begrenzt die Zahl der Bilder (ohne max zeigt MusclePreview bis zu 3 und ein "+N").
export default function UnitVisual({ tags = [], icon = '', size = 34, max }) {
  if (tags.length > 0) return <MusclePreview tags={max ? tags.slice(0, max) : tags} size={size} />;
  if (isSymbol(icon)) {
    return (
      <span className="sym-c" style={{ width: size, height: size }} aria-hidden="true">
        <SportSymbol name={icon} size={Math.round(size * 0.54)} />
      </span>
    );
  }
  if (icon) {
    return (
      <span className="pl-emo" style={{ width: size, height: size, fontSize: Math.round(size * 0.5) }} aria-hidden="true">{icon}</span>
    );
  }
  return null;
}
