// modules/finance/components/EntryDetailSheet.jsx
//
// Ansicht eines bereits angelegten Postens: erst ansehen, dann bearbeiten.
// Oben Name und Betrag, darunter der Status (ein Tipp setzt offen ↔ bezahlt),
// die Details und unten "Bearbeiten" / "Eintrag löschen". Das eigentliche
// Formular (EntryModal) öffnet erst "Bearbeiten" — oder ein Tipp auf eine
// leere Zeile wie "+ Notiz hinzufügen".
//
// Der Eintrag kommt "live" aus der Monatsliste, damit der Status-Knopf sofort
// den neuen Stand zeigt.

import SheetShell from '../../../core/components/SheetShell';
import { IconClose, IconEdit, IconChevronRight, IconCheck } from '../../../core/components/Icons';
import { CATEGORIES, formatDateTime, formatPayments, isSparschweinDeposit } from '../lib/finance';
import { toDateStr } from '../lib/analytics';

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

export default function EntryDetailSheet({ entry, onClose, onEdit, onDelete, onTogglePaid }) {
  const isIncome = INCOME.has(entry.category);
  const canPay = !isIncome && !isSparschweinDeposit(entry);
  const overdue = canPay && !entry.paid && entry.due_date && String(entry.due_date).slice(0, 10) < toDateStr(new Date());

  return (
    <SheetShell onClose={onClose} labelledBy="ed-title">
      <div className="ed-root">
        <div className="ed-top">
          <span className="ed-tag" style={{ '--dot': DOT[entry.category] }}>
            <i aria-hidden="true" />{CATEGORIES[entry.category] || entry.category}
          </span>
          <button type="button" className="ed-close" onClick={onClose} aria-label="Schließen"><IconClose /></button>
        </div>

        <h1 className="ed-name" id="ed-title">{entry.name}</h1>
        <div className="ed-amount">{NF.format(Number(entry.amount || 0))} <span>€</span></div>

        {canPay && (
          <button
            type="button"
            className={`ed-status ${entry.paid ? 'is-paid' : ''}`}
            aria-pressed={!!entry.paid}
            onClick={() => onTogglePaid(entry)}
          >
            {entry.paid
              ? <span className="ed-tick" aria-hidden="true"><IconCheck /></span>
              : <span className="ed-ring" aria-hidden="true" />}
            <span>
              <b>{entry.paid ? 'Bezahlt' : 'Offen'}</b>
              <small>{entry.paid ? 'Tippen, um wieder auf offen zu setzen' : 'Tippen, um als bezahlt zu markieren'}</small>
            </span>
          </button>
        )}

        <div className="ed-list">
          <button type="button" className="ed-li" onClick={() => onEdit(entry)}>
            <span className="ed-k">Zahlungsart</span>
            <span className="ed-v">{paymentText(entry)}<span className="ed-chev"><IconChevronRight /></span></span>
          </button>
          <button type="button" className="ed-li" onClick={() => onEdit(entry)}>
            <span className="ed-k">Fällig am</span>
            {entry.due_date
              ? <span className={`ed-v ${overdue ? 'ed-v--bad' : ''}`}>{fmtDue(entry.due_date)}{overdue ? ' · überfällig' : ''}<span className="ed-chev"><IconChevronRight /></span></span>
              : <span className="ed-v ed-v--mut">+ Datum setzen</span>}
          </button>
          <button type="button" className="ed-li ed-li--note" onClick={() => onEdit(entry)}>
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
          <button type="button" className="ed-edit" onClick={() => onEdit(entry)}>
            <span className="ed-edit-ic"><IconEdit /></span>Bearbeiten
          </button>
          <button type="button" className="ed-delete" onClick={() => onDelete(entry.id)}>Eintrag löschen</button>
        </div>
      </div>
    </SheetShell>
  );
}
