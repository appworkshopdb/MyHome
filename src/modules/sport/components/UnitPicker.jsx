import { useEffect, useMemo, useRef, useState } from 'react';
import UnitVisual from './UnitVisual';
import SportSymbol from './SportSymbol';
import OwnUnitForm from './OwnUnitForm';
import { KRAFT_SUBS, UNIT_TABS, searchCatalog, tabOf } from '../lib/unitCatalog';
import { MUSCLE_GROUPS, muscleSinglesByRegion } from '../lib/data/muscleGroups';
import { muscleLabel } from '../lib/planMuscles';
import Icon from '../../../core/components/Icon';

// Einheit wählen (Galerie). Kategorien als Kacheln: Kraft, Ausdauer, Mobility zeigen
// die festen Vorlagen (App-Einheiten), "Eigene" die selbst angelegten Einheiten und die Sportarten
// aus dem Profil. Bei Kraft darunter der Umschalter Splits / Muskeln / Kombinationen.
// Ein Tipp wählt, "Auswählen" übernimmt.
// Kraft › Muskeln: alle Muskeln als Mehrfachauswahl. Die Auswahl gilt nur für diese
// Stelle (Training bzw. Plan-Tag), gespeichert wird NICHTS, außer man schaltet
// "Als eigene Einheit speichern" ein. Passt die Auswahl genau zu einer vorhandenen
// Einheit, wird diese genommen.
// Neue eigene Einheiten entstehen über die Kachel "Neue Einheit" (Formular OwnUnitForm),
// beides nur, wenn onCreateOwn gegeben ist (gibt den Katalog-Eintrag zurück).
// Der Inhalt scrollt im umgebenden Sheet/Wizard, die Fußleiste klebt unten.
// inline: eingebettet in ein Formular ("Training eintragen" auf einer Seite): ohne Suche
// und ohne eigene Fußleiste; jede Auswahl geht sofort an onChange(entry | null), ein
// zweiter Tipp hebt sie auf. "Neue Einheit" ruft dann onNewOwn() statt das Formular hier
// zu öffnen. Muskel-Kombinationen kommen als Eintrag 'combo:…' (Speichern als eigene
// Einheit entscheidet das umgebende Formular).

const TAB_SYMBOL = { kraft: 'kraft', aus: 'laufen', beweg: 'mobility', eigen: 'stern' };
const COMBO_TYPE = 'custom.kraft'; // Muskel-Kombinationen zählen in der Auswertung als Kraft
const sameSet = (a, b) => a.length === b.length && a.every((m) => b.includes(m));

