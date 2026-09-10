// modules/nutrition/components/OverviewSection.jsx
// Modul-Übersicht für Ernährung — passt ohne Scrollen auf einen Screen
// (siehe UMBAU-PLAN.md Schritt 9): Ampel-Fokuskarte mit Suchfeld,
// zwei Rezeptkarten, darunter die Bereiche.
//
// Alle Zahlen kommen aus dem bereits in NutritionModule geladenen State
// (foods/recipes) — kein zusätzlicher Netzwerk-Zugriff.
//
// Die Suche in der Fokuskarte führt auf den Bereich "Lebensmittel"
// (AmpelView) und reicht den eingetippten Text dorthin durch, statt ihn
// beim Wechsel zu verlieren.
//
// Ohne Bereich "Mein Profil": Körperdaten, Trainingsfokus, Sportarten und
// Ernährungsform liegen ausschließlich auf der Profilseite oben rechts.
//
// Rezeptkarten zeigen eine Platzhalterfläche statt eines Fotos: nut_recipes
// hat kein Bildfeld (siehe fromRecipeRow in lib/nutData.js). Das Mockup
// zeigt dort ein Bild — das wäre ein neues Feature, kein Umbau.

import { useState } from 'react';
import { AMPEL_CATS, RECIPE_CATS } from '../lib/nutrition';
import { LEXIKON } from '../lib/data/lexikon';
import { IconSearch } from '../../../core/components/Icons';
import FocusCard from '../../../core/components/FocusCard.jsx';
import PageSection from '../../../core/components/PageSection.jsx';
import AreaList from '../../../core/components/AreaList.jsx';
import AreaRow from '../../../core/components/AreaRow.jsx';

export default function OverviewSection({ foods, recipes, onSearch, onNavigate }) {
  const [query, setQuery] = useState('');

  const counts = AMPEL_CATS.map((c) => ({
    key:   c.key,
    label: c.label,
    count: foods.filter((f) => f.category === c.key).length,
  }));

  // Zuletzt angelegte Rezepte zuerst — getRecipes sortiert aufsteigend
  // nach created_at, die beiden neuesten stehen also am Ende.
  const latest = recipes.slice(-2).reverse();

  function submitSearch(e) {
    e.preventDefault();
    onSearch(query.trim());
  }

  return (
    <>
      <h1 className="overview-page-title">Ernährung</h1>

      {/* Fokuskarte: Ampel-Frage mit Suchfeld */}
      <FocusCard>
        <FocusCard.Eyebrow>Ampel</FocusCard.Eyebrow>
        <div className="nut-focus-question">Ist das drin?</div>

        <form className="nut-focus-search" onSubmit={submitSearch}>
          <span className="nut-focus-search-icon" aria-hidden="true"><IconSearch /></span>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Lebensmittel suchen …"
            aria-label="Lebensmittel suchen"
          />
        </form>

        <div className="nut-ampel-legend">
          {counts.map((c) => (
            <span key={c.key} className="nut-ampel-legend-item">
              <i className={`nut-ampel-dot nut-ampel-dot--${c.key}`} />
              {c.count}
            </span>
          ))}
        </div>
      </FocusCard>

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
                <span className="nut-recipe-image" aria-hidden="true" />
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
        <AreaList fabClearance>
          <AreaRow
            label="Lebensmittel"
            value={`${foods.length}`}
            onPress={() => onNavigate('lebensmittel')}
          />
          <AreaRow
            label="Lexikon"
            value={`${LEXIKON.length} Begriffe`}
            onPress={() => onNavigate('lexikon')}
          />
          {/* Ohne Kennzahl: TippsView kennt kein "neu" (kein created_at-
              Vergleich, kein gelesen/ungelesen pro Nutzer) — abgestimmt
              im Umbau-Chat, lieber keine Zahl als eine erfundene. */}
          <AreaRow
            label="Tipps"
            onPress={() => onNavigate('tipps')}
          />
        </AreaList>
      </PageSection>
    </>
  );
}
