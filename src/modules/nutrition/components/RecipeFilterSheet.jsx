import SheetShell from '../../../core/components/SheetShell';
import { DIET_FILTERS, NUTRI_FILTERS, ART_GROUPS, SORTS } from '../lib/recipeFilter';

// Filter der Rezeptliste als Bottom-Sheet: Ernährung (eine Wahl), Nährwerte
// pro Portion (mehrere), Gerichtart (eine Wahl), Sortierung. Es werden nur
// Filter angeboten, zu denen es in der Liste mindestens ein Rezept gibt; die
// Zahl am Chip zählt die Treffer bei aktueller Mahlzeit und Suche.
// Alles wirkt sofort in der Liste dahinter, der Knopf unten schließt nur.
export default function RecipeFilterSheet({
  counts, diet, setDiet, nutri, toggleNutri, art, setArt, sort, setSort,
  resultCount, activeCount, onReset, onClose,
}) {
  const dietChips = DIET_FILTERS.filter((d) => counts.diet[d.key].total > 0);
  const nutriChips = NUTRI_FILTERS.filter((n) => counts.nutri[n.key].total > 0);
  const artChips = ART_GROUPS.filter((g) => counts.art[g.key].total > 0);

  return (
    <SheetShell onClose={onClose} labelledBy="rf-sheet-title">
      <div className="rf-sheet">
        <div className="rf-sheet-head">
          <h2 id="rf-sheet-title">Filter</h2>
          {activeCount > 0 && <button type="button" className="rf-link" onClick={onReset}>Zurücksetzen</button>}
        </div>

        {dietChips.length > 0 && (
          <div>
            <div className="rf-group-label">Ernährung</div>
            <div className="rf-chips">
              {dietChips.map((d) => (
                <button key={d.key} type="button" className={`chip ${diet === d.key ? 'active' : ''}`} onClick={() => setDiet(diet === d.key ? null : d.key)}>
                  {d.label} <small>{counts.diet[d.key].shown}</small>
                </button>
              ))}
            </div>
          </div>
        )}

        {nutriChips.length > 0 && (
          <div>
            <div className="rf-group-label">Nährwerte pro Portion</div>
            <div className="rf-chips">
              {nutriChips.map((n) => (
                <button key={n.key} type="button" className={`chip ${nutri.includes(n.key) ? 'active' : ''}`} onClick={() => toggleNutri(n.key)}>
                  {n.label} <small>{n.hint}</small>
                </button>
              ))}
            </div>
          </div>
        )}

        {artChips.length > 0 && (
          <div>
            <div className="rf-group-label">Gerichtart</div>
            <div className="rf-chips">
              {artChips.map((g) => (
                <button key={g.key} type="button" className={`chip ${art === g.key ? 'active' : ''}`} onClick={() => setArt(art === g.key ? null : g.key)}>
                  {g.label} <small>{counts.art[g.key].shown}</small>
                </button>
              ))}
            </div>
          </div>
        )}

        <div>
          <div className="rf-group-label">Sortieren</div>
          <div className="rf-chips">
            {SORTS.map((o) => (
              <button key={o.key} type="button" className={`chip ${sort === o.key ? 'active' : ''}`} onClick={() => setSort(o.key)}>{o.label}</button>
            ))}
          </div>
        </div>

        <button type="button" className="btn btn-primary rf-sheet-done" onClick={onClose}>
          {resultCount} Rezept{resultCount !== 1 ? 'e' : ''} anzeigen
        </button>
      </div>
    </SheetShell>
  );
}
