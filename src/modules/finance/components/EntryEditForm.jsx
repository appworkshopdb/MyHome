// modules/finance/components/EntryEditForm.jsx
//
// Posten bearbeiten — im selben Aufbau wie "Neuer Eintrag" (EntrySheet.jsx):
// Name, Betrag, Wechselregler Kategorie und Zahlungsart, "Mehr Details" mit
// Fällig am, Zahlung aufteilen und Notiz. Dieselben Bausteine (WizardKit).
//
// Anders als beim Anlegen: ein Schritt (kein Fortschritt, kein Zurück), dazu
//  - Status Offen | Bezahlt (nur bei Ausgaben),
//  - je Teilzahlung ein Haken "bezahlt" (Bar, Gutschein, Sparschwein gelten
//    sofort als bezahlt und sind fest gesetzt, core/lib/paymentParts.js),
//  - Herkunft und "Eintrag löschen" unter "Mehr Details".
//
// Teilzahlungen im Entwurf: parts = [erste, …weitere, letzte]. Die letzte
// bekommt wie beim Anlegen immer den Rest vom Gesamtbetrag.

import { useRef, useState } from 'react';
import { DateButton, MoreButton, SegGroup, WheelPicker, WizardFoot, WizardFrame, missingHint } from '../../../core/components/wizard/WizardKit';
import { IconCheck, IconTrash } from '../../../core/components/Icons';
import { parseMoney } from '../../../core/lib/wizardDates';
import {
  PAYMENTS, formatDateTime, formatEur, isInstantMethod, isSparschweinDeposit, entryParts,
} from '../lib/finance';

const money = (v) => parseMoney(v) || 0; // ungültig → 0
const INCOME = new Set(['fixeinnahmen', 'sonstige_einnahmen']);

// Fünf Einträge: wie beim Anlegen, dazu "Fixeinnahme" (Posten aus Vorlagen behalten ihre Art)
const CATEGORY_ITEMS = [
  { value: 'fixeinnahmen',       label: 'Fixeinnahme' },
  { value: 'sonstige_einnahmen', label: 'Einnahme'    },
  { value: 'fixkosten',          label: 'Fixkosten'   },
  { value: 'variable_kosten',    label: 'Variable'    },
  { value: 'sonstige_ausgaben',  label: 'Sonstige'    },
];

