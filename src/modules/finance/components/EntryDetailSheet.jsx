// modules/finance/components/EntryDetailSheet.jsx
//
// Ansicht eines bereits angelegten Postens. "Bearbeiten" (oder ein Tipp auf eine
// Zeile) wechselt zur Bearbeitungsansicht (EntryEditForm.jsx), die wie
// "Neuer Eintrag" aufgebaut ist; "Speichern" kehrt hierher zurück.
//
// Teilzahlungen: Bar, Gutschein und Sparschwein gelten SOFORT als bezahlt, offen
// ist nur der Rest (core/lib/paymentParts.js). Bei geteilter Zahlung zeigt die
// Ansicht jede Teilzahlung mit ihrem Status; der Status-Knopf setzt offen ↔
// bezahlt sofort (wie in der Liste).
//
// Der Eintrag kommt "live" aus der Monatsliste, damit nach dem Speichern sofort
// die neuen Werte stehen.

import { useState } from 'react';
import SheetShell from '../../../core/components/SheetShell';
import { IconClose, IconEdit, IconChevronRight, IconCheck } from '../../../core/components/Icons';
import {
  CATEGORIES, formatDateTime, formatPayments, formatEur, isSparschweinDeposit,
  isInstantMethod, entryParts, openAmount, isFullyPaid, isPartlyPaid,
} from '../lib/finance';
import { toDateStr } from '../lib/analytics';
import EntryEditForm from './EntryEditForm';

const INCOME = new Set(['fixeinnahmen', 'sonstige_einnahmen']);
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

export default function EntryDetailSheet({ entry, onClose, onSave, onDelete, onTogglePaid, onTogglePart, showToast, startInEdit = false }) {
  // Bearbeiten: eigene Ansicht im Aufbau von "Neuer Eintrag". focus = Feld, das der Tipp in der Ansicht meinte.
  const [edit, setEdit] = useState(startInEdit ? { focus: null } : null);

  function startEdit(target = null) { setEdit({ focus: target }); }

  async function save(updated) {
    await onSave(updated);
    setEdit(null); // zurück zur Ansicht mit den neuen Werten
  }

  if (edit) {
    return (
      <SheetShell onClose={onClose} wizard>
        <EntryEditForm
          entry={entry} focus={edit.focus} onClose={onClose}
          onSave={save} onDelete={onDelete} showToast={showToast}
        />
      </SheetShell>
    );
  }

  const { category } = entry;
  const canPay = !INCOME.has(category) && !isSparschweinDeposit(entry);
  const overdue = canPay && !isFullyPaid(entry) && entry.due_date
    && String(entry.due_date).slice(0, 10) < toDateStr(new Date());

  const parts = entryParts(entry);
  const fully = isFullyPaid(entry);
  const partly = isPartlyPaid(entry);
  const allInstant = parts.every((p) => isInstantMethod(p.method));
  const open = openAmount(entry);

  function onStatus() {
    if (allInstant) return;
    onTogglePaid(entry);
  }

  return (
    <SheetShell onClose={onClose} labelledBy="ed-title">
      <div className="ed-root">
        <div className="ed-top">
          <span className="ed-tag" style={{ '--dot': DOT[category] }}>
            <i aria-hidden="true" />{CATEGORIES[category] || category}
          </span>
          <button type="button" className="ed-close" onClick={onClose} aria-label="Schließen"><IconClose /></button>
        </div>

        <h1 className="ed-name" id="ed-title">{entry.name}</h1>
        <div className="ed-amount">{NF.format(Number(entry.amount || 0))} <span>€</span></div>

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

        {canPay && parts.length > 1 && (
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
                    onClick={() => onTogglePart(entry, i)}
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
          <button type="button" className="ed-li ed-li--parts" onClick={() => startEdit('payment')}>
            <span className="ed-k">Zahlungsart</span>
            {parts.length > 1 ? (
              <span className="ed-v ed-v--parts">
                <span className="ed-parts">
                  {parts.map((p, i) => (
                    <span key={i} className="ed-part">
                      <span>{p.method} {NF.format(p.amount)} €</span>
                    </span>
                  ))}
                </span>
                <span className="ed-chev"><IconChevronRight /></span>
              </span>
            ) : (
              <span className="ed-v">{paymentText(entry)}<span className="ed-chev"><IconChevronRight /></span></span>
            )}
          </button>

          <button type="button" className="ed-li" onClick={() => startEdit('due')}>
            <span className="ed-k">Fällig am</span>
            {entry.due_date
              ? <span className={`ed-v ${overdue ? 'ed-v--bad' : ''}`}>{fmtDue(entry.due_date)}{overdue ? ' · überfällig' : ''}<span className="ed-chev"><IconChevronRight /></span></span>
              : <span className="ed-v ed-v--mut">+ Datum setzen</span>}
          </button>

          <button type="button" className="ed-li ed-li--note" onClick={() => startEdit('note')}>
            <span className="ed-k">Notiz</span>
            {entry.note
              ? <span className="ed-v ed-v--note">{entry.note}</span>
              : <span className="ed-v ed-v--mut">+ Notiz hinzufügen</span>}
          </button>

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
          <button type="button" className="ed-edit" onClick={() => startEdit(null)}>
            <span className="ed-edit-ic"><IconEdit /></span>Bearbeiten
          </button>
          <button type="button" className="ed-delete" onClick={() => onDelete(entry.id)}>Eintrag löschen</button>
        </div>
      </div>
    </SheetShell>
  );
}
