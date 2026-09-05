import { useEffect, useMemo, useState } from 'react';
import { useEntrySheet } from '../lib/EntrySheetContext';
import { useAuth } from '../lib/AuthContext';
import { useUi } from '../lib/UiContext';
import { getModule } from '../modules';
import * as finData from '../../modules/finance/lib/finData';

// Kategorien mit semantischen Status-Tokens (Design-System "Kompakte Tiefe").
// Einnahme → positiv, Fixkosten/Variable → kritisch, Sonstige → neutral.
const QUICK_CATEGORIES = [
  { key: 'sonstige_einnahmen', label: 'Einnahme',  token: 'var(--status-positive)' },
  { key: 'fixkosten',          label: 'Fixkosten', token: 'var(--status-critical)' },
  { key: 'variable_kosten',    label: 'Variable',  token: 'var(--status-critical)' },
  { key: 'sonstige_ausgaben',  label: 'Sonstige',  token: 'var(--text-muted)' },
];

const QUICK_PAYMENTS = ['Bar', 'Bank', 'Paypal', 'SEPA', 'Klarna'];

function FinanceWizard({ onClose }) {
  const { session }     = useAuth();
  const { showToast }   = useUi();
  const { notifySaved } = useEntrySheet();

  const [step, setStep] = useState(1);
  const [name,    setName]    = useState('');
  const [amount,  setAmount]  = useState('');
  const [category, setCategory] = useState('variable_kosten');
  const [payment,  setPayment]  = useState('');
  const [dueDate,  setDueDate]  = useState('');
  const [note,     setNote]     = useState('');
  const [saving,   setSaving]   = useState(false);

  // Vorschläge einmalig laden
  const [history, setHistory] = useState([]);
  useEffect(() => {
    finData.getNameSuggestions(session).then(setHistory).catch(() => {});
  }, [session]);

  // Live-Vorschläge: Wortanfang-Match, häufigste zuerst
  const suggestions = useMemo(() => {
    const q = name.trim().toLowerCase();
    if (!q) return [];
    return history
      .filter((h) => h.name.toLowerCase().startsWith(q))
      .sort((a, b) => b.count - a.count)
      .slice(0, 6);
  }, [name, history]);

  function pickSuggestion(h) {
    setName(h.name);
    if (h.cat) setCategory(h.cat);
    if (h.payment) setPayment(h.payment);
  }

  const amountNum = parseFloat(String(amount).replace(',', '.'));
  const step1Valid = name.trim() && amountNum > 0;

  async function submit() {
    setSaving(true);
    try {
      const now = new Date();
      await finData.saveEntry(session, {
        category,
        name:     name.trim(),
        payment:  payment || 'Bank',
        amount:   amountNum,
        paid:     (payment || 'Bank') === 'Bar',
        year:     now.getFullYear(),
        month:    now.getMonth() + 1,
        due_date: dueDate || null,
        note:     note.trim() || null,
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

  function next() {
    if (step === 1 && !step1Valid) {
      return showToast('Bitte Name und Betrag eingeben');
    }
    if (step < 3) setStep(step + 1);
    else submit();
  }
  function back() { if (step > 1) setStep(step - 1); }

  const STEP_LABELS = {
    1: 'Schritt 1 · Name und Betrag',
    2: 'Schritt 2 · Kategorie und Zahlungsart',
    3: 'Schritt 3 · Fälligkeit und Notiz',
  };

  return (
    <>
      {/* Fortschrittsleiste — 3 Segmente */}
      <div className="wiz-progress">
        {[1, 2, 3].map((n) => (
          <div key={n} className={`wiz-seg ${n <= step ? 'done' : ''}`} />
        ))}
      </div>
      <div className="wiz-steplabel t-meta">{STEP_LABELS[step]}</div>

      <div className="wiz-body">
        {step === 1 && (
          <>
            <label className="wiz-label t-meta">Name</label>
            <input
              className="wiz-input"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="z.B. Tanken"
              autoFocus
              autoComplete="off"
            />
            {suggestions.length > 0 && (
              <div className="wiz-suggest">
                {suggestions.map((h) => (
                  <button key={h.name} className="wiz-suggest-item" onClick={() => pickSuggestion(h)}>
                    {h.name}
                  </button>
                ))}
              </div>
            )}
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
          </>
        )}

        {step === 2 && (
          <>
            <div className="wiz-hint t-meta">
              Aus „{name || '—'}" erkannt — du kannst es ändern.
            </div>
            <label className="wiz-label t-meta">Kategorie</label>
            <div className="wiz-cat-grid">
              {QUICK_CATEGORIES.map((c) => {
                const active = category === c.key;
                return (
                  <button
                    key={c.key}
                    className={`wiz-cat ${active ? 'active' : ''}`}
                    style={active ? { background: c.token, borderColor: c.token, color: 'var(--text-on-accent)' } : {}}
                    onClick={() => setCategory(c.key)}
                  >
                    {c.label}
                  </button>
                );
              })}
            </div>
            <label className="wiz-label t-meta" style={{ marginTop: 'var(--space-5)' }}>Zahlungsart</label>
            <div className="wiz-pay-row">
              {QUICK_PAYMENTS.map((p) => {
                const active = payment === p;
                return (
                  <button
                    key={p}
                    className={`wiz-pay ${active ? 'active' : ''}`}
                    onClick={() => setPayment(active ? '' : p)}
                  >
                    {p}
                  </button>
                );
              })}
            </div>
          </>
        )}

        {step === 3 && (
          <>
            <label className="wiz-label t-meta">Fällig am <span className="wiz-optional">optional</span></label>
            <input
              className="wiz-input"
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
            />
            <label className="wiz-label t-meta" style={{ marginTop: 'var(--space-5)' }}>Notiz <span className="wiz-optional">optional</span></label>
            <textarea
              className="wiz-input wiz-textarea"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Zusatzinfo…"
            />
            <div className="wiz-summary">
              <span className="t-body" style={{ fontWeight: 700 }}>{name || '—'}</span>
              <span className="t-meta">
                {amountNum > 0 ? amountNum.toFixed(2).replace('.', ',') : '0'} € ·{' '}
                {QUICK_CATEGORIES.find((c) => c.key === category)?.label}
                {payment ? ` · ${payment}` : ''}
              </span>
            </div>
          </>
        )}
      </div>

      {/* Navigation */}
      <div className="wiz-nav">
        <button
          className="btn btn-secondary"
          onClick={back}
          style={{ flex: 1, visibility: step === 1 ? 'hidden' : 'visible' }}
        >
          Zurück
        </button>
        <button
          className="btn btn-primary"
          onClick={next}
          disabled={saving}
          style={{ flex: 1 }}
        >
          {step === 3 ? (saving ? 'Speichert…' : 'Speichern') : 'Weiter'}
        </button>
      </div>
    </>
  );
}

function PlaceholderSheetBody({ moduleId, onClose }) {
  const mod = getModule(moduleId);
  return (
    <div className="sheet-placeholder">
      <p className="t-body">Schnellerfassung für {mod?.name || moduleId} ist noch nicht angebunden.</p>
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
          <div className="sheet-title t-title">Neuer Eintrag</div>
          <button className="sheet-cancel" onClick={close}>Abbrechen</button>
        </div>
        {openFor === 'finance'
          ? <FinanceWizard onClose={close} />
          : <PlaceholderSheetBody moduleId={openFor} onClose={close} />}
      </div>
    </div>
  );
}
