// modules/finance/components/EntryDetailSheet.jsx
//
// Ansicht eines bereits angelegten Postens, im Aufbau von "Neuer Eintrag" und
// "Posten bearbeiten": gleiche Kopfzeile (WizardFrame), gleiche Reihenfolge und
// Beschriftungen, aber als Text mit feinen Linien (nur lesen). "Bearbeiten" (oder
// ein Tipp auf Zahlungsart, Fällig am oder Notiz) wechselt zur Bearbeitung
// (EntryEditForm.jsx); "Speichern" kehrt hierher zurück.
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
import { WizardFoot, WizardFrame } from '../../../core/components/wizard/WizardKit';
import { IconEdit, IconTrash, IconChevronRight, IconCheck } from '../../../core/components/Icons';
import {
  formatDateTime, formatPayments, formatEur, isSparschweinDeposit,
  isInstantMethod, entryParts, openAmount, isFullyPaid, isPartlyPaid,
} from '../lib/finance';
import { toDateStr } from '../lib/analytics';
import EntryEditForm, { CATEGORY_ITEMS } from './EntryEditForm';
import { Button } from '../../../core/components/ui';

const INCOME = new Set(['fixeinnahmen', 'sonstige_einnahmen']);
const DOT = {
  fixeinnahmen: 'var(--status-positive)',
  sonstige_einnahmen: 'var(--status-positive)',
  fixkosten: 'var(--data-1)',
  variable_kosten: 'var(--data-2)',
  sonstige_ausgaben: 'var(--data-3)',
};

const CAT_LABEL = Object.fromEntries(CATEGORY_ITEMS.map((c) => [c.value, c.label]));

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
  const split = parts.length > 1;

  function onStatus() {
    if (allInstant) return;
    onTogglePaid(entry);
  }

  return (
    <SheetShell onClose={onClose} wizard>
      <WizardFrame
        title="Posten"
        sub={entry.created_at ? `Erfasst am ${formatDateTime(entry.created_at)}` : undefined}
        stepKey="view"
        onClose={onClose}
        footer={(
          <WizardFoot>
            <Button variant="secondary" icon="trash" className="vw-del" onClick={() => onDelete(entry.id)} aria-label="Eintrag löschen">Löschen</Button>
            <Button icon="edit" className="vw-edit" onClick={() => startEdit(null)}>Bearbeiten</Button>
          </WizardFoot>
        )}
      >
        <div className="vw-sec">
          <span className="wz-lbl">Name</span>
          <h1 className="vw-v vw-v--name" id="ed-title">{entry.name}</h1>
        </div>

        <div className="vw-sec">
          <span className="wz-lbl">Betrag</span>
          <div className="vw-amt">{NF.format(Number(entry.amount || 0))} <span>€</span></div>
        </div>

        <button type="button" className="vw-sec vw-btn" onClick={() => startEdit('payment')}>
          <span className="vw-two">
            <span>
              <span className="wz-lbl">Kategorie</span>
              <span className="vw-v vw-dot" style={{ '--dot': DOT[category] }}><i aria-hidden="true" />{CAT_LABEL[category] || category}</span>
            </span>
            <span>
              <span className="wz-lbl">Zahlungsart</span>
              <span className="vw-v">{split && canPay ? parts.map((p) => p.method).join(' · ') : paymentText(entry)}</span>
            </span>
          </span>
        </button>

        {canPay && (
          <div className="vw-sec">
            <span className="wz-lbl">Status</span>
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
            {split && (
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
          </div>
        )}

        <button type="button" className="vw-sec vw-btn" onClick={() => startEdit('due')}>
          <span className="wz-lbl">Fällig am <span className="opt">optional</span></span>
          {entry.due_date
            ? (
              <span className="vw-row">
                <span className={`vw-v ${overdue ? 'vw-v--bad' : ''}`}>{fmtDue(entry.due_date)}{overdue ? ' · überfällig' : ''}</span>
                <IconChevronRight />
              </span>
            )
            : <span className="vw-v vw-v--mut">+ Datum setzen</span>}
        </button>

        <button type="button" className="vw-sec vw-btn" onClick={() => startEdit('note')}>
          <span className="wz-lbl">Notiz <span className="opt">optional</span></span>
          {entry.note
            ? <span className="vw-v vw-v--note">{entry.note}</span>
            : <span className="vw-v vw-v--mut">+ Notiz hinzufügen</span>}
        </button>

        <div className="vw-meta">
          <span>Herkunft</span>
          <b>{entry.from_template ? 'Festposten (aus Vorlage)' : 'Einzelbuchung'}</b>
        </div>
      </WizardFrame>
    </SheetShell>
  );
}
