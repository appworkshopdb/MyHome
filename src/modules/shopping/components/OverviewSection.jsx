// modules/shopping/components/OverviewSection.jsx
// Modul-Übersicht für Einkauf — passt ohne Scrollen auf einen Screen
// (siehe UMBAU-PLAN.md Schritt 8): aktive Liste als Fokuskarte,
// "Häufig" als Chips, darunter die Bereiche.
//
// Regel für "die eine aktive Liste" (im Repo gibt es dafür kein Flag,
// nur einen Status pro Liste — abgestimmt im Umbau-Chat):
//   1. zuletzt geänderte Liste mit Status "im_einkauf"
//   2. sonst die zuletzt angelegte offene Liste
//   3. sonst Leerzustand mit Hinweis auf den FAB
//
// Die Artikelansicht EINER Liste (ItemsView) bleibt der bestehende
// Drill-down mit eigenem Zurück-Pfeil — unverändert, kein Hash-Bereich.

import { useEffect, useState } from 'react';
import { loadFrequentItems, saveItem } from '../lib/shoData.js';
import FocusCard from '../../../core/components/FocusCard.jsx';
import PageSection from '../../../core/components/PageSection.jsx';
import AreaList from '../../../core/components/AreaList.jsx';
import AreaRow from '../../../core/components/AreaRow.jsx';

const CHIP_COUNT = 6;

function changedAt(list) {
  return new Date(list.updated_at || list.created_at || 0).getTime();
}
function createdAt(list) {
  return new Date(list.created_at || 0).getTime();
}

export function pickActiveList(lists) {
  const imEinkauf = lists.filter((l) => l.status === 'im_einkauf');
  if (imEinkauf.length > 0) {
    return imEinkauf.slice().sort((a, b) => changedAt(b) - changedAt(a))[0];
  }
  const offen = lists.filter((l) => (l.status || 'offen') === 'offen');
  if (offen.length > 0) {
    return offen.slice().sort((a, b) => createdAt(b) - createdAt(a))[0];
  }
  return null;
}

export default function OverviewSection({ lists, onOpenList, onListsChange, onNavigate }) {
  const [freq, setFreq]       = useState([]);
  const [adding, setAdding]   = useState(null);
  const [added, setAdded]     = useState(null);
  const [error, setError]     = useState(null);

  useEffect(() => {
    loadFrequentItems(CHIP_COUNT)
      .then(setFreq)
      .catch(() => setFreq([]));
  }, []);

  const active     = pickActiveList(lists);
  const offeneListen = lists.filter((l) => (l.status || 'offen') !== 'erledigt');
  const weitere    = offeneListen.filter((l) => l.id !== active?.id).slice(0, 3);

  const done  = active?._done  ?? 0;
  const total = active?._total ?? 0;

  async function handleChip(item) {
    if (!active) { setError('Erst eine Liste anlegen — über das Plus unten rechts.'); return; }
    setAdding(item.name);
    setError(null);
    try {
      await saveItem({
        list_id:  active.id,
        name:     item.name,
        category: item.category,
        quantity: item.quantity ?? null,
        unit:     item.unit ?? null,
      });
      setAdded(item.name);
      setTimeout(() => setAdded(null), 2000);
      await onListsChange();
    } catch {
      setError('Hinzufügen fehlgeschlagen.');
    } finally {
      setAdding(null);
    }
  }

  return (
    <>
      <h1 className="overview-page-title">Einkauf</h1>

      {/* Fokuskarte: aktive Liste */}
      <FocusCard>
        {active ? (
          <>
            <FocusCard.Eyebrow right={active.status === 'im_einkauf' ? 'IM EINKAUF' : null}>
              Aktive Liste
            </FocusCard.Eyebrow>
            <div className="sho-focus-title">{active.name}</div>
            <FocusCard.Progress value={total > 0 ? done / total : 0} />
            <FocusCard.Footer divider={false}>
              <span>
                {total > 0 ? `${done} von ${total} erledigt` : 'Noch keine Artikel'}
              </span>
              <FocusCard.Pill onPress={() => onOpenList(active)}>Öffnen</FocusCard.Pill>
            </FocusCard.Footer>
          </>
        ) : (
          <>
            <FocusCard.Eyebrow>Aktive Liste</FocusCard.Eyebrow>
            <div className="sho-focus-title">Keine offene Liste</div>
            <FocusCard.Meta>
              <span>Neue Liste über das Plus unten rechts anlegen.</span>
            </FocusCard.Meta>
          </>
        )}
      </FocusCard>

      {/* Häufig — Chips legen den Artikel direkt in die aktive Liste */}
      <PageSection
        title="Häufig"
        action={{ label: 'Mehr ›', onPress: () => onNavigate('haeufig') }}
      >
        <div className="sho-freq-card">
          {freq.length === 0 ? (
            <div className="sho-freq-empty">
              Noch keine Gewohnheiten erkennbar — abgehakte Artikel tauchen hier auf.
            </div>
          ) : (
            <div className="sho-chip-row">
              {freq.map((item) => (
                <button
                  key={item.name}
                  className="sho-chip"
                  onClick={() => handleChip(item)}
                  disabled={adding === item.name}
                >
                  {added === item.name ? '✓' : '+'} {item.name}
                </button>
              ))}
            </div>
          )}
          {error && <div className="sho-freq-error">{error}</div>}
        </div>
      </PageSection>

      {/* Bereiche */}
      <PageSection title="Bereiche">
        <AreaList fabClearance>
          <AreaRow
            label="Alle Listen"
            value={`${lists.length} · ${offeneListen.length} offen`}
            onPress={() => onNavigate('listen')}
          />
          {weitere.map((l) => (
            <AreaRow
              key={l.id}
              label={l.name}
              value={`${l._done ?? 0} / ${l._total ?? 0}`}
              onPress={() => onOpenList(l)}
            />
          ))}
        </AreaList>
      </PageSection>
    </>
  );
}
