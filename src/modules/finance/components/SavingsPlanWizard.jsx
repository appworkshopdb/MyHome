// modules/finance/components/SavingsPlanWizard.jsx
//
// Sparplan anlegen oder ändern — im Aufbau von "Neuer Eintrag" (WizardKit):
//  1 Ziel: Name, Zielbetrag, Bis Datum (Kalender, Schnellwahl 3/6/12/24 Monate)
//    oder Ohne Datum, erste Rate in diesem oder im nächsten Monat
//  2 Plan wählen: Durchschnitt aus den eigenen Buchungen und bis zu drei
//    Vorschläge, aufsteigend nach Rate; dazu "Eigenen Plan festlegen"
//  3 Prüfen: Fälligkeitstag, Zusammenfassung, Speichern
// Beim Ändern rechnen die Vorschläge mit dem Rest (Ziel minus Eingezahltes).
// Rechenlogik: lib/savingsPlans.js. Keine Punkte.

import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../../core/lib/AuthContext';
import { useUi } from '../../../core/lib/UiContext';
import { useEntrySheet } from '../../../core/lib/EntrySheetContext';
import SheetShell from '../../../core/components/SheetShell';
import { DateButton, SegGroup, WizardFoot, WizardFrame, missingHint } from '../../../core/components/wizard/WizardKit';
import { parseMoney } from '../../../core/lib/wizardDates';
import * as finData from '../lib/finData';
import { formatEur, localTodayStr } from '../lib/finance';
import {
  MONTHS_LONG, averages, customOption, fitLevel, fmtDay, idxToYM, lastDayOfIdx, monthIdx,
  monthLabel, monthShortLabel, monthShortName, r2, scheduleRates, suggestions,
} from '../lib/savingsPlans';
import { Button } from '../../../core/components/ui';

const NF0 = new Intl.NumberFormat('de-DE', { maximumFractionDigits: 0 });
const eur0 = (n) => `${NF0.format(Math.round(n))} €`;
const money = (v) => parseMoney(v) || 0;
const QUICK = [[3, '3 Monate'], [6, '6 Monate'], [12, '1 Jahr'], [24, '2 Jahre']];
const DUE_DAYS = [{ value: 1, label: '1.' }, { value: 15, label: '15.' }, { value: 31, label: 'Monatsende' }];

function Option({ o, on, onPick, children }) {
  const fit = fitLevel(o.share);
  const n = o.amounts.length;
  const per = n === 1 ? 'einmalig' : o.rhythm === 'quarterly' ? '/ Quartal' : '/ Monat';
  const months = o.rhythm === 'quarterly' && n <= 4 ? ` (${o.months.map(monthShortName).join(', ')})` : '';
  const basis = o.rhythm === 'quarterly' ? 'vom Übrig im Ratenmonat' : 'von deinem Übrig';
  return (
    <div
      className={`spw-opt${on ? ' on' : ''}`}
      role="radio"
      aria-checked={on}
      tabIndex={0}
      onClick={onPick}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onPick(); } }}
    >
      <div className="spw-opt-top"><span className="spw-radio" aria-hidden="true" /><b>{o.title}</b></div>
      {children}
      {o.rate > 0 && (
        <>
          <div className="spw-rate"><span>{formatEur(o.rate)}</span><small>{per}</small></div>
          <div className="spw-meta">
            {n} {n === 1 ? 'Rate' : 'Raten'}{months} · fertig {monthShortLabel(o.months[n - 1])}{o.extra}
            {o.late && <span className="spw-warn"> · nach deinem Datum</span>}
          </div>
          <div className={`spw-fit spw-fit--${fit.key}`}>
            <div className="spw-fitbar"><i style={{ width: `${Math.min(o.share ?? 100, 100)}%` }} /></div>{/* pruefer:ok berechnete Breite */}
            <span>{o.share == null ? fit.text : `${o.share} % ${basis} · ${fit.text}`}</span>
          </div>
        </>
      )}
    </div>
  );
}

