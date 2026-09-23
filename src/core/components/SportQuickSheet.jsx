import { useEffect, useState } from 'react';
import { useAuth } from '../lib/AuthContext';
import { useEntrySheet } from '../lib/EntrySheetContext';
import * as db from '../../modules/sport/lib/spoData';
import { TRAINING_TYPES } from '../../modules/sport/lib/data/trainingTypes';
import { PREDEFINED_UNITS } from '../../modules/sport/lib/data/predefinedUnits';
import PlanDaysEditor from '../../modules/sport/components/PlanDaysEditor';
import SheetShell from './SheetShell';

const TYPE_GROUPS = [
  { group: 'Kraft',    types: TRAINING_TYPES.filter((t) => t.group === 'Kraft').slice(0, 8) },
  { group: 'Ausdauer', types: TRAINING_TYPES.filter((t) => t.group === 'Ausdauer').slice(0, 6) },
  { group: 'Sonstige', types: TRAINING_TYPES.filter((t) => !['Kraft', 'Ausdauer'].includes(t.group)).slice(0, 4) },
];

function TypeChips({ typeKey, onSelect }) {
  return (
    <>
      {TYPE_GROUPS.map(({ group, types }) => (
        <div key={group} style={{ marginBottom: 10 }}>
          <div className="t-meta" style={{ marginBottom: 4 }}>{group}</div>
          <div className="wiz-cat-grid">
            {types.map((t) => (
              <button key={t.key} className={`wiz-cat ${typeKey === t.key ? 'active' : ''}`}
                onClick={() => onSelect(t.key, t.label)}>{t.label}</button>
            ))}
          </div>
        </div>
      ))}
    </>
  );
}

