// modules/finance/components/RecurringSheet.jsx
//
// Ein Fenster für alle laufenden Einträge der Seite "Verträge":
//   einnahme  → Vorlage mit Kategorie fixeinnahmen   (fin_fixtemplates)
//   fixkosten → Vorlage mit Kategorie fixkosten      (fin_fixtemplates, bucht jeden Monat)
//   vertrag   → Vertrag                              (fin_contracts, nur Übersicht)
//
// Neu anlegen: "Einnahme hinzufügen" (kind = einnahme) oder "Hinzufügen" mit Art-Auswahl
// Fixkosten | Vertrag (choose). Bearbeiten: die Art steht fest, dazu "Löschen".
// Ersetzt FixTemplateModal und ContractModal; die Felder sind dieselben.

import { useState } from 'react';
import { INTERVALS, PAYMENTS, MONTHS_DE, addMonthsClamped } from '../lib/finance';
import SheetShell from '../../../core/components/SheetShell';
import { ChipGroup, DateButton, WizardFoot, WizardFrame } from '../../../core/components/wizard/WizardKit';
import { parseNum } from '../../../core/lib/wizardDates';
import { IconContract, IconFixed } from './ContractIcons';

const INTERVAL_OPTIONS = Object.entries(INTERVALS).map(([value, { label }]) => ({ value, label }));
const CATEGORY_OF = { einnahme: 'fixeinnahmen', fixkosten: 'fixkosten' };

const fmtNum = (v) => (v === null || v === undefined || v === '' ? '' : String(v).replace('.', ','));

function Switch({ label, sub, on, onChange }) {
  return (
    <div className="rf-sw">
      <span className="rf-sw-t"><b>{label}</b>{sub ? <small>{sub}</small> : null}</span>
      <button type="button" role="switch" aria-checked={on} aria-label={label} className={`rf-switch${on ? ' on' : ''}`} onClick={() => onChange(!on)}><i /></button>
    </div>
  );
}

