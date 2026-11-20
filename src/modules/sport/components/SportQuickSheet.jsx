import { useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '../../../core/lib/AuthContext';
import { useEntrySheet } from '../../../core/lib/EntrySheetContext';
import * as db from '../lib/spoData';
import PlanDaysBoard, { DayTile } from './PlanDaysBoard';
import UnitPicker from './UnitPicker';
import UnitSelectCard from './UnitSelectCard';
import RestBadge from './RestBadge';
import SportSymbol from './SportSymbol';
import OwnUnitForm from './OwnUnitForm';
import { resolveUnitVisual } from '../lib/planMuscles';
import { buildCatalog, unitKindLabel } from '../lib/unitCatalog';
import { isSymbol } from '../lib/sportSymbols';
import { dayFromEntry, daysAreComplete, daysSummary, emptyDay, itemsFromDays } from '../lib/planDays';
import { getBodyProfile } from '../../../core/lib/bodyProfileData';
import { todayIso } from '../../../core/lib/wizardDates';
import SheetShell from '../../../core/components/SheetShell';
import { DateButton, MoreButton, SegGroup, WheelPicker, WizardFoot, WizardFrame, missingHint } from '../../../core/components/wizard/WizardKit';

// Sport (FAB) — im gemeinsamen Wizard-Rahmen (core/components/wizard/WizardKit.jsx).
// Begriffe: eine EINHEIT ist ein Baustein (fest aus der App oder selbst angelegt), ein
// TRAINING ist eine Einheit an einem Tag, ein TRAININGSPLAN reiht Einheiten über Tage.
// Auswahl in zwei Gruppen:
//   Im Kalender eintragen: Training (e1, e1pick Einheit wählen) · Ruhetag (r1) → spo_workouts
//   Neu anlegen:           Trainingsplan (p1 Name, p2 Tage, p3 Prüfen) → spo_plans
//                          Eigene Einheit (own, Formular OwnUnitForm) → spo_units
// Bearbeiten/Löschen eigener Einheiten: Bereich "Einheiten" im Modul (EinheitenView).
// Die Einheit wählt man überall in derselben Galerie (UnitPicker): Kraft, Ausdauer,
// Mobility, Eigene (inkl. Sportarten), mit Bildern bzw. Symbolen.
// Plan: Tage als Kachelraster (PlanDaysBoard), Einheit über die Galerie (UnitPicker, Screen p2pick).

const STATUS_OPTIONS = [{ value: 'done', label: '✓ Erledigt' }, { value: 'planned', label: '◷ Geplant' }];

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
  const [picked,  setPicked]  = useState(null); // gewählter Katalog-Eintrag (Bilder, Name, Typ)
  const titleAuto = useRef(true);
  const [date,    setDate]    = useState(todayIso());
  const [statusPick, setStatusPick] = useState(null); // null = folgt dem Datum
  const [showMore, setShowMore] = useState(false);

  const status = statusPick ?? (date > todayIso() ? 'planned' : 'done');

  // Einheit aus der Galerie: Typ, Bilder und (solange nicht selbst geändert) der Name
  function selectUnit(entry) {
    setPicked(entry);
    setTypeKey(entry.type_key || 'sonstiges');
    if (titleAuto.current || !title) { setTitle(entry.title); titleAuto.current = true; }
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
        // Feste Bilder: die Muskeln der gewählten Einheit (leer = aus dem Typ ableiten), sonst ihr Symbol
        ...(picked?.muscle_groups?.length ? { muscle_groups: picked.muscle_groups } : {}),
        ...(!picked?.muscle_groups?.length && isSymbol(picked?.icon) ? { icon: picked.icon } : {}),
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
  const [planDays,  setPlanDays]  = useState([emptyDay()]);
  const [planSel,   setPlanSel]   = useState(0);
  const [myUnits,   setMyUnits]   = useState([]);
  const [mySports,  setMySports]  = useState([]);
  const planDataLoaded = useRef(false);

  // Eigene Einheiten und Profil-Sportarten für die Auswahl, einmal beim ersten Auswahl-Schritt
  useEffect(() => {
    if (!['p2', 'e1'].includes(screen) || planDataLoaded.current) return;
    planDataLoaded.current = true;
    db.getUnits(session).then(setMyUnits).catch(() => {});
    getBodyProfile(session).then((p) => setMySports(p.sports ?? [])).catch(() => {});
  }, [screen, session]);
  const catalog = useMemo(() => buildCatalog({ units: myUnits, userSports: mySports }), [myUnits, mySports]);
  // Eigene Einheit aus Muskeln anlegen ("Eigene Einheit zusammenstellen") und gleich als Eintrag zurückgeben
  async function createOwnUnitEntry(draft) {
    const row = await db.createOwnUnit(session, draft);
    setMyUnits((list) => [...list, row]);
    return buildCatalog({ units: [row] }).find((e) => e.own);
  }

  const planDaysOk = daysAreComplete(planDays);
  const planHint = planDays.length === 0
    ? 'Der Plan braucht mindestens einen Tag'
    : (planDaysOk ? '' : 'Bitte jedem Trainingstag eine Einheit zuweisen');

  async function savePlan() {
    setSaving(true); setError('');
    try {
      await db.savePlan(
        session,
        { title: planTitle.trim(), notes: planNotes.trim() || null },
        itemsFromDays(planDays),
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

  // ── Eigene Einheit anlegen ──
  async function saveOwnUnit(draft) {
    await db.createOwnUnit(session, draft);
    notifySaved();
    onClose();
  }

  const errorEl = error ? <p className="wz-hint err" role="alert">{error}</p> : null;
  const wrap = (props, children) => (
    <SheetShell onClose={onClose} wizard labelledBy="sport-sheet-title">
      <WizardFrame stepKey={screen} onClose={onClose} {...props}>{children}</WizardFrame>
    </SheetShell>
  );

  // ── Auswahl ──
  if (screen === 'choose') {
    return wrap({ title: 'Sport', sub: 'Was möchtest du tun?' }, (
      <>
        <div className="wz-grp">Im Kalender eintragen</div>
        <button type="button" className="wz-row-btn" onClick={() => go('e1')}>
          <span className="wz-row-ico"><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3.5" y="5" width="17" height="15" rx="3" /><path d="M8 3v4M16 3v4M3.5 10h17M9 15l2 2 4-4" /></svg></span>
          <span>Training eintragen<small>Eine Einheit an einem Tag</small></span>
          <span className="chev" aria-hidden="true">›</span>
        </button>
        <button type="button" className="wz-row-btn" onClick={() => go('r1')}>
          <RestBadge size={40} />
          <span>Ruhetag<small>Erholung im Kalender festhalten</small></span>
          <span className="chev" aria-hidden="true">›</span>
        </button>
        <div className="wz-grp">Neu anlegen</div>
        <button type="button" className="wz-row-btn" onClick={() => { setPlanTitle(''); go('p1'); }}>
          <span className="wz-row-ico"><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3.5" y="4" width="17" height="4.5" rx="1.5" /><rect x="3.5" y="10" width="17" height="4.5" rx="1.5" /><rect x="3.5" y="16" width="10" height="4.5" rx="1.5" /></svg></span>
          <span>Trainingsplan<small>Mehrere Tage, füllt den Kalender von selbst</small></span>
          <span className="chev" aria-hidden="true">›</span>
        </button>
        <button type="button" className="wz-row-btn" onClick={() => go('own')}>
          <span className="wz-row-ico"><SportSymbol name="stern" size={22} /></span>
          <span>Eigene Einheit<small>Baustein mit Symbol oder Muskeln</small></span>
          <span className="chev" aria-hidden="true">›</span>
        </button>
        <p className="wz-hint">Ein Training ist eine Einheit an einem bestimmten Tag. Eigene Einheiten bearbeitest du im Bereich „Einheiten“.</p>
      </>
    ));
  }

  // ── Neue Einheit: Eingeben ──
  if (screen === 'e1') {
    const nameOk = Boolean(title.trim());
    const ready = Boolean(picked) && nameOk && Boolean(date);
    return wrap({
      title: 'Training eintragen',
      sub: 'Einheit, Name und Datum',
      onBack: back,
      footer: (
        <WizardFoot hint={ready ? '' : missingHint([['Einheit', !picked], ['Name', !nameOk], ['Datum', !date]])}>
          <MoreButton open={showMore} onClick={() => setShowMore((o) => !o)} />
          <button type="button" className="btn btn-primary" disabled={!ready || saving} onClick={saveWorkout}>{saving ? 'Speichert…' : 'Speichern'}</button>
        </WizardFoot>
      ),
    }, (
      <>
        <div className="wz-lbl">Einheit</div>
        <UnitSelectCard
          chosen={Boolean(picked)}
          title={picked?.title}
          subtitle={unitKindLabel(picked)}
          {...(picked ? resolveUnitVisual({ muscle_groups: picked.muscle_groups, icon: picked.icon, type_key: picked.type_key, title: picked.title }, myUnits) : {})}
          onClick={() => go('e1pick')}
        />

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
  // Einheit für die neue Einheit aus der Galerie wählen, danach zurück
  if (screen === 'e1pick') {
    return wrap({
      title: 'Einheit wählen',
      sub: 'Kraft, Ausdauer, Mobility oder eigene',
      onBack: back,
    }, (
      <UnitPicker
        catalog={catalog}
        selectedKey={picked?.key}
        onPick={(entry) => { selectUnit(entry); back(); }}
        onCreateOwn={createOwnUnitEntry}
      />
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
        <p className="wz-hint">Danach legst du Tag für Tag eine Einheit oder einen Ruhetag an. Die Länge des Plans ergibt sich aus den Tagen. Aktivieren kannst du den Plan anschließend unter „Pläne“.</p>
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
      <div className="pe pe--wz">
        <PlanDaysBoard days={planDays} setDays={setPlanDays} sel={planSel} setSel={setPlanSel} onChoose={() => go('p2pick')} />
        {planMore && (
          <>
            <label className="wz-lbl" htmlFor="wz-plan-note" style={{ marginTop: 4 }}>Notiz <span className="opt">optional</span></label>
            <textarea id="wz-plan-note" className="wz-input" value={planNotes} onChange={(e) => setPlanNotes(e.target.value)} placeholder="z. B. für Einsteiger, 3× pro Woche" />
          </>
        )}
      </div>
    ));
  }
  // Einheit für den gewählten Tag aus der Galerie wählen, danach zurück zu den Tagen
  if (screen === 'p2pick') {
    return wrap({
      title: 'Einheit wählen',
      sub: `Für Tag ${planSel + 1}`,
      step: 2, total: 3, onBack: back,
    }, (
      <UnitPicker
        catalog={catalog}
        selectedKey={planDays[planSel]?._selectedUnitKey}
        onCreateOwn={createOwnUnitEntry}
        onPick={(entry) => { setPlanDays((list) => list.map((d, i) => (i === planSel ? dayFromEntry(entry) : d))); back(); }}
      />
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
      <div className="pe pe--wz">
        <div className="pe-rv">
          <small>Trainingsplan</small>
          <b>{planTitle.trim()}</b>
          <span>{daysSummary(planDays)}</span>
        </div>
        <div className="pe-grid">
          {planDays.map((d, i) => <DayTile key={i} day={d} index={i} />)}
        </div>
        <div className="pe-rvrow"><span>Notiz</span><span>{planNotes.trim() || '—'}</span></div>
        <p className="wz-hint">Nach dem Speichern findest du den Plan unter „Pläne“ und kannst ihn dort aktivieren.</p>
        {errorEl}
      </div>
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

  // ── Eigene Einheit anlegen ──
  return wrap({ title: 'Eigene Einheit', sub: 'Baustein für Trainings und Pläne', onBack: back }, (
    <OwnUnitForm onSave={saveOwnUnit} onCancel={back} saveLabel="Speichern" cancelLabel="Abbrechen" />
  ));
}
