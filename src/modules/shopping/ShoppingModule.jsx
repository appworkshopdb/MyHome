// modules/shopping/ShoppingModule.jsx

import { useState, useEffect, useCallback } from 'react';
import ModuleTopBar from '../../core/components/ModuleTopBar.jsx';
import ModuleTabs   from '../../core/components/ModuleTabs.jsx';

import ListView    from './components/ListView.jsx';
import ItemsView   from './components/ItemsView.jsx';
import FreqView    from './components/FreqView.jsx';

import { loadLists } from './lib/shoData.js';

import './shopping.css';

const TABS = [
  { key: 'listen', label: 'Listen'  },
  { key: 'haeufig', label: 'Häufig' },
];

const DEFAULT_VIEW = 'listen';

export default function ShoppingModule({ view, onNavigateView }) {
  const activeTab = TABS.find((t) => t.key === view) ? view : DEFAULT_VIEW;

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

  // Beim Tab-Wechsel offene Liste schließen
  function handleTabChange(key) {
    setOpenList(null);
    onNavigateView(key);
  }

  if (loading) {
    return (
      <>
        <ModuleTopBar title="Einkauf" />
        <div className="page-loading">Wird geladen …</div>
      </>
    );
  }

  // ── Artikelansicht: TopBar zeigt Zurück-Pfeil + Listenname ──
  if (openList) {
    return (
      <>
        <ModuleTopBar title={openList.name} onBack={() => setOpenList(null)} />
        <div className="main-content sho-module-content">
          {error && (
            <div className="toast toast-error" style={{ marginBottom: 16 }}>{error}</div>
          )}
          <ItemsView
            list={openList}
            onBack={() => setOpenList(null)}
          />
        </div>
      </>
    );
  }

  // ── Hauptansicht mit Tabs ────────────────────────────────────
  return (
    <>
      <ModuleTopBar title="Einkauf" />
      <ModuleTabs items={TABS} active={activeTab} onChange={handleTabChange} />
      <div className="main-content sho-module-content">
        {error && (
          <div className="toast toast-error" style={{ marginBottom: 16 }}>{error}</div>
        )}

        {activeTab === 'listen' && (
          <ListView
            lists={lists}
            onListsChange={fetchLists}
            onOpenList={(list) => {
              setOpenList(list);
              // Tab bleibt auf 'listen', openList steuert die Tiefe
            }}
          />
        )}

        {activeTab === 'haeufig' && (
          <FreqView onAddToList={(item) => {
            // Öffnet die erste Liste direkt wenn vorhanden
            if (lists.length > 0) setOpenList(lists[0]);
          }} />
        )}
      </div>
    </>
  );
}
