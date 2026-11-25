// modules/finance/components/SavingsPlans.jsx
//
// Sparpläne im Bereich "Sparen" der Finanzen-Übersicht (unter dem Sparschwein):
// je Plan eine Zeile mit Balken und Status, darunter "Sparplan anlegen".
// Tippen öffnet die Plan-Ansicht: Gespart, Soll heute, Status, Raten, Einzahlen,
// Vorziehen (mit "Rückgängig machen", 10 Sekunden), Plan anpassen, Bearbeiten,
// Beenden. Raten sind Buchungen (lib/savingsPlans.js) — fällige Raten sind offene
// Posten und zählen im Saldo, eingezahlte Raten im Sparschwein. Keine Punkte.
//
// Ohne Migration (fin_savings_plans fehlt) zeigt der Bereich nur das Sparschwein.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '../../../core/lib/AuthContext';
import { useUi } from '../../../core/lib/UiContext';
import { useEntrySheet } from '../../../core/lib/EntrySheetContext';
import SheetShell from '../../../core/components/SheetShell';
import ActionToast from '../../../core/components/ActionToast';
import { WizardFoot, WizardFrame } from '../../../core/components/wizard/WizardKit';
import { IconEdit, IconCheck } from '../../../core/components/Icons';
import * as finData from '../lib/finData';
import { formatEur, localTodayStr } from '../lib/finance';
import {
  extendPlan, fmtDay, fmtDayShort, monthIdx, planInfo, rateDue, rateState, spreadRest,
} from '../lib/savingsPlans';
import SavingsPlanWizard from './SavingsPlanWizard';

const NF0 = new Intl.NumberFormat('de-DE', { maximumFractionDigits: 0 });
const eur0 = (n) => `${NF0.format(Math.round(n))} €`;

const TargetIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
    <circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="5" /><circle cx="12" cy="12" r="1.5" />
  </svg>
);

// Kurzstatus für die Zeile in der Übersicht
function rowStatus(info) {
  const base = `${eur0(info.paid)} von ${eur0(info.target)}`;
  if (info.done) return { chip: 'erreicht', tone: 'ok', sub: `${base} · Ziel erreicht` };
  if (info.overdue.length) return { chip: `${info.overdue.length} offen`, tone: 'warn', sub: `${base} · ${eur0(info.overdueSum)} Rückstand` };
  if (info.dueNow.length) return { chip: 'fällig', tone: 'info', sub: `${base} · Rate fällig ${fmtDayShort(rateDue(info.dueNow[0]))}` };
  return { chip: 'im Plan', tone: 'ok', sub: info.next ? `${base} · nächste Rate ${fmtDayShort(rateDue(info.next))}` : base };
}

