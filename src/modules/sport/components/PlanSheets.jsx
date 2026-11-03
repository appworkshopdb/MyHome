import { useState } from 'react';
import SheetShell from '../../../core/components/SheetShell.jsx';
import { addDaysIso, planDayFor } from '../../../core/lib/sportPlanSync';
import { parseIso, todayIso } from '../../../core/lib/wizardDates';

// Bottom-Sheets des Dauerplans: aktivieren/wechseln, beenden, Änderung am
// aktiven Plan bestätigen. Texte bewusst knapp, nur das, was der Nutzer vor
// dem Bestätigen wissen muss.

const WD = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
const fmtDM = (iso) => { const d = parseIso(iso); return `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.`; };
const fmtShort = (iso) => `${WD[parseIso(iso).getDay()]} ${fmtDM(iso)}`;

// nächster Montag (heute ist Montag → in 7 Tagen)
function nextMonday(iso) {
  const dow = parseIso(iso).getDay();
  return addDaysIso(iso, ((1 - dow + 7) % 7) || 7);
}

function Facts({ children }) {
  return <div className="pl-facts">{children}</div>;
}
function Fact({ ok, children }) {
  return <div className={ok ? 'is-ok' : ''}><i aria-hidden="true" /><span>{children}</span></div>;
}

function Foot({ confirmLabel, onConfirm, onClose, busy }) {
  return (
    <div className="pl-foot">
      <button type="button" className="btn btn-primary" onClick={onConfirm} disabled={busy}>
        {busy ? 'Einen Moment …' : confirmLabel}
      </button>
      <button type="button" className="btn btn-secondary" onClick={onClose} disabled={busy}>Abbrechen</button>
    </div>
  );
}

export function ActivatePlanSheet({ plan, hasActive, onConfirm, onClose, busy }) {
  const today = todayIso();
  const [mode, setMode] = useState('heute');
  const [date, setDate] = useState(addDaysIso(today, 1));

  const start = mode === 'heute' ? today : mode === 'montag' ? nextMonday(today) : date;
  const when = mode === 'heute' ? 'ab heute' : mode === 'montag' ? `ab Montag, ${fmtDM(start)}` : `ab ${fmtShort(start)}`;
  const preview = Array.from({ length: 7 }, (_, i) => {
    const d = addDaysIso(start, i);
    return { d, day: planDayFor(plan.items, start, d) };
  });
  const dateOptions = Array.from({ length: 14 }, (_, i) => addDaysIso(today, i));

  return (
    <SheetShell onClose={onClose} labelledBy="pl-act-title">
      <div className="sheet-header">
        <span className="sheet-title" id="pl-act-title">„{plan.title}“ aktivieren</span>
      </div>
      <div className="pl-sheet">
        <p className="pl-sub">{plan.items.length} Tage, Start mit Tag 1.</p>

        <div className="pl-seg" role="group" aria-label="Start">
          {[['heute', 'Heute'], ['montag', 'Montag'], ['datum', 'Datum']].map(([k, l]) => (
            <button key={k} type="button" className={mode === k ? 'is-on' : ''} aria-pressed={mode === k} onClick={() => setMode(k)}>{l}</button>
          ))}
        </div>
        {mode === 'datum' && (
          <select className="pl-select" value={date} onChange={(e) => setDate(e.target.value)} aria-label="Startdatum">
            {dateOptions.map((d) => <option key={d} value={d}>{fmtShort(d)}</option>)}
          </select>
        )}

        <p className="pl-sub">Start: {fmtShort(start)}, die ersten 7 Tage</p>
        <div className="pl-prev">
          {preview.map(({ d, day }) => (
            <div key={d} className={day?.item.is_rest ? 'is-rest' : 'is-train'}>
              <span>{fmtShort(d)}</span>
              <b>{day ? (day.item.is_rest ? 'Ruhetag' : day.item.title) : ''}</b>
            </div>
          ))}
        </div>

        <Facts>
          <Fact>Dein Trainingsplan „{plan.title}“ beginnt {when}.</Fact>
          <Fact ok>Alles vor dem Start bleibt unverändert.</Fact>
        </Facts>

        <Foot confirmLabel={hasActive ? 'Plan wechseln' : 'Plan aktivieren'} onConfirm={() => onConfirm(plan, start)} onClose={onClose} busy={busy} />
      </div>
    </SheetShell>
  );
}

export function EndPlanSheet({ plan, impact, onConfirm, onClose, busy }) {
  return (
    <SheetShell onClose={onClose} labelledBy="pl-end-title">
      <div className="sheet-header">
        <span className="sheet-title" id="pl-end-title">Plan beenden?</span>
      </div>
      <div className="pl-sheet">
        <p className="pl-sub">„{plan.title}“ läuft ab heute nicht mehr weiter.</p>
        <Facts>
          <Fact>{impact.open} offene Plan-Einträge ab heute entfallen.</Fact>
          {impact.manual > 0 && <Fact ok>{impact.manual} eigene Einträge bleiben.</Fact>}
          <Fact ok>Erledigtes und Vergangenes bleibt unverändert.</Fact>
        </Facts>
        <Foot confirmLabel="Plan beenden" onConfirm={onConfirm} onClose={onClose} busy={busy} />
      </div>
    </SheetShell>
  );
}

export function EditPlanConfirmSheet({ title, impact, onConfirm, onClose, busy }) {
  return (
    <SheetShell onClose={onClose} labelledBy="pl-edit-title">
      <div className="sheet-header">
        <span className="sheet-title" id="pl-edit-title">Änderung ab heute übernehmen?</span>
      </div>
      <div className="pl-sheet">
        <p className="pl-sub">„{title}“ gilt ab heute in der neuen Fassung.</p>
        <Facts>
          <Fact>{impact.open} offene Plan-Einträge ab heute werden neu erzeugt.</Fact>
          <Fact ok>Der Plan läuft an derselben Stelle im Zyklus weiter.</Fact>
          {impact.manual > 0 && <Fact ok>{impact.manual} eigene Einträge bleiben.</Fact>}
          <Fact ok>Erledigtes und Vergangenes bleibt im bisherigen Stand.</Fact>
        </Facts>
        <Foot confirmLabel="Änderung übernehmen" onConfirm={onConfirm} onClose={onClose} busy={busy} />
      </div>
    </SheetShell>
  );
}
