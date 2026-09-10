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
// Der Listenname steht in der Artikelansicht als Inhalts-Überschrift in
// der Seite (.page-header) — die TopBar zeigt dort weiterhin keinen
// Titel, weil sie den Drill-down nicht kennt.

import { useState, useEffect, useCallback } from 'react';
import ModuleTopBar from '../../core/components/ModuleTopBar.jsx';

import OverviewSection from './components/OverviewSection.jsx';
import ListView    from './components/ListView.jsx';
import ItemsView   from './components/ItemsView.jsx';
import FreqView    from './components/FreqView.jsx';

import { loadLists } from './lib/shoData.js';

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
          <div className="page-header">
            <h1>{openList.name}</h1>
          </div>
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
