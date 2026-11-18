import { useMemo, useState } from 'react';
import UnitVisual from './UnitVisual';
import { KRAFT_SUBS, UNIT_TABS, searchCatalog, tabOf } from '../lib/unitCatalog';
import { MUSCLE_GROUPS, muscleSinglesByRegion } from '../lib/data/muscleGroups';
import { muscleLabel } from '../lib/planMuscles';

// Einheit wählen (Galerie): Suche, Kategorien als Kacheln (Kraft, Ausdauer, Mobility,
// Eigene = eigene Einheiten + Sportarten aus dem Profil), bei Kraft die Unterkategorien
// (Splits, Muskeln, Kombinationen) als Umschalter, darunter die Einheiten als Karten mit
// ihren Bildern. Ein Tipp wählt, "Auswählen" übernimmt.
// Kraft > Muskeln zeigt alle Muskeln direkt (sechs Muskelgruppen, dazu die einzelnen
// Muskeln vorne und hinten) als Mehrfachauswahl: mehrere Muskeln ergeben eine
// Kombination ("Brust + Beine"). Eine vorhandene Einheit mit denselben Muskeln wird
// wiederverwendet, sonst legt onCreateOwn eine eigene Einheit an (ohne onCreateOwn
// entsteht ein Eintrag nur für diese Auswahl).
// Der Inhalt scrollt im umgebenden Sheet/Wizard, die Fußleiste klebt unten.

const EMPTY = {
  eigen: 'Noch nichts hier. Wähle unter Kraft › Muskeln mehrere Muskeln, daraus entsteht eine eigene Einheit. Sportarten fügst du im Profil hinzu.',
};

// Symbole der Kategorie-Kacheln
const TAB_ICONS = {
  kraft: <path d="M6.5 6.5v11M17.5 6.5v11M3.5 9v6M20.5 9v6M6.5 12h11" />,
  aus: <path d="M3 12h4l2-5 4 10 2-5h6" />,
  beweg: <><circle cx="12" cy="5" r="2" /><path d="M12 8v6m0 0-3 6m3-6 3 6M5 11l7-3 7 3" /></>,
  eigen: <path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.8 6.8 19.6l1-5.8L3.5 9.7l5.9-.9z" />,
};

