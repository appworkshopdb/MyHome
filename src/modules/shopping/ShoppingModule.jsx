// modules/shopping/ShoppingModule.jsx
//
// SONDERFALL unter den fünf Modulen: "Listen" ist kein einfacher Tab mit
// Inhalt — ein Tap auf eine Liste wechselt komplett auf ItemsView mit
// eigenem Zurück-Pfeil (Drill-down, keine Geschwister-Ansicht wie bei den
// anderen Modulen). Würden Listen + Artikelansicht stumpf untereinander-
// gelegt, lägen die Artikel ALLER Listen auf einer Seite — ein anderes
// Feature, nicht dieselbe Funktion in neuer Optik.
//
// Deshalb: "Listen" und "Häufig" werden zu einer durchlaufenden Seite
// zusammengelegt (zwei PageSections), die Artikelansicht EINER Liste
// bleibt aber ein eigener Screen mit Zurück-Pfeil, unverändert.
//
// Da die TopBar app-weit keinen Titel mehr zeigt (siehe ModuleTopBar.jsx),
// aber der Listenname in der Artikelansicht wichtiger Kontext ist (welche
// Liste ist das?), steht er dort jetzt als Inhalts-Überschrift direkt in
// der Seite (.page-header), nicht mehr in der fixen Chrome oben.

import { useState, useEffect, useCallback } from 'react';
import ModuleTopBar from '../../core/components/ModuleTopBar.jsx';
import PageSection  from '../../core/components/PageSection.jsx';

import ListView    from './components/ListView.jsx';
import ItemsView   from './components/ItemsView.jsx';
import FreqView    from './components/FreqView.jsx';

import { loadLists } from './lib/shoData.js';

import './shopping.css';

export default function ShoppingModule({ hasWarnings }) {
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

  if (loading) {
    return (
      <>
        <ModuleTopBar hasWarnings={hasWarnings} />
        <div className="page-loading with-topbar-space">Wird geladen …</div>
      </>
    );
  }

  // ── Artikelansicht: eigener Screen mit Zurück-Pfeil, unverändert ──
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

  // ── Hauptseite: Listen + Häufig als zwei Abschnitte ──────────────
  return (
    <>
      <ModuleTopBar hasWarnings={hasWarnings} />
      <div className="sho-module-content with-topbar-space">
        {error && (
          <div className="toast toast-error" style={{ marginBottom: 16 }}>{error}</div>
        )}

        <PageSection title="Listen">
          <ListView
            lists={lists}
            onListsChange={fetchLists}
            onOpenList={setOpenList}
          />
        </PageSection>

        <PageSection title="Häufig">
          <FreqView onAddToList={(item) => {
            // Öffnet die erste Liste direkt wenn vorhanden
            if (lists.length > 0) setOpenList(lists[0]);
          }} />
        </PageSection>
      </div>
    </>
  );
}
