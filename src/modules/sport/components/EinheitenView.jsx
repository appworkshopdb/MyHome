import { useMemo, useState } from 'react';
import { useAuth } from '../../../core/lib/AuthContext';
import SheetShell from '../../../core/components/SheetShell';
import UnitVisual from './UnitVisual';
import OwnUnitForm from './OwnUnitForm';
import * as db from '../lib/spoData';
import { buildCatalog } from '../lib/unitCatalog';
import { OWN_CATEGORIES, categoryOfType } from '../lib/sportSymbols';

// Bereich "Einheiten": die Bibliothek. Umschalter App-Einheiten | Eigene.
//   App-Einheiten: fest aus der App, nur ansehen (gruppiert wie in der Galerie).
//   Eigene:        selbst angelegte Einheiten anlegen, bearbeiten, löschen
//                  (Formular OwnUnitForm), dazu die Sportarten aus dem Profil.
// Trainings und Pläne legt man über den Plus-Knopf an.

const APP_GROUPS = [
  ['split', 'Kraft · Splits'],
  ['muskel', 'Kraft · Muskeln'],
  ['kombi', 'Kraft · Kombinationen'],
  ['aus', 'Ausdauer'],
  ['beweg', 'Mobility'],
];

function Row({ entry, sub, onClick }) {
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag {...(onClick ? { type: 'button', onClick } : {})} className={`eh-row${onClick ? ' is-btn' : ''}`}>
      <span className="eh-vis"><UnitVisual tags={entry.muscle_groups} icon={entry.icon} size={36} max={3} /></span>
      <span className="eh-tx"><b>{entry.title}</b>{sub && <small>{sub}</small>}</span>
      {onClick && (
        <svg className="eh-edit" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 20h4L19 9l-4-4L4 16z" /></svg>
      )}
    </Tag>
  );
}

export default function EinheitenView({ units, loading, userSports = [], onChanged, showToast }) {
  const { session } = useAuth();
  const [view, setView] = useState('app');
  const [editing, setEditing] = useState(undefined); // undefined = zu, null = neu, Zeile = bearbeiten
  const catalog = useMemo(() => buildCatalog({ units, userSports }), [units, userSports]);
  const own = catalog.filter((e) => e.own);
  const sports = catalog.filter((e) => e.cat === 'sport');
  const appCount = catalog.filter((e) => !e.own && e.cat !== 'sport').length;

  async function save(draft) {
    if (editing) {
      await db.saveUnit(session, { id: editing.id, ...draft, duration_min: editing.duration_min ?? null });
      showToast?.('Einheit gespeichert');
    } else {
      await db.createOwnUnit(session, draft);
      showToast?.('Eigene Einheit angelegt');
    }
    setEditing(undefined);
    await onChanged?.();
  }
  async function remove() {
    await db.deleteUnit(editing.id);
    setEditing(undefined);
    showToast?.('Einheit gelöscht');
    await onChanged?.();
  }
  const catLabel = (e) => OWN_CATEGORIES.find((c) => c.key === categoryOfType(e.type_key, e.muscle_groups.length > 0))?.label ?? '';

  return (
    <div className="page eh">
      <div className="up-seg" role="tablist" aria-label="Einheiten">
        <button type="button" role="tab" aria-selected={view === 'app'} className={view === 'app' ? 'is-on' : ''} onClick={() => setView('app')}>App-Einheiten <em>{appCount}</em></button>
        <button type="button" role="tab" aria-selected={view === 'own'} className={view === 'own' ? 'is-on' : ''} onClick={() => setView('own')}>Eigene <em>{own.length}</em></button>
      </div>

      {view === 'app' ? (
        <>
          <p className="eh-hint">Feste Einheiten aus der App. Du kannst sie in Trainings und Plänen verwenden, aber nicht ändern.</p>
          {APP_GROUPS.map(([cat, label]) => (
            <section key={cat}>
              <div className="up-sec">{label}</div>
              <div className="eh-list">{catalog.filter((e) => e.cat === cat).map((e) => <Row key={e.key} entry={e} />)}</div>
            </section>
          ))}
        </>
      ) : (
        <>
          <button type="button" className="btn btn-secondary btn-block" onClick={() => setEditing(null)}>＋ Neue eigene Einheit</button>
          {loading ? (
            <p className="eh-hint">Lädt…</p>
          ) : own.length === 0 ? (
            <p className="eh-hint">Noch keine eigene Einheit. Lege eine mit Symbol oder Muskeln an, sie steht dann in der Galerie unter „Eigene“.</p>
          ) : (
            <div className="eh-list">
              {own.map((e) => <Row key={e.key} entry={e} sub={catLabel(e)} onClick={() => setEditing(units.find((u) => u.id === e.key))} />)}
            </div>
          )}
          {sports.length > 0 && (
            <section>
              <div className="up-sec">Aus deinem Profil</div>
              <div className="eh-list">{sports.map((e) => <Row key={e.key} entry={e} />)}</div>
              <p className="eh-hint">Sportarten änderst du im Profil.</p>
            </section>
          )}
        </>
      )}

      {editing !== undefined && (
        <SheetShell onClose={() => setEditing(undefined)} labelledBy="eh-form-title">
          <div className="sheet-header">
            <span className="sheet-title" id="eh-form-title">{editing ? 'Einheit bearbeiten' : 'Eigene Einheit'}</span>
          </div>
          <div className="up-wrap">
            <OwnUnitForm
              key={editing?.id ?? 'neu'}
              initial={editing}
              onSave={save}
              onCancel={() => setEditing(undefined)}
              onDelete={editing ? remove : undefined}
            />
          </div>
        </SheetShell>
      )}
    </div>
  );
}