export default function SportQuickSheet({ onClose }) {
  const { session } = useAuth();
  const { notifySaved } = useEntrySheet();

  const [screen, setScreen] = useState('choose');
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState('');

  const [unitTitle,    setUnitTitle]    = useState('');
  const [unitTypeKey,  setUnitTypeKey]  = useState('');
  const [unitDuration, setUnitDuration] = useState('');
  const [showPresets,  setShowPresets]  = useState(false);

  function adoptPreset(preset) {
    setUnitTypeKey(preset.type_key ?? '');
    setUnitTitle(preset.title);
    setShowPresets(false);
  }
  function selectUnitType(key, label) {
    setUnitTypeKey(key);
    if (!unitTitle) setUnitTitle(label);
  }

  async function saveUnit() {
    if (!unitTitle.trim()) return setError('Bitte Bezeichnung eingeben');
    setSaving(true); setError('');
    try {
      await db.saveUnit(session, {
        title: unitTitle.trim(),
        type_key: unitTypeKey || null,
        duration_min: unitDuration ? parseInt(unitDuration, 10) : null,
      });
      notifySaved();
      onClose();
    } catch (e) { setError('Speichern fehlgeschlagen'); }
    finally { setSaving(false); }
  }

  const [planStep,  setPlanStep]  = useState(1);
  const [planTitle, setPlanTitle] = useState('');
  const [planNotes, setPlanNotes] = useState('');
  const [planDays,  setPlanDays]  = useState([{ unit_id: '', title: '', type_key: '', duration_min: '', muscle_groups: [], is_rest: false }]);
  const [myUnits,   setMyUnits]   = useState([]);

  useEffect(() => {
    if (screen !== 'plan') return;
    db.getUnits(session).then(setMyUnits).catch(() => {});
  }, [screen, session]);

  function planNext() {
    if (planStep === 1) {
      if (!planTitle.trim()) return setError('Bitte einen Namen für den Plan eingeben');
      setError('');
      setPlanStep(2);
      return;
    }
    savePlan();
  }
  function planBack() {
    if (planStep === 2) { setPlanStep(1); return; }
    setScreen('choose');
  }

  async function savePlan() {
    if (planDays.length === 0) return setError('Der Plan braucht mindestens einen Tag');
    const missing = planDays.some((d) => !d.is_rest && !d.unit_id && !d._selectedUnitKey);
    if (missing) return setError('Bitte jedem Trainingstag eine Einheit zuweisen');

    setSaving(true); setError('');
    try {
      await db.savePlan(
        session,
        { title: planTitle.trim(), notes: planNotes.trim() || null },
        planDays.map((d) => ({
          unit_id: d.is_rest ? null : (d.unit_id || null),
          title: d.is_rest ? (d.title.trim() || 'Ruhetag') : d.title,
          type_key: d.is_rest ? null : (d.type_key || null),
          duration_min: d.duration_min === '' ? null : parseInt(d.duration_min, 10),
          muscle_groups: d.is_rest ? [] : (d.muscle_groups ?? []),
          is_rest: d.is_rest,
        }))
      );
      notifySaved();
      onClose();
    } catch (e) { setError('Speichern fehlgeschlagen'); }
    finally { setSaving(false); }
  }

  const [manageUnits,   setManageUnits]   = useState([]);
  const [manageLoading, setManageLoading] = useState(false);
  const [selectedId,    setSelectedId]    = useState(null);

  useEffect(() => {
    if (screen !== 'verwalten') return;
    setManageLoading(true);
    db.getUnits(session).then(setManageUnits).catch(() => setError('Einheiten konnten nicht geladen werden')).finally(() => setManageLoading(false));
  }, [screen, session]);

  function selectToEdit(u) {
    setSelectedId(u.id);
    setUnitTitle(u.title);
    setUnitTypeKey(u.type_key ?? '');
    setUnitDuration(u.duration_min != null ? String(u.duration_min) : '');
    setError('');
  }

  async function saveManagedUnit() {
    if (!unitTitle.trim()) return setError('Bitte Bezeichnung eingeben');
    setSaving(true); setError('');
    try {
      await db.saveUnit(session, {
        id: selectedId, title: unitTitle.trim(),
        type_key: unitTypeKey || null,
        duration_min: unitDuration ? parseInt(unitDuration, 10) : null,
      });
      notifySaved();
      onClose();
    } catch (e) { setError('Speichern fehlgeschlagen'); }
    finally { setSaving(false); }
  }

  async function deleteManagedUnit() {
    setSaving(true);
    try {
      await db.deleteUnit(selectedId);
      notifySaved();
      onClose();
    } catch (e) { setError('Löschen fehlgeschlagen'); }
    finally { setSaving(false); }
  }

  return (
    <SheetShell onClose={onClose} labelledBy="sport-sheet-title">
      <div className="sheet-header">
        <span id="sport-sheet-title" className="sheet-title">Sport</span>
        <button className="sheet-cancel" onClick={onClose}>Abbrechen</button>
      </div>

      {screen === 'choose' && (
        <div className="wiz-body">
          <div className="wiz-cat-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
            <button className="wiz-cat" style={{ padding: '18px 12px' }} onClick={() => setScreen('einheit')}>
              Neue Einheit
            </button>
            <button className="wiz-cat" style={{ padding: '18px 12px' }} onClick={() => { setScreen('plan'); setPlanStep(1); }}>
              Trainingsplan
            </button>
          </div>
          <button
            className="btn btn-secondary btn-block"
            style={{ marginTop: 16 }}
            onClick={() => setScreen('verwalten')}
          >
            Eigene Einheiten verwalten
          </button>
        </div>
      )}

      {screen === 'einheit' && (
        <div className="wiz-body">
          <button className="wiz-cat" style={{ marginBottom: 14 }} onClick={() => setShowPresets(!showPresets)}>
            {showPresets ? 'Vorlagen ausblenden' : 'Aus Vorlage übernehmen'}
          </button>
          {showPresets && (
            <div className="wiz-cat-grid" style={{ marginBottom: 14, maxHeight: 160, overflowY: 'auto' }}>
              {PREDEFINED_UNITS.map((preset) => (
                <button key={preset.key} className="wiz-cat" onClick={() => adoptPreset(preset)}>{preset.title}</button>
              ))}
            </div>
          )}

          <label className="wiz-label t-meta">Trainingstyp</label>
          <TypeChips typeKey={unitTypeKey} onSelect={selectUnitType} />

          <label className="wiz-label t-meta" style={{ marginTop: 'var(--space-5)' }}>Name</label>
          <input className="wiz-input" type="text" value={unitTitle} onChange={(e) => setUnitTitle(e.target.value)}
            placeholder="z.B. Legday, Arme" autoFocus />

          <label className="wiz-label t-meta" style={{ marginTop: 'var(--space-5)' }}>
            Richtwert Dauer <span className="wiz-optional">optional</span>
          </label>
          <input className="wiz-input" type="number" value={unitDuration} onChange={(e) => setUnitDuration(e.target.value)}
            placeholder="Minuten" min="0" max="1440" />

          {error && <div className="wiz-hint t-meta" style={{ color: 'var(--danger)' }}>{error}</div>}

          <div className="wiz-nav">
            <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setScreen('choose')}>Zurück</button>
            <button className="btn btn-primary" style={{ flex: 1 }} disabled={saving} onClick={saveUnit}>
              {saving ? 'Speichert…' : 'Einheit speichern'}
            </button>
          </div>
        </div>
      )}

      {screen === 'plan' && (
        <>
          <div className="wiz-progress">
            {[1, 2].map((n) => (
              <div key={n} className={`wiz-seg ${n <= planStep ? 'done' : ''}`} />
            ))}
          </div>

          <div className="wiz-body">
            {planStep === 1 && (
              <>
                <label className="wiz-label t-meta">Plan-Name</label>
                <input className="wiz-input" type="text" value={planTitle} onChange={(e) => setPlanTitle(e.target.value)}
                  placeholder="z.B. 4-Tage-Split, Push/Pull/Legs" autoFocus />
                <div className="wiz-hint t-meta">
                  Startdatum legst du später beim Eintragen im Kalender fest — hier geht es nur um den Aufbau des Plans.
                </div>
              </>
            )}

            {planStep === 2 && (
              <>
                <PlanDaysEditor days={planDays} onChange={setPlanDays} units={myUnits} />
                <label className="wiz-label t-meta" style={{ marginTop: 'var(--space-5)' }}>
                  Notiz <span className="wiz-optional">optional</span>
                </label>
                <textarea className="wiz-input wiz-textarea" value={planNotes} onChange={(e) => setPlanNotes(e.target.value)}
                  placeholder="z.B. für Einsteiger, 3× pro Woche" />
              </>
            )}

            {error && <div className="wiz-hint t-meta" style={{ color: 'var(--danger)' }}>{error}</div>}

            <div className="wiz-nav">
              <button className="btn btn-secondary" style={{ flex: 1 }} onClick={planBack}>Zurück</button>
              <button className="btn btn-primary" style={{ flex: 1 }} disabled={saving} onClick={planNext}>
                {planStep === 1 ? 'Weiter' : (saving ? 'Speichert…' : 'Plan speichern')}
              </button>
            </div>
          </div>
        </>
      )}

      {screen === 'verwalten' && (
        <div className="wiz-body">
          {!selectedId ? (
            <>
              {manageLoading ? (
                <div className="wiz-hint t-meta">Lädt…</div>
              ) : manageUnits.length === 0 ? (
                <div className="wiz-hint t-meta">Noch keine eigene Einheit angelegt.</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {manageUnits.map((u) => (
                    <button key={u.id} className="wiz-cat" style={{ textAlign: 'left' }} onClick={() => selectToEdit(u)}>
                      {u.title}{u.duration_min ? ` · ${u.duration_min} Min.` : ''}
                    </button>
                  ))}
                </div>
              )}
              <div className="wiz-nav">
                <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setScreen('choose')}>Zurück</button>
              </div>
            </>
          ) : (
            <>
              <label className="wiz-label t-meta">Trainingstyp</label>
              <TypeChips typeKey={unitTypeKey} onSelect={selectUnitType} />

              <label className="wiz-label t-meta" style={{ marginTop: 'var(--space-5)' }}>Name</label>
              <input className="wiz-input" type="text" value={unitTitle} onChange={(e) => setUnitTitle(e.target.value)} />

              <label className="wiz-label t-meta" style={{ marginTop: 'var(--space-5)' }}>
                Richtwert Dauer <span className="wiz-optional">optional</span>
              </label>
              <input className="wiz-input" type="number" value={unitDuration} onChange={(e) => setUnitDuration(e.target.value)} min="0" max="1440" />

              {error && <div className="wiz-hint t-meta" style={{ color: 'var(--danger)' }}>{error}</div>}

              <button className="btn btn-secondary btn-block" style={{ marginTop: 14, color: 'var(--danger)', borderColor: 'var(--danger)' }}
                disabled={saving} onClick={deleteManagedUnit}>
                Diese Einheit löschen
              </button>

              <div className="wiz-nav">
                <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setSelectedId(null)}>Zurück</button>
                <button className="btn btn-primary" style={{ flex: 1 }} disabled={saving} onClick={saveManagedUnit}>
                  {saving ? 'Speichert…' : 'Speichern'}
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </SheetShell>
  );
}
