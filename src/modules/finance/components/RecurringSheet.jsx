// modules/finance/components/RecurringSheet.jsx
//
// Ein Fenster für alle laufenden Einträge der Seite "Verträge":
//   einnahme  → Vorlage mit Kategorie fixeinnahmen   (fin_fixtemplates)
//   fixkosten → Vorlage mit Kategorie fixkosten      (fin_fixtemplates, bucht jeden Monat)
//   vertrag   → Vorlage mit Kategorie fixkosten und is_contract (bucht genau wie Fixkosten,
//               dazu Kündigung und Notiz). Ältere Verträge aus fin_contracts werden beim
//               Speichern als Vorlage übernommen (legacyContractId).
//
// Neu anlegen: "Einnahme hinzufügen" (kind = einnahme) oder "Hinzufügen" mit Art-Auswahl
// Fixkosten | Vertrag (choose). Bearbeiten: die Art steht fest, dazu "Löschen".
// Ersetzt FixTemplateModal und ContractModal; die Felder sind dieselben.

import { useState } from 'react';
import { INTERVALS, PAYMENTS, MONTHS_DE, addMonthsClamped, dueDateFor } from '../lib/finance';
import SheetShell from '../../../core/components/SheetShell';
import { ChipGroup, DateButton, SegGroup, WizardFoot, WizardFrame } from '../../../core/components/wizard/WizardKit';
import { parseMoney } from '../../../core/lib/wizardDates';
import { IconContract, IconFixed } from './ContractIcons';
import { formatMoney } from '../../../core/lib/format';

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
  onSaveTemplate, onDelete, onClose, showToast,
}) {
  const editing = Boolean(item);
  const [kind, setKind] = useState(editing
    ? (itemType === 'contract' || item.is_contract ? 'vertrag' : (item.category === 'fixeinnahmen' ? 'einnahme' : 'fixkosten'))
    : initialKind);

  const [name,    setName]    = useState(item?.name || '');
  const [payment, setPayment] = useState(item?.payment || 'Bank');
  const [amount,  setAmount]  = useState(fmtNum(item?.amount));
  // Fälligkeit als Datum im Kalender (optional); gespeichert wird der Tag im Monat (due_day)
  const [dueDate, setDueDate] = useState(item?.due_day ? dueDateFor(item.due_day, currentYear, currentMonth) : '');
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
  // Einnahme: Eingang jeden Monat am selben Tag (Fix) oder unterschiedlich. Fix = Tag gesetzt (due_day);
  // der Eingang wird dann ab diesem Tag bestätigt (lib/income.js).
  const isIncome     = kind === 'einnahme';
  const [incomeMode, setIncomeMode] = useState(item ? (item.due_day ? 'fix' : 'varies') : 'fix');
  const isRecurring  = interval !== 'monthly';
  const intervalMths = INTERVALS[interval]?.months ?? 1;
  const amtNum       = parseMoney(amount) || 0;
  const monthlyHint  = intervalMths > 1 ? `≈ ${formatMoney(amtNum / intervalMths)}/Mo.` : null;

  const title = editing
    ? { einnahme: 'Einnahme bearbeiten', fixkosten: 'Fixkosten bearbeiten', vertrag: 'Vertrag bearbeiten' }[kind]
    : (choose ? 'Hinzufügen' : 'Einnahme hinzufügen');

  function submit() {
    if (!name.trim()) return showToast('Bitte Name eingeben');
    const amt = parseMoney(amount);
    if (Number.isNaN(amt) || amt < 0) return showToast('Bitte gültigen Betrag eingeben');
    if (isIncome && incomeMode === 'fix' && !dueDate) return showToast('Bitte den Tag des Eingangs wählen');
    const dd = (isIncome && incomeMode === 'varies') ? null : (dueDate ? parseInt(dueDate.slice(8, 10), 10) : null);

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

    // Ein älterer Vertrag (fin_contracts) wird als neue Vorlage gespeichert; seine
    // Felder werden dabei nicht übernommen (andere Tabelle, andere Spalten).
    const legacy = itemType === 'contract';
    return onSaveTemplate({
      ...(item && !legacy ? item : {}),
      ...(legacy ? { legacyContractId: item.id } : {}),
      ...(isContract ? { is_contract: true, cancellation: cancellation.trim() || null, notes: notes.trim() || null } : {}),
      category: isContract ? 'fixkosten' : CATEGORY_OF[kind],
      name: name.trim(), payment, amount: amt, interval,
      quarterly: interval === 'quarterly',
      start_month: isRecurring ? startMonth : null,
      start_year:  isRecurring ? ((!legacy && item?.start_year) || currentYear) : null,
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
  const dueDay = dueDate ? parseInt(dueDate.slice(8, 10), 10) : null;
  // Gespeichert wird nur der Tag; die Anzeige bleibt im laufenden Monat (auch bei einem Tag aus einem anderen Monat)
  const pickDueDate = (iso) => setDueDate(iso ? dueDateFor(parseInt(iso.slice(8, 10), 10), currentYear, currentMonth) : '');

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
                  <span className="rf-ic"><IconContract /></span><b>Vertrag</b><small>Bucht wie Fixkosten, mit Kündigung</small>
                </button>
              </div>
            </>
          )}

          <label className="wz-lbl" htmlFor="rf-name">Name</label>
          <input id="rf-name" className="wz-input hero" type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder={namePh} autoComplete="off" />

          <label className="wz-lbl" htmlFor="rf-amount">Betrag (€)</label>
          <input id="rf-amount" className="wz-input" type="text" inputMode="decimal" value={amount}
            onChange={(e) => setAmount(e.target.value.replace(/[^\d.,]/g, ''))} placeholder="0,00" autoComplete="off" />
          {monthlyHint ? <div className="rf-hint">{monthlyHint}</div> : null}

          {isIncome ? (
            <>
              <div className="wz-lbl">Eingang</div>
              <SegGroup
                label="Eingang"
                value={incomeMode}
                onChange={setIncomeMode}
                options={[{ value: 'fix', label: 'Jeden Monat am selben Tag' }, { value: 'varies', label: 'Unterschiedlich' }]}
              />
              {incomeMode === 'fix' ? (
                <>
                  <div className="wz-lbl">Tag des Eingangs</div>
                  <DateButton value={dueDate} onChange={pickDueDate} placeholder="Tag wählen" label="Tag des Eingangs" />
                  <div className="rf-hint">{dueDay ? `Ab dem ${dueDay}. jedes Monats kannst du den Eingang bestätigen.` : 'Der Knopf „Eingang bestätigen“ erscheint ab diesem Tag.'}</div>
                </>
              ) : (
                <div className="rf-hint">Der Knopf „Eingang bestätigen“ ist immer sichtbar, einmal pro Monat. Du bestätigst, wenn das Geld da ist.</div>
              )}
            </>
          ) : (
            <>
              <div className="wz-lbl">Fällig am <span className="opt">optional</span></div>
              <DateButton value={dueDate} onChange={pickDueDate} optional placeholder="Datum wählen" label="Fällig am" />
              {dueDay ? <div className="rf-hint">{isRecurring ? `Am ${dueDay}. des Fälligkeitsmonats` : `Jeden Monat am ${dueDay}.`}</div> : null}
            </>
          )}

          <div className="wz-lbl">Zahlungsart</div>
          <ChipGroup options={PAYMENTS} value={payment} onChange={setPayment} label="Zahlungsart" />

          <div className="rf-card">
            <div className="wz-lbl">Zahlungsintervall</div>
            <ChipGroup options={INTERVAL_OPTIONS} value={interval} onChange={setInterval} label="Zahlungsintervall" />
            {isRecurring && (
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