export default function UnitPicker({ catalog, selectedKey, onPick, onCreateOwn, inline = false, onChange, onNewOwn }) {
  const current = catalog.find((e) => e.key === selectedKey);
  const comboStart = selectedKey?.startsWith('combo:') ? selectedKey.slice(6).split('+').filter(Boolean) : null;
  const [tab, setTab] = useState(comboStart ? 'kraft' : current ? tabOf(current.cat) : 'kraft');
  const [sub, setSub] = useState(comboStart ? 'muskel' : current && ['split', 'muskel', 'kombi'].includes(current.cat) ? current.cat : 'split');
  const [q, setQ] = useState('');
  const [sel, setSel] = useState(selectedKey && !comboStart && current?.cat !== 'muskel' ? [selectedKey] : []);
  const [mus, setMus] = useState(comboStart ?? (current?.cat === 'muskel' ? current.muscle_groups ?? [] : [])); // gewählte Muskeln
  const [saveOwn, setSaveOwn] = useState(false);
  const [ownName, setOwnName] = useState('');
  const [creating, setCreating] = useState(false);
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
  const comboTitle = mus.map(muscleLabel).join(' & ');
  const ready = muscleMode ? mus.length > 0 : Boolean(chosen);

  function tap(key) { setError(''); setSel((cur) => (inline && cur[0] === key ? [] : [key])); }
  function toggleMuscle(key) { setError(''); setMus((cur) => (cur.includes(key) ? cur.filter((k) => k !== key) : [...cur, key])); }
  function changeTab(next) { setTab(next); setSel([]); setMus([]); setError(''); }
  function changeSub(next) { setSub(next); setSel([]); setMus([]); setError(''); }

  async function confirm() {
    if (!ready || busy) return;
    if (!muscleMode) return onPick(chosen);
    if (saveOwn && onCreateOwn) {
      const title = ownName.trim() || comboTitle;
      // dieselben Muskeln gibt es schon als eigene Einheit? Dann diese nehmen
      const existingOwn = catalog.find((e) => e.own && e.muscle_groups?.length && sameSet(e.muscle_groups, mus));
      if (existingOwn) return onPick(existingOwn);
      setBusy(true); setError('');
      try { onPick(await onCreateOwn({ title, muscle_groups: mus, icon: null, type_key: COMBO_TYPE })); }
      catch { setError('Speichern fehlgeschlagen.'); setBusy(false); }
      return;
    }
    // nur für diese Stelle: passt eine vorhandene Einheit genau, diese nehmen
    const existing = catalog.find((e) => e.cat !== 'sport' && e.muscle_groups?.length && sameSet(e.muscle_groups, mus));
    if (existing) return onPick(existing);
    onPick({ key: `combo:${mus.join('+')}`, title: comboTitle, type_key: COMBO_TYPE, muscle_groups: mus, icon: '', cat: 'kombi' });
  }

  // inline: aktuelle Auswahl melden (Kombination: vorhandene Einheit mit denselben Muskeln oder 'combo:…')
  const report = useRef(onChange);
  report.current = onChange;
  useEffect(() => {
    if (!inline) return;
    if (muscleMode) {
      if (!mus.length) return report.current?.(null);
      const existing = catalog.find((e) => e.cat !== 'sport' && e.muscle_groups?.length && sameSet(e.muscle_groups, mus));
      report.current?.(existing ?? { key: `combo:${mus.join('+')}`, title: comboTitle, type_key: COMBO_TYPE, muscle_groups: mus, icon: '', cat: 'kombi' });
    } else {
      report.current?.(catalog.find((e) => e.key === sel[0]) ?? null);
    }
  }, [inline, muscleMode, mus.join('+'), sel[0]]); // eslint-disable-line react-hooks/exhaustive-deps

  async function createOwn(draft) {
    const entry = await onCreateOwn(draft);
    onPick(entry);
  }

  if (creating) {
    return <OwnUnitForm onSave={createOwn} onCancel={() => setCreating(false)} saveLabel="Speichern und wählen" cancelLabel="Zurück" />;
  }

  const unitCard = (e) => {
    const on = sel.includes(e.key);
    return (
      <button key={e.key} type="button" role="radio" aria-checked={on} className={`up-card${on ? ' is-on' : ''}`} onClick={() => tap(e.key)}>
        <span className="up-vis"><UnitVisual tags={e.muscle_groups} icon={e.icon} size={38} max={2} /></span>
        <b>{e.title}</b>
        {searching && e.own && <i className="up-own-tag">Eigene</i>}
      </button>
    );
  };
  const newCard = (inline ? onNewOwn : onCreateOwn) && (
    <button key="new" type="button" className="up-card up-card--new" onClick={() => (inline ? onNewOwn() : setCreating(true))}>
      <span className="up-vis"><span className="up-plus" aria-hidden="true"><Icon name="plus" size={null} className="glyph" /></span></span>
      <b>Neue Einheit</b>
    </button>
  );
  // Reiter "Eigene": eigene Einheiten (mit "Neue Einheit" vorn) und Sportarten aus dem Profil
  const groups = !searching && tab === 'eigen'
    ? [
        { key: 'eigen', title: 'Meine Einheiten', items: list.filter((e) => e.cat === 'eigen'), lead: newCard },
        { key: 'sport', title: 'Aus deinem Profil', items: list.filter((e) => e.cat === 'sport') },
      ].filter((g) => g.items.length > 0 || g.lead)
    : [{ key: 'all', title: searching ? '' : 'Vorlagen', items: list }];

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
    <div className={`up${inline ? ' up--inline' : ''}`}>
      {!inline && <div className="up-search">
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="11" cy="11" r="6.5" /><path d="m16 16 4 4" />
        </svg>
        <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Suchen, z. B. Brust oder Lauf" aria-label="Einheit suchen" />
      </div>}

      {!searching && (
        <>
          <div className="up-cats" role="tablist" aria-label="Kategorie">
            {UNIT_TABS.map((t) => (
              <button key={t.key} type="button" role="tab" aria-selected={tab === t.key} className={tab === t.key ? 'is-on' : ''} onClick={() => changeTab(t.key)}>
                <SportSymbol name={TAB_SYMBOL[t.key]} size={24} />
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
      ) : searching && list.length === 0 ? (
        <p className="up-empty">Nichts gefunden. Probiere einen anderen Begriff.</p>
      ) : (
        <div className="up-groups" role="radiogroup" aria-label="Einheit">
          {groups.map((g) => (
            <div key={g.key}>
              {g.title && <div className="up-sec">{g.title}</div>}
              <div className="up-grid">{g.lead}{g.items.map(unitCard)}</div>
            </div>
          ))}
        </div>
      )}
      {muscleMode && mus.length === 0 && <p className="up-hint">Tippe einen oder mehrere Muskeln an, z. B. Brust &amp; Beine.</p>}
      {!searching && tab === 'eigen' && list.length === 0 && <p className="up-hint">Noch keine eigene Einheit. Sportarten aus deinem Profil erscheinen ebenfalls hier.</p>}

      {!inline && <div className="up-foot">
        {muscleMode && mus.length > 0 && (
          <>
            <div className="up-combo" aria-live="polite">
              <UnitVisual tags={mus} size={34} max={3} />
              <b>{comboTitle}</b>
            </div>
            {onCreateOwn && (
              <label className="up-switch">
                <input type="checkbox" checked={saveOwn} onChange={(e) => setSaveOwn(e.target.checked)} />
                <span className="up-sw" aria-hidden="true" />
                <span><b>Als eigene Einheit speichern</b><small>{saveOwn ? 'Steht danach unter „Eigene“' : 'Sonst gilt die Auswahl nur hier'}</small></span>
              </label>
            )}
            {saveOwn && onCreateOwn && (
              <input className="ou-in up-own-name" type="text" value={ownName || comboTitle} onChange={(e) => setOwnName(e.target.value)} placeholder="Name der Einheit" aria-label="Name der eigenen Einheit" autoComplete="off" />
            )}
          </>
        )}
        {error && <p className="up-error" role="alert">{error}</p>}
        <button type="button" className="btn btn-primary" disabled={!ready || busy} onClick={confirm}>{busy ? 'Speichert…' : 'Auswählen'}</button>
      </div>}
    </div>
  );
}
