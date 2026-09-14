import { useState } from 'react';
import { useUi } from '../../../core/lib/UiContext';
import { CATEGORIES, PAYMENTS, formatDateTime } from '../lib/finance';
import { IconCalendarSmall, IconTrash } from '../../../core/components/Icons';
import SheetShell from '../../../core/components/SheetShell';

// paid-Logik: Bar, Sparschwein und Gutschein gelten als sofort beglichen.
const INSTANT_PAID = new Set(['Bar', 'Sparschwein', 'Gutschein']);

export default function EntryModal({ entry, defaultCategory, onSave, onDelete, onClose, showToast }) {
  const { isDarkActive } = useUi();

  const [category, setCategory] = useState(entry?.category || defaultCategory || 'variable_kosten');
  const [name,     setName]     = useState(entry?.name     || '');
  const [payment,  setPayment]  = useState(entry?.payment  || 'Bank');
  const [amount,   setAmount]   = useState(entry?.amount   ?? '');
  const [note,     setNote]     = useState(entry?.note     || '');
  const [dueDate,  setDueDate]  = useState(entry?.due_date || '');

  function submit() {
    if (!name.trim()) return showToast('Bitte Name eingeben');
    const amt = parseFloat(String(amount).replace(',', '.'));
    if (isNaN(amt) || amt < 0) return showToast('Bitte gültigen Betrag eingeben');
    const paid = INSTANT_PAID.has(payment) ? true : entry?.paid || false;
    onSave({
      ...(entry || {}),
      category,
      name: name.trim(),
      payment,
      amount: amt,
      paid,
      note: note.trim() || null,
      due_date: dueDate || null,
    });
  }

  const QUICK_CATS = [
    { key: 'sonstige_einnahmen', label: 'Einnahme'  },
    { key: 'fixkosten',          label: 'Fixkosten' },
    { key: 'variable_kosten',    label: 'Variable'  },
    { key: 'sonstige_ausgaben',  label: 'Sonstige'  },
  ];

  return (
    <SheetShell onClose={onClose}>
      {/* Header */}
      <div className="sheet-header">
        <div className="sheet-title t-title">
          {entry ? 'Eintrag bearbeiten' : 'Eintrag hinzufügen'}
        </div>
        <button className="sheet-cancel" onClick={onClose}>Abbrechen</button>
      </div>

      <div className="wiz-body">
        {/* Erfassungszeitpunkt */}
        {entry?.created_at && (
          <div className="entry-modal-meta t-meta">
            <IconCalendarSmall />
            Erfasst am {formatDateTime(entry.created_at)}
          </div>
        )}

        {/* Kategorie */}
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

        {/* Name */}
        <label className="wiz-label t-meta" style={{ marginTop: 'var(--space-5)' }}>Name</label>
        <input
          className="wiz-input"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="z.B. Gym, Gehalt…"
          autoComplete="off"
        />

        {/* Betrag + Zahlungsart nebeneinander */}
        <div className="entry-modal-row">
          <div style={{ flex: 1 }}>
            <label className="wiz-label t-meta">Betrag (€)</label>
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
          </div>
        </div>

        {/* Zahlungsart — Pills wie im Wizard */}
        <label className="wiz-label t-meta" style={{ marginTop: 'var(--space-5)' }}>Zahlungsart</label>
        <div className="wiz-pay-row">
          {PAYMENTS.map((p) => (
            <button
              key={p}
              className={`wiz-pay ${payment === p ? 'active' : ''}`}
              onClick={() => setPayment(p)}
            >
              {p}
            </button>
          ))}
        </div>

        {/* Fälligkeit (optional) */}
        <label className="wiz-label t-meta" style={{ marginTop: 'var(--space-5)' }}>
          Fällig am <span className="wiz-optional">optional</span>
        </label>
        <input
          className="wiz-input"
          type="date"
          value={dueDate}
          onChange={(e) => setDueDate(e.target.value)}
        />

        {/* Notiz (optional) */}
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

      {/* Aktionszeile */}
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
