// modules/shopping/ShoppingModule.jsx
//
// NEU (UMBAU-PLAN.md Schritt 8): ohne `view` zeigt sich die Übersicht
// (aktive Liste als Fokuskarte, "Häufig"-Chips, Bereiche), mit `view`
// genau EIN Bereich als Vollbild-Detail-Screen.
//
// SONDERFALL unter den fünf Modulen: die Artikelansicht EINER Liste
// (ItemsView) war schon vor dem Umbau ein eigener Drill-down-Screen mit
// Zurück-Pfeil — der bleibt exakt so, als lokaler `openList`-Zustand
// statt als Hash-Bereich. Der Plan sagt das ausdrücklich ("ItemsView
// bleibt der bestehende Drill-down"). Deshalb führen sowohl die
// Fokuskarte als auch die Listen-Zeilen in "Bereiche" direkt dorthin,
// nicht über onNavigateView.
//
// Der Listenname steht in der Artikelansicht als Überschrift in der Kopf-Karte
// von ItemsView (mit Fortschritt) — die TopBar zeigt dort weiterhin keinen
// Titel, weil sie den Drill-down nicht kennt.

import { useState, useEffect, useCallback } from 'react';
import ModuleTopBar from '../../core/components/ModuleTopBar.jsx';

import OverviewSection from './components/OverviewSection.jsx';
import ListView    from './components/ListView.jsx';
import ItemsView   from './components/ItemsView.jsx';
import FreqView    from './components/FreqView.jsx';

import { loadLists } from './lib/shoData.js';
import { takeOpenListRequest } from '../../core/lib/shoppingHandoff.js';

import './shopping.css';

const DETAIL_TITLES = {
  listen:  'Alle Listen',
  haeufig: 'Häufig',
};

export default function ShoppingModule({ view, onNavigateView, hasWarnings }) {
  const [lists,    setLists]    = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState(null);
  const [openList, setOpenList] = useState(null); // wenn gesetzt → ItemsView

  const fetchLists = useCallback(async () => {
    try {
      const data = await loadLists();
      setLists(data);
    } catch (e) {
      setError('Listen konnten nicht geladen werden.');
    }
  }, []);

  useEffect(() => {
    fetchLists().finally(() => setLoading(false));
  }, [fetchLists]);

  // In der Artikelansicht hat die Eingabeleiste ein eigenes Plus: der globale Plus-Knopf
  // würde darauf liegen und wird per Attribut am <html> ausgeblendet (design-v2.css).
  useEffect(() => {
    const root = document.documentElement;
    if (openList) root.setAttribute('data-sho-items', '');
    else root.removeAttribute('data-sho-items');
    return () => root.removeAttribute('data-sho-items');
  }, [openList]);

  // "Liste öffnen" aus dem Hinweis nach Rezept → Einkaufsliste: gezielt diese Liste zeigen.
  // Die Anfrage wird nur einmal gelesen und danach verworfen.
  useEffect(() => {
    const id = takeOpenListRequest();
    if (!id) return;
    loadLists().then((all) => {
      const hit = all.find((l) => l.id === id);
      if (hit) setOpenList(hit);
    }).catch(() => {});
  }, []);

  function backToOverview() { onNavigateView(null); }

  if (loading) {
    return (
      <>
        <ModuleTopBar hasWarnings={hasWarnings} />
        <div className="page-loading with-topbar-space">Wird geladen …</div>
      </>
    );
  }

  // ── Artikelansicht: bestehender Drill-down, unverändert ──
  if (openList) {
    async function handleBack() {
      await fetchLists(); // Status neu laden
      setOpenList(null);
    }
    return (
      <>
        <ModuleTopBar onBack={handleBack} hasWarnings={hasWarnings} />
        <div className="sho-module-content sho-detail-content with-topbar-space">
          {error && (
            <div className="toast toast-error" style={{ marginBottom: 16 }}>{error}</div>
          )}
          <ItemsView
            list={openList}
            onBack={handleBack}
          />
        </div>
      </>
    );
  }

  // ── Detail-Screens: ein Bereich pro Screen ──
  if (view && DETAIL_TITLES[view]) {
    return (
      <>
        <ModuleTopBar onBack={backToOverview} title={DETAIL_TITLES[view]} hasWarnings={hasWarnings} />
        <div className="sho-module-content with-topbar-space">
          {error && (
            <div className="toast toast-error" style={{ marginBottom: 16 }}>{error}</div>
          )}

          {view === 'listen' && (
            <ListView
              lists={lists}
              onListsChange={fetchLists}
              onOpenList={setOpenList}
            />
          )}

          {view === 'haeufig' && <FreqView />}
        </div>
      </>
    );
  }

  // ── Übersicht ──
  return (
    <>
      <ModuleTopBar hasWarnings={hasWarnings} />
      <div className="sho-module-content with-topbar-space">
        {error && (
          <div className="toast toast-error" style={{ marginBottom: 16 }}>{error}</div>
        )}
        <OverviewSection
          lists={lists}
          onOpenList={setOpenList}
          onListsChange={fetchLists}
          onNavigate={onNavigateView}
        />
      </div>
    </>
  );
}
