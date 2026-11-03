import { RecipeCover } from '../lib/recipeCovers';
import { TEMPLATE_CATS } from '../lib/templateCategories';

const ICONS = {
  bolt: <path d="M13 3L5 13.5h6L10 21l8-10.5h-6z" />,
  sweet: <><circle cx="12" cy="12" r="5" /><path d="M7.5 7.5L4 4M16.5 16.5L20 20M7.5 16.5L4 20M16.5 7.5L20 4" /></>,
  sport: <path d="M6.5 6.5v11M17.5 6.5v11M3.5 9v6M20.5 9v6M6.5 12h11" />,
  leaf: <><path d="M5 19C4 11 8 5 20 4c.5 11-4.5 16-12 15.2" /><path d="M5 19c3-4 6-7 10-9.5" /></>,
  box: <><rect x="4" y="9" width="16" height="10" rx="2.5" /><path d="M7 9V6.5h10V9" /><path d="M9 14h6" /></>,
  feather: <><path d="M20 4c-8 0-13 5-13 11v4" /><path d="M20 4c0 8-5 12-11 12" /><path d="M7 19l5-5" /></>,
  fish: <><path d="M3 12c3-5 8-6 12-4 2 1 4 2.5 6 4-2 1.5-4 3-6 4-4 2-9 1-12-4z" /><circle cx="16.5" cy="11" r=".6" fill="currentColor" /><path d="M3 12l-1.5-3M3 12l-1.5 3" /></>,
  wheat: <><path d="M12 21V8M12 8c-2-.5-3-2-3-4 2 .5 3 2 3 4zM12 8c2-.5 3-2 3-4-2 .5-3 2-3 4zM12 14c-2-.5-3-2-3-4M12 14c2-.5 3-2 3-4" /><path d="M4 4l16 16" /></>,
};

// Übersicht der Vorlagen: oben die Mahlzeiten mit Rezeptbild, darunter die Themen
// als kleine Kacheln. Kategorien ohne Rezept werden nicht angezeigt.
export default function TemplateCategories({ counts, onPick }) {
  const meals = TEMPLATE_CATS.filter((c) => c.kind === 'meal' && counts[c.key] > 0);
  const themes = TEMPLATE_CATS.filter((c) => c.kind === 'theme' && counts[c.key] > 0);
  return (
    <div className="tpl-cats">
      {meals.length > 0 && (
        <>
          <div className="tpl-sec">Nach Mahlzeit</div>
          <div className="tpl-grid">
            {meals.map((c) => (
              <button key={c.key} type="button" className="tpl-tile" onClick={() => onPick(c.key)}>
                <span className={`tpl-art tpl-tone-${c.tone}`}>
                  <RecipeCover recipe={c.cover} className="tpl-cover" style={{ background: 'transparent' }} />
                </span>
                <span className="tpl-tile-t">{c.label}</span>
                <span className="tpl-tile-s">{counts[c.key]} Rezepte</span>
              </button>
            ))}
          </div>
        </>
      )}
      {themes.length > 0 && (
        <>
          <div className="tpl-sec">Nach Ziel &amp; Typ</div>
          <div className="tpl-grid">
            {themes.map((c) => (
              <button key={c.key} type="button" className="tpl-tile tpl-tile2" onClick={() => onPick(c.key)}>
                <span className={`tpl-ico tpl-tone-${c.tone}`}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{ICONS[c.icon]}</svg>
                </span>
                <span className="tpl-tile-t">{c.label}</span>
                <span className="tpl-tile-s">{counts[c.key]} · {c.hint}</span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
