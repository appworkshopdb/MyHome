// modules/nutrition/components/OverviewSection.jsx
// Modul-Übersicht für Ernährung: oben der Tagesstand (derselbe Block wie im
// Tagesplan des Hubs: offene kcal/Makros, Mahlzeit-Marker), darunter zwei
// Rezeptkarten und die Bereiche. Die Ampel (Lebensmittel-Liste mit Suche)
// ist ein eigener Bereich in der Liste unten.
//
// Der Tagesstand wird bei jedem Öffnen der Übersicht neu geladen
// (core/lib/nutritionDay.js); schlägt das fehl, fehlt nur der Block.
// Rezeptbilder: siehe lib/recipeCovers.jsx.

import { useEffect, useState } from 'react';
import { AMPEL_CATS, RECIPE_CATS } from '../lib/nutrition';
import { RecipeCover } from '../lib/recipeCovers';
import { LEXIKON } from '../lib/data/lexikon';
import { useAuth } from '../../../core/lib/AuthContext';
import { loadNutritionDay } from '../../../core/lib/nutritionDay';
import { NutritionBlock } from '../../../core/components/DayPlan.jsx';
import PageSection from '../../../core/components/PageSection.jsx';
import AreaList from '../../../core/components/AreaList.jsx';
import AreaRow from '../../../core/components/AreaRow.jsx';

export default function OverviewSection({ foods, recipes, onNavigate }) {
  const { session } = useAuth();
  const [day, setDay] = useState(null);

  useEffect(() => {
    let alive = true;
    loadNutritionDay(session)
      .then((d) => { if (alive) setDay(d); })
      .catch((e) => console.error('Tagesstand nicht geladen', e));
    return () => { alive = false; };
  }, [session]);

  const counts = AMPEL_CATS.map((c) => ({
    key:   c.key,
    label: c.label,
    count: foods.filter((f) => f.category === c.key).length,
  }));

  // Zuletzt angelegte Rezepte zuerst — getRecipes sortiert aufsteigend
  // nach created_at, die beiden neuesten stehen also am Ende.
  const latest = recipes.slice(-2).reverse();

  return (
    <>
      <h1 className="overview-page-title">Ernährung</h1>

      {/* Tagesstand wie im Tagesplan; Antippen → Mahlzeiten */}
      {day && (
        <NutritionBlock
          data={day}
          label="Heute"
          hideOpen
          variant="hero"
          onOpen={(target) => { if (target.endsWith('mahlzeiten')) onNavigate('mahlzeiten'); }}
        />
      )}

      {/* Rezepte */}
      <PageSection
        title="Rezepte"
        action={{ label: `Alle ${recipes.length} ›`, onPress: () => onNavigate('rezepte') }}
      >
        {latest.length === 0 ? (
          <div className="nut-recipe-empty">
            Noch keine eigenen Rezepte — über das Plus unten rechts anlegen.
          </div>
        ) : (
          <div className="nut-recipe-grid">
            {latest.map((r) => (
              <button key={r.id} className="nut-recipe-card" onClick={() => onNavigate('rezepte')}>
                <RecipeCover recipe={r} className="nut-recipe-image" />
                <span className="nut-recipe-title">{r.name}</span>
                <span className="nut-recipe-meta">
                  {[RECIPE_CATS.find((c) => c.key === r.category)?.label,
                    r.servings ? `${r.servings} Portionen` : null]
                    .filter(Boolean).join(' · ')}
                </span>
              </button>
            ))}
          </div>
        )}
      </PageSection>

      {/* Bereiche */}
      <PageSection title="Bereiche">
        <AreaList variant="tiles">
          <AreaRow
            label="Ampel"
            icon="ampel"
            featured
            value={(
              <span className="nut-area-ampel">
                {counts.map((c) => (
                  <span key={c.key} className="nut-area-ampel-item">
                    <i className={`nut-ampel-dot nut-ampel-dot--${c.key}`} />
                    {c.count}
                  </span>
                ))}
              </span>
            )}
            onPress={() => onNavigate('lebensmittel')}
          />
          <AreaRow
            label="Lexikon"
            icon="book"
            value={`${LEXIKON.length} Begriffe`}
            onPress={() => onNavigate('lexikon')}
          />
          {/* Ohne Kennzahl: TippsView kennt kein "neu" (kein created_at-
              Vergleich, kein gelesen/ungelesen pro Nutzer) — abgestimmt
              im Umbau-Chat, lieber keine Zahl als eine erfundene. */}
          <AreaRow
            label="Tipps"
            icon="bulb"
            onPress={() => onNavigate('tipps')}
          />
        </AreaList>
      </PageSection>
    </>
  );
}