const NF = new Intl.NumberFormat('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// Entwurf der Zahlungen: Betrag als Text (letzte Zeile ignoriert ihn, sie ist der Rest)
function initialParts(entry) {
  const ps = entryParts(entry);
  return ps.map((p, i) => ({
    method: p.method,
    amount: i === ps.length - 1 ? '' : String(p.amount ?? '').replace('.', ','),
    paid: !!p.paid,
  }));
}

const isPaidFlag = (p) => isInstantMethod(p.method) || !!p.paid;

export default function EntryEditForm({ entry, focus = null, onClose, onSave, onDelete, showToast }) {
  const [name, setName] = useState(entry.name || '');
  const [amount, setAmount] = useState(entry.amount != null ? String(entry.amount).replace('.', ',') : '');
  const [category, setCategory] = useState(entry.category);
  const [parts, setParts] = useState(() => initialParts(entry));
  const [dueDate, setDueDate] = useState(entry.due_date ? String(entry.due_date).slice(0, 10) : '');
  const [note, setNote] = useState(entry.note || '');
  const [showMore, setShowMore] = useState(() => (
    focus === 'due' || focus === 'note'
    || Boolean(entry.due_date || entry.note) || (Array.isArray(entry.payments) && entry.payments.length > 1)
  ));
  const [saving, setSaving] = useState(false);
  const noteRef = useRef(null);

  const split = parts.length > 1;
  const canPay = !INCOME.has(category) && !isSparschweinDeposit({ category, name });
  const amountNum = money(amount);
  const last = parts.length - 1;

  // Beträge: alle außer der letzten Teilzahlung getippt, die letzte ist der Rest
  const typed = parts.slice(0, -1).map((p) => money(p.amount));
  const restNum = amountNum - typed.reduce((a, b) => a + b, 0);
  const resolved = split
    ? parts.map((p, i) => ({ method: p.method, amount: i === last ? Math.max(0, restNum) : typed[i], paid: isPaidFlag(p) }))
    : [{ method: parts[0].method, amount: amountNum, paid: isPaidFlag(parts[0]) }];

  const methods = parts.map((p) => p.method);
  const baseValid = Boolean(name.trim()) && amountNum > 0;
  const splitValid = !split || (
    typed.every((n) => n > 0) && restNum > 0.004 && new Set(methods).size === methods.length
  );
  const valid = baseValid && splitValid;
  const hint = !baseValid
    ? missingHint([['Name', !name.trim()], ['Betrag', !(amountNum > 0)]])
    : (!splitValid ? 'Teilbeträge müssen zusammen kleiner als der Betrag sein, die Zahlungsarten verschieden' : '');

  const fully = resolved.every((p) => p.paid);
  const partly = !fully && resolved.some((p) => p.paid);
  const allInstant = resolved.every((p) => isInstantMethod(p.method));
  const openSum = resolved.filter((p) => !p.paid).reduce((s, p) => s + p.amount, 0);

  const patchPart = (i, patch) => setParts((ps) => ps.map((p, j) => (j === i ? { ...p, ...patch } : p)));

  // Zahlungsart einer Teilzahlung ändern: sofort bezahlte Art → bezahlt; von sofort bezahlt weg → offen
  function setMethod(i, method) {
    setParts((ps) => ps.map((p, j) => {
      if (j !== i) return p;
      const paid = isInstantMethod(method) ? true : (isInstantMethod(p.method) ? false : !!p.paid);
      return { ...p, method, paid };
    }));
  }

  function setAllPaid(paid) {
    setParts((ps) => ps.map((p) => ({ ...p, paid: isInstantMethod(p.method) ? true : paid })));
  }

  function toggleSplit() {
    if (split) {
      setParts((ps) => [{ ...ps[0], amount: '', paid: ps.every(isPaidFlag) || !!ps[0].paid }]);
      return;
    }
    setShowMore(true);
    setParts((ps) => {
      const first = ps[0];
      const second = first.method === 'Bar' ? (PAYMENTS.find((p) => p !== 'Bar') || 'Bank') : 'Bar';
      return [
        { ...first, amount: amountNum > 0 ? String(Math.round((amountNum / 2) * 100) / 100).replace('.', ',') : '' },
        { method: second, amount: '', paid: isInstantMethod(second) },
      ];
    });
  }

  function addMid() {
    const used = new Set(methods);
    const method = PAYMENTS.find((p) => !used.has(p));
    if (!method) return;
    setParts((ps) => [...ps.slice(0, -1), { method, amount: '', paid: isInstantMethod(method) }, ps[ps.length - 1]]);
  }
  const removeMid = (i) => setParts((ps) => ps.filter((_, j) => j !== i));

  async function submit() {
    if (!valid || saving) return;
    setSaving(true);
    try {
      await onSave({
        ...entry,
        category,
        name: name.trim(),
        payments: resolved,
        payment: resolved[0].method, // Abwärtskompatibilität (altes Einzelfeld)
        amount: amountNum,
        paid: resolved.every((p) => p.paid),
        note: note.trim() || null,
        due_date: dueDate || null,
      });
    } catch (e) {
      console.error(e);
      showToast('Speichern fehlgeschlagen');
      setSaving(false);
    }
  }

  const rowCls = `ed-prow${canPay ? '' : ' ed-prow--nochk'}`;
  const check = (i) => {
    if (!canPay) return null;
    const p = parts[i];
    const instant = isInstantMethod(p.method);
    const on = isPaidFlag(p);
    return (
      <button
        type="button" role="checkbox" aria-checked={on} aria-label={`${p.method} bezahlt`}
        disabled={instant} className={`ed-pk${on ? ' is-paid' : ''}`}
        onClick={() => patchPart(i, { paid: !p.paid })}
      >
        <span className="ed-box" aria-hidden="true">{on && <IconCheck />}</span>
      </button>
    );
  };
  const methodSelect = (i, label) => (
    <select className="wz-input" value={parts[i].method} onChange={(e) => setMethod(i, e.target.value)} aria-label={label}>
      {PAYMENTS.filter((p) => p === parts[i].method || !methods.includes(p)).map((p) => <option key={p} value={p}>{p}</option>)}
    </select>
  );

  return (
    <WizardFrame
      title="Posten bearbeiten"
      sub={entry.created_at ? `Erfasst am ${formatDateTime(entry.created_at)}` : undefined}
      stepKey="edit"
      onClose={onClose}
      footer={(
        <WizardFoot hint={hint}>
          <MoreButton open={showMore} onClick={() => setShowMore((o) => !o)} />
          <button type="button" className="btn btn-primary" disabled={!valid || saving} onClick={submit}>
            {saving ? 'Speichert…' : 'Speichern'}
          </button>
        </WizardFoot>
      )}
    >
      <label className="wz-lbl" htmlFor="ed-name">Name</label>
      <input
        id="ed-name" className="wz-input hero" type="text" value={name} autoComplete="off" enterKeyHint="next"
        onChange={(e) => setName(e.target.value)} placeholder="z.B. Tanken"
      />

      <label className="wz-lbl" htmlFor="ed-amount">Betrag</label>
      <div className="wz-amount">
        <input
          id="ed-amount" type="text" inputMode="decimal" autoComplete="off" enterKeyHint="done"
          value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^\d.,]/g, ''))} placeholder="0,00"
        />
        <span>€</span>
      </div>

      <div className="wz-two" style={{ marginTop: 16 }}>
        <div>
          <div className="wz-col-lbl">Kategorie</div>
          <WheelPicker items={CATEGORY_ITEMS} value={category} onChange={setCategory} label="Kategorie" />
        </div>
        <div>
          <div className="wz-col-lbl">Zahlungsart</div>
          <WheelPicker items={PAYMENTS} value={parts[0].method} onChange={(m) => setMethod(0, m)} label="Zahlungsart" />
        </div>
      </div>

      {canPay && (
        <>
          <div className="wz-lbl">Status</div>
          {allInstant ? (
            <p className="wz-hint" style={{ marginTop: 0 }}>Bezahlt · Bar, Gutschein und Sparschwein gelten sofort als bezahlt</p>
          ) : (
            <>
              <SegGroup
                label="Status"
                value={fully ? 'paid' : partly ? '' : 'open'}
                onChange={(v) => setAllPaid(v === 'paid')}
                options={[{ value: 'open', label: 'Offen' }, { value: 'paid', label: 'Bezahlt' }]}
              />
              {partly && <p className="wz-hint ed-warn">Teilweise bezahlt · {formatEur(openSum)} noch offen</p>}
            </>
          )}
        </>
      )}

      {showMore && (
        <>
          <div className="wz-lbl">Fällig am <span className="opt">optional</span></div>
          <DateButton value={dueDate} onChange={setDueDate} optional placeholder="Datum wählen" label="Fällig am" />

          <button type="button" className="wz-link" onClick={toggleSplit}>
            {split ? '⚖ Aufteilung entfernen' : '⚖ Zahlung aufteilen'}
          </button>
          {split && (
            <div className="wz-parts">
              <div className={rowCls}>
                <div className="wz-input wz-part-method">{parts[0].method}</div>
                <label className="wz-input wz-part-amt">
                  <input
                    type="text" inputMode="decimal" aria-label={`Teilbetrag ${parts[0].method}`}
                    value={parts[0].amount} onChange={(e) => patchPart(0, { amount: e.target.value.replace(/[^\d.,]/g, '') })}
                  />
                  <span>€</span>
                </label>
                {check(0)}
              </div>
              {parts.slice(1, -1).map((p, k) => {
                const i = k + 1;
                return (
                  <div className={rowCls} key={i}>
                    {methodSelect(i, `Zahlungsart ${i + 1}`)}
                    <div className="wz-input wz-part-amt">
                      <input
                        type="text" inputMode="decimal" aria-label={`Teilbetrag ${p.method}`}
                        value={p.amount} onChange={(e) => patchPart(i, { amount: e.target.value.replace(/[^\d.,]/g, '') })}
                      />
                      <span>€</span>
                      <button type="button" className="wz-part-rm" onClick={() => removeMid(i)} aria-label={`${p.method} entfernen`}>×</button>
                    </div>
                    {check(i)}
                  </div>
                );
              })}
              <div className={rowCls}>
                {methodSelect(last, 'Letzte Zahlungsart')}
                <div className="wz-input wz-part-amt wz-part-rest">Rest {NF.format(Math.max(0, restNum))} €</div>
                {check(last)}
              </div>
              {parts.length < PAYMENTS.length && (
                <button type="button" className="wz-link wz-part-add" onClick={addMid}>+ Weitere Teilzahlung</button>
              )}
            </div>
          )}

          <label className="wz-lbl" htmlFor="ed-note" style={{ marginTop: 14 }}>Notiz <span className="opt">optional</span></label>
          <textarea
            id="ed-note" ref={noteRef} className="wz-input" value={note} autoFocus={focus === 'note'}
            onChange={(e) => setNote(e.target.value)} placeholder="Zusatzinfo…"
          />

          <div className="ed-ro2">
            <span>Herkunft</span>
            <b>{entry.from_template ? 'Festposten (aus Vorlage)' : 'Einzelbuchung'}</b>
          </div>
          <button type="button" className="btn btn-danger btn-block ed-del2" onClick={() => onDelete(entry.id)} disabled={saving}>
            <IconTrash size={18} /> Eintrag löschen
          </button>
        </>
      )}
    </WizardFrame>
  );
}