export default function SavingsPlanWizard({ plan = null, rates = [], onClose, onSaved }) {
  const { session } = useAuth();
  const { showToast } = useUi();
  const { notifySaved } = useEntrySheet();
  const today = localTodayStr();
  const cur = monthIdx(today);

  const paidSoFar = useMemo(() => r2(rates.filter((r) => r.paid).reduce((s, r) => s + Number(r.amount), 0)), [rates]);
  const [step, setStep] = useState(1);
  const [name, setName] = useState(plan?.name || '');
  const [amount, setAmount] = useState(plan ? String(plan.target_amount).replace('.', ',') : '');
  const [mode, setMode] = useState(plan && !plan.target_date ? 'nodate' : 'date');
  const [date, setDate] = useState(plan?.target_date ? String(plan.target_date).slice(0, 10) : '');
  const [first, setFirst] = useState('now');
  const [choice, setChoice] = useState(null);
  const [showCustom, setShowCustom] = useState(false);
  const [customRate, setCustomRate] = useState('');
  const [customRhythm, setCustomRhythm] = useState('monthly');
  const [dueDay, setDueDay] = useState(plan?.due_day || 1);
  const [saving, setSaving] = useState(false);
  const [avg, setAvg] = useState(null);

  // Durchschnitt aus allen Buchungen (Sparschwein-Buchungen zählen nicht als Einnahme/Ausgabe)
  useEffect(() => {
    let active = true;
    finData.getAllEntries(session)
      .then((all) => { if (active) setAvg(averages(all, today)); })
      .catch(() => { if (active) setAvg(averages([], today)); });
    return () => { active = false; };
  }, [session, today]);

  const full = money(amount);
  const target = r2(full - paidSoFar);
  const firstIdx = first === 'now' ? cur : cur + 1;
  const N = mode === 'date' && date ? monthIdx(date) - firstIdx + 1 : null;
  let err = null;
  if (N != null && N < 1) err = 'Das Datum liegt vor der ersten Rate.';
  if (full > 0 && target <= 0) err = 'Mit dem schon Gesparten ist das Ziel erreicht.';
  const valid1 = Boolean(name.trim()) && full > 0 && !err && (mode === 'nodate' || (date && N >= 1));
  const missing = missingHint([['Name', !name.trim()], ['Zielbetrag', !(full > 0)], ['Datum', mode === 'date' && !date]]);

  const avail = avg ? avg.uebrig : 0;
  const sg = useMemo(
    () => (valid1 ? suggestions({ target, mode, date, firstIdx, avail }) : { opts: [], note: null }),
    [valid1, target, mode, date, firstIdx, avail],
  );
  const co = customOption({ target, rate: money(customRate), rhythm: customRhythm, firstIdx, avail, mode, date });
  const defaultKey = sg.opts.length ? (mode === 'nodate' && sg.opts[1] ? sg.opts[1].key : sg.opts[0].key) : null;
  const activeKey = choice === 'custom' || sg.opts.some((o) => o.key === choice) ? choice : (defaultKey || (showCustom || !sg.opts.length ? 'custom' : null));
  const chosen = activeKey === 'custom' ? co : sg.opts.find((o) => o.key === activeKey) || null;

  function quickDate(months) { setDate(lastDayOfIdx(firstIdx + months - 1)); setChoice(null); }

  async function save() {
    if (!chosen || saving) return;
    setSaving(true);
    try {
      const planned = scheduleRates(chosen.months, chosen.amounts, dueDay, today);
      await finData.saveSavingsPlan(session, {
        id: plan?.id,
        name,
        target_amount: full,
        target_date: mode === 'date' ? date : null,
        rhythm: chosen.rhythm,
        rate: chosen.rate,
        due_day: dueDay,
      }, planned);
      notifySaved();
      const openNow = planned.some((r) => monthIdx(r.due_date) === cur);
      showToast(openNow ? 'Sparplan gespeichert · erste Rate ist offen' : 'Sparplan gespeichert');
      onSaved?.();
      onClose();
    } catch (e) {
      console.error(e);
      showToast('Speichern fehlgeschlagen');
      setSaving(false);
    }
  }

  const title = plan ? 'Sparplan ändern' : 'Neuer Sparplan';

  // ── Schritt 3: Prüfen ──
  if (step === 3 && chosen) {
    const planned = scheduleRates(chosen.months, chosen.amounts, dueDay, today);
    const firstDue = planned[0].due_date;
    const lastAmount = chosen.amounts[chosen.amounts.length - 1];
    const n = chosen.amounts.length;
    return (
      <SheetShell onClose={onClose} wizard>
        <WizardFrame
          title={plan ? 'Änderung prüfen' : 'Sparplan prüfen'}
          sub="Schritt 3 von 3 · Bitte kontrollieren"
          step={3}
          total={3}
          stepKey="review"
          onBack={() => setStep(2)}
          onClose={onClose}
          footer={(
            <WizardFoot>
              <Button variant="secondary" onClick={() => setStep(1)} disabled={saving}>Ändern</Button>
              <Button onClick={save} disabled={saving}>{saving ? 'Speichert…' : 'Speichern'}</Button>
            </WizardFoot>
          )}
        >
          <div className="wz-review">
            <div className="wz-rv-top"><small>{plan ? 'Rest bis zum Ziel' : 'Ziel'}</small><b>{formatEur(target)}</b><span>{name.trim()}</span></div>
          </div>
          <div className="wz-lbl">Fällig am</div>
          <SegGroup label="Fällig am" value={dueDay} onChange={setDueDay} options={DUE_DAYS} />
          <div className="wz-review spw-review">
            <div className="wz-rv-row"><span>Rate</span><span>{formatEur(chosen.rate)} {n === 1 ? 'einmalig' : chosen.rhythm === 'quarterly' ? 'quartalsweise' : 'monatlich'}</span></div>
            <div className="wz-rv-row"><span>Raten</span><span>{n}</span></div>
            <div className="wz-rv-row"><span>Erste Rate</span><span>{fmtDay(firstDue)}{firstDue === today ? ' (heute)' : ''}</span></div>
            <div className="wz-rv-row"><span>Letzte Rate</span><span>{fmtDay(planned[n - 1].due_date)}</span></div>
            <div className="wz-rv-row"><span>Einzahlung</span><span>ins Sparschwein</span></div>
            <div className="wz-rv-row"><span>Fällige Rate</span><span>als offener Posten</span></div>
          </div>
          {lastAmount !== chosen.rate && (
            <p className="wz-rv-note">Die letzte Rate ist {formatEur(lastAmount)} und gleicht den Rest aus.</p>
          )}
        </WizardFrame>
      </SheetShell>
    );
  }

  // ── Schritt 2: Plan wählen ──
  if (step === 2) {
    return (
      <SheetShell onClose={onClose} wizard>
        <WizardFrame
          title={title}
          sub="Schritt 2 von 3 · Plan wählen"
          step={2}
          total={3}
          stepKey="plan"
          onBack={() => setStep(1)}
          onClose={onClose}
          footer={(
            <WizardFoot hint={!chosen && activeKey === 'custom' ? 'Noch nötig: Rate' : ''}>
              <Button variant="secondary" onClick={() => setStep(1)}>Zurück</Button>
              <Button disabled={!chosen} onClick={() => setStep(3)}>Weiter</Button>
            </WizardFoot>
          )}
        >
          <div className="spw-avg">
            <div className="spw-avg-h">{avg ? avg.label : 'Durchschnitt wird berechnet …'}</div>
            <div className="spw-avg-g">
              <div><small>Einnahmen</small><b>{avg ? eur0(avg.ein) : '—'}</b></div>
              <div><small>Ausgaben</small><b>{avg ? eur0(avg.aus) : '—'}</b></div>
              <div><small>Übrig</small><b className={avail > 0 ? 'pos' : 'neg'}>{avg ? eur0(avail) : '—'}</b></div>
            </div>
          </div>
          <div className="wz-lbl">Vorschläge für {formatEur(target)} {mode === 'date' ? `bis ${fmtDay(date)}` : 'ohne Datum'}</div>
          {sg.note && <p className="wz-hint">{sg.note}</p>}
          {sg.opts.map((o) => (
            <Option key={o.key} o={o} on={activeKey === o.key} onPick={() => setChoice(o.key)} />
          ))}
          {showCustom || !sg.opts.length ? (
            <Option o={co || { key: 'custom', title: 'Eigener Plan', amounts: [], months: [], rate: 0 }} on={activeKey === 'custom'} onPick={() => setChoice('custom')}>
              <div className="spw-custom" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()} role="presentation">
                <label className="wz-amount spw-custom-amt">
                  <input
                    type="text" inputMode="decimal" autoComplete="off" placeholder="Rate" aria-label="Eigene Rate"
                    value={customRate}
                    onFocus={() => setChoice('custom')}
                    onChange={(e) => { setCustomRate(e.target.value.replace(/[^\d.,]/g, '')); setChoice('custom'); }}
                  />
                  <span>€</span>
                </label>
                <SegGroup
                  label="Rhythmus"
                  value={customRhythm}
                  onChange={(v) => { setCustomRhythm(v); setChoice('custom'); }}
                  options={[{ value: 'monthly', label: 'Monatlich' }, { value: 'quarterly', label: 'Quartal' }]}
                />
              </div>
            </Option>
          ) : (
            <button type="button" className="wz-link" onClick={() => { setShowCustom(true); setChoice('custom'); }}>+ Eigenen Plan festlegen</button>
          )}
        </WizardFrame>
      </SheetShell>
    );
  }

  // ── Schritt 1: Ziel ──
  const firstOptions = [
    { value: 'now', label: MONTHS_LONG[idxToYM(cur).m - 1] },
    { value: 'next', label: MONTHS_LONG[idxToYM(cur + 1).m - 1] },
  ];
  let hint = '';
  if (err) hint = err;
  else if (mode === 'date' && date && N >= 1) hint = `${N} ${N === 1 ? 'Monat' : 'Monate'} mit Rate: ${monthLabel(firstIdx)} bis ${monthLabel(monthIdx(date))}.`;
  else if (mode === 'nodate') hint = 'Die App schlägt dir ein Tempo vor.';

  return (
    <SheetShell onClose={onClose} wizard>
      <WizardFrame
        title={title}
        sub="Schritt 1 von 3 · Ziel"
        step={1}
        total={3}
        stepKey="goal"
        onClose={onClose}
        footer={(
          <WizardFoot one hint={missing}>
            <Button disabled={!valid1} onClick={() => setStep(2)}>Weiter</Button>
          </WizardFoot>
        )}
      >
        <label className="wz-lbl" htmlFor="spw-name">Name</label>
        <input
          id="spw-name" className="wz-input hero" type="text" autoComplete="off" enterKeyHint="next"
          value={name} onChange={(e) => setName(e.target.value)} placeholder="z.B. Urlaub"
        />

        <label className="wz-lbl" htmlFor="spw-amount">Zielbetrag</label>
        <div className="wz-amount">
          <input
            id="spw-amount" type="text" inputMode="decimal" autoComplete="off" enterKeyHint="done"
            value={amount} onChange={(e) => { setAmount(e.target.value.replace(/[^\d.,]/g, '')); setChoice(null); }} placeholder="0,00"
          />
          <span>€</span>
        </div>
        {plan && <p className="wz-hint">Schon gespart: {formatEur(paidSoFar)}. Die Vorschläge rechnen mit dem Rest.</p>}

        <div className="wz-lbl">Bis wann</div>
        <SegGroup
          label="Bis wann"
          value={mode}
          onChange={(v) => { setMode(v); setChoice(null); }}
          options={[{ value: 'date', label: 'Bis Datum' }, { value: 'nodate', label: 'Ohne Datum' }]}
        />
        {mode === 'date' && (
          <>
            <div className="spw-date">
              <DateButton value={date} onChange={(v) => { setDate(v); setChoice(null); }} placeholder="Datum wählen" label="Zieldatum" />
            </div>
            <div className="spw-quick" role="group" aria-label="Schnellwahl">
              {QUICK.map(([m, label]) => (
                <button
                  key={m}
                  type="button"
                  className={`wz-chip${date === lastDayOfIdx(firstIdx + m - 1) ? ' on' : ''}`}
                  onClick={() => quickDate(m)}
                >
                  {label}
                </button>
              ))}
            </div>
          </>
        )}

        <div className="wz-lbl">Erste Rate</div>
        <SegGroup label="Erste Rate" value={first} onChange={(v) => { setFirst(v); setChoice(null); }} options={firstOptions} />
        {hint && <p className={`wz-hint${err ? ' err' : ''}`}>{hint}</p>}
      </WizardFrame>
    </SheetShell>
  );
}
