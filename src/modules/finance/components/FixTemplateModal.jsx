import { useState } from 'react';
import { FIX_TEMPLATE_CATEGORIES, INTERVALS, PAYMENTS, MONTHS_DE } from '../lib/finance';
import SheetShell from '../../../core/components/SheetShell';

const INTERVAL_OPTIONS = Object.entries(INTERVALS).map(([value, { label }]) => ({ value, label }));

// Gemeinsamer Wizard für Fixkosten UND Einnahmen-Vorlagen.
// type-Auswahl oben: 'fixkosten' | 'fixeinnahmen'
export default function FixTemplateModal({
  tpl,
  initialCategory = 'fixkosten',
  currentMonth,
  currentYear,
  onSave,
  onDelete,
  onClose,
  showToast,
}) {
  const [category, setCategory]   = useState(tpl?.category || initialCategory);
  const [name,     setName]       = useState(tpl?.name || '');
  const [payment,  setPayment]    = useState(tpl?.payment || 'Bank');
  const [amount,   setAmount]     = useState(tpl?.amount ?? '');
  const [dueDay,   setDueDay]     = useState(tpl?.due_day ?? '');

  const initialInterval = tpl?.interval ?? (tpl?.quarterly ? 'quarterly' : 'monthly');
  const [interval,     setInterval]     = useState(initialInterval);
  const [startMonth,   setStartMonth]   = useState(tpl?.start_month || currentMonth);
  const [startDate,    setStartDate]    = useState(tpl?.start_date || '');
  const [isOpen,       setIsOpen]       = useState(tpl?.is_open ?? false);
  const [durationMonths, setDurationMonths] = useState(tpl?.contract_duration_months ?? '');
  const [endDate,      setEndDate]      = useState(tpl?.end_date || '');
  const [useDurationMonths, setUseDurationMonths] = useState(
    !!tpl?.contract_duration_months && !tpl?.end_date
  );

  const isRecurring  = interval !== 'monthly';
  const intervalMths = INTERVALS[interval]?.months ?? 1;
  const amtNum       = parseFloat(amount) || 0;
  const monthlyHint  = intervalMths > 1
    ? `≈ ${(amtNum / intervalMths).toFixed(2).replace('.', ',')} €/Mo.`
    : null;

  // Typ-Auswahl oben — Fixkosten vs. Einnahme
  const TYPE_OPTS = [
    { key: 'fixkosten',    label: 'Fixkosten'  },
    { key: 'fixeinnahmen', label: 'Einnahme'   },
  ];

  function submit() {
    if (!name.trim()) return showToast('Bitte Name eingeben');
    const amt = parseFloat(amount);
    if (isNaN(amt) || amt < 0) return showToast('Bitte gültigen Betrag eingeben');
    const dd = dueDay !== '' ? parseInt(dueDay, 10) : null;
    if (dd !== null && (dd < 1 || dd > 31)) return showToast('Fälligkeitstag muss zwischen 1 und 31 liegen');

    let contractDurationMonths = null;
    let resolvedEndDate = null;
    if (!isOpen) {
      if (useDurationMonths) {
        const dm = parseInt(durationMonths, 10);
        if (!isNaN(dm) && dm > 0) contractDurationMonths = dm;
      } else {
        resolvedEndDate = endDate || null;
      }
    }

    onSave({
      ...(tpl || {}),
      category,
      name: name.trim(),
      payment,
      amount: amt,
      interval,
      quarterly: interval === 'quarterly',
      start_month: isRecurring ? startMonth : null,
      start_year:  isRecurring ? (tpl?.start_year || currentYear) : null,
      start_date:  startDate || null,
      is_open:     isOpen,
      end_date:    isOpen ? null : resolvedEndDate,
      contract_duration_months: isOpen ? null : contractDurationMonths,
      due_day:     dd,
    });
  }

  const title = tpl ? 'Posten bearbeiten' : 'Posten hinzufügen';

  return (
    <SheetShell onClose={onClose}>
      <div className="sheet-header">
        <div className="sheet-title t-title">{title}</div>
        <button className="sheet-cancel" onClick={onClose}>Abbrechen</button>
      </div>

      <div className="wiz-body">

        {/* Typ-Auswahl (nur bei Neuanlage, beim Bearbeiten ist es fix) */}
        {!tpl && (
          <>
            <label className="wiz-label t-meta">Art</label>
            <div className="wiz-cat-grid">
              {TYPE_OPTS.map((t) => (
                <button
                  key={t.key}
                  className={`wiz-cat ${category === t.key ? 'active' : ''}`}
                  onClick={() => setCategory(t.key)}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </>
        )}

        {/* Name */}
        <label className="wiz-label t-meta" style={{ marginTop: tpl ? 0 : 'var(--space-5)' }}>Name</label>
        <input
          className="wiz-input"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={category === 'fixeinnahmen' ? 'z.B. Gehalt, Rente…' : 'z.B. Miete, Strom…'}
          autoFocus
          autoComplete="off"
        />

        {/* Zahlungsart */}
        <label className="wiz-label t-meta" style={{ marginTop: 'var(--space-5)' }}>Zahlungsart</label>
        <div className="wiz-pay-row">
          {PAYMENTS.map((p) => (
            <button
              key={p}
              className={`wiz-pay ${payment === p ? 'active' : ''}`}
              onClick={() => setPayment(p)}
            >
              {p}
            </button>
          ))}
        </div>

        {/* Betrag + Fällig am — nebeneinander */}
        <div className="modal-row-2col">
          <div>
            <label className="wiz-label t-meta">Betrag (€)</label>
            <input
              className="wiz-input"
              type="number"
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              min="0"
              step="0.01"
              placeholder="0,00"
            />
            {monthlyHint && (
              <span className="t-meta" style={{ color: 'var(--text-muted)', marginTop: 4, display: 'block' }}>
                {monthlyHint}
              </span>
            )}
          </div>
          <div>
            <label className="wiz-label t-meta">
              Fällig am <span className="wiz-optional">Tag</span>
            </label>
            <input
              className="wiz-input"
              type="number"
              inputMode="numeric"
              value={dueDay}
              onChange={(e) => setDueDay(e.target.value)}
              min="1"
              max="31"
              placeholder="z.B. 1"
            />
          </div>
        </div>

        {/* Zahlungsintervall */}
        <label className="wiz-label t-meta" style={{ marginTop: 'var(--space-5)' }}>Zahlungsintervall</label>
        <select
          className="wiz-input"
          value={interval}
          onChange={(e) => setInterval(e.target.value)}
        >
          {INTERVAL_OPTIONS.map(({ value, label }) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>

        {/* Startmonat (nur bei nicht-monatlich) */}
        {isRecurring && (
          <>
            <label className="wiz-label t-meta" style={{ marginTop: 'var(--space-5)' }}>Startmonat</label>
            <select
              className="wiz-input"
              value={startMonth}
              onChange={(e) => setStartMonth(Number(e.target.value))}
            >
              {MONTHS_DE.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
            </select>
            <span className="t-meta" style={{ color: 'var(--text-muted)', marginTop: 4, display: 'block' }}>
              Erster Fälligkeitsmonat — danach alle {INTERVALS[interval]?.months} Monate.
            </span>
          </>
        )}

        {/* Beginn */}
        <label className="wiz-label t-meta" style={{ marginTop: 'var(--space-5)' }}>
          Beginn <span className="wiz-optional">optional</span>
        </label>
        <input
          className="wiz-input"
          type="date"
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
        />

        {/* Unbefristet */}
        <label className="modal-checkbox-label t-body" style={{ marginTop: 'var(--space-4)' }}>
          <input
            type="checkbox"
            checked={isOpen}
            onChange={(e) => setIsOpen(e.target.checked)}
          />
          Unbefristet / läuft bis auf Weiteres
        </label>

        {/* Ende / Laufzeit */}
        {!isOpen && (
          <>
            <label className="modal-checkbox-label t-body" style={{ marginTop: 'var(--space-3)' }}>
              <input
                type="checkbox"
                checked={useDurationMonths}
                onChange={(e) => setUseDurationMonths(e.target.checked)}
              />
              Laufzeit in Monaten angeben
            </label>

            {useDurationMonths ? (
              <>
                <label className="wiz-label t-meta" style={{ marginTop: 'var(--space-4)' }}>
                  Laufzeit (Monate)
                </label>
                <input
                  className="wiz-input"
                  type="number"
                  value={durationMonths}
                  onChange={(e) => setDurationMonths(e.target.value)}
                  min="1"
                  step="1"
                  placeholder="z.B. 24"
                />
                {durationMonths && startDate && (() => {
                  const s = new Date(startDate);
                  if (!isNaN(s) && parseInt(durationMonths) > 0) {
                    const end = new Date(s);
                    end.setMonth(end.getMonth() + parseInt(durationMonths));
                    return (
                      <span className="t-meta" style={{ color: 'var(--text-muted)', marginTop: 4, display: 'block' }}>
                        Ende: {end.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                      </span>
                    );
                  }
                  return null;
                })()}
              </>
            ) : (
              <>
                <label className="wiz-label t-meta" style={{ marginTop: 'var(--space-4)' }}>
                  Ende <span className="wiz-optional">optional</span>
                </label>
                <input
                  className="wiz-input"
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </>
            )}
          </>
        )}
      </div>

      {/* Aktionszeile */}
      <div className="entry-modal-actions">
        {tpl && (
          <button
            className="btn btn-danger"
            style={{ marginRight: 'auto' }}
            onClick={() => onDelete(tpl.id)}
          >
            Löschen
          </button>
        )}
        <button className="btn btn-secondary" onClick={onClose}>Abbrechen</button>
        <button className="btn btn-primary"   onClick={submit}>Speichern</button>
      </div>
    </SheetShell>
  );
}