export default function RecurringSheet({
  kind: initialKind = 'fixkosten',
  choose = false,          // Art-Auswahl Fixkosten | Vertrag (nur beim Neuanlegen)
  item = null,             // bestehende Vorlage oder Vertrag
  itemType = null,         // 'template' | 'contract' (nur beim Bearbeiten)
  currentMonth, currentYear,
  onSaveTemplate, onSaveContract, onDelete, onClose, showToast,
}) {
  const editing = Boolean(item);
  const [kind, setKind] = useState(editing
    ? (itemType === 'contract' ? 'vertrag' : (item.category === 'fixeinnahmen' ? 'einnahme' : 'fixkosten'))
    : initialKind);

  const [name,    setName]    = useState(item?.name || '');
  const [payment, setPayment] = useState(item?.payment || 'Bank');
  const [amount,  setAmount]  = useState(fmtNum(item?.amount));
  const [dueDay,  setDueDay]  = useState(item?.due_day ?? '');
  const initialInterval = item?.interval ?? (item?.quarterly ? 'quarterly' : 'monthly');
  const [interval,   setInterval]   = useState(initialInterval);
  const [startMonth, setStartMonth] = useState(item?.start_month || currentMonth);
  const [startDate,  setStartDate]  = useState(item?.start_date || '');
  const [isOpen,     setIsOpen]     = useState(item?.is_open ?? item?.is_monthly ?? false);
  const [durationMonths, setDurationMonths] = useState(item?.contract_duration_months ?? '');
  const [endDate,    setEndDate]    = useState(item?.end_date || '');
  const [useDuration, setUseDuration] = useState(!!item?.contract_duration_months && !item?.end_date);
  const [cancellation, setCancellation] = useState(item?.cancellation || '');
  const [notes,        setNotes]        = useState(item?.notes || '');

  const isContract   = kind === 'vertrag';
  const isRecurring  = interval !== 'monthly';
  const intervalMths = INTERVALS[interval]?.months ?? 1;
  const amtNum       = parseNum(amount);
  const monthlyHint  = intervalMths > 1 ? `≈ ${(amtNum / intervalMths).toFixed(2).replace('.', ',')} €/Mo.` : null;

  const title = editing
    ? { einnahme: 'Einnahme bearbeiten', fixkosten: 'Fixkosten bearbeiten', vertrag: 'Vertrag bearbeiten' }[kind]
    : (choose ? 'Hinzufügen' : 'Einnahme hinzufügen');

  function submit() {
    if (!name.trim()) return showToast('Bitte Name eingeben');
    const amt = parseNum(amount);
    if (!/\d/.test(amount) || amt < 0) return showToast('Bitte gültigen Betrag eingeben');
    const dd = dueDay !== '' ? parseInt(dueDay, 10) : null;
    if (dd !== null && (Number.isNaN(dd) || dd < 1 || dd > 31)) return showToast('Fälligkeitstag muss zwischen 1 und 31 liegen');

    let contractDurationMonths = null;
    let resolvedEndDate = null;
    if (!isOpen) {
      if (useDuration) {
        const dm = parseInt(durationMonths, 10);
        if (!Number.isNaN(dm) && dm > 0) contractDurationMonths = dm;
      } else {
        resolvedEndDate = endDate || null;
      }
    }

    if (isContract) {
      return onSaveContract({
        ...(item || {}),
        name: name.trim(), amount: amt, interval,
        start_date: startDate || null,
        is_open: isOpen, is_monthly: isOpen,
        end_date: isOpen ? null : resolvedEndDate,
        contract_duration_months: isOpen ? null : contractDurationMonths,
        payment,
        cancellation: cancellation.trim() || null,
        notes: notes.trim() || null,
        quarterly: null,
        due_day: dd,
      });
    }
    return onSaveTemplate({
      ...(item || {}),
      category: CATEGORY_OF[kind],
      name: name.trim(), payment, amount: amt, interval,
      quarterly: interval === 'quarterly',
      start_month: isRecurring ? startMonth : null,
      start_year:  isRecurring ? (item?.start_year || currentYear) : null,
      start_date:  startDate || null,
      is_open:     isOpen,
      end_date:    isOpen ? null : resolvedEndDate,
      contract_duration_months: isOpen ? null : contractDurationMonths,
      due_day:     dd,
    });
  }

  const endLabel   = isContract ? 'Vertragsende' : 'Ende';
  const startLabel = isContract ? 'Vertragsbeginn' : 'Beginn';
  const namePh = isContract ? 'z. B. Gym, Strom, Netflix…' : (kind === 'einnahme' ? 'z. B. Gehalt, Rente…' : 'z. B. Miete, Strom…');
  const dayPh = isContract ? 'z. B. 5' : 'z. B. 1';

  let endDatePreview = null;
  if (useDuration && durationMonths && startDate) {
    const s = new Date(startDate);
    if (!Number.isNaN(s.getTime()) && parseInt(durationMonths, 10) > 0) {
      const end = addMonthsClamped(s, parseInt(durationMonths, 10));
      endDatePreview = end.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
    }
  }

  const footer = editing ? (
    <WizardFoot>
      <button type="button" className="btn btn-danger" onClick={() => onDelete(item.id)}>Löschen</button>
      <button type="button" className="btn btn-primary" onClick={submit}>Speichern</button>
    </WizardFoot>
  ) : (
    <WizardFoot one>
      <button type="button" className="btn btn-primary" onClick={submit}>Speichern</button>
    </WizardFoot>
  );

  return (
    <SheetShell onClose={onClose} wizard>
      <WizardFrame title={title} onClose={onClose} footer={footer} stepKey={kind}>
        <div className="rf-form">
          {choose && !editing && (
            <>
              <div className="wz-lbl">Art</div>
              <div className="rf-types" role="group" aria-label="Art">
                <button type="button" className="rf-type" aria-pressed={kind === 'fixkosten'} onClick={() => setKind('fixkosten')}>
                  <span className="rf-ic"><IconFixed /></span><b>Fixkosten</b><small>Wird jeden Monat gebucht</small>
                </button>
                <button type="button" className="rf-type" aria-pressed={kind === 'vertrag'} onClick={() => setKind('vertrag')}>
                  <span className="rf-ic"><IconContract /></span><b>Vertrag</b><small>Nur zur Übersicht, bucht nichts</small>
                </button>
              </div>
            </>
          )}

          <label className="wz-lbl" htmlFor="rf-name">Name</label>
          <input id="rf-name" className="wz-input hero" type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder={namePh} autoComplete="off" />

          <div className="wz-two rf-gap">
            <div>
              <label className="wz-lbl" htmlFor="rf-amount">Betrag (€)</label>
              <input id="rf-amount" className="wz-input" type="text" inputMode="decimal" value={amount}
                onChange={(e) => setAmount(e.target.value.replace(/[^\d.,]/g, ''))} placeholder="0,00" autoComplete="off" />
              {monthlyHint ? <div className="rf-hint">{monthlyHint}</div> : null}
            </div>
            <div>
              <label className="wz-lbl" htmlFor="rf-day">Fällig am <span className="opt">Tag</span></label>
              <input id="rf-day" className="wz-input" type="text" inputMode="numeric" value={dueDay}
                onChange={(e) => setDueDay(e.target.value.replace(/\D/g, '').slice(0, 2))} placeholder={dayPh} autoComplete="off" />
            </div>
          </div>

          <div className="wz-lbl">Zahlungsart</div>
          <ChipGroup options={PAYMENTS} value={payment} onChange={setPayment} label="Zahlungsart" />

          <div className="rf-card">
            <div className="wz-lbl">Zahlungsintervall</div>
            <ChipGroup options={INTERVAL_OPTIONS} value={interval} onChange={setInterval} label="Zahlungsintervall" />
            {isRecurring && !isContract && (
              <>
                <label className="wz-lbl" htmlFor="rf-month">Startmonat</label>
                <select id="rf-month" className="wz-input" value={startMonth} onChange={(e) => setStartMonth(Number(e.target.value))}>
                  {MONTHS_DE.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
                </select>
                <div className="rf-hint">Erster Fälligkeitsmonat — danach alle {intervalMths} Monate.</div>
              </>
            )}
          </div>

          <div className="rf-card">
            <div className="wz-lbl">{startLabel} <span className="opt">optional</span></div>
            <DateButton value={startDate} onChange={setStartDate} optional placeholder="Datum wählen" label={startLabel} />
            <Switch label="Unbefristet" sub="läuft bis auf Weiteres" on={isOpen} onChange={setIsOpen} />
            {!isOpen && (
              useDuration ? (
                <>
                  <label className="wz-lbl" htmlFor="rf-dur">Laufzeit (Monate)</label>
                  <input id="rf-dur" className="wz-input" type="text" inputMode="numeric" value={durationMonths}
                    onChange={(e) => setDurationMonths(e.target.value.replace(/\D/g, '').slice(0, 3))} placeholder="z. B. 24" autoComplete="off" />
                  {endDatePreview ? <div className="rf-hint">Ende: {endDatePreview}</div> : null}
                  <button type="button" className="rf-link" onClick={() => setUseDuration(false)}>Stattdessen {endLabel} wählen</button>
                </>
              ) : (
                <>
                  <div className="wz-lbl">{endLabel} <span className="opt">optional</span></div>
                  <DateButton value={endDate} onChange={setEndDate} optional placeholder="Datum wählen" label={endLabel} />
                  <button type="button" className="rf-link" onClick={() => setUseDuration(true)}>Oder: Laufzeit in Monaten angeben</button>
                </>
              )
            )}
          </div>

          {isContract && (
            <>
              <label className="wz-lbl" htmlFor="rf-cancel">Kündigungsfrist <span className="opt">optional</span></label>
              <input id="rf-cancel" className="wz-input" type="text" value={cancellation} onChange={(e) => setCancellation(e.target.value)} placeholder="z. B. 4 Wochen zum Monatsende" autoComplete="off" />
              <label className="wz-lbl" htmlFor="rf-notes">Notiz <span className="opt">optional</span></label>
              <input id="rf-notes" className="wz-input" type="text" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="z. B. Kundennummer, Anbieter…" autoComplete="off" />
            </>
          )}
        </div>
      </WizardFrame>
    </SheetShell>
  );
}
