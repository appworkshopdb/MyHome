import { useEffect, useMemo, useRef, useState } from 'react';
import { useEntrySheet } from '../lib/EntrySheetContext';
import { useAuth } from '../lib/AuthContext';
import { useUi } from '../lib/UiContext';
import { getModule } from '../modules';
import * as finData from '../../modules/finance/lib/finData';
import { MONTHS_DE, PAYMENTS, SPARSCHWEIN_DEPOSIT_NAME, isInstantPaid } from '../../modules/finance/lib/finance';
import { useFinanceMonth } from '../../modules/finance/lib/FinanceMonthContext';
import ReceiptScanChoice from './ReceiptScanChoice';
import { formatReceiptDate } from '../lib/photoScan';
import { fmtDate, parseNum } from '../lib/wizardDates';
import SheetShell from './SheetShell';
import { DateButton, MoreButton, WheelPicker, WizardFoot, WizardFrame, missingHint } from './wizard/WizardKit';

const QUICK_CATEGORIES = [
  { key: 'sonstige_einnahmen', label: 'Einnahme'  },
  { key: 'fixkosten',          label: 'Fixkosten' },
  { key: 'variable_kosten',    label: 'Variable'  },
  { key: 'sonstige_ausgaben',  label: 'Sonstige'  },
];
const CATEGORY_ITEMS = QUICK_CATEGORIES.map((c) => ({ value: c.key, label: c.label }));

// Zahlungsart-Werte der Beleg-Erkennung → Zahlungsarten der App.
// Karten (EC/Girocard/Kredit) buchen vom Konto ab → "Bank".
const RECEIPT_PAYMENT_MAP = {
  bar: 'Bar', karte: 'Bank', paypal: 'Paypal', gutschein: 'Gutschein', klarna: 'Klarna',
};

const eur = (n) => `${n.toFixed(2).replace('.', ',')} €`;

