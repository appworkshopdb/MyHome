import { useState } from 'react';
import { MusclePreview } from './EinheitenListShared';
import RestBadge from './RestBadge';
import { PREDEFINED_UNITS } from '../lib/data/predefinedUnits';
import { resolveTypeLabel } from '../lib/typeLabel';
import { resolvePlanMuscleGroups } from '../lib/planMuscles';

// Plan bearbeiten: der Plan als Kachelraster, je Tag die Bilder seiner Muskeln.
// Ein Tipp wählt den Tag, darunter wird er bearbeitet (Einheit, Ruhetag,
// früher/später schieben, entfernen). Speichern gibt dasselbe zurück wie vorher:
// onSave(plan, items) — spo_plan_items kennt keine muscle_groups, sie dienen nur
// der Anzeige hier.

const isPredefinedId = (id) => typeof id === 'string' && id.startsWith('pre.');

function findAnyUnit(id, personalUnits) {
  if (isPredefinedId(id)) return PREDEFINED_UNITS.find((u) => u.key === id) ?? null;
  return personalUnits.find((u) => u.id === id) ?? null;
}

function selectedUnitKey(item, units) {
  if (item.unit_id) return item.unit_id;
  const predefined = PREDEFINED_UNITS.find((u) => u.title === item.title);
  if (predefined) return predefined.key;
  const personal = units.find((u) => u.title === item.title);
  return personal?.id ?? '';
}

// Der Name steht einmal; der Typ nur, wenn er sich vom Namen unterscheidet.
function unitOptionLabel(u) {
  const type = resolveTypeLabel(u.type_key);
  return type && type !== u.title ? `${u.title} (${type})` : u.title;
}

const emptyDay = () => ({ unit_id: '', _selectedUnitKey: '', title: '', type_key: '', duration_min: '', muscle_groups: [], is_rest: false });

function Visual({ day, size }) {
  if (day.is_rest) return <RestBadge size={size + 10} />;
  const tags = (day.muscle_groups ?? []).slice(0, 2);
  if (tags.length === 0) return <span className="pe-empty" style={{ width: size, height: size }} aria-hidden="true">?</span>;
  return <MusclePreview tags={tags} size={size} />;
}

