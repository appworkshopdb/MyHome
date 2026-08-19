import { useState } from 'react';
import { useEntrySheet } from '../lib/EntrySheetContext';
import { useAuth } from '../lib/AuthContext';
import { useUi } from '../lib/UiContext';
import { getModule } from '../modules';
import * as finData from '../../modules/finance/lib/finData';

// Vereinfachte Kategorien für die Schnellerfassung — bewusst 4 statt der
// vollen 5 aus core/lib CATEGORIES (siehe modules/finance/lib/finance.js),
// weil das Sheet für Tempo optimiert ist. Volle Kategorie-Auswahl bleibt
// über den bestehenden "Bearbeiten"-Weg (EntryModal) erreichbar.
const QUICK_CATEGORIES = [
  { key: 'variable_kosten', label: 'Variable' },
  { key: 'fixkosten', label: 'Fixkosten' },
  { key: 'sonstige_ausgaben', label: 'Sonstige' },
  { key: 'sonstige_einnahmen', label: 'Einnahme' },
];
const QUICK_PAYMENTS = ['Bar', 'Bank', 'Paypal', 'Klarna'];
const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', ',', '0', '⌫'];

function FinanceSheetBody({ onClose }) {
  const { session } = useAuth();
  const { showToast } = useUi();
  const { notifySaved } = useEntrySheet();

  const [amount, setAmount] = useState('0');
  const [category, setCategory] = useState('variable_kosten');
  const [name, setName] = useState('');
  const [payment, setPayment] = useState('Bar');
  const [saving, setSaving] = useState(false);

  function pressKey(k) {
    if (k === '⌫') {
      setAmount((a) => (a.length > 1 ? a.slice(0, -1) : '0'));
      return;
    }
    if (k === ',') {
      if (amount.includes(',')) return;
      setAmount((a) => a + ',');
      return;
    }
    setAmount((a) => {
      if (a === '0') return k;
      // maximal 2 Nachkommastellen
      const [, dec] = a.split(',');
      if (dec && dec.length >= 2) return a;
      return a + k;
    });
  }

  async function submit() {
    const numeric = parseFloat(amount.replace(',', '.'));
    if (!numeric || numeric <= 0) return showToast('Bitte einen Betrag eingeben');
    if (!name.trim()) return showToast('Bitte einen Namen eingeben');

    setSaving(true);
    try {
      const now = new Date();
      await finData.saveEntry(session, {
        category,
        name: name.trim(),
        payment,
        amount: numeric,
        paid: payment === 'Bar',
        year: now.getFullYear(),
        month: now.getMonth() + 1,
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

  return (
    <>
      <div className="sheet-amount-row">
        <div className="sheet-amount">{amount}</div>
        <div className="sheet-amount-currency">€</div>
        <div style={{ flex: 1 }} />
        <div className="sheet-cursor" />
      </div>

      <div className="sheet-chip-row">
        {QUICK_CATEGORIES.map((c) => (
          <button
            key={c.key}
            className={`sheet-chip ${category === c.key ? 'active' : ''}`}
            onClick={() => setCategory(c.key)}
          >
            {c.label}
          </button>
        ))}
      </div>

      <div className="sheet-name-field">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Name"
        />
      </div>

      <div className="sheet-chip-row small">
        {QUICK_PAYMENTS.map((p) => (
          <button
            key={p}
            className={`sheet-chip dark ${payment === p ? 'active' : ''}`}
            onClick={() => setPayment(p)}
          >
            {p}
          </button>
        ))}
      </div>

      <div className="sheet-keypad">
        {KEYS.map((k) => (
          <button key={k} className="sheet-key" onClick={() => pressKey(k)}>
            {k}
          </button>
        ))}
      </div>

      <button className="sheet-save" onClick={submit} disabled={saving}>
        {saving ? 'Speichert…' : 'Speichern'}
      </button>
      <div className="sheet-footnote">Betrag zuerst, Rest optional — ein Screen, kein Scrollen.</div>
    </>
  );
}

// Für Module ohne eigene Erfassen-Logik (noch) — ehrlicher Platzhalter
// statt so zu tun, als würde hier schon etwas gespeichert.
function PlaceholderSheetBody({ moduleId, onClose }) {
  const mod = getModule(moduleId);
  return (
    <div className="sheet-placeholder">
      <p>Schnellerfassung für {mod?.name || moduleId} ist noch nicht angebunden — bisher nur für Finanzen verdrahtet.</p>
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
        {openFor === 'finance' ? (
          <FinanceSheetBody onClose={close} />
        ) : (
          <PlaceholderSheetBody moduleId={openFor} onClose={close} />
        )}
      </div>
    </div>
  );
}
