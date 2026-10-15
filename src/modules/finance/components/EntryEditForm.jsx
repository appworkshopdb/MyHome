// modules/finance/components/EntryEditForm.jsx
//
// Bearbeiten-Ansicht im selben Sheet wie die Posten-Ansicht (EntryDetailSheet):
// Kategorie, Betrag, Name, Zahlungsart(en), Status, Fälligkeit und Notiz sind
// direkt änderbar. "Speichern" kehrt in die Ansicht zurück, "Abbrechen"
// verwirft die Änderungen.
//
// Bezahlt-Status: Bar, Gutschein und Sparschwein gelten sofort als bezahlt
// (der Schalter ist dann gesperrt). Sonst entscheidet der Nutzer selbst; ein
// schon abgehakter Posten bleibt abgehakt, solange man ihn nicht ändert.

import { useEffect, useRef, useState } from 'react';
import PaymentsEditor from '../../../core/components/PaymentsEditor';
import { isInstantPaid, isSparschweinDeposit } from '../lib/finance';

const CATS = [
  { key: 'sonstige_einnahmen', label: 'Einnahme' },
  { key: 'fixkosten',          label: 'Fixkosten' },
  { key: 'variable_kosten',    label: 'Variable' },
  { key: 'sonstige_ausgaben',  label: 'Sonstige' },
];
const INCOME = new Set(['fixeinnahmen', 'sonstige_einnahmen']);

function initialPayments(entry) {
  if (Array.isArray(entry.payments) && entry.payments.length > 0) return entry.payments;
  if (entry.payment) return [{ method: entry.payment, amount: null }];
  return [{ method: 'Bank', amount: null }];
}