export default function PlanEditor({ initialPlan, units = [], isActive = false, onSave, onCancel, showToast }) {
  const [title, setTitle] = useState(initialPlan?.title ?? '');
  const [notes, setNotes] = useState(initialPlan?.notes ?? '');
  const [showNotes, setShowNotes] = useState(Boolean(initialPlan?.notes));
  const [days, setDays] = useState(
    initialPlan?.items?.length
      ? initialPlan.items.map((i) => ({
          unit_id: i.unit_id ?? '',
          _selectedUnitKey: i.is_rest ? '' : selectedUnitKey(i, units),
          title: i.title ?? '',
          type_key: i.type_key ?? '',
          duration_min: i.duration_min != null ? String(i.duration_min) : '',
          muscle_groups: i.is_rest ? [] : resolvePlanMuscleGroups(i, units),
          is_rest: i.is_rest,
        }))
      : [emptyDay()]
  );
  const [sel, setSel] = useState(0);

  const cur = days[sel] ?? days[0];
  const restCount = days.filter((d) => d.is_rest).length;
  const trainCount = days.length - restCount;

  function patchDay(index, patch) {
    setDays((list) => list.map((d, i) => (i === index ? { ...d, ...patch } : d)));
  }

  function chooseUnit(unitId) {
    const unit = findAnyUnit(unitId, units);
    patchDay(sel, {
      unit_id: isPredefinedId(unitId) ? null : unitId,
      title: unit?.title ?? '',
      type_key: unit?.type_key ?? '',
      duration_min: unit?.duration_min != null ? String(unit.duration_min) : '',
      muscle_groups: unit?.muscle_groups ?? [],
      _selectedUnitKey: unitId,
    });
  }

  function toggleRest(isRest) {
    patchDay(sel, isRest
      ? { is_rest: true, unit_id: '', _selectedUnitKey: '', title: 'Ruhetag', type_key: '', duration_min: '', muscle_groups: [] }
      : { ...emptyDay() });
  }

  function addDay() {
    setDays((list) => [...list, emptyDay()]);
    setSel(days.length);
  }

  function removeDay() {
    if (days.length === 1) return;
    setDays((list) => list.filter((_, i) => i !== sel));
    setSel(Math.max(0, sel - 1));
  }

  function moveDay(delta) {
    const target = sel + delta;
    if (target < 0 || target >= days.length) return;
    setDays((list) => {
      const next = [...list];
      [next[sel], next[target]] = [next[target], next[sel]];
      return next;
    });
    setSel(target);
  }

  function submit() {
    if (!title.trim()) return showToast('Bitte einen Namen für den Plan eingeben');
    if (days.length === 0) return showToast('Der Plan braucht mindestens einen Tag');

    const missing = days.findIndex((d) => !d.is_rest && !d.unit_id && !d._selectedUnitKey);
    if (missing >= 0) {
      setSel(missing);
      return showToast('Bitte jedem Trainingstag eine Einheit zuweisen');
    }

    onSave(
      { ...(initialPlan?.id ? { id: initialPlan.id } : {}), title: title.trim(), notes: notes.trim() || null },
      days.map((d) => ({
        unit_id: d.is_rest ? null : (d.unit_id || null),
        title: d.is_rest ? (d.title.trim() || 'Ruhetag') : d.title,
        type_key: d.is_rest ? null : (d.type_key || null),
        duration_min: d.duration_min === '' ? null : parseInt(d.duration_min, 10),
        muscle_groups: d.is_rest ? [] : (d.muscle_groups ?? []),
        is_rest: d.is_rest,
      }))
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

      <div className="pe-head">
        <span>Ablauf</span>
        <span>{days.length} Tage · {trainCount} Einheiten · {restCount} Ruhetage</span>
      </div>

      <div className="pe-grid" role="group" aria-label="Tage des Plans">
        {days.map((d, i) => (
          <button
            key={i}
            type="button"
            className={`pe-tile${d.is_rest ? ' is-rest' : ''}${i === sel ? ' is-sel' : ''}`}
            aria-pressed={i === sel}
            onClick={() => setSel(i)}
          >
            <span className="pe-n">Tag {i + 1}</span>
            <span className="pe-vis"><Visual day={d} size={30} /></span>
            <b>{d.is_rest ? 'Ruhetag' : (d.title || 'Einheit wählen')}</b>
          </button>
        ))}
        <button type="button" className="pe-tile pe-add" onClick={addDay}>
          <span className="pe-plus" aria-hidden="true">+</span>
          <b>Tag</b>
        </button>
      </div>

      <div className="pe-panel">
        <div className="pe-panel-h">
          <Visual day={cur} size={40} />
          <div>
            <small>Tag {sel + 1} von {days.length}</small>
            <b>{cur.is_rest ? 'Ruhetag' : (cur.title || 'Neuer Tag')}</b>
          </div>
        </div>

        {!cur.is_rest && (
          <div className="form-group" style={{ margin: 0 }}>
            <label htmlFor="pe-unit">Einheit</label>
            <select id="pe-unit" value={cur._selectedUnitKey ?? cur.unit_id ?? ''} onChange={(e) => chooseUnit(e.target.value)}>
              <option value="">Einheit wählen…</option>
              <optgroup label="Vordefinierte Einheiten">
                {PREDEFINED_UNITS.map((u) => <option key={u.key} value={u.key}>{unitOptionLabel(u)}</option>)}
              </optgroup>
              {units.length > 0 && (
                <optgroup label="Deine Einheiten">
                  {units.map((u) => <option key={u.id} value={u.id}>{unitOptionLabel(u)}</option>)}
                </optgroup>
              )}
            </select>
          </div>
        )}

        <label className="pe-toggle" htmlFor="pe-rest">
          <span>Ruhetag</span>
          <input id="pe-rest" type="checkbox" role="switch" checked={cur.is_rest} onChange={(e) => toggleRest(e.target.checked)} />
        </label>

        <div className="pe-move">
          <button type="button" className="btn btn-secondary" onClick={() => moveDay(-1)} disabled={sel === 0}>← Früher</button>
          <button type="button" className="btn btn-secondary" onClick={() => moveDay(1)} disabled={sel === days.length - 1}>Später →</button>
          <button type="button" className="btn btn-secondary pe-trash" onClick={removeDay} disabled={days.length === 1} aria-label="Tag entfernen">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M5 7h14M10 7V4h4v3M7 7l1 13h8l1-13" />
            </svg>
          </button>
        </div>
      </div>

      <div className="pe-foot">
        <button type="button" className="btn btn-secondary" onClick={onCancel}>Abbrechen</button>
        <button type="button" className="btn btn-primary" onClick={submit}>Speichern</button>
      </div>
    </div>
  );
}