export default function UnitPicker({ catalog, selectedKey, onPick, onCreateOwn }) {
  const current = catalog.find((e) => e.key === selectedKey);
  const [tab, setTab] = useState(current ? tabOf(current.cat) : 'kraft');
  const [sub, setSub] = useState(current && ['split', 'muskel', 'kombi'].includes(current.cat) ? current.cat : 'split');
  const [q, setQ] = useState('');
  const [sel, setSel] = useState(selectedKey && current?.cat !== 'muskel' ? [selectedKey] : []);
  const [mus, setMus] = useState(current?.cat === 'muskel' ? current.muscle_groups ?? [] : []); // gewählte Muskeln (Schlüssel)
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const searching = q.trim().length > 0;
  const list = useMemo(() => {
    if (searching) return searchCatalog(catalog, q);
    if (tab === 'kraft') return catalog.filter((e) => e.cat === sub);
    const cats = UNIT_TABS.find((t) => t.key === tab).cats;
    return catalog.filter((e) => cats.includes(e.cat));
  }, [catalog, q, searching, tab, sub]);

  // Muskeln: Mehrfachwahl (ohne Suche)
  const muscleMode = !searching && tab === 'kraft' && sub === 'muskel';
  const chosen = catalog.find((e) => e.key === sel[0]);
  const comboTitle = mus.map(muscleLabel).join(' + ');
  const ready = muscleMode ? mus.length > 0 : Boolean(chosen);

  function tap(key) { setError(''); setSel([key]); }
  function toggleMuscle(key) { setError(''); setMus((cur) => (cur.includes(key) ? cur.filter((k) => k !== key) : [...cur, key])); }
  function changeTab(next) { setTab(next); setSel([]); setMus([]); setError(''); }
  function changeSub(next) { setSub(next); setSel([]); setMus([]); setError(''); }

  async function confirm() {
    if (!ready || busy) return;
    if (!muscleMode) return onPick(chosen);
    // gleiche Muskeln wie eine vorhandene Einheit? Dann diese nehmen
    const sameSet = (a) => a.length === mus.length && a.every((m) => mus.includes(m));
    const existing = catalog.find((e) => e.cat !== 'sport' && e.muscle_groups?.length && sameSet(e.muscle_groups));
    if (existing) return onPick(existing);
    if (!onCreateOwn) return onPick({ key: `combo:${mus.join('+')}`, title: comboTitle, type_key: null, muscle_groups: mus, icon: '', cat: 'kombi' });
    setBusy(true); setError('');
    try { onPick(await onCreateOwn({ title: comboTitle, muscle_groups: mus })); }
    catch { setError('Speichern fehlgeschlagen.'); setBusy(false); }
  }

  const unitCard = (e) => {
    const on = sel.includes(e.key);
    return (
      <button key={e.key} type="button" role="radio" aria-checked={on} className={`up-card${on ? ' is-on' : ''}`} onClick={() => tap(e.key)}>
        <span className="up-vis"><UnitVisual tags={e.muscle_groups} icon={e.icon} size={38} max={2} /></span>
        <b>{e.title}</b>
      </button>
    );
  };
  // Im Reiter "Eigene" getrennt: eigene Einheiten und Sportarten aus dem Profil
  const groups = !searching && tab === 'eigen'
    ? [
        { key: 'eigen', title: 'Eigene Einheiten', items: list.filter((e) => e.cat === 'eigen') },
        { key: 'sport', title: 'Meine Sportarten', items: list.filter((e) => e.cat === 'sport') },
      ].filter((g) => g.items.length > 0)
    : [{ key: 'all', title: '', items: list }];

  const muscleCard = (m) => {
    const on = mus.includes(m.key);
    return (
      <button key={m.key} type="button" role="checkbox" aria-checked={on} className={`up-card is-multi${on ? ' is-on' : ''}`} onClick={() => toggleMuscle(m.key)}>
        <span className="up-vis"><UnitVisual tags={[m.key]} size={38} max={1} /></span>
        <b>{muscleLabel(m.key)}</b>
      </button>
    );
  };

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
          <div className="up-cats" role="tablist" aria-label="Kategorie">
            {UNIT_TABS.map((t) => (
              <button key={t.key} type="button" role="tab" aria-selected={tab === t.key} className={tab === t.key ? 'is-on' : ''} onClick={() => changeTab(t.key)}>
                <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{TAB_ICONS[t.key]}</svg>
                <span>{t.label}</span>
              </button>
            ))}
          </div>
          {tab === 'kraft' && (
            <div className="up-seg" role="tablist" aria-label="Unterkategorie">
              {KRAFT_SUBS.map((s) => (
                <button key={s.key} type="button" role="tab" aria-selected={sub === s.key} className={sub === s.key ? 'is-on' : ''} onClick={() => changeSub(s.key)}>{s.label}</button>
              ))}
            </div>
          )}
        </>
      )}
      {searching && <div className="up-count">{list.length === 1 ? '1 Treffer' : `${list.length} Treffer`}</div>}

      {muscleMode ? (
        <div className="up-muscles">
          <div className="up-sec">Muskelgruppen</div>
          <div className="up-grid" role="group" aria-label="Muskelgruppen">{MUSCLE_GROUPS.map(muscleCard)}</div>
          {['Vorne', 'Hinten'].map((region) => (
            <div key={region}>
              <div className="up-sec">Einzelne Muskeln · {region}</div>
              <div className="up-grid" role="group" aria-label={`Einzelne Muskeln ${region}`}>{muscleSinglesByRegion(region).map(muscleCard)}</div>
            </div>
          ))}
        </div>
      ) : list.length === 0 ? (
        <p className="up-empty">{searching ? 'Nichts gefunden. Probiere einen anderen Begriff.' : EMPTY[tab]}</p>
      ) : (
        <div className="up-groups" role="radiogroup" aria-label="Einheit">
          {groups.map((g) => (
            <div key={g.key}>
              {g.title && <div className="up-sec">{g.title}</div>}
              <div className="up-grid">{g.items.map(unitCard)}</div>
            </div>
          ))}
        </div>
      )}
      {muscleMode && mus.length === 0 && <p className="up-hint">Tippe einen oder mehrere Muskeln an, z. B. Brust + Beine.</p>}

      <div className="up-foot">
        {muscleMode && mus.length > 0 && (
          <div className="up-combo" aria-live="polite">
            <UnitVisual tags={mus} size={34} max={3} />
            <b>{comboTitle}</b>
          </div>
        )}
        {error && <p className="up-error" role="alert">{error}</p>}
        <button type="button" className="btn btn-primary" disabled={!ready || busy} onClick={confirm}>{busy ? 'Speichert…' : 'Auswählen'}</button>
      </div>
    </div>
  );
}
