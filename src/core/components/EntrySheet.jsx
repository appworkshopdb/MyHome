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
const MAX_CENTS = 99_999_999; // 999.999,99 € — genug Spielraum, kein absurder Überlauf

function formatCents(cents) {
  const euros = Math.floor(cents / 100);
  const rest = String(cents % 100).padStart(2, '0');
  return `${euros},${rest}`;
}

function FinanceSheetBody({ onClose }) {
  const { session } = useAuth();
  const { showToast } = useUi();
  const { notifySaved } = useEntrySheet();

  // Ziffern laufen von rechts ein, wie am Kartenterminal — die letzten
  // zwei Stellen sind immer die Cent-Stellen. Die Komma-Taste ist damit
  // rein optisch (siehe .sheet-key.inert), kein eigener Handler nötig.
  const [cents, setCents] = useState(0);
  const [category, setCategory] = useState('variable_kosten');
  const [name, setName] = useState('');
  const [payment, setPayment] = useState('Bar');
  const [saving, setSaving] = useState(false);

  function pressKey(k) {
    if (k === ',') return; // funktionslos, siehe oben
    if (k === '⌫') {
      setCents((c) => Math.floor(c / 10));
      return;
    }
    setCents((c) => Math.min(MAX_CENTS, c * 10 + Number(k)));
  }

  async function submit() {
    const numeric = cents / 100;
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
        <div className="sheet-amount">{formatCents(cents)}</div>
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
        {KEYS.map((k) =>
          k === ',' ? (
            <div key={k} className="sheet-key inert">{k}</div>
          ) : (
            <button key={k} className="sheet-key" onClick={() => pressKey(k)}>{k}</button>
          )
        )}
      </div>

      <button
        className={`sheet-save ${cents > 0 ? '' : 'disabled'}`}
        onClick={submit}
        disabled={saving || cents === 0}
      >
        {saving ? 'Speichert…' : cents > 0 ? 'Speichern' : 'Betrag fehlt'}
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
