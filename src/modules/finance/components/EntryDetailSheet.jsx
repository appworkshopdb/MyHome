// modules/finance/components/EntryDetailSheet.jsx
//
// Ansicht eines bereits angelegten Postens — und dieselbe Ansicht zum Bearbeiten.
// "Bearbeiten" (oder ein Tipp auf eine Zeile) macht die Felder genau dort
// änderbar, wo sie stehen: Ausgabenart (Auswahl im Etikett), Name, Betrag,
// Status (Haken offen/bezahlt), Zahlungsart(en), Fälligkeit und Notiz. Kein
// zweites Formular, kein Seitenwechsel. "Speichern" übernimmt, "Abbrechen"
// verwirft.
//
// Teilzahlungen: Bar, Gutschein und Sparschwein gelten SOFORT als bezahlt, offen
// ist nur der Rest (core/lib/paymentParts.js). Bei geteilter Zahlung zeigt die
// Ansicht jede Teilzahlung mit ihrem Status, und beim Bearbeiten kann jede
// einzeln als bezahlt markiert werden. Der Status-Knopf setzt alles auf einmal.
//
// Ansicht: Der Status-Knopf setzt offen ↔ bezahlt sofort (wie in der Liste).
// Bearbeiten: Er ändert nur den Entwurf und wird mit "Speichern" übernommen.
//
// Der Eintrag kommt "live" aus der Monatsliste, damit nach dem Speichern sofort
// die neuen Werte stehen.

import { useEffect, useRef, useState } from 'react';
import SheetShell from '../../../core/components/SheetShell';
import PaymentsEditor from '../../../core/components/PaymentsEditor';
import { IconClose, IconEdit, IconChevronRight, IconCheck } from '../../../core/components/Icons';
import {
  CATEGORIES, formatDateTime, formatPayments, formatEur, isSparschweinDeposit,
  isInstantMethod, entryParts, openAmount, isFullyPaid, isPartlyPaid,
} from '../lib/finance';
import { toDateStr } from '../lib/analytics';

const INCOME = new Set(['fixeinnahmen', 'sonstige_einnahmen']);
const CAT_ORDER = ['fixeinnahmen', 'sonstige_einnahmen', 'fixkosten', 'variable_kosten', 'sonstige_ausgaben'];
const DOT = {
  fixeinnahmen: 'var(--status-positive)',
  sonstige_einnahmen: 'var(--status-positive)',
  fixkosten: 'var(--data-1)',
  variable_kosten: 'var(--data-2)',
  sonstige_ausgaben: 'var(--data-3)',
};

