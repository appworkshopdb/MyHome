import { useMemo, useState } from 'react';
import UnitVisual from './UnitVisual';
import OwnUnitForm from './OwnUnitForm';
import { KRAFT_SUBS, UNIT_TABS, searchCatalog, tabOf } from '../lib/unitCatalog';

// Einheit wählen (Galerie): Suche, Reiter (Kraft, Ausdauer, Beweglichkeit, Sport,
// Eigene), bei Kraft die Unterkategorien, darunter die Einheiten als Karten mit
// ihren Bildern. Ein Tipp wählt, "Auswählen" übernimmt. Eigene Einheiten legt man
// ebenfalls hier an ("Eigene Einheit zusammenstellen": Muskeln wählen, die Bilder
// ergeben sich daraus), wenn onCreateOwn gegeben ist.
// Der Inhalt scrollt im umgebenden Sheet/Wizard, die Fußleiste klebt unten.

const EMPTY = {
  sport: 'Du hast im Profil noch keine Sportarten gewählt. Dort kannst du sie hinzufügen.',
  eigen: 'Noch keine eigene Einheit. Eigene Einheiten legst du über „Eigene Einheiten verwalten“ an.',
};

export default function UnitPicker({ catalog, selectedKey, onPick, onCreateOwn }) {
  const current = catalog.find((e) => e.key === selectedKey);
  const [tab, setTab] = useState(current ? tabOf(current.cat) : 'kraft');
  const [sub, setSub] = useState(current && ['split', 'muskel', 'kombi'].includes(current.cat) ? current.cat : 'split');
  const [q, setQ] = useState('');
  const [sel, setSel] = useState(selectedKey || null);
  const [own, setOwn] = useState(false);

  const searching = q.trim().length > 0;
  const list = useMemo(() => {
    if (searching) return searchCatalog(catalog, q);
    if (tab === 'kraft') return catalog.filter((e) => e.cat === sub);
    const cats = UNIT_TABS.find((t) => t.key === tab).cats;
    return catalog.filter((e) => cats.includes(e.cat));
  }, [catalog, q, searching, tab, sub]);

  const chosen = catalog.find((e) => e.key === sel);

  if (own) return <OwnUnitForm onSave={async (draft) => onPick(await onCreateOwn(draft))} onCancel={() => setOwn(false)} />;

  return (
    <div className="up">
      <div className="up-search">
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="11" cy="11" r="6.5" /><path d="m16 16 4 4" />
        </svg>
        <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Suchen, z. B. Brust oder Lauf" aria-label="Einheit suchen" />
      </div>

      {!searching && (
        <>
          <div className="up-tabs" role="tablist" aria-label="Kategorie">
            {UNIT_TABS.map((t) => (
              <button key={t.key} type="button" role="tab" aria-selected={tab === t.key} className={tab === t.key ? 'is-on' : ''} onClick={() => setTab(t.key)}>{t.label}</button>
            ))}
          </div>
          {tab === 'kraft' && (
            <div className="up-subs" role="group" aria-label="Unterkategorie">
              {KRAFT_SUBS.map((s) => (
                <button key={s.key} type="button" aria-pressed={sub === s.key} className={sub === s.key ? 'is-on' : ''} onClick={() => setSub(s.key)}>{s.label}</button>
              ))}
            </div>
          )}
        </>
      )}
      {searching && <div className="up-count">{list.length === 1 ? '1 Treffer' : `${list.length} Treffer`}</div>}

      {list.length === 0 ? (
        <p className="up-empty">{searching ? 'Nichts gefunden. Probiere einen anderen Begriff.' : EMPTY[tab]}</p>
      ) : (
        <div className="up-grid" role="radiogroup" aria-label="Einheit">
          {list.map((e) => (
            <button key={e.key} type="button" role="radio" aria-checked={sel === e.key} className={`up-card${sel === e.key ? ' is-on' : ''}`} onClick={() => setSel(e.key)}>
              <span className="up-vis"><UnitVisual tags={e.muscle_groups} icon={e.icon} size={38} max={2} /></span>
              <b>{e.title}</b>
            </button>
          ))}
        </div>
      )}

      <div className="up-foot">
        {onCreateOwn && (
          <button type="button" className="up-ownbtn" onClick={() => setOwn(true)}>
            <span className="up-ownic" aria-hidden="true">+</span>
            <span><b>Eigene Einheit zusammenstellen</b><small>Muskeln wählen, z. B. Brust + Beine</small></span>
          </button>
        )}
        <button type="button" className="btn btn-primary" disabled={!chosen} onClick={() => chosen && onPick(chosen)}>Auswählen</button>
      </div>
    </div>
  );
}
