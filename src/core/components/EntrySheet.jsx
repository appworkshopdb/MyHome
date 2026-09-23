import { useEffect, useMemo, useRef, useState } from 'react';
import { useEntrySheet } from '../lib/EntrySheetContext';
import { useAuth } from '../lib/AuthContext';
import { useUi } from '../lib/UiContext';
import { getModule } from '../modules';
import * as finData from '../../modules/finance/lib/finData';
import { SPARSCHWEIN_DEPOSIT_NAME, isInstantPaid } from '../../modules/finance/lib/finance';
import PaymentsEditor from './PaymentsEditor';
import SheetShell from './SheetShell';

const QUICK_CATEGORIES = [
  { key: 'sonstige_einnahmen', label: 'Einnahme'  },
  { key: 'fixkosten',          label: 'Fixkosten' },
  { key: 'variable_kosten',    label: 'Variable'  },
  { key: 'sonstige_ausgaben',  label: 'Sonstige'  },
];

const QUICK_PAYMENTS = ['Bar', 'Bank', 'Paypal', 'SEPA', 'Klarna', 'Sparschwein', 'Gutschein'];

function FinanceWizard({ onClose }) {
  const { session } = useAuth();
  const { showToast } = useUi();
  const { notifySaved, getFinancePeriod } = useEntrySheet();

  const [step, setStep] = useState(1);
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('variable_kosten');
  const [payments, setPayments] = useState([{ method: 'Bank', amount: null }]);
  const [dueDate, setDueDate] = useState('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  const [showSuggest, setShowSuggest] = useState(false);
  const amountRef = useRef(null);

  const [history, setHistory] = useState([]);
  useEffect(() => {
    finData.getNameSuggestions(session).then(setHistory).catch(() => {});
  }, [session]);

  const suggestions = useMemo(() => {
    const q = name.trim().toLowerCase();
    if (!q) return [];
    return history
      .filter((h) => h.name.toLowerCase().startsWith(q))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);
  }, [name, history]);

  function pickSuggestion(h) {
    setName(h.name);
    if (h.cat) setCategory(h.cat);
    if (h.payments && Array.isArray(h.payments) && h.payments.length > 0) {
      setPayments(h.payments.map((p) => ({ ...p, amount: null })));
    } else if (h.payment) {
      setPayments([{ method: h.payment, amount: null }]);
    }
    setShowSuggest(false);
    setTimeout(() => amountRef.current?.focus(), 0);
  }

  const amountNum = parseFloat(String(amount).replace(',', '.'));
  const step1Valid = name.trim() && amountNum > 0;

  function resolvePayments() {
    if (payments.length === 1) {
      return [{ method: payments[0].method, amount: amountNum }];
    }
    return payments.map((p, idx) => {
      if (idx === payments.length - 1) {
        const sumOthers = payments
          .slice(0, -1)
          .reduce((s, pp) => s + (parseFloat(pp.amount) || 0), 0);
        return { method: p.method, amount: Math.max(0, amountNum - sumOthers) };
      }
      return { method: p.method, amount: parseFloat(p.amount) || 0 };
    });
  }

  async function submit() {
    const resolvedPayments = resolvePayments();
    if (payments.length > 1) {
      const sumPartial = payments.slice(0, -1).reduce((s, p) => s + (parseFloat(p.amount) || 0), 0);
      if (sumPartial > amountNum) {
        return showToast('Teilbeträge überschreiten den Gesamtbetrag');
      }
    }

    setSaving(true);
    try {
      const now = new Date();
      // Den aktuell angezeigten Finanzmonat verwenden. getFinancePeriod()
      // liest die synchron gepflegte Ref und verhindert, dass beim Wechsel
      // z.B. September -> Oktober noch der vorherige State verwendet wird.
      const period = getFinancePeriod();
      const targetYear = period?.year ?? now.getFullYear();
      const targetMonth = period?.month ?? (now.getMonth() + 1);

      await finData.saveEntry(session, {
        category,
        name: name.trim(),
        payments: resolvedPayments,
        payment: resolvedPayments[0].method,
        amount: amountNum,
        paid: isInstantPaid(resolvedPayments),
        year: targetYear,
        month: targetMonth,
        due_date: dueDate || null,
        note: note.trim() || null,
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
    if (step === 1 && name.trim().toLowerCase() === SPARSCHWEIN_DEPOSIT_NAME.toLowerCase()) {
      setCategory('variable_kosten');
      setPayments([{ method: 'Sparschwein', amount: null }]);
    }
    if (step < 3) setStep(step + 1);
    else submit();
  }
  function back() { if (step > 1) setStep(step - 1); }

  const showSuggestList = showSuggest && suggestions.length > 0;
  const primaryMethod = payments[0]?.method || '';

  return (
    <>
      <div className="wiz-progress">
        {[1, 2, 3].map((n) => <div key={n} className={`wiz-seg ${n <= step ? 'done' : ''}`} />)}
      </div>
      <div className="wiz-body">
        {step === 1 && (
          <>
            <label className="wiz-label t-meta">Name</label>
            <div className="wiz-name-block">
              <input className="wiz-input wiz-input-name" type="text" value={name} onChange={(e) => { setName(e.target.value); setShowSuggest(true); }} onFocus={() => setShowSuggest(true)} placeholder="z.B. Tanken" autoFocus autoComplete="off" />
              {showSuggestList && <div className="wiz-suggest">{suggestions.map((h) => <button key={h.name} type="button" className="wiz-suggest-item" onClick={() => pickSuggestion(h)}>{h.name}</button>)}</div>}
            </div>
            <label className="wiz-label t-meta" style={{ marginTop: 'var(--space-5)' }}>Betrag (€)</label>
            <input ref={amountRef} className="wiz-input" type="number" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} onFocus={() => setShowSuggest(false)} placeholder="0,00" min="0" step="0.01" />
          </>
        )}
        {step === 2 && (
          <>
            <div className="wiz-hint t-meta">Aus „{name || '—'}" erkannt — du kannst es ändern.</div>
            <label className="wiz-label t-meta">Kategorie</label>
            <div className="wiz-cat-grid">
              {QUICK_CATEGORIES.map((c) => <button key={c.key} className={`wiz-cat ${category === c.key ? 'active' : ''}`} onClick={() => setCategory(c.key)}>{c.label}</button>)}
            </div>
            <label className="wiz-label t-meta" style={{ marginTop: 'var(--space-5)' }}>Zahlungsart</label>
            <PaymentsEditor payments={payments} onChange={setPayments} totalAmount={amount} />
          </>
        )}
        {step === 3 && (
          <>
            <label className="wiz-label t-meta">Fällig am <span className="wiz-optional">optional</span></label>
            <input className="wiz-input" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            <label className="wiz-label t-meta" style={{ marginTop: 'var(--space-5)' }}>Notiz <span className="wiz-optional">optional</span></label>
            <textarea className="wiz-input wiz-textarea" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Zusatzinfo…" />
            <div className="wiz-summary">
              <span className="t-body" style={{ fontWeight: 700 }}>{name || '—'}</span>
              <span className="t-meta">
                {amountNum > 0 ? amountNum.toFixed(2).replace('.', ',') : '0'} € · {QUICK_CATEGORIES.find((c) => c.key === category)?.label}
                {payments.length === 1 ? ` · ${primaryMethod}` : ` · ${payments.map((p) => p.method).join(' + ')}`}
              </span>
            </div>
          </>
        )}
      </div>
      <div className="wiz-nav">
        <button className="btn btn-secondary" onClick={back} style={{ flex: 1, visibility: step === 1 ? 'hidden' : 'visible' }}>Zurück</button>
        <button className="btn btn-primary" onClick={next} disabled={saving} style={{ flex: 1 }}>{step === 3 ? (saving ? 'Speichert…' : 'Speichern') : 'Weiter'}</button>
      </div>
    </>
  );
}

function PlaceholderSheetBody({ moduleId, onClose }) {
  const mod = getModule(moduleId);
  return <div className="sheet-placeholder"><p className="t-body">Schnellerfassung für {mod?.name || moduleId} ist noch nicht angebunden.</p><button className="btn btn-secondary btn-block" onClick={onClose}>Schließen</button></div>;
}

export default function EntrySheet() {
  const { openFor, close } = useEntrySheet();
  if (!openFor) return null;
  return (
    <SheetShell onClose={close}>
      <div className="sheet-header">
        <div className="sheet-title t-title">Neuer Eintrag</div>
        <button className="sheet-cancel" onClick={close}>Abbrechen</button>
      </div>
      {openFor === 'finance' ? <FinanceWizard onClose={close} /> : <PlaceholderSheetBody moduleId={openFor} onClose={close} />}
    </SheetShell>
  );
}
