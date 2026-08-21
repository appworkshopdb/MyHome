// modules/shopping/ShoppingModule.jsx
// Einstiegspunkt des Einkauf-Moduls.
//
// Routing-Muster identisch zu FinanceModule/HabitsModule:
//   view/onNavigateView kommen von App.jsx (useRoute),
//   kein eigenes useState für die aktive Tab-Ansicht.
//
// openList: die aktuell geöffnete Liste (null = Listenübersicht).
// Das ist bewusst KEIN URL-Part — nur Modul + Tab gehören in die URL,
// tiefere Zustände (welche Liste offen) bleiben im lokalen State
// (siehe Projektkontext.md, Abschnitt "Routing").

import { useState, useEffect, useCallback } from 'react';
import ModuleTopBar from '../../core/components/ModuleTopBar.jsx';

import ListView  from './components/ListView.jsx';
import ItemsView from './components/ItemsView.jsx';

import { loadLists } from './lib/shoData.js';

import './shopping.css';

export default function ShoppingModule({ view, onNavigateView }) {
  const [lists,    setLists]    = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState(null);
  const [openList, setOpenList] = useState(null); // { id, name, icon }

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
        <ModuleTopBar title="Einkauf" />
        <div className="page-loading">Wird geladen …</div>
      </>
    );
  }

  // Artikelansicht einer bestimmten Liste
  if (openList) {
    return (
      <>
        <ModuleTopBar title={openList.name} />
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

  // Listenübersicht
  return (
    <>
      <ModuleTopBar title="Einkauf" />
      <div className="main-content sho-module-content">
        {error && (
          <div className="toast toast-error" style={{ marginBottom: 16 }}>{error}</div>
        )}
        <ListView
          lists={lists}
          onListsChange={fetchLists}
          onOpenList={setOpenList}
        />
      </div>
    </>
  );
}
