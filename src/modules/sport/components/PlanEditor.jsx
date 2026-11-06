import { useMemo, useState } from 'react';
import SheetShell from '../../../core/components/SheetShell.jsx';
import PlanDaysBoard from './PlanDaysBoard';
import UnitPicker from './UnitPicker';
import { buildCatalog } from '../lib/unitCatalog';
import { createOwnUnit } from '../lib/spoData';
import { daysAreComplete, daysFromItems, dayFromEntry, itemsFromDays } from '../lib/planDays';

// Plan bearbeiten: Name, darunter die Tage als Kachelraster (PlanDaysBoard).
// Die Einheit wählt man in der Galerie (UnitPicker) in einem Sheet.
// onSave(plan, items) ist unverändert; spo_plan_items kennt keine muscle_groups,
// sie dienen nur der Anzeige.
export default function PlanEditor({ session, initialPlan, units = [], userSports = [], isActive = false, onSave, onCancel, showToast }) {
  const [title, setTitle] = useState(initialPlan?.title ?? '');
  const [notes, setNotes] = useState(initialPlan?.notes ?? '');
  const [showNotes, setShowNotes] = useState(Boolean(initialPlan?.notes));
  const [days, setDays] = useState(() => daysFromItems(initialPlan?.items, units));
  const [sel, setSel] = useState(0);
  const [picking, setPicking] = useState(false);

  const [ownUnits, setOwnUnits] = useState([]); // hier neu angelegte eigene Einheiten
  const catalog = useMemo(() => buildCatalog({ units: [...units, ...ownUnits], userSports }), [units, ownUnits, userSports]);

  // Eigene Einheit aus Muskeln anlegen und gleich als Eintrag zurückgeben
  async function createOwn(draft) {
    const row = await createOwnUnit(session, draft);
    setOwnUnits((list) => [...list, row]);
    return buildCatalog({ units: [row] }).find((e) => e.own);
  }

  function submit() {
    if (!title.trim()) return showToast('Bitte einen Namen für den Plan eingeben');
    if (days.length === 0) return showToast('Der Plan braucht mindestens einen Tag');
    if (!daysAreComplete(days)) {
      setSel(days.findIndex((d) => !d.is_rest && !d.unit_id && !d._selectedUnitKey));
      return showToast('Bitte jedem Trainingstag eine Einheit zuweisen');
    }
    onSave(
      { ...(initialPlan?.id ? { id: initialPlan.id } : {}), title: title.trim(), notes: notes.trim() || null },
      itemsFromDays(days),
    );
  }

  return (
    <div className="pe">
      {isActive && (
        <div className="pe-note">
          <span className="pe-note-bd" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 12a7 7 0 0 1 12-5l3 3M20 12a7 7 0 0 1-12 5l-3-3M19 5v5h-5M5 19v-5h5" />
            </svg>
          </span>
          Aktiv · Änderungen gelten ab heute
        </div>
      )}

      <div className="card">
        <div className="card-title">{initialPlan?.id ? 'Plan bearbeiten' : 'Neuer Trainingsplan'}</div>
        <div className="form-group">
          <label htmlFor="pe-name">Name</label>
          <input id="pe-name" type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="z.B. Ganzkörper 5 Tage" />
        </div>
        {showNotes ? (
          <div className="form-group">
            <label htmlFor="pe-notes">Notiz (optional)</label>
            <input id="pe-notes" type="text" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="z.B. für Einsteiger, 3× pro Woche" />
          </div>
        ) : (
          <button type="button" className="pe-link" onClick={() => setShowNotes(true)}>+ Notiz hinzufügen</button>
        )}
      </div>

      <PlanDaysBoard days={days} setDays={setDays} sel={sel} setSel={setSel} onChoose={() => setPicking(true)} />

      <div className="pe-foot">
        <button type="button" className="btn btn-secondary" onClick={onCancel}>Abbrechen</button>
        <button type="button" className="btn btn-primary" onClick={submit}>Speichern</button>
      </div>

      {picking && (
        <SheetShell onClose={() => setPicking(false)} labelledBy="pe-pick-title">
          <div className="sheet-header">
            <span className="sheet-title" id="pe-pick-title">Einheit für Tag {sel + 1}</span>
          </div>
          <div className="up-wrap">
            <UnitPicker
              catalog={catalog}
              selectedKey={days[sel]?._selectedUnitKey}
              onCreateOwn={session ? createOwn : undefined}
              onPick={(entry) => { setDays((list) => list.map((d, i) => (i === sel ? dayFromEntry(entry) : d))); setPicking(false); }}
            />
          </div>
        </SheetShell>
      )}
    </div>
  );
}