function PlanSheet({ plan, rates, onClose, onEdit, onPaid }) {
  const { session } = useAuth();
  const { showToast } = useUi();
  const { notifySaved } = useEntrySheet();
  const [busy, setBusy] = useState(false);
  const today = localTodayStr();
  const info = planInfo(plan, rates, today);

  async function pay(list, title) {
    if (busy || !list.length) return;
    setBusy(true);
    try {
      await finData.setRatesPaid(list, true);
      notifySaved();
      onPaid(list, title);
    } catch (e) {
      console.error(e);
      showToast('Einzahlen fehlgeschlagen');
    }
    setBusy(false);
  }

  async function adjust(kind) {
    if (busy) return;
    setBusy(true);
    try {
      if (kind === 'spread') {
        const { rate, rates: planned } = spreadRest(plan, info, today);
        await finData.saveSavingsPlan(session, { ...plan, rate }, planned);
        showToast('Rest auf die übrigen Monate verteilt');
      } else {
        const { rates: planned, targetDate } = extendPlan(plan, info, today);
        await finData.saveSavingsPlan(session, { ...plan, target_date: targetDate }, planned);
        showToast(plan.target_date ? 'Ziel verschoben' : 'Offene Raten ans Ende gelegt');
      }
      notifySaved();
    } catch (e) {
      console.error(e);
      showToast('Anpassen fehlgeschlagen');
    }
    setBusy(false);
  }

  async function end() {
    if (busy || !confirm('Sparplan beenden? Eingezahltes bleibt im Sparschwein, offene Raten fallen weg.')) return;
    setBusy(true);
    try {
      await finData.endSavingsPlan(session, plan.id);
      notifySaved();
      showToast('Sparplan beendet');
      onClose();
    } catch (e) {
      console.error(e);
      showToast('Beenden fehlgeschlagen');
      setBusy(false);
    }
  }

  let status;
  if (info.done) status = { tone: 'ok', title: 'Ziel erreicht', text: `${formatEur(info.paid)} im Sparschwein` };
  else if (info.overdue.length) status = { tone: 'warn', title: `${info.overdue.length} ${info.overdue.length === 1 ? 'Rate' : 'Raten'} offen`, text: `${formatEur(info.overdueSum)} Rückstand · seit ${fmtDay(rateDue(info.overdue[0]))}` };
  else if (info.dueNow.length) status = { tone: 'info', title: 'Rate fällig', text: `${formatEur(Number(info.dueNow[0].amount))} am ${fmtDay(rateDue(info.dueNow[0]))}` };
  else status = { tone: 'ok', title: 'Im Plan', text: info.next ? `Nächste Rate ${formatEur(Number(info.next.amount))} am ${fmtDay(rateDue(info.next))}` : 'Keine Rate offen' };

  let primary;
  if (info.done) primary = <button type="button" className="btn btn-primary" disabled>Ziel erreicht</button>;
  else if (info.payable.length > 1) primary = <button type="button" className="btn btn-primary" disabled={busy} onClick={() => pay(info.payable, `${formatEur(info.payableSum)} eingezahlt`)}>{formatEur(info.payableSum)} einzahlen</button>;
  else if (info.payable.length === 1) primary = <button type="button" className="btn btn-primary" disabled={busy} onClick={() => pay(info.payable, 'Rate eingezahlt')}>Rate einzahlen</button>;
  else primary = <button type="button" className="btn btn-primary" disabled={busy || !info.next} onClick={() => pay([info.next], 'Rate vorgezogen')}>Rate vorziehen</button>;

  const spreadN = plan.target_date ? Math.max(1, monthIdx(plan.target_date) - monthIdx(today) + 1) : 0;

  return (
    <SheetShell onClose={onClose} wizard>
      <WizardFrame
        title={plan.name}
        sub={`Sparplan · ${plan.target_date ? `bis ${fmtDay(plan.target_date)}` : 'ohne Datum'}`}
        stepKey={`plan-${plan.id}`}
        onClose={onClose}
        footer={(
          <WizardFoot>
            <button type="button" className="btn btn-secondary spr-edit" onClick={onEdit} disabled={busy}><IconEdit /> Bearbeiten</button>
            {primary}
          </WizardFoot>
        )}
      >
        <span className="wz-lbl">Gespart</span>
        <div className="spr-saved"><span>{formatEur(info.paid)}</span><small>von {formatEur(info.target)}</small></div>
        <div className={`spr-pbar${info.overdue.length ? ' warn' : ''}`}>
          <i style={{ width: `${info.pct}%` }} />{/* pruefer:ok berechnete Breite */}
          <b style={{ left: `${info.sollPct}%` }} aria-hidden="true" />{/* pruefer:ok berechnete Lage */}
        </div>
        <div className="spr-pleg"><span>{info.pct} %</span><span>Strich = Soll heute</span></div>

        <div className={`spr-st spr-st--${status.tone}`}>
          <span className="spr-st-ic" aria-hidden="true">{status.tone === 'warn' ? '!' : status.tone === 'info' ? '€' : <IconCheck />}</span>
          <span><b>{status.title}</b><small>{status.text}</small></span>
        </div>

        {info.overdue.length > 0 && !info.done && (
          <div className="spr-adj">
            <div className="spr-adj-h">Plan anpassen</div>
            {plan.target_date && (
              <button type="button" className="spr-adj-o" disabled={busy} onClick={() => adjust('spread')}>
                <b>Rest verteilen</b>
                <span>{spreadN} × {formatEur(Math.round((info.rest / spreadN) * 100) / 100)} bis {fmtDay(plan.target_date)}</span>
              </button>
            )}
            <button type="button" className="spr-adj-o" disabled={busy} onClick={() => adjust('extend')}>
              <b>{plan.target_date ? 'Ziel verschieben' : 'Hinten anhängen'}</b>
              <span>{formatEur(Number(plan.rate))} weiter, offene Raten kommen ans Ende</span>
            </button>
          </div>
        )}

        <div className="spr-facts">
          <div className="spr-fact"><span>Rate</span><b>{formatEur(Number(plan.rate))} {plan.rhythm === 'quarterly' ? 'quartalsweise' : 'monatlich'}</b></div>
          <div className="spr-fact"><span>Raten</span><b>{info.paidCount} von {info.list.length} eingezahlt</b></div>
          <div className="spr-fact"><span>Noch offen</span><b>{formatEur(info.rest)}</b></div>
          <div className="spr-fact"><span>Letzte Rate</span><b>{info.lastDue ? fmtDay(info.lastDue) : '–'}</b></div>
        </div>

        <span className="wz-lbl">Raten</span>
        <div className="spr-rates">
          {info.list.map((r) => {
            const st = rateState(r, today);
            return (
              <div key={r.id} className="spr-rate">
                <span>{fmtDay(rateDue(r))}</span>
                <b>{formatEur(Number(r.amount))}</b>
                <em className={`spr-chip spr-chip--${st.key}`}>{st.text}</em>
              </div>
            );
          })}
        </div>

        <button type="button" className="spr-end" onClick={end} disabled={busy}>Sparplan beenden</button>
      </WizardFrame>
    </SheetShell>
  );
}

