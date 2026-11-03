import { useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '../lib/AuthContext';
import { useEntrySheet } from '../lib/EntrySheetContext';
import * as db from '../../modules/sport/lib/spoData';
import { TRAINING_TYPES } from '../../modules/sport/lib/data/trainingTypes';
import { PREDEFINED_UNITS } from '../../modules/sport/lib/data/predefinedUnits';
import PlanDaysEditor from '../../modules/sport/components/PlanDaysEditor';
import { fmtDate, todayIso } from '../lib/wizardDates';
import SheetShell from './SheetShell';
import { DateButton, MoreButton, SegGroup, WheelPicker, WizardFoot, WizardFrame, missingHint } from './wizard/WizardKit';

// Sport (FAB) — im gemeinsamen Wizard-Rahmen (core/components/wizard/WizardKit.jsx).
// Auswahl zuerst: Neue Einheit · Trainingsplan · Ruhetag.
//   Neue Einheit  (e1 Eingeben, e2 Prüfen) → spo_workouts (Training mit Datum)
//   Trainingsplan (p1 Name, p2 Trainingstage, p3 Prüfen) → spo_plans
//   Ruhetag       (r1) → spo_workouts mit is_rest
// "Eigene Einheiten verwalten" (Vorlagen anlegen, bearbeiten, löschen) bleibt wie bisher.
// Was bei Einheiten gewählt werden kann und was wo angelegt wird, wird separat geklärt.

const GROUP_ICON = { Kraft: '💪', Ausdauer: '🏃', Beweglichkeit: '🧘' };
const GROUPS = [...new Set(TRAINING_TYPES.map((t) => t.group))];
const STATUS_OPTIONS = [{ value: 'done', label: '✓ Erledigt' }, { value: 'planned', label: '◷ Geplant' }];

// "Push (Brust, Schultern, Trizeps)" → Titel "Push", Zusatz "Brust, Schultern, Trizeps"
function splitLabel(t) {
  const m = /^(.*?)\s*\((.*)\)\s*$/.exec(t.label);
  if (m) return { title: m[1], sub: m[2] };
  return { title: t.label, sub: t.group };
}
const shortTitle = (t) => splitLabel(t).title;

// Trainingstyp: erst die Gruppe als große Karte, darunter die Typen als Kacheln
function TypePicker({ typeKey, onSelect }) {
  const selected = TRAINING_TYPES.find((t) => t.key === typeKey);
  const [group, setGroup] = useState(selected?.group ?? GROUPS[0]);
  const types = TRAINING_TYPES.filter((t) => t.group === group);
  return (
    <>
      <div className="wz-tgroups" role="group" aria-label="Typ-Gruppe">
        {GROUPS.map((g) => (
          <button key={g} type="button" className={`wz-tg${g === group ? ' on' : ''}`} aria-pressed={g === group} onClick={() => setGroup(g)}>
            <span>{GROUP_ICON[g] || '🎯'}</span>{g}
            <small>{TRAINING_TYPES.filter((t) => t.group === g).length} Typen</small>
          </button>
        ))}
      </div>
      <div className="wz-types" role="group" aria-label={group}>
        {types.map((t) => {
          const { title, sub } = splitLabel(t);
          return (
            <button key={t.key} type="button" className={`wz-ty${t.key === typeKey ? ' on' : ''}`} aria-pressed={t.key === typeKey} onClick={() => onSelect(t)}>
              {title}<small>{sub}</small>
            </button>
          );
        })}
      </div>
    </>
  );
}

export default function SportQuickSheet({ onClose }) {
  const { session } = useAuth();
  const { notifySaved } = useEntrySheet();

  const [screen, setScreen] = useState('choose');
  const historyRef = useRef([]);
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState('');

  function go(next) { historyRef.current.push(screen); setError(''); setScreen(next); }
  function back() { const prev = historyRef.current.pop(); setError(''); setScreen(prev || 'choose'); }

  // ── Neue Einheit (Training) ──
  const [typeKey, setTypeKey] = useState('');
  const [title,   setTitle]   = useState('');
  const titleAuto = useRef(true);
  const [date,    setDate]    = useState(todayIso());
  const [statusPick, setStatusPick] = useState(null); // null = folgt dem Datum
  const [showMore, setShowMore] = useState(false);

  const type = TRAINING_TYPES.find((t) => t.key === typeKey);
  const status = statusPick ?? (date > todayIso() ? 'planned' : 'done');

  function selectType(t) {
    setTypeKey(t.key);
    if (titleAuto.current || !title) { setTitle(shortTitle(t)); titleAuto.current = true; }
  }

  async function saveWorkout() {
    setSaving(true); setError('');
    try {
      await db.saveWorkout(session, {
        occurred_on: date,
        type_key: typeKey,
        title: title.trim(),
        status,
        is_rest: false,
      });
      notifySaved();
      onClose();
    } catch { setError('Speichern fehlgeschlagen'); }
    finally { setSaving(false); }
  }

  // ── Trainingsplan ──
  const [planTitle, setPlanTitle] = useState('');
  const [planNotes, setPlanNotes] = useState('');
  const [planMore,  setPlanMore]  = useState(false);
  const [planDays,  setPlanDays]  = useState([{ unit_id: '', title: '', type_key: '', duration_min: '', muscle_groups: [], is_rest: false }]);
  const [myUnits,   setMyUnits]   = useState([]);

  useEffect(() => {
    if (screen !== 'p2') return;
    db.getUnits(session).then(setMyUnits).catch(() => {});
  }, [screen, session]);

  const planDaysOk = planDays.length > 0 && !planDays.some((d) => !d.is_rest && !d.unit_id && !d._selectedUnitKey);
  const planHint = planDays.length === 0
    ? 'Der Plan braucht mindestens einen Tag'
    : (planDaysOk ? '' : 'Bitte jedem Trainingstag eine Einheit zuweisen');

  async function savePlan() {
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
        })),
      );
      notifySaved();
      onClose();
    } catch { setError('Speichern fehlgeschlagen'); }
    finally { setSaving(false); }
  }

  // ── Ruhetag ──
  const [restDate, setRestDate] = useState(todayIso());
  async function saveRest() {
    setSaving(true); setError('');
    try {
      await db.saveWorkout(session, {
        occurred_on: restDate,
        type_key: null,
        title: 'Ruhetag',
        duration_min: null,
        status: 'done',
        is_rest: true,
      });
      notifySaved();
      onClose();
    } catch { setError('Speichern fehlgeschlagen'); }
    finally { setSaving(false); }
  }

  // ── Eigene Einheiten verwalten (Vorlagen) ──
  const [manageUnits,   setManageUnits]   = useState([]);
  const [manageLoading, setManageLoading] = useState(false);
  const [selectedId,    setSelectedId]    = useState(null);
  const [unitTitle,     setUnitTitle]     = useState('');
  const [unitTypeKey,   setUnitTypeKey]   = useState('');
  const [unitDuration,  setUnitDuration]  = useState('');
  const [showPresets,   setShowPresets]   = useState(false);

  useEffect(() => {
    if (screen !== 'manage') return;
    setManageLoading(true);
    db.getUnits(session).then(setManageUnits).catch(() => setError('Einheiten konnten nicht geladen werden')).finally(() => setManageLoading(false));
  }, [screen, session]);

  function openTemplate(u) {
    setSelectedId(u?.id ?? null);
    setUnitTitle(u?.title ?? '');
    setUnitTypeKey(u?.type_key ?? '');
    setUnitDuration(u?.duration_min != null ? String(u.duration_min) : '');
    setShowPresets(false);
    go('tpl');
  }
  function adoptPreset(preset) {
    setUnitTypeKey(preset.type_key ?? '');
    setUnitTitle(preset.title);
    setShowPresets(false);
  }
  async function saveTemplate() {
    if (!unitTitle.trim()) return setError('Bitte Bezeichnung eingeben');
    setSaving(true); setError('');
    try {
      await db.saveUnit(session, {
        ...(selectedId ? { id: selectedId } : {}),
        title: unitTitle.trim(),
        type_key: unitTypeKey || null,
        duration_min: unitDuration ? parseInt(unitDuration, 10) : null,
      });
      notifySaved();
      onClose();
    } catch { setError('Speichern fehlgeschlagen'); }
    finally { setSaving(false); }
  }
  async function deleteTemplate() {
    setSaving(true);
    try {
      await db.deleteUnit(selectedId);
      notifySaved();
      onClose();
    } catch { setError('Löschen fehlgeschlagen'); }
    finally { setSaving(false); }
  }

  const planReview = useMemo(() => planDays.map((d, i) => ({ n: i + 1, text: d.is_rest ? 'Ruhetag' : (d.title || '—') })), [planDays]);
  const errorEl = error ? <p className="wz-hint err" role="alert">{error}</p> : null;
  const wrap = (props, children) => (
    <SheetShell onClose={onClose} wizard labelledBy="sport-sheet-title">
      <WizardFrame stepKey={screen} onClose={onClose} {...props}>{children}</WizardFrame>
    </SheetShell>
  );

  // ── Auswahl ──
  if (screen === 'choose') {
    return wrap({ title: 'Sport', sub: 'Was möchtest du anlegen?' }, (
      <>
        <button type="button" className="wz-row-btn" onClick={() => go('e1')}>
          <span className="wz-row-ico">⚡</span>
          <span>Neue Einheit<small>Training mit Typ und Datum</small></span>
          <span className="chev" aria-hidden="true">›</span>
        </button>
        <button type="button" className="wz-row-btn" onClick={() => { setPlanTitle(''); go('p1'); }}>
          <span className="wz-row-ico">🗓</span>
          <span>Trainingsplan<small>Mehrere Trainingstage zu einem Plan bündeln</small></span>
          <span className="chev" aria-hidden="true">›</span>
        </button>
        <button type="button" className="wz-row-btn" onClick={() => go('r1')}>
          <span className="wz-row-ico soft">🌙</span>
          <span>Ruhetag<small>Erholung im Kalender festhalten</small></span>
          <span className="chev" aria-hidden="true">›</span>
        </button>
        <button type="button" className="btn btn-secondary btn-block" style={{ marginTop: 14 }} onClick={() => go('manage')}>
          Eigene Einheiten verwalten
        </button>
      </>
    ));
  }

  // ── Neue Einheit: Eingeben ──
  if (screen === 'e1') {
    const nameOk = Boolean(title.trim());
    const ready = Boolean(typeKey) && nameOk && Boolean(date);
    return wrap({
      title: 'Neue Einheit',
      sub: 'Schritt 1 von 2 · Eingeben',
      step: 1, total: 2, onBack: back,
      footer: (
        <WizardFoot hint={ready ? '' : missingHint([['Trainingstyp', !typeKey], ['Name', !nameOk], ['Datum', !date]])}>
          <MoreButton open={showMore} onClick={() => setShowMore((o) => !o)} />
          <button type="button" className="btn btn-primary" disabled={!ready} onClick={() => go('e2')}>Weiter</button>
        </WizardFoot>
      ),
    }, (
      <>
        <div className="wz-lbl">Trainingstyp</div>
        <TypePicker typeKey={typeKey} onSelect={selectType} />

        <label className="wz-lbl" htmlFor="wz-sport-name" style={{ marginTop: 18 }}>Name</label>
        <input
          id="wz-sport-name"
          className="wz-input hero"
          type="text"
          value={title}
          onChange={(e) => { titleAuto.current = false; setTitle(e.target.value); }}
          placeholder="z. B. Legday, Arme"
          autoComplete="off"
        />

        <div className="wz-lbl">Datum</div>
        <DateButton value={date} onChange={setDate} placeholder="Datum wählen" label="Datum" />
        {date > todayIso() && statusPick === null && <p className="wz-hint">Liegt in der Zukunft, wird als „Geplant" gespeichert.</p>}

        {showMore && (
          <div style={{ marginTop: 16 }}>
            <div>
              <div className="wz-col-lbl">Status</div>
              <div style={{ display: 'grid', gap: 8 }} role="group" aria-label="Status">
                {STATUS_OPTIONS.map((o) => (
                  <button key={o.value} type="button" className={`wz-gbtn${status === o.value ? ' on' : ''}`} style={{ minHeight: 58 }} aria-pressed={status === o.value} onClick={() => setStatusPick(o.value)}>
                    {o.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
        {errorEl}
      </>
    ));
  }

  // ── Neue Einheit: Prüfen ──
  if (screen === 'e2') {
    return wrap({
      title: 'Einheit prüfen',
      sub: 'Schritt 2 von 2 · Bitte alles kontrollieren',
      step: 2, total: 2, onBack: back,
      footer: (
        <WizardFoot>
          <button type="button" className="btn btn-secondary" onClick={back} disabled={saving}>Ändern</button>
          <button type="button" className="btn btn-primary" onClick={saveWorkout} disabled={saving}>{saving ? 'Speichert…' : 'Speichern'}</button>
        </WizardFoot>
      ),
    }, (
      <>
        <div className="wz-review">
          <div className="wz-rv-top"><small>Einheit</small><b style={{ fontSize: 24 }}>{title.trim()}</b></div>
          <div className="wz-rv-row"><span>Trainingstyp</span><span>{type ? `${shortTitle(type)} · ${type.group}` : '—'}</span></div>
          <div className="wz-rv-row"><span>Datum</span><span>{fmtDate(date)}</span></div>
          <div className="wz-rv-row"><span>Status</span><span>{status === 'planned' ? 'Geplant' : 'Erledigt'}</span></div>
        </div>
        {errorEl}
      </>
    ));
  }

  // ── Trainingsplan ──
  if (screen === 'p1') {
    const ok = Boolean(planTitle.trim());
    return wrap({
      title: 'Trainingsplan',
      sub: 'Schritt 1 von 3 · Name',
      step: 1, total: 3, onBack: back,
      footer: (
        <WizardFoot one hint={ok ? '' : missingHint([['Name', true]])}>
          <button type="button" className="btn btn-primary" disabled={!ok} onClick={() => go('p2')}>Weiter</button>
        </WizardFoot>
      ),
    }, (
      <>
        <label className="wz-lbl" htmlFor="wz-plan-name">Plan-Name</label>
        <input
          id="wz-plan-name"
          className="wz-input hero"
          type="text"
          value={planTitle}
          onChange={(e) => setPlanTitle(e.target.value)}
          placeholder="z. B. 4-Tage-Split, Push/Pull/Legs"
          autoFocus
          autoComplete="off"
          onKeyDown={(e) => e.key === 'Enter' && ok && go('p2')}
        />
        <p className="wz-hint">Das Startdatum legst du später beim Eintragen im Kalender fest. Hier geht es nur um den Aufbau des Plans.</p>
      </>
    ));
  }
  if (screen === 'p2') {
    return wrap({
      title: 'Trainingsplan',
      sub: 'Schritt 2 von 3 · Trainingstage',
      step: 2, total: 3, onBack: back,
      footer: (
        <WizardFoot hint={planHint}>
          <MoreButton open={planMore} onClick={() => setPlanMore((o) => !o)} />
          <button type="button" className="btn btn-primary" disabled={!planDaysOk} onClick={() => go('p3')}>Weiter</button>
        </WizardFoot>
      ),
    }, (
      <>
        <PlanDaysEditor days={planDays} onChange={setPlanDays} units={myUnits} />
        {planMore && (
          <>
            <label className="wz-lbl" htmlFor="wz-plan-note" style={{ marginTop: 16 }}>Notiz <span className="opt">optional</span></label>
            <textarea id="wz-plan-note" className="wz-input" value={planNotes} onChange={(e) => setPlanNotes(e.target.value)} placeholder="z. B. für Einsteiger, 3× pro Woche" />
          </>
        )}
      </>
    ));
  }
  if (screen === 'p3') {
    return wrap({
      title: 'Plan prüfen',
      sub: 'Schritt 3 von 3 · Bitte alles kontrollieren',
      step: 3, total: 3, onBack: back,
      footer: (
        <WizardFoot>
          <button type="button" className="btn btn-secondary" onClick={back} disabled={saving}>Ändern</button>
          <button type="button" className="btn btn-primary" onClick={savePlan} disabled={saving}>{saving ? 'Speichert…' : 'Speichern'}</button>
        </WizardFoot>
      ),
    }, (
      <>
        <div className="wz-review">
          <div className="wz-rv-top"><small>Trainingsplan</small><b style={{ fontSize: 24 }}>{planTitle.trim()}</b></div>
          {planReview.map((d) => <div className="wz-rv-row" key={d.n}><span>Tag {d.n}</span><span>{d.text}</span></div>)}
          <div className="wz-rv-row"><span>Notiz</span><span>{planNotes.trim() || '—'}</span></div>
        </div>
        {errorEl}
      </>
    ));
  }

  // ── Ruhetag ──
  if (screen === 'r1') {
    return wrap({
      title: 'Ruhetag',
      sub: 'Erholung festhalten',
      onBack: back,
      footer: (
        <WizardFoot one hint={restDate ? '' : missingHint([['Datum', true]])}>
          <button type="button" className="btn btn-primary" disabled={!restDate || saving} onClick={saveRest}>{saving ? 'Speichert…' : 'Speichern'}</button>
        </WizardFoot>
      ),
    }, (
      <>
        <div className="wz-lbl">Datum</div>
        <DateButton value={restDate} onChange={setRestDate} placeholder="Datum wählen" label="Datum" />
        <p className="wz-hint">Der Ruhetag steht danach im Kalender und wird im Hub als „Ruhetag" angezeigt.</p>
        {errorEl}
      </>
    ));
  }

  // ── Eigene Einheiten verwalten: Liste ──
  if (screen === 'manage') {
    return wrap({ title: 'Eigene Einheiten', sub: 'Vorlagen verwalten', onBack: back }, (
      <>
        <button type="button" className="btn btn-secondary btn-block" style={{ marginBottom: 12 }} onClick={() => openTemplate(null)}>
          ＋ Neue Einheiten-Vorlage
        </button>
        {manageLoading ? (
          <p className="wz-hint">Lädt…</p>
        ) : manageUnits.length === 0 ? (
          <p className="wz-hint">Noch keine eigene Einheit angelegt.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {manageUnits.map((u) => (
              <button key={u.id} type="button" className="wz-gbtn" style={{ textAlign: 'left', padding: '12px 14px' }} onClick={() => openTemplate(u)}>
                {u.title}
              </button>
            ))}
          </div>
        )}
        {errorEl}
      </>
    ));
  }

  // ── Einheiten-Vorlage anlegen / bearbeiten ──
  return wrap({
    title: selectedId ? 'Vorlage bearbeiten' : 'Neue Vorlage',
    sub: 'Eigene Einheit',
    onBack: back,
    footer: (
      <WizardFoot one hint={unitTitle.trim() ? '' : missingHint([['Name', true]])}>
        <button type="button" className="btn btn-primary" disabled={saving || !unitTitle.trim()} onClick={saveTemplate}>{saving ? 'Speichert…' : 'Speichern'}</button>
      </WizardFoot>
    ),
  }, (
    <>
      {!selectedId && (
        <>
          <button type="button" className="btn btn-secondary btn-block" onClick={() => setShowPresets((o) => !o)}>
            {showPresets ? 'Vorlagen ausblenden' : 'Aus Vorlage übernehmen'}
          </button>
          {showPresets && (
            <div className="wz-chips" style={{ margin: '10px 0', maxHeight: 160, overflowY: 'auto' }}>
              {PREDEFINED_UNITS.map((preset) => (
                <button key={preset.key} type="button" className="wz-chip" onClick={() => adoptPreset(preset)}>{preset.title}</button>
              ))}
            </div>
          )}
        </>
      )}
      <div className="wz-lbl">Trainingstyp</div>
      <TypePicker
        typeKey={unitTypeKey}
        onSelect={(t) => { setUnitTypeKey(t.key); if (!unitTitle) setUnitTitle(shortTitle(t)); }}
      />
      <label className="wz-lbl" htmlFor="wz-tpl-name" style={{ marginTop: 18 }}>Name</label>
      <input id="wz-tpl-name" className="wz-input hero" type="text" value={unitTitle} onChange={(e) => setUnitTitle(e.target.value)} placeholder="z. B. Legday, Arme" autoComplete="off" />
      {selectedId && (
        <button type="button" className="btn btn-secondary btn-block" style={{ marginTop: 14, color: 'var(--danger)', borderColor: 'var(--danger)' }} disabled={saving} onClick={deleteTemplate}>
          Diese Einheit löschen
        </button>
      )}
      {errorEl}
    </>
  ));
}
