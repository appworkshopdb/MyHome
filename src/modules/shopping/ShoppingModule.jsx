// modules/shopping/ShoppingModule.jsx
// Einstiegspunkt des Einkauf-Moduls.
//
// Routing-Muster identisch zu FinanceModule/HabitsModule:
//   view/onNavigateView kommen von App.jsx (useRoute),
//   kein eigenes useState für die aktive Unteransicht.
//
// Tabs:
//   listen   → Übersicht aller Einkaufslisten
//   (weitere Unteransichten kommen in Phase 2/3)

import { useState, useEffect, useCallback } from 'react';
import ModuleTopBar from '../../core/components/ModuleTopBar.jsx';
import ModuleTabs   from '../../core/components/ModuleTabs.jsx';

import ListView from './components/ListView.jsx';

import { loadLists } from './lib/shoData.js';

import './shopping.css';

const TABS = [
  { key: 'listen', label: 'Einkauf' },
];

const DEFAULT_VIEW = 'listen';

export default function ShoppingModule({ view, onNavigateView }) {
  const activeTab = TABS.find((t) => t.key === view) ? view : DEFAULT_VIEW;

  const [lists,   setLists]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);

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

  const tabLabel = TABS.find((t) => t.key === activeTab)?.label ?? 'Einkauf';

  if (loading) {
    return (
      <>
        <ModuleTopBar title="Einkauf" />
        <div className="page-loading">Wird geladen …</div>
      </>
    );
  }

  return (
    <>
      <ModuleTopBar title={tabLabel} />
      {/* Tabs erst anzeigen wenn es mehr als einen gibt */}
      {TABS.length > 1 && (
        <ModuleTabs items={TABS} active={activeTab} onChange={onNavigateView} />
      )}

      <div className="main-content sho-module-content">
        {error && (
          <div className="toast toast-error" style={{ marginBottom: 16 }}>{error}</div>
        )}

        {activeTab === 'listen' && (
          <ListView
            lists={lists}
            onListsChange={fetchLists}
          />
        )}
      </div>
    </>
  );
}
