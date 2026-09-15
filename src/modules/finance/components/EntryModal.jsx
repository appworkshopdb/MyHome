import { useState } from 'react';
import { useUi } from '../../../core/lib/UiContext';
import { formatDateTime, isInstantPaid } from '../lib/finance';
import PaymentsEditor from '../../../core/components/PaymentsEditor';
import { IconCalendarSmall, IconTrash } from '../../../core/components/Icons';
import SheetShell from '../../../core/components/SheetShell';

const QUICK_CATS = [
  { key: 'sonstige_einnahmen', label: 'Einnahme'  },
  { key: 'fixkosten',          label: 'Fixkosten' },
  { key: 'variable_kosten',    label: 'Variable'  },
  { key: 'sonstige_ausgaben',  label: 'Sonstige'  },
];

export default function EntryModal({ entry, defaultCategory, onSave, onDelete, onClose, showToast }) {
  const { isDarkActive } = useUi();

  const [category, setCategory] = useState(entry?.category || defaultCategory || 'variable_kosten');
  const [name,     setName]     = useState(entry?.name     || '');
  const [amount,   setAmount]   = useState(entry?.amount   ?? '');
  const [note,     setNote]     = useState(entry?.note     || '');
  const [dueDate,  setDueDate]  = useState(entry?.due_date || '');

  // payments-Array: aus vorhandenem Eintrag laden, Fallback auf altes payment-Feld
  const [payments, setPayments] = useState(() => {
    if (Array.isArray(entry?.payments) && entry.payments.length > 0) {
      return entry.payments;
    }
    if (entry?.payment) return [{ method: entry.payment, amount: null }];
    return [{ method: 'Bank', amount: null }];
  });

  function submit() {
    if (!name.trim()) return showToast('Bitte Name eingeben');
    const amt = parseFloat(String(amount).replace(',', '.'));
    if (isNaN(amt) || amt < 0) return showToast('Bitte gültigen Betrag eingeben');

    // Payments auflösen: letzter Eintrag = Rest vom Gesamtbetrag
    const resolvedPayments = payments.length === 1
      ? [{ method: payments[0].method, amount: amt }]
      : payments.map((p, idx) => {
          if (idx === payments.length - 1) {
            const sumOthers = payments
              .slice(0, -1)
              .reduce((s, pp) => s + (parseFloat(pp.amount) || 0), 0);
            return { method: p.method, amount: Math.max(0, amt - sumOthers) };
          }
          return { method: p.method, amount: parseFloat(p.amount) || 0 };
        });

    onSave({
      ...(entry || {}),
      category,
      name:     name.trim(),
      payments: resolvedPayments,
      payment:  resolvedPayments[0].method, // Abwärtskompatibilität
      amount:   amt,
      paid:     isInstantPaid(resolvedPayments),
      note:     note.trim() || null,
      due_date: dueDate || null,
    });
  }

  return (
    <SheetShell onClose={onClose}>
      <div className="sheet-header">
        <div className="sheet-title t-title">
          {entry ? 'Eintrag bearbeiten' : 'Eintrag hinzufügen'}
        </div>
        <button className="sheet-cancel" onClick={onClose}>Abbrechen</button>
      </div>

      <div className="wiz-body">
        {entry?.created_at && (
          <div className="entry-modal-meta t-meta">
            <IconCalendarSmall />
            Erfasst am {formatDateTime(entry.created_at)}
          </div>
        )}

        <label className="wiz-label t-meta">Kategorie</label>
        <div className="wiz-cat-grid">
          {QUICK_CATS.map((c) => (
            <button
              key={c.key}
              className={`wiz-cat ${category === c.key ? 'active' : ''}`}
              onClick={() => setCategory(c.key)}
            >
              {c.label}
            </button>
          ))}
        </div>

        <label className="wiz-label t-meta" style={{ marginTop: 'var(--space-5)' }}>Name</label>
        <input
          className="wiz-input"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="z.B. Gym, Gehalt…"
          autoComplete="off"
        />

        <label className="wiz-label t-meta" style={{ marginTop: 'var(--space-5)' }}>Betrag (€)</label>
        <input
          className="wiz-input"
          type="number"
          inputMode="decimal"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="0,00"
          min="0"
          step="0.01"
        />

        <label className="wiz-label t-meta" style={{ marginTop: 'var(--space-5)' }}>Zahlungsart</label>
        <PaymentsEditor
          payments={payments}
          onChange={setPayments}
          totalAmount={amount}
        />

        <label className="wiz-label t-meta" style={{ marginTop: 'var(--space-5)' }}>
          Fällig am <span className="wiz-optional">optional</span>
        </label>
        <input
          className="wiz-input"
          type="date"
          value={dueDate}
          onChange={(e) => setDueDate(e.target.value)}
        />

        <label className="wiz-label t-meta" style={{ marginTop: 'var(--space-5)' }}>
          Notiz <span className="wiz-optional">optional</span>
        </label>
        <textarea
          className="wiz-input wiz-textarea"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Zusatzinfo…"
        />
      </div>

      <div className="entry-modal-actions">
        {entry && (
          <button
            className="btn btn-danger"
            style={{ marginRight: 'auto' }}
            onClick={() => onDelete(entry.id)}
          >
            <IconTrash /> Löschen
          </button>
        )}
        <button className="btn btn-secondary" onClick={onClose}>Abbrechen</button>
        <button className="btn btn-primary"   onClick={submit}>Speichern</button>
      </div>
    </SheetShell>
  );
}