// Zeilen für den Bereich "Sparen" (innerhalb der AreaList des Sparschweins)
export default function SavingsPlanRows() {
  const { session } = useAuth();
  const { version, notifySaved } = useEntrySheet();
  const { showToast } = useUi();
  const [plans, setPlans] = useState(null); // null = noch nicht geladen oder Migration fehlt
  const [rates, setRates] = useState([]);
  const [openId, setOpenId] = useState(null);
  const [wizard, setWizard] = useState(null); // { plan } oder { plan: null }
  const [undo, setUndo] = useState(null); // { title, list }

  const sessionRef = useRef(session);
  useEffect(() => { sessionRef.current = session; }, [session]);

  const load = useCallback(async () => {
    try {
      const [ps, rs] = await Promise.all([
        finData.getSavingsPlans(sessionRef.current),
        finData.getSavingsPlanRates(sessionRef.current),
      ]);
      setPlans(ps);
      setRates(rs);
    } catch (e) {
      console.error('[Sparpläne] Laden fehlgeschlagen:', e);
      setPlans(null);
    }
  }, []);
  useEffect(() => { load(); }, [load, version]);

  const byPlan = useMemo(() => {
    const m = new Map();
    for (const r of rates) {
      if (!m.has(r.savings_plan_id)) m.set(r.savings_plan_id, []);
      m.get(r.savings_plan_id).push(r);
    }
    return m;
  }, [rates]);

  async function undoPaid(list) {
    try {
      await finData.setRatesPaid(list, false);
      notifySaved();
      showToast('Rückgängig gemacht');
    } catch (e) {
      console.error(e);
      showToast('Rückgängig fehlgeschlagen');
    }
  }

  if (plans === null) return null;
  const today = localTodayStr();
  const openPlan = plans.find((p) => p.id === openId) || null;

  return (
    <>
      {plans.map((p) => {
        const info = planInfo(p, byPlan.get(p.id) || [], today);
        const st = rowStatus(info);
        return (
          <button key={p.id} type="button" className="area-row spr-row" onClick={() => setOpenId(p.id)} aria-label={`Sparplan ${p.name}, ${st.sub}`}>
            <span className="spr-ic" aria-hidden="true"><TargetIcon /></span>
            <span className="spr-body">
              <span className="spr-top"><b>{p.name}</b><em className={`spr-chip spr-chip--${st.tone}`}>{st.chip}</em></span>
              <span className={`spr-bar${info.overdue.length ? ' warn' : ''}`}><i style={{ width: `${info.pct}%` }} /></span>{/* pruefer:ok berechnete Breite */}
              <small>{st.sub}</small>
            </span>
            <span className="area-row-chevron" aria-hidden="true">›</span>
          </button>
        );
      })}
      <button type="button" className="area-row spr-add" onClick={() => setWizard({ plan: null })}>
        <span className="spr-ic spr-ic--add" aria-hidden="true">+</span>
        <span className="area-row-label">Sparplan anlegen</span>
      </button>

      {openPlan && !wizard && (
        <PlanSheet
          plan={openPlan}
          rates={byPlan.get(openPlan.id) || []}
          onClose={() => setOpenId(null)}
          onEdit={() => setWizard({ plan: openPlan })}
          onPaid={(list, title) => setUndo({ list, title })}
        />
      )}
      {wizard && (
        <SavingsPlanWizard
          plan={wizard.plan}
          rates={wizard.plan ? byPlan.get(wizard.plan.id) || [] : []}
          onClose={() => setWizard(null)}
        />
      )}
      {undo && (
        <ActionToast
          key={undo.list.map((r) => r.id).join('-') + undo.title}
          className="action-toast--fin"
          title={undo.title}
          duration={10000}
          actions={[{ label: 'Rückgängig machen', primary: true, onPress: () => undoPaid(undo.list) }]}
          onClose={() => setUndo(null)}
        />
      )}
    </>
  );
}