const NF = new Intl.NumberFormat('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// 'YYYY-MM-DD' -> 'TT.MM.JJJJ' ohne Date-Parsing (keine Zeitzonen-Verschiebung)
function fmtDue(str) {
  const [y, m, d] = String(str).slice(0, 10).split('-');
  return `${d}.${m}.${y}`;
}

function paymentText(entry) {
  if (Array.isArray(entry.payments) && entry.payments.length > 1) {
    return entry.payments.map((p) => `${p.method} ${NF.format(Number(p.amount || 0))} €`).join(' · ');
  }
  return formatPayments(entry) || '—';
}

// Entwurf der Zahlungen: mit Bezahlt-Status je Teilzahlung
function initialPayments(entry) {
  const parts = entryParts(entry);
  const raw = Array.isArray(entry.payments) && entry.payments.length > 0
    ? entry.payments
    : [{ method: entry.payment || 'Bank', amount: null }];
  return raw.map((p, i) => ({ ...p, paid: parts[i].paid }));
}

// Alle (nicht sofort bezahlten) Teilzahlungen auf bezahlt/offen setzen
const setAllPaid = (payments, paid) => payments.map((p) => ({ ...p, paid: isInstantMethod(p.method) ? true : paid }));
const draftPaidFlag = (p) => isInstantMethod(p.method) || !!p.paid;

export default function EntryDetailSheet({ entry, onClose, onSave, onDelete, onTogglePaid, showToast }) {
  const [draft, setDraft] = useState(null); // null = Ansicht, sonst Entwurf beim Bearbeiten
  const [focus, setFocus] = useState(null);
  const [saving, setSaving] = useState(false);
  const noteRef = useRef(null);
  const dueRef = useRef(null);
  const payRef = useRef(null);
  const editing = draft !== null;

  // Tipp auf eine Zeile springt nach dem Umschalten direkt ins passende Feld
  useEffect(() => {
    if (!editing || !focus) return;
    const el = { note: noteRef.current, due: dueRef.current, payment: payRef.current }[focus];
    if (!el) return;
    el.scrollIntoView({ block: 'center' });
    if (focus !== 'payment') el.focus({ preventScroll: true });
  }, [editing, focus]);

  function startEdit(target = null) {
    setDraft({
      category: entry.category,
      name: entry.name || '',
      amount: entry.amount != null ? String(entry.amount).replace('.', ',') : '',
      payments: initialPayments(entry),
      dueDate: entry.due_date || '',
      note: entry.note || '',
    });
    setFocus(target);
  }
  const set = (patch) => setDraft((d) => ({ ...d, ...patch }));

  const category = editing ? draft.category : entry.category;
  const canPay = !INCOME.has(category)
    && !isSparschweinDeposit(editing ? { category, name: draft.name } : entry);
  const amountNorm = editing ? String(draft.amount).replace(',', '.') : '';
  const overdue = !editing && canPay && !isFullyPaid(entry) && entry.due_date
    && String(entry.due_date).slice(0, 10) < toDateStr(new Date());

  // Status: in der Ansicht aus dem Posten, beim Bearbeiten aus dem Entwurf
  // (Entwurf: der letzte Eintrag bekommt wie beim Speichern den Rest vom Gesamtbetrag)
  const draftTotal = parseFloat(amountNorm) || 0;
  const parts = editing
    ? draft.payments.map((p, idx, ps) => {
      const others = ps.slice(0, -1).reduce((sum, pp) => sum + (parseFloat(String(pp.amount).replace(',', '.')) || 0), 0);
      const amount = ps.length === 1 ? draftTotal
        : idx === ps.length - 1 ? Math.max(0, draftTotal - others)
          : parseFloat(String(p.amount).replace(',', '.')) || 0;
      return { method: p.method, amount, paid: draftPaidFlag(p) };
    })
    : entryParts(entry);
  const fully = editing ? parts.every((p) => p.paid) : isFullyPaid(entry);
  const partly = editing ? !fully && parts.some((p) => p.paid) : isPartlyPaid(entry);
  const allInstant = parts.every((p) => isInstantMethod(p.method));
  const open = editing ? parts.filter((p) => !p.paid).reduce((sum, p) => sum + p.amount, 0) : openAmount(entry);

  async function submit() {
    if (!draft.name.trim()) return showToast('Bitte Name eingeben');
    const amt = parseFloat(amountNorm);
    if (isNaN(amt) || amt < 0) return showToast('Bitte gültigen Betrag eingeben');

    // Zahlungen auflösen: der letzte Eintrag bekommt den Rest vom Gesamtbetrag
    const ps = draft.payments;
    const resolved = ps.length === 1
      ? [{ method: ps[0].method, amount: amt, paid: draftPaidFlag(ps[0]) }]
      : ps.map((p, idx) => {
        if (idx === ps.length - 1) {
          const others = ps.slice(0, -1).reduce((s, pp) => s + (parseFloat(pp.amount) || 0), 0);
          return { method: p.method, amount: Math.max(0, amt - others), paid: draftPaidFlag(p) };
        }
        return { method: p.method, amount: parseFloat(p.amount) || 0, paid: draftPaidFlag(p) };
      });

    setSaving(true);
    try {
      await onSave({
        ...entry,
        category: draft.category,
        name: draft.name.trim(),
        payments: resolved,
        payment: resolved[0].method, // Abwärtskompatibilität (altes Einzelfeld)
        amount: amt,
        paid: resolved.every((p) => p.paid), // Zeile: alles bezahlt
        note: draft.note.trim() || null,
        due_date: draft.dueDate || null,
      });
      setDraft(null);
    } catch (e) {
      console.error(e);
      showToast('Speichern fehlgeschlagen');
    }
    setSaving(false);
  }

  // Eine einzelne Teilzahlung im Entwurf abhaken / wieder öffnen
  function setPartPaid(idx, paid) {
    set({ payments: draft.payments.map((p, i) => (i === idx ? { ...p, paid } : p)) });
  }

  function onStatus() {
    if (allInstant) return undefined;
    if (!editing) return onTogglePaid(entry);
    // Entwurf: alles bezahlt <-> alles wieder offen (sofort Bezahltes bleibt bezahlt)
    set({ payments: setAllPaid(draft.payments, !fully) });
    return undefined;
  }

  return (
    <SheetShell onClose={onClose} labelledBy="ed-title">
      <div className="ed-root">
        <div className="ed-top">
          {editing ? (
            <label className="ed-tag ed-tag--select" style={{ '--dot': DOT[category] }}>
              <i aria-hidden="true" />
              <select value={category} onChange={(e) => set({ category: e.target.value })} aria-label="Ausgabenart">
                {CAT_ORDER.map((k) => <option key={k} value={k}>{CATEGORIES[k]}</option>)}
              </select>
            </label>
          ) : (
            <span className="ed-tag" style={{ '--dot': DOT[category] }}>
              <i aria-hidden="true" />{CATEGORIES[category] || category}
            </span>
          )}
          <button type="button" className="ed-close" onClick={onClose} aria-label="Schließen"><IconClose /></button>
        </div>

        {editing ? (
          <input
            className="ed-name ed-in" id="ed-title" type="text" autoComplete="off" aria-label="Name"
            value={draft.name} onChange={(e) => set({ name: e.target.value })} placeholder="Name"
          />
        ) : (
          <h1 className="ed-name" id="ed-title">{entry.name}</h1>
        )}

        {editing ? (
          <div className="ed-amount">
            <input
              className="ed-in" type="text" inputMode="decimal" autoComplete="off" aria-label="Betrag in Euro"
              style={{ width: `${Math.max(4, draft.amount.length) + 0.5}ch` }}
              value={draft.amount} onChange={(e) => set({ amount: e.target.value })} placeholder="0,00"
            />
            {' '}<span>€</span>
          </div>
        ) : (
          <div className="ed-amount">{NF.format(Number(entry.amount || 0))} <span>€</span></div>
        )}

        {canPay && (
          <button
            type="button"
            className={`ed-status ${fully ? 'is-paid' : ''} ${partly ? 'is-part' : ''}`}
            aria-pressed={partly ? 'mixed' : fully}
            disabled={allInstant}
            onClick={onStatus}
          >
            {fully
              ? <span className="ed-tick" aria-hidden="true"><IconCheck /></span>
              : <span className={`ed-ring ${partly ? 'ed-ring--part' : ''}`} aria-hidden="true" />}
            <span>
              <b>{fully ? 'Bezahlt' : partly ? 'Teilweise bezahlt' : 'Offen'}</b>
              <small>
                {allInstant
                  ? 'Bar, Gutschein und Sparschwein gelten sofort als bezahlt'
                  : fully ? 'Tippen, um wieder auf offen zu setzen'
                    : partly ? `${formatEur(open)} noch offen · Tippen, um alles als bezahlt zu markieren`
                      : 'Tippen, um als bezahlt zu markieren'}
              </small>
            </span>
          </button>
        )}

        {editing && canPay && parts.length > 1 && (
          <ul className="ed-checks" aria-label="Teilzahlungen">
            {parts.map((p, i) => {
              const instant = isInstantMethod(p.method);
              return (
                <li key={i}>
                  <button
                    type="button"
                    role="checkbox"
                    aria-checked={p.paid}
                    disabled={instant}
                    className={`ed-check ${p.paid ? 'is-paid' : ''}`}
                    onClick={() => setPartPaid(i, !p.paid)}
                  >
                    <span className="ed-box" aria-hidden="true">{p.paid && <IconCheck />}</span>
                    <span className="ed-check-t">
                      <b>{p.method} · {formatEur(p.amount)}</b>
                      <small>{instant ? 'Gilt sofort als bezahlt' : p.paid ? 'Bezahlt' : 'Offen — antippen zum Abhaken'}</small>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}

        <div className="ed-list">
          {editing ? (
            <div className="ed-ed" ref={payRef}>
              <span className="ed-k">Zahlungsart</span>
              <PaymentsEditor
                payments={draft.payments}
                onChange={(payments) => set({ payments })}
                totalAmount={amountNorm}
              />
            </div>
          ) : (
            <button type="button" className="ed-li ed-li--parts" onClick={() => startEdit('payment')}>
              <span className="ed-k">Zahlungsart</span>
              {parts.length > 1 ? (
                <span className="ed-v ed-v--parts">
                  <span className="ed-parts">
                    {parts.map((p, i) => (
                      <span key={i} className="ed-part">
                        <span>{p.method} {NF.format(p.amount)} €</span>
                        {canPay && <em className={p.paid ? 'is-paid' : 'is-open'}>{p.paid ? '✓ bezahlt' : 'offen'}</em>}
                      </span>
                    ))}
                  </span>
                  <span className="ed-chev"><IconChevronRight /></span>
                </span>
              ) : (
                <span className="ed-v">{paymentText(entry)}<span className="ed-chev"><IconChevronRight /></span></span>
              )}
            </button>
          )}

          {editing ? (
            <label className="ed-ed ed-ed--row">
              <span className="ed-k">Fällig am</span>
              <input
                ref={dueRef} className="ed-date" type="date" value={draft.dueDate}
                onChange={(e) => set({ dueDate: e.target.value })}
              />
            </label>
          ) : (
            <button type="button" className="ed-li" onClick={() => startEdit('due')}>
              <span className="ed-k">Fällig am</span>
              {entry.due_date
                ? <span className={`ed-v ${overdue ? 'ed-v--bad' : ''}`}>{fmtDue(entry.due_date)}{overdue ? ' · überfällig' : ''}<span className="ed-chev"><IconChevronRight /></span></span>
                : <span className="ed-v ed-v--mut">+ Datum setzen</span>}
            </button>
          )}

          {editing ? (
            <label className="ed-ed">
              <span className="ed-k">Notiz</span>
              <textarea
                ref={noteRef} className="ed-ta" value={draft.note} placeholder="Zusatzinfo …"
                onChange={(e) => set({ note: e.target.value })}
              />
            </label>
          ) : (
            <button type="button" className="ed-li ed-li--note" onClick={() => startEdit('note')}>
              <span className="ed-k">Notiz</span>
              {entry.note
                ? <span className="ed-v ed-v--note">{entry.note}</span>
                : <span className="ed-v ed-v--mut">+ Notiz hinzufügen</span>}
            </button>
          )}

          <div className="ed-ro">
            <span className="ed-k">Herkunft</span>
            <span className="ed-v">{entry.from_template ? 'Festposten (aus Vorlage)' : 'Einzelbuchung'}</span>
          </div>
          {entry.created_at && (
            <div className="ed-ro">
              <span className="ed-k">Erfasst am</span>
              <span className="ed-v">{formatDateTime(entry.created_at)}</span>
            </div>
          )}
        </div>

        <div className="ed-actions">
          {editing ? (
            <>
              <button type="button" className="ed-edit" onClick={submit} disabled={saving}>Speichern</button>
              <div className="ed-sub">
                <button type="button" className="ed-cancel" onClick={() => setDraft(null)} disabled={saving}>Abbrechen</button>
                <button type="button" className="ed-delete" onClick={() => onDelete(entry.id)} disabled={saving}>Eintrag löschen</button>
              </div>
            </>
          ) : (
            <>
              <button type="button" className="ed-edit" onClick={() => startEdit(null)}>
                <span className="ed-edit-ic"><IconEdit /></span>Bearbeiten
              </button>
              <button type="button" className="ed-delete" onClick={() => onDelete(entry.id)}>Eintrag löschen</button>
            </>
          )}
        </div>
      </div>
    </SheetShell>
  );
}
