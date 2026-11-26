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
  extendPlan, fmtDay, fmtDayShort, maxForRate, monthIdx, monthLabel, monthShortLabel, planInfo,
  previewRateChange, rateDue, rateState, spreadRest,
} from '../lib/savingsPlans';
import { parseMoney } from '../../../core/lib/wizardDates';
import SavingsPlanWizard from './SavingsPlanWizard';
import Icon from '../../../core/components/Icon';
import { confirmDialog, Button } from '../../../core/components/ui';

const NF0 = new Intl.NumberFormat('de-DE', { maximumFractionDigits: 0 });
const eur0 = (n) => `${NF0.format(Math.round(n))} €`;

const TargetIcon = () => <Icon name="target" size={null} />;

// Kurzstatus für die Zeile in der Übersicht
function rowStatus(info) {
  const base = `${eur0(info.paid)} von ${eur0(info.target)}`;
  if (info.done) return { chip: 'erreicht', tone: 'ok', sub: `${base} · Ziel erreicht` };
  if (info.overdue.length) return { chip: `${info.overdue.length} offen`, tone: 'warn', sub: `${base} · ${eur0(info.overdueSum)} Rückstand` };
  if (info.dueNow.length) return { chip: 'fällig', tone: 'info', sub: `${base} · Rate fällig ${fmtDayShort(rateDue(info.dueNow[0]))}` };
  return { chip: 'im Plan', tone: 'ok', sub: info.next ? `${base} · nächste Rate ${fmtDayShort(rateDue(info.next))}` : base };
}

function PlanSheet({ plan, rates, onClose, onEdit, onPaid, onEditRate }) {
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
    if (busy || !(await confirmDialog({ title: 'Sparplan beenden?', text: 'Eingezahltes bleibt im Sparschwein, offene Raten fallen weg.', confirmLabel: 'Beenden' }))) return;
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
  if (info.done) primary = <Button disabled>Ziel erreicht</Button>;
  else if (info.payable.length > 1) primary = <Button disabled={busy} onClick={() => pay(info.payable, `${formatEur(info.payableSum)} eingezahlt`)}>{formatEur(info.payableSum)} einzahlen</Button>;
  else if (info.payable.length === 1) primary = <Button disabled={busy} onClick={() => pay(info.payable, 'Rate eingezahlt')}>Rate einzahlen</Button>;
  else primary = <Button disabled={busy || !info.next} onClick={() => pay([info.next], 'Rate vorgezogen')}>Rate vorziehen</Button>;

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
            <Button variant="secondary" icon="edit" className="spr-edit" onClick={onEdit} disabled={busy}>Bearbeiten</Button>
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

        {!info.done && (info.payable[0] || info.next) && (
          <button type="button" className="spr-more" onClick={() => onEditRate(info.payable[0] || info.next)}>
            <span className="spr-more-ic" aria-hidden="true"><Icon name="plus" size={null} className="glyph" /></span>
            <span><b>Diesen Monat mehr sparen</b><small>Rate {monthShortLabel(monthIdx(rateDue(info.payable[0] || info.next)))} ändern, nur für diesen Monat</small></span>
            <span className="area-row-chevron" aria-hidden="true"><Icon name="open" size={null} className="glyph" /></span>
          </button>
        )}

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

        <span className="wz-lbl">Raten <span className="opt">offene antippen zum Ändern</span></span>
        <div className="spr-rates">
          {info.list.map((r, idx) => {
            const st = rateState(r, today);
            const changed = Math.abs(Number(r.amount) - Number(plan.rate)) > 0.004 && idx < info.list.length - 1;
            const inner = (
              <>
                <span>{fmtDay(rateDue(r))}{changed && <em className="spr-chg">geändert</em>}</span>
                <b>{formatEur(Number(r.amount))}</b>
                <em className={`spr-chip spr-chip--${st.key}`}>{st.text}</em>
              </>
            );
            return r.paid
              ? <div key={r.id} className="spr-rate">{inner}<span className="spr-rate-chev" /></div>
              : (
                <button key={r.id} type="button" className="spr-rate spr-rate--tap" onClick={() => onEditRate(r)} aria-label={`Rate ${fmtDay(rateDue(r))} ändern`}>
                  {inner}<span className="spr-rate-chev" aria-hidden="true"><Icon name="open" size={null} className="glyph" /></span>
                </button>
              );
          })}
        </div>

        <button type="button" className="spr-end" onClick={end} disabled={busy}>Sparplan beenden</button>
      </WizardFrame>
    </SheetShell>
  );
}

