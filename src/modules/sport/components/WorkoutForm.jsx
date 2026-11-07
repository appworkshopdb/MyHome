import { useMemo, useRef, useState } from 'react';
import SheetShell from '../../../core/components/SheetShell.jsx';
import UnitPicker from './UnitPicker';
import UnitSelectCard from './UnitSelectCard';
import { buildCatalog } from '../lib/unitCatalog';
import { resolveTypeLabel } from '../lib/typeLabel';
import { resolveUnitVisual } from '../lib/planMuscles';
import { todayIso } from '../../../core/lib/wizardDates';

// Lokales Kalenderdatum (toISOString würde zwischen 0 und 2 Uhr den Vortag liefern)
const TODAY = todayIso;

// Eine Einheit wird als Ganzes erfasst (kein Satz-für-Satz-Log).
// initialValues deckt drei Fälle ab:
//   - {}                       neue Einheit, heute, erledigt
//   - { occurred_on, status }  neue Einheit für einen Kalendertag
//   - vollständige Workout-Zeile (mit id) → Bearbeiten-Modus
//
// mode ersetzt das frühere reine status-Feld um eine dritte Option
// "Ruhetag" — bisher konnte ein Ruhetag nur über einen kompletten Plan
// entstehen (PlanEditor "+ Ruhetag"), jetzt auch direkt für einen
// einzelnen Kalendertag. Intern bleibt ein Ruhetag weiterhin
// status='done' + is_rest=true (dieselbe Kodierung wie beim Anwenden
// eines Plans, siehe core/lib/sportPlanSync.js buildPlanRows).
export default function WorkoutForm({ onSave, onCancel, showToast, initialValues, userSports = [], units = [], onCreateOwn }) {
  const iv = initialValues ?? {};
  const isEdit = Boolean(iv.id);

  const [occurredOn, setOccurredOn] = useState(iv.occurred_on ?? TODAY());
  const [typeKey, setTypeKey] = useState(iv.type_key && iv.type_key !== 'sonstiges' ? iv.type_key : '');
  const [title, setTitle] = useState(iv.title ?? '');
  const [notes, setNotes] = useState(iv.notes ?? '');
  const [mode, setMode] = useState(iv.is_rest ? 'rest' : (iv.status ?? 'done'));
  // Feste Bilder: Muskelgruppen der Einheit. null = aus dem Trainingstyp ableiten (spoData.saveWorkout),
  // ein Array = ausdrücklich gesetzt (vorhandene Einheit oder gewählte eigene Einheit).
  const [muscles, setMuscles] = useState(iv.muscle_groups?.length ? iv.muscle_groups : null);

  // Einheit aus der Galerie (UnitPicker): Typ, Muskeln (Bilder) und, solange der Name
  // nicht selbst geschrieben wurde, die Bezeichnung.
  const [picking, setPicking] = useState(false);
  const [picked, setPicked] = useState(null);
  const titleAuto = useRef(!iv.title);
  const catalog = useMemo(() => buildCatalog({ units, userSports }), [units, userSports]);

  function selectUnit(entry) {
    setPicked(entry);
    setTypeKey(entry.type_key ?? '');
    setMuscles(entry.muscle_groups?.length ? entry.muscle_groups : null);
    if (titleAuto.current || !title) { setTitle(entry.title); titleAuto.current = true; }
    setPicking(false);
  }

  const shownTitle = picked?.title ?? title;
  const visual = resolveUnitVisual({ muscle_groups: muscles ?? [], icon: picked?.icon, type_key: typeKey, title: shownTitle }, units);

  function submit() {
    if (mode === 'rest') {
      onSave({
        ...(isEdit ? { id: iv.id } : {}),
        occurred_on: occurredOn,
        type_key: null,
        title: title.trim() || 'Ruhetag',
        duration_min: null,
        notes: notes.trim() || null,
        status: 'done',
        is_rest: true,
      });
      return;
    }

    if (!title.trim()) return showToast('Bitte Bezeichnung eingeben, z.B. "Push" oder "Brust/Bizeps"');
    onSave({
      ...(isEdit ? { id: iv.id } : {}),
      occurred_on: occurredOn,
      type_key: typeKey || 'sonstiges',
      title: title.trim(),
      notes: notes.trim() || null,
      status: mode,
      is_rest: false,
      ...(muscles ? { muscle_groups: muscles } : {}),
    });
  }

  return (
    <div className="card">
      <div className="card-title">{isEdit ? 'Training bearbeiten' : 'Training eintragen'}</div>

      <div className="form-row">
        <div className="form-group">
          <label>Datum</label>
          <input type="date" value={occurredOn} onChange={(e) => setOccurredOn(e.target.value)} />
        </div>
      </div>

      <div className="form-group">
        <label>Status</label>
        {/* Bewusst inline gestylt statt mit .segmented: diese Klasse lebt
            in modules/nutrition/nutrition.css und wäre eine versteckte
            Abhängigkeit von Sport auf Ernährung (Architektur-Regel:
            Module importieren nie voneinander). */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
          {[['planned', 'Geplant'], ['done', 'Erledigt'], ['rest', 'Ruhetag']].map(([key, label]) => (
            <button
              key={key}
              onClick={() => setMode(key)}
              style={{
                padding: '10px 4px', borderRadius: 'var(--radius-xs)',
                border: `1.5px solid ${mode === key ? 'var(--accent)' : 'var(--border)'}`,
                background: mode === key ? 'var(--accent)' : 'var(--bg-secondary)',
                color: mode === key ? 'var(--on-accent)' : 'var(--text-secondary)',
                fontSize: '0.76rem', fontWeight: 600, cursor: 'pointer',
              }}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {mode !== 'rest' && (
        <div className="form-group">
          <label>Einheit</label>
          <UnitSelectCard
            chosen={Boolean(picked) || Boolean(typeKey) || Boolean(iv.title)}
            title={shownTitle || resolveTypeLabel(typeKey)}
            subtitle={resolveTypeLabel(typeKey)}
            {...visual}
            onClick={() => setPicking(true)}
          />
        </div>
      )}

      <div className="form-group">
        <label>Bezeichnung{mode === 'rest' ? ' (optional)' : ''}</label>
        <input
          type="text" value={title} onChange={(e) => { titleAuto.current = false; setTitle(e.target.value); }}
          placeholder={mode === 'rest' ? 'Ruhetag' : 'z.B. Push, Brust/Bizeps, Lauf...'}
        />
      </div>

      <div className="form-group">
        <label>Notiz (optional)</label>
        <input type="text" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="z.B. gut lief's, Knie gespürt..." />
      </div>

      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 4 }}>
        <button className="btn btn-secondary" onClick={onCancel}>Abbrechen</button>
        <button className="btn btn-primary" onClick={submit}>Speichern</button>
      </div>

      {picking && (
        <SheetShell onClose={() => setPicking(false)} labelledBy="wf-pick-title">
          <div className="sheet-header">
            <span className="sheet-title" id="wf-pick-title">Einheit wählen</span>
          </div>
          <div className="up-wrap">
            <UnitPicker catalog={catalog} selectedKey={picked?.key} onPick={selectUnit} onCreateOwn={onCreateOwn} />
          </div>
        </SheetShell>
      )}
    </div>
  );
}