// ── Wizard ───────────────────────────────────────────────────────────────────
// Ablauf: Auswahl (Beleg scannen / manuell) → Schritt 1 "Eingeben" (alle Pflicht-
// angaben, "Mehr Details" klappt im Schritt auf) → Schritt 2 "Prüfen" → Speichern.
// Ein Scan füllt Schritt 1 nur vor, gespeichert wird erst nach dem Prüfen.
function FinanceWizard({ onClose }) {
  const { session }     = useAuth();
  const { showToast }   = useUi();
  const { notifySaved } = useEntrySheet();
  // Monat, der gerade in den Buchungen angezeigt wird (sonst aktueller Monat)
  const { activeYear, activeMonth } = useFinanceMonth();

  const [view, setView]       = useState('choose'); // 'choose' | 'enter' | 'review'
  const [scanned, setScanned] = useState(null);     // letztes Scan-Ergebnis, für den Hinweis
  const [name,     setName]     = useState('');
  const [amount,   setAmount]   = useState('');
  const [category, setCategory] = useState('variable_kosten');
  const [pay1,     setPay1]     = useState('Bank');
  const [split,    setSplit]    = useState(false);
  const [splitAmt, setSplitAmt] = useState('');
  const [pay2,     setPay2]     = useState('Bar');
  const [dueDate,  setDueDate]  = useState('');
  const [note,     setNote]     = useState('');
  const [showMore, setShowMore] = useState(false);
  const [saving,   setSaving]   = useState(false);

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
    // Zahlungsart aus dem Verlauf (bei mehreren: die erste)
    const method = (Array.isArray(h.payments) && h.payments[0]?.method) || h.payment;
    if (method && PAYMENTS.includes(method)) setPay1(method);
    setSplit(false);
    setShowSuggest(false);
    setTimeout(() => amountRef.current?.focus(), 0);
  }

  // Ergebnis des Beleg-Scans: nur vorbefüllen, gespeichert wird erst nach
  // dem Prüfen. Monat/Jahr bleiben bewusst der aktive Monat (wie bei manueller
  // Eingabe); das Belegdatum landet in der Notiz.
  function applyReceipt(r) {
    setShowSuggest(false);
    // Frischer Scan ersetzt, was vorher im Formular stand (auch bei erneutem Scan)
    setName(r.merchant || '');
    setAmount(r.total != null ? String(r.total).replace('.', ',') : '');
    setPay1(RECEIPT_PAYMENT_MAP[r.payment_method] || 'Bank'); // sonstige/unbekannt: Voreinstellung Bank
    setSplit(false);
    const d = formatReceiptDate(r.date);
    setNote(d ? `Beleg vom ${d}` : '');
    setScanned(r);
    setView('enter');
  }

  const amountNum = parseNum(amount);
  const splitNum  = parseNum(splitAmt);
  const baseValid = Boolean(name.trim()) && amountNum > 0;
  const splitValid = !split || (splitNum > 0 && splitNum < amountNum && pay1 !== pay2);
  const valid = baseValid && splitValid;

  // Zahlungen für das Speichern: eine Zahlungsart = ganzer Betrag; geteilt =
  // Teilbetrag + Rest (der Rest geht an die zweite Zahlungsart).
  const payments = split
    ? [{ method: pay1, amount: splitNum }, { method: pay2, amount: Math.max(0, amountNum - splitNum) }]
    : [{ method: pay1, amount: amountNum }];

  function toggleSplit() {
    if (split) { setSplit(false); return; }
    setSplit(true);
    setShowMore(true);
    if (!splitAmt && amountNum > 0) setSplitAmt(String(Math.round(amountNum / 2 * 100) / 100).replace('.', ','));
    if (pay2 === pay1) setPay2(PAYMENTS.find((p) => p !== pay1) || 'Bar');
  }

  async function submit() {
    setSaving(true);
    try {
      await finData.saveEntry(session, {
        category,
        name:     name.trim(),
        payments,
        payment:  payments[0].method, // Abwärtskompatibilität
        amount:   amountNum,
        paid:     isInstantPaid(payments),
        year:     activeYear,   // Monat aus der Buchungen-Ansicht, nicht "heute"
        month:    activeMonth,
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

  function toReview() {
    if (!valid) return;
    if (name.trim().toLowerCase() === SPARSCHWEIN_DEPOSIT_NAME.toLowerCase()) {
      setCategory('variable_kosten');
      setPay1('Sparschwein');
      setSplit(false);
    }
    setView('review');
  }

  const catLabel = QUICK_CATEGORIES.find((c) => c.key === category)?.label;

  // ── Auswahl: Beleg scannen / manuell ──
  if (view === 'choose') {
    return (
      <WizardFrame title="Neuer Eintrag" sub="Wie möchtest du eintragen?" onClose={onClose} stepKey="choose">
        <ReceiptScanChoice
          onScanned={applyReceipt}
          onManual={() => setView('enter')}
        />
      </WizardFrame>
    );
  }

  // ── Schritt 2: Prüfen ──
  if (view === 'review') {
    return (
      <WizardFrame
        title="Eintrag prüfen"
        sub="Schritt 2 von 2 · Bitte alles kontrollieren"
        step={2}
        total={2}
        stepKey="review"
        onBack={() => setView('enter')}
        onClose={onClose}
        footer={(
          <WizardFoot>
            <button type="button" className="btn btn-secondary" onClick={() => setView('enter')} disabled={saving}>Ändern</button>
            <button type="button" className="btn btn-primary" onClick={submit} disabled={saving}>{saving ? 'Speichert…' : 'Speichern'}</button>
          </WizardFoot>
        )}
      >
        <div className="wz-review">
          <div className="wz-rv-top"><small>Betrag</small><b>{eur(amountNum)}</b><span>{name.trim()}</span></div>
          <div className="wz-rv-row"><span>Kategorie</span><span>{catLabel}</span></div>
          <div className="wz-rv-row">
            <span>Zahlungsart</span>
            <span>{split ? `${pay1} ${eur(splitNum)} + ${pay2} ${eur(Math.max(0, amountNum - splitNum))}` : pay1}</span>
          </div>
          <div className="wz-rv-row"><span>Gebucht in</span><span>{MONTHS_DE[activeMonth - 1]} {activeYear}</span></div>
          <div className="wz-rv-row"><span>Fällig am</span><span>{dueDate ? fmtDate(dueDate) : '—'}</span></div>
          <div className="wz-rv-row"><span>Notiz</span><span>{note.trim() || '—'}</span></div>
        </div>
        <p className="wz-rv-note">„Gebucht in" ist der Monat, den du gerade unter Buchungen siehst. Das Fälligkeitsdatum ändert daran nichts.</p>
      </WizardFrame>
    );
  }

  // ── Schritt 1: Eingeben ──
  const hint = !baseValid
    ? missingHint([['Name', !name.trim()], ['Betrag', !(amountNum > 0)]])
    : (!splitValid ? 'Teilbetrag muss kleiner als der Betrag sein, die Zahlungsarten verschieden' : '');
  const showSuggestList = showSuggest && suggestions.length > 0;

  return (
    <WizardFrame
      title="Neuer Eintrag"
      sub="Schritt 1 von 2 · Eingeben"
      step={1}
      total={2}
      stepKey="enter"
      onBack={() => setView('choose')}
      onClose={onClose}
      footer={(
        <WizardFoot hint={hint}>
          <MoreButton open={showMore} onClick={() => setShowMore((o) => !o)} />
          <button type="button" className="btn btn-primary" disabled={!valid} onClick={toReview}>Weiter</button>
        </WizardFoot>
      )}
    >
      {scanned && (
        <p className="wz-hint ok">
          {scanned.total != null ? 'Beleg gelesen – bitte prüfen und bei Bedarf ändern.' : 'Betrag nicht erkannt – bitte eingeben.'}
        </p>
      )}

      <label className="wz-lbl" htmlFor="wz-fin-name">Name</label>
      <input
        id="wz-fin-name"
        className="wz-input hero"
        type="text"
        value={name}
        onChange={(e) => { setName(e.target.value); setShowSuggest(true); }}
        onFocus={() => setShowSuggest(true)}
        placeholder="z.B. Tanken"
        autoFocus={!scanned}
        autoComplete="off"
        enterKeyHint="next"
      />
      {showSuggestList && (
        <div className="wz-suggest">
          {suggestions.map((h) => (
            <button key={h.name} type="button" onClick={() => pickSuggestion(h)}>
              {h.name}
              <small>{QUICK_CATEGORIES.find((c) => c.key === h.cat)?.label || ''}</small>
            </button>
          ))}
        </div>
      )}

      <label className="wz-lbl" htmlFor="wz-fin-amount">Betrag</label>
      <div className="wz-amount">
        <input
          id="wz-fin-amount"
          ref={amountRef}
          type="text"
          inputMode="decimal"
          value={amount}
          onChange={(e) => setAmount(e.target.value.replace(/[^\d.,]/g, ''))}
          onFocus={() => setShowSuggest(false)}
          placeholder="0,00"
          autoComplete="off"
          enterKeyHint="done"
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
          <WheelPicker items={PAYMENTS} value={pay1} onChange={setPay1} label="Zahlungsart" />
        </div>
      </div>

      {showMore && (
        <>
          <div className="wz-lbl">Fällig am <span className="opt">optional</span></div>
          <DateButton value={dueDate} onChange={setDueDate} optional placeholder="Datum wählen" label="Fällig am" />

          <button type="button" className="wz-link" onClick={toggleSplit}>
            {split ? '⚖ Aufteilung entfernen' : '⚖ Zahlung aufteilen'}
          </button>
          {split && (
            <div>
              <div className="wz-two">
                <div className="wz-input" style={{ display: 'grid', alignContent: 'center' }}>{pay1}</div>
                <div className="wz-amount" style={{ padding: '2px 12px' }}>
                  <input
                    type="text"
                    inputMode="decimal"
                    aria-label={`Teilbetrag ${pay1}`}
                    value={splitAmt}
                    onChange={(e) => setSplitAmt(e.target.value.replace(/[^\d.,]/g, ''))}
                    style={{ fontSize: 22 }}
                  />
                  <span style={{ fontSize: 15 }}>€</span>
                </div>
              </div>
              <div className="wz-two" style={{ marginTop: 8 }}>
                <select className="wz-input" value={pay2} onChange={(e) => setPay2(e.target.value)} aria-label="Zweite Zahlungsart">
                  {PAYMENTS.filter((p) => p !== pay1).map((p) => <option key={p} value={p}>{p}</option>)}
                </select>
                <div className="wz-input" style={{ display: 'grid', alignContent: 'center', fontWeight: 700 }}>
                  Rest {eur(Math.max(0, amountNum - splitNum))}
                </div>
              </div>
            </div>
          )}

          <label className="wz-lbl" htmlFor="wz-fin-note" style={{ marginTop: 14 }}>Notiz <span className="opt">optional</span></label>
          <textarea id="wz-fin-note" className="wz-input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Zusatzinfo…" />
        </>
      )}
    </WizardFrame>
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

  // SheetShell liefert: createPortal (kein z-index-Konflikt),
  // iOS-sicherer Body-Lock (position:fixed statt overflow:hidden),
  // Grab-Handle zum Wegwischen. Finanzen bringt seinen Wizard-Rahmen selbst mit.
  if (openFor === 'finance') {
    return (
      <SheetShell onClose={close} wizard>
        <FinanceWizard onClose={close} />
      </SheetShell>
    );
  }
  return (
    <SheetShell onClose={close}>
      <div className="sheet-header">
        <div className="sheet-title t-title">Neuer Eintrag</div>
        <button className="sheet-cancel" onClick={close}>Abbrechen</button>
      </div>
      <PlaceholderSheetBody moduleId={openFor} onClose={close} />
    </SheetShell>
  );
}