export default function EntryEditForm({ entry, focus, onCancel, onSave, onDelete, showToast }) {
  const [category, setCategory] = useState(entry.category);
  const [name, setName] = useState(entry.name || '');
  const [amount, setAmount] = useState(entry.amount != null ? String(entry.amount).replace('.', ',') : '');
  const [payments, setPayments] = useState(() => initialPayments(entry));
  const [dueDate, setDueDate] = useState(entry.due_date || '');
  const [note, setNote] = useState(entry.note || '');
  const [saving, setSaving] = useState(false);

  // Schon abgehakt? Gilt nur dann als eigene Entscheidung, wenn der Posten nicht
  // ohnehin durch eine sofort bezahlte Zahlungsart als bezahlt galt.
  const [paidDraft, setPaidDraft] = useState(
    () => !!entry.paid && !isInstantPaid(initialPayments(entry)),
  );

  const noteRef = useRef(null);
  const dueRef = useRef(null);
  const payRef = useRef(null);

  // Tipp auf "+ Notiz hinzufügen" / "Fällig am" / "Zahlungsart" in der Ansicht
  // springt direkt zum passenden Feld.
  useEffect(() => {
    const el = { note: noteRef.current, due: dueRef.current, payment: payRef.current }[focus];
    if (!el) return;
    el.scrollIntoView({ block: 'center' });
    if (focus !== 'payment') el.focus({ preventScroll: true });
  }, [focus]);

  const amountNorm = String(amount).replace(',', '.');
  const canPay = !INCOME.has(category) && !isSparschweinDeposit({ category, name });
  const instant = isInstantPaid(payments);
  const paid = canPay ? instant || paidDraft : !!entry.paid;

  const cats = entry.category === 'fixeinnahmen'
    ? [{ key: 'fixeinnahmen', label: 'Fixeinnahme' }, ...CATS]
    : CATS;

  async function submit() {
    if (!name.trim()) return showToast('Bitte Name eingeben');
    const amt = parseFloat(amountNorm);
    if (isNaN(amt) || amt < 0) return showToast('Bitte gültigen Betrag eingeben');

    // Zahlungen auflösen: der letzte Eintrag bekommt den Rest vom Gesamtbetrag
    const resolved = payments.length === 1
      ? [{ method: payments[0].method, amount: amt }]
      : payments.map((p, idx) => {
        if (idx === payments.length - 1) {
          const others = payments.slice(0, -1).reduce((s, pp) => s + (parseFloat(pp.amount) || 0), 0);
          return { method: p.method, amount: Math.max(0, amt - others) };
        }
        return { method: p.method, amount: parseFloat(p.amount) || 0 };
      });

    setSaving(true);
    try {
      await onSave({
        ...entry,
        category,
        name: name.trim(),
        payments: resolved,
        payment: resolved[0].method, // Abwärtskompatibilität (altes Einzelfeld)
        amount: amt,
        paid,
        note: note.trim() || null,
        due_date: dueDate || null,
      });
    } catch (e) {
      console.error(e);
      showToast('Speichern fehlgeschlagen');
      setSaving(false);
    }
  }

  return (
    <div className="ed-root">
      <div className="ed-top">
        <b className="ed-title">Eintrag bearbeiten</b>
        <button type="button" className="ed-cancel" onClick={onCancel} disabled={saving}>Abbrechen</button>
      </div>

      <div className="ee-cats" role="group" aria-label="Kategorie">
        {cats.map((c) => (
          <button
            key={c.key} type="button"
            className={category === c.key ? 'is-on' : ''}
            aria-pressed={category === c.key}
            onClick={() => setCategory(c.key)}
          >
            {c.label}
          </button>
        ))}
      </div>

      <div className="ee-hero">
        <label className="ee-lbl" htmlFor="ee-amount">Betrag</label>
        <div className="ee-amt">
          <input
            id="ee-amount" type="text" inputMode="decimal" autoComplete="off"
            style={{ width: `${Math.max(4, amount.length)}ch` }}
            value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0,00"
          />
          <span>€</span>
        </div>
        <input
          className="ee-name" type="text" autoComplete="off" aria-label="Name"
          value={name} onChange={(e) => setName(e.target.value)} placeholder="z. B. Miete, Gehalt …"
        />
      </div>

      <div className="ee-card">
        <div className="ee-row" ref={payRef}>
          <div className="ee-lbl">Zahlungsart</div>
          <PaymentsEditor payments={payments} onChange={setPayments} totalAmount={amountNorm} />
        </div>

        {canPay && (
          <div className="ee-row">
            <div className="ee-line">
              <div className="ee-lbl">Status</div>
              <div className="ee-seg" role="group" aria-label="Status">
                <button type="button" className={!paid ? 'is-on' : ''} aria-pressed={!paid} disabled={instant} onClick={() => setPaidDraft(false)}>Offen</button>
                <button type="button" className={paid ? 'is-on' : ''} aria-pressed={paid} disabled={instant} onClick={() => setPaidDraft(true)}>Bezahlt</button>
              </div>
            </div>
            {instant && <p className="ee-hint">Bar, Gutschein und Sparschwein gelten sofort als bezahlt.</p>}
          </div>
        )}

        <div className="ee-row">
          <label className="ee-lbl" htmlFor="ee-due">Fällig am <span className="ee-opt">· optional</span></label>
          <input id="ee-due" ref={dueRef} className="wiz-input" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
        </div>
      </div>

      <div className="ee-note">
        <label className="ee-lbl" htmlFor="ee-note">Notiz <span className="ee-opt">· optional</span></label>
        <textarea
          id="ee-note" ref={noteRef} className="wiz-input wiz-textarea"
          value={note} onChange={(e) => setNote(e.target.value)} placeholder="Zusatzinfo …"
        />
      </div>

      <div className="ed-actions">
        <button type="button" className="ed-edit" onClick={submit} disabled={saving}>Speichern</button>
        <button type="button" className="ed-delete" onClick={() => onDelete(entry.id)} disabled={saving}>Eintrag löschen</button>
      </div>
    </div>
  );
}
