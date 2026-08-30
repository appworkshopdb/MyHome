import { useState } from 'react';
import { useEntrySheet } from '../lib/EntrySheetContext';
import { useAuth } from '../lib/AuthContext';
import { useUi } from '../lib/UiContext';
import { getModule } from '../modules';
import * as finData from '../../modules/finance/lib/finData';

const QUICK_CATEGORIES = [
  { key: 'sonstige_einnahmen', label: 'Einnahme',  color: 'var(--success)' },
  { key: 'fixkosten',          label: 'Fixkosten', color: 'var(--danger)'  },
  { key: 'variable_kosten',    label: 'Variable',  color: 'var(--danger)'  },
  { key: 'sonstige_ausgaben',  label: 'Sonstige',  color: 'var(--text-muted)' },
];

const QUICK_PAYMENTS = ['Bar', 'Bank', 'Paypal', 'SEPA', 'Klarna'];

function FinanceSheetBody({ onClose }) {
  const { session }      = useAuth();
  const { showToast }    = useUi();
  const { notifySaved }  = useEntrySheet();

  const [category, setCategory] = useState('variable_kosten');
  const [amount,   setAmount]   = useState('');
  const [name,     setName]     = useState('');
  const [payment,  setPayment]  = useState('');      // leer = optional
  const [dueDate,  setDueDate]  = useState('');       // leer = optional
  const [saving,   setSaving]   = useState(false);

  async function submit() {
    const numeric = parseFloat(amount.replace(',', '.'));
    if (!numeric || numeric <= 0) return showToast('Bitte einen Betrag eingeben');
    if (!name.trim())             return showToast('Bitte einen Namen eingeben');

    setSaving(true);
    try {
      const now = new Date();
      await finData.saveEntry(session, {
        category,
        name:     name.trim(),
        payment:  payment || 'Bank',
        amount:   numeric,
        paid:     (payment || 'Bank') === 'Bar',
        year:     now.getFullYear(),
        month:    now.getMonth() + 1,
        due_date: dueDate || null,
      });
      notifySaved();
      showToast('Gespeichert');
      onClose();
    } catch (err) {
      showToast(err.message || 'Speichern fehlgeschlagen');
    } finally {
      setSaving(false);
    }
  }

  const canSave = amount && parseFloat(amount.replace(',', '.')) > 0;

  return (
    <>
      {/* Kategorie — 4 Chips, ein Schritt */}
      <div className="sheet-chip-row" style={{ paddingTop: 20 }}>
        {QUICK_CATEGORIES.map((c) => (
          <button
            key={c.key}
            className={`sheet-chip ${category === c.key ? 'active' : ''}`}
            style={category === c.key ? { background: c.color, borderColor: c.color, color: '#fff' } : {}}
            onClick={() => setCategory(c.key)}
          >
            {c.label}
          </button>
        ))}
      </div>

      {/* Name */}
      <div className="sheet-name-field">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Name / Beschreibung"
          autoFocus
        />
      </div>

      {/* Betrag + Zahlungsart nebeneinander */}
      <div style={{ display: 'flex', gap: 12, padding: '14px 20px 0', alignItems: 'flex-end' }}>
        <div style={{ flex: 1 }}>
          <div className="sheet-field-label">Betrag (€)</div>
          <input
            className="sheet-text-input"
            type="number"
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0,00"
            min="0"
            step="0.01"
          />
        </div>
        <div style={{ flex: 1 }}>
          <div className="sheet-field-label">Zahlung <span className="sheet-optional">optional</span></div>
          <select
            className="sheet-text-input"
            value={payment}
            onChange={(e) => setPayment(e.target.value)}
          >
            <option value="">– wählen –</option>
            {QUICK_PAYMENTS.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
      </div>

      {/* Fällig am — optional */}
      <div style={{ padding: '14px 20px 0' }}>
        <div className="sheet-field-label">Fällig am <span className="sheet-optional">optional</span></div>
        <input
          className="sheet-text-input"
          type="date"
          value={dueDate}
          onChange={(e) => setDueDate(e.target.value)}
        />
      </div>

      {/* Speichern */}
      <button
        className={`sheet-save ${canSave ? '' : 'disabled'}`}
        onClick={submit}
        disabled={saving || !canSave}
        style={{ marginTop: 20 }}
      >
        {saving ? 'Speichert…' : canSave ? 'Speichern' : 'Betrag fehlt'}
      </button>
    </>
  );
}

function PlaceholderSheetBody({ moduleId, onClose }) {
  const mod = getModule(moduleId);
  return (
    <div className="sheet-placeholder">
      <p>Schnellerfassung für {mod?.name || moduleId} ist noch nicht angebunden.</p>
      <button className="btn btn-secondary btn-block" onClick={onClose}>Schließen</button>
    </div>
  );
}

export default function EntrySheet() {
  const { openFor, close } = useEntrySheet();
  if (!openFor) return null;

  return (
    <div className="sheet-overlay" onClick={(e) => e.target === e.currentTarget && close()}>
      <div className="sheet">
        <div className="sheet-header">
          <div className="sheet-title">Neuer Eintrag</div>
          <button className="sheet-cancel" onClick={close}>Abbrechen</button>
        </div>
        {openFor === 'finance'
          ? <FinanceSheetBody onClose={close} />
          : <PlaceholderSheetBody moduleId={openFor} onClose={close} />}
      </div>
    </div>
  );
}
