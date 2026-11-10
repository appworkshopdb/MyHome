import { useMemo, useState } from 'react';
import UnitVisual from './UnitVisual';
import OwnUnitForm from './OwnUnitForm';
import { KRAFT_SUBS, UNIT_TABS, searchCatalog, tabOf } from '../lib/unitCatalog';

// Einheit wählen (Galerie): Suche, Reiter (Kraft, Ausdauer, Beweglichkeit, Sport,
// Eigene), bei Kraft die Unterkategorien, darunter die Einheiten als Karten mit
// ihren Bildern. Ein Tipp wählt, "Auswählen" übernimmt. Im Reiter Kraft > Muskeln
// wählt man mehrere Muskeln direkt an (Kombination, z. B. "Brust + Rücken"): eine
// vorhandene Einheit mit denselben Muskeln wird wiederverwendet, sonst legt
// onCreateOwn eine eigene Einheit an (ohne onCreateOwn entsteht ein Eintrag nur für
// diese Auswahl). "Eigene Einheit zusammenstellen" bleibt für einzelne Muskeln.
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
  const [sel, setSel] = useState(selectedKey ? [selectedKey] : []);
  const [own, setOwn] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const searching = q.trim().length > 0;
  const list = useMemo(() => {
    if (searching) return searchCatalog(catalog, q);
    if (tab === 'kraft') return catalog.filter((e) => e.cat === sub);
    const cats = UNIT_TABS.find((t) => t.key === tab).cats;
    return catalog.filter((e) => cats.includes(e.cat));
  }, [catalog, q, searching, tab, sub]);

  // Mehrfachwahl nur bei den Muskeln (ohne Suche)
  const multi = !searching && tab === 'kraft' && sub === 'muskel';
  const chosenList = sel.map((k) => catalog.find((e) => e.key === k)).filter(Boolean);
  const combo = multi && chosenList.length > 1;
  const comboTitle = chosenList.map((e) => e.title).join(' + ');
  const comboMuscles = [...new Set(chosenList.flatMap((e) => e.muscle_groups ?? []))];

  function tap(key) {
    setError('');
    setSel((cur) => (!multi ? [key] : cur.includes(key) ? cur.filter((k) => k !== key) : [...cur, key]));
  }
  function changeTab(next) { setTab(next); setSel([]); setError(''); }
  function changeSub(next) { setSub(next); setSel([]); setError(''); }

  async function confirm() {
    if (chosenList.length === 0 || busy) return;
    if (!combo) return onPick(chosenList[0]);
    // gleiche Muskeln wie eine vorhandene Einheit? Dann diese nehmen
    const sameSet = (a) => a.length === comboMuscles.length && a.every((m) => comboMuscles.includes(m));
    const existing = catalog.find((e) => e.cat !== 'sport' && e.muscle_groups?.length && sameSet(e.muscle_groups));
    if (existing) return onPick(existing);
    if (!onCreateOwn) return onPick({ key: `combo:${sel.join('+')}`, title: comboTitle, type_key: null, muscle_groups: comboMuscles, icon: '', cat: 'kombi' });
    setBusy(true); setError('');
    try { onPick(await onCreateOwn({ title: comboTitle, muscle_groups: comboMuscles })); }
    catch { setError('Speichern fehlgeschlagen.'); setBusy(false); }
  }

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
              <button key={t.key} type="button" role="tab" aria-selected={tab === t.key} className={tab === t.key ? 'is-on' : ''} onClick={() => changeTab(t.key)}>{t.label}</button>
            ))}
          </div>
          {tab === 'kraft' && (
            <div className="up-subs" role="group" aria-label="Unterkategorie">
              {KRAFT_SUBS.map((s) => (
                <button key={s.key} type="button" aria-pressed={sub === s.key} className={sub === s.key ? 'is-on' : ''} onClick={() => changeSub(s.key)}>{s.label}</button>
              ))}
            </div>
          )}
        </>
      )}
      {searching && <div className="up-count">{list.length === 1 ? '1 Treffer' : `${list.length} Treffer`}</div>}

      {list.length === 0 ? (
        <p className="up-empty">{searching ? 'Nichts gefunden. Probiere einen anderen Begriff.' : EMPTY[tab]}</p>
      ) : (
        <div className="up-grid" role={multi ? 'group' : 'radiogroup'} aria-label={multi ? 'Muskeln' : 'Einheit'}>
          {list.map((e) => {
            const on = sel.includes(e.key);
            return (
              <button key={e.key} type="button" role={multi ? 'checkbox' : 'radio'} aria-checked={on} className={`up-card${on ? ' is-on' : ''}${multi ? ' is-multi' : ''}`} onClick={() => tap(e.key)}>
                <span className="up-vis"><UnitVisual tags={e.muscle_groups} icon={e.icon} size={38} max={2} /></span>
                <b>{e.title}</b>
              </button>
            );
          })}
        </div>
      )}

      {multi && !combo && <p className="up-hint">Tippe mehrere Muskeln an, z. B. Brust + Rücken.</p>}

      <div className="up-foot">
        {combo && (
          <div className="up-combo" aria-live="polite">
            <UnitVisual tags={comboMuscles} size={34} max={3} />
            <b>{comboTitle}</b>
          </div>
        )}
        {error && <p className="up-error" role="alert">{error}</p>}
        {onCreateOwn && (
          <button type="button" className="up-ownbtn" onClick={() => setOwn(true)}>
            <span className="up-ownic" aria-hidden="true">+</span>
            <span><b>Eigene Einheit zusammenstellen</b><small>Muskeln wählen, z. B. Brust + Beine</small></span>
          </button>
        )}
        <button type="button" className="btn btn-primary" disabled={chosenList.length === 0 || busy} onClick={confirm}>{busy ? 'Speichert…' : 'Auswählen'}</button>
      </div>
    </div>
  );
}