const NF2 = new Intl.NumberFormat('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// Rate eines Monats ändern: gilt nur für diesen Monat, die Schlussraten passen sich an
function RateChangeSheet({ plan, rates, rate, onBack, onClose, onSaved }) {
  const { session } = useAuth();
  const { showToast } = useUi();
  const { notifySaved } = useEntrySheet();
  const today = localTodayStr();
  const [value, setValue] = useState(NF2.format(Number(rate.amount)));
  const [busy, setBusy] = useState(false);
  const base = Number(plan.rate);
  const max = maxForRate(plan, rates, rate.id);
  const v = parseMoney(value) || 0;
  const valid = v > 0 && v <= max + 0.004;
  const month = monthLabel(monthIdx(rateDue(rate)));

  let preview = null;
  if (v > max + 0.004) preview = { tone: 'warn', title: `Höchstens ${formatEur(max)}`, text: 'Mehr braucht es nicht bis zum Ziel' };
  else if (valid && Math.abs(v - Number(rate.amount)) < 0.005) preview = { tone: 'same', title: 'Keine Änderung', text: '' };
  else if (valid) {
    const pv = previewRateChange(plan, rates, rate.id, v, today);
    const earlier = monthIdx(pv.lastAfter) < monthIdx(pv.lastBefore);
    const later = monthIdx(pv.lastAfter) > monthIdx(pv.lastBefore);
    const fewer = pv.openBefore - pv.openAfter;
    if (earlier) preview = { tone: 'ok', title: `Ziel früher erreicht: ${monthShortLabel(monthIdx(pv.lastAfter))}`, text: `statt ${monthShortLabel(monthIdx(pv.lastBefore))} · ${fewer} ${fewer === 1 ? 'Rate' : 'Raten'} weniger` };
    else if (later) preview = { tone: 'warn', title: `Ziel später: ${monthShortLabel(monthIdx(pv.lastAfter))}`, text: `statt ${monthShortLabel(monthIdx(pv.lastBefore))} · ${formatEur(Number(rate.amount) - v)} kommen ans Ende` };
    else if (v > Number(rate.amount)) preview = { tone: 'ok', title: `Letzte Rate nur noch ${formatEur(pv.lastAmount)}`, text: `Ziel bleibt ${monthShortLabel(monthIdx(pv.lastBefore))}` };
    else preview = { tone: 'warn', title: `Letzte Rate wird ${formatEur(pv.lastAmount)}`, text: `Ziel bleibt ${monthShortLabel(monthIdx(pv.lastBefore))}` };
  }

  const quick = [
    ['+ 50 €', Number(rate.amount) + 50], ['+ 100 €', Number(rate.amount) + 100],
    ['Doppelt', base * 2], ['Alles', max],
  ];

  async function save() {
    if (!valid || busy) return;
    setBusy(true);
    try {
      const before = await finData.changeSavingsPlanRate(session, plan.id, rate.id, Math.round(v * 100) / 100);
      notifySaved();
      onSaved(before, `Rate ${month}: ${formatEur(v)}`);
    } catch (e) {
      console.error(e);
      showToast('Speichern fehlgeschlagen');
      setBusy(false);
    }
  }

  return (
    <SheetShell onClose={onClose} wizard>
      <WizardFrame
        title="Rate ändern"
        sub={`${plan.name} · ${month}`}
        stepKey={`rate-${rate.id}`}
        onBack={onBack}
        onClose={onClose}
        footer={(
          <WizardFoot>
            <Button variant="secondary" onClick={() => setValue(NF2.format(base))} disabled={busy}>Normale Rate</Button>
            <Button onClick={save} disabled={!valid || busy}>{busy ? 'Speichert…' : 'Speichern'}</Button>
          </WizardFoot>
        )}
      >
        <label className="wz-lbl" htmlFor="spr-rate-amt">Betrag nur für diesen Monat</label>
        <div className="wz-amount">
          <input
            id="spr-rate-amt" type="text" inputMode="decimal" autoComplete="off"
            value={value} onChange={(e) => setValue(e.target.value.replace(/[^\d.,]/g, ''))}
          />
          <span>€</span>
        </div>
        <div className="spw-quick" role="group" aria-label="Schnellwahl">
          {quick.map(([label, amount]) => (
            <button key={label} type="button" className="wz-chip" onClick={() => setValue(NF2.format(Math.min(Math.round(amount * 100) / 100, max)))}>{label}</button>
          ))}
        </div>
        {preview && (
          <div className={`spr-pv spr-pv--${preview.tone}`}>
            <b>{preview.title}</b>{preview.text && <small>{preview.text}</small>}
          </div>
        )}
        <div className="spr-facts">
          <div className="spr-fact"><span>Normale Rate</span><b>{formatEur(base)}</b></div>
          <div className="spr-fact"><span>Fällig am</span><b>{fmtDay(rateDue(rate))}</b></div>
        </div>
        <p className="wz-hint">Gilt nur für {month}. Die anderen Monate bleiben bei {formatEur(base)}; was du mehr sparst, fällt am Ende weg.</p>
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
  const [undo, setUndo] = useState(null); // { key, title, run }
  const [rateEdit, setRateEdit] = useState(null); // { planId, rateId }

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

  async function undoRate(planId, before) {
    try {
      await finData.restoreSavingsPlanRates(session, planId, before);
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
            <span className="area-row-chevron" aria-hidden="true"><Icon name="open" size={null} className="glyph" /></span>
          </button>
        );
      })}
      <button type="button" className="area-row spr-add" onClick={() => setWizard({ plan: null })}>
        <span className="spr-ic spr-ic--add" aria-hidden="true"><Icon name="plus" size={null} className="glyph" /></span>
        <span className="area-row-label">Sparplan anlegen</span>
      </button>

      {openPlan && !wizard && !rateEdit && (
        <PlanSheet
          plan={openPlan}
          rates={byPlan.get(openPlan.id) || []}
          onClose={() => setOpenId(null)}
          onEdit={() => setWizard({ plan: openPlan })}
          onPaid={(list, title) => setUndo({ key: `pay-${list.map((r) => r.id).join('-')}-${Date.now()}`, title, run: () => undoPaid(list) })}
          onEditRate={(r) => setRateEdit({ planId: openPlan.id, rateId: r.id })}
        />
      )}
      {openPlan && rateEdit && (byPlan.get(openPlan.id) || []).some((r) => r.id === rateEdit.rateId) && (
        <RateChangeSheet
          plan={openPlan}
          rates={byPlan.get(openPlan.id) || []}
          rate={(byPlan.get(openPlan.id) || []).find((r) => r.id === rateEdit.rateId)}
          onBack={() => setRateEdit(null)}
          onClose={() => { setRateEdit(null); setOpenId(null); }}
          onSaved={(before, title) => {
            const planId = openPlan.id;
            setRateEdit(null);
            setUndo({ key: `rate-${Date.now()}`, title, run: () => undoRate(planId, before) });
          }}
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
          key={undo.key}
          className="action-toast--fin"
          title={undo.title}
          duration={10000}
          actions={[{ label: 'Rückgängig machen', primary: true, onPress: undo.run }]}
          onClose={() => setUndo(null)}
        />
      )}
    </>
  );
}
