import { useMemo, useState } from 'react';
import UnitVisual from './UnitVisual';
import { KRAFT_SUBS, UNIT_TABS, searchCatalog, tabOf } from '../lib/unitCatalog';
import { MUSCLE_GROUPS, muscleSinglesByRegion } from '../lib/data/muscleGroups';
import { muscleLabel } from '../lib/planMuscles';

// Einheit wählen (Galerie): Suche, Reiter (Kraft, Ausdauer, Beweglichkeit, Sport,
// Eigene), bei Kraft die Unterkategorien, darunter die Einheiten als Karten mit
// ihren Bildern. Ein Tipp wählt, "Auswählen" übernimmt.
// Kraft > Muskeln zeigt alle Muskeln direkt (sechs Muskelgruppen, dazu die einzelnen
// Muskeln vorne und hinten) als Mehrfachauswahl: mehrere Muskeln ergeben eine
// Kombination ("Brust + Beine"). Eine vorhandene Einheit mit denselben Muskeln wird
// wiederverwendet, sonst legt onCreateOwn eine eigene Einheit an (ohne onCreateOwn
// entsteht ein Eintrag nur für diese Auswahl).
// Der Inhalt scrollt im umgebenden Sheet/Wizard, die Fußleiste klebt unten.

const EMPTY = {
  sport: 'Du hast im Profil noch keine Sportarten gewählt. Dort kannst du sie hinzufügen.',
  eigen: 'Noch keine eigene Einheit. Wähle unter Kraft › Muskeln mehrere Muskeln, daraus entsteht eine eigene Einheit.',
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
        <div className="up-grid" role="radiogroup" aria-label="Einheit">
          {list.map((e) => {
            const on = sel.includes(e.key);
            return (
              <button key={e.key} type="button" role="radio" aria-checked={on} className={`up-card${on ? ' is-on' : ''}`} onClick={() => tap(e.key)}>
                <span className="up-vis"><UnitVisual tags={e.muscle_groups} icon={e.icon} size={38} max={2} /></span>
                <b>{e.title}</b>
              </button>
            );
          })}
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
