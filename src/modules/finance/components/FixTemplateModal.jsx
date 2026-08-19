import { useState } from 'react';
import Modal from '../../../core/components/Modal';
import { FIX_TEMPLATE_CATEGORIES, INTERVALS, PAYMENTS, MONTHS_DE } from '../lib/finance';

const INTERVAL_OPTIONS = Object.entries(INTERVALS).map(([value, { label }]) => ({ value, label }));

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
  const [name, setName]           = useState(tpl?.name || '');
  const [payment, setPayment]     = useState(tpl?.payment || 'Bank');
  const [amount, setAmount]       = useState(tpl?.amount ?? '');

  const initialInterval = tpl?.interval ?? (tpl?.quarterly ? 'quarterly' : 'monthly');
  const [interval, setInterval]   = useState(initialInterval);
  const [startMonth, setStartMonth] = useState(tpl?.start_month || currentMonth);

  // Beginn/Ende — neu
  const [startDate, setStartDate]   = useState(tpl?.start_date || '');
  const [isOpen, setIsOpen]         = useState(tpl?.is_open ?? false);
  const [durationMonths, setDurationMonths] = useState(tpl?.contract_duration_months ?? '');
  const [endDate, setEndDate]       = useState(tpl?.end_date || '');
  const [useDurationMonths, setUseDurationMonths] = useState(
    !!tpl?.contract_duration_months && !tpl?.end_date
  );

  const isRecurring = interval !== 'monthly';

  function submit() {
    if (!name.trim()) return showToast('Bitte Name eingeben');
    const amt = parseFloat(amount);
    if (isNaN(amt) || amt < 0) return showToast('Bitte gültigen Betrag eingeben');

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
      start_date: startDate || null,
      is_open: isOpen,
      end_date: isOpen ? null : resolvedEndDate,
      contract_duration_months: isOpen ? null : contractDurationMonths,
    });
  }

  const intervalMonths = INTERVALS[interval]?.months ?? 1;
  const amtNum = parseFloat(amount) || 0;
  const monthlyHint = intervalMonths > 1
    ? `≈ ${(amtNum / intervalMonths).toFixed(2).replace('.', ',')} €/Mo.`
    : null;

  return (
    <Modal title={tpl ? 'Posten bearbeiten' : 'Posten hinzufügen'} onClose={onClose}>

      {/* Art */}
      <div className="form-group">
        <label>Art</label>
        <select value={category} onChange={(e) => setCategory(e.target.value)}>
          {Object.entries(FIX_TEMPLATE_CATEGORIES).map(([v, l]) => (
            <option key={v} value={v}>{l}</option>
          ))}
        </select>
      </div>

      {/* Name */}
      <div className="form-group">
        <label>Name</label>
        <input type="text" value={name} onChange={(e) => setName(e.target.value)}
          placeholder="z.B. Miete, Gehalt..." />
      </div>

      {/* Zahlungsart + Betrag */}
      <div className="form-row">
        <div className="form-group">
          <label>Zahlungsart</label>
          <select value={payment} onChange={(e) => setPayment(e.target.value)}>
            {PAYMENTS.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
        <div className="form-group">
          <label>Betrag (€)</label>
          <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)}
            min="0" step="0.01" placeholder="0,00" />
          {monthlyHint && (
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 4, display: 'block' }}>
              {monthlyHint}
            </span>
          )}
        </div>
      </div>

      {/* Intervall */}
      <div className="form-group">
        <label>Zahlungsintervall</label>
        <select value={interval} onChange={(e) => setInterval(e.target.value)}>
          {INTERVAL_OPTIONS.map(({ value, label }) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
      </div>

      {/* Startmonat (nur bei nicht-monatlich) */}
      {isRecurring && (
        <div className="form-group">
          <label>Startmonat</label>
          <select value={startMonth} onChange={(e) => setStartMonth(Number(e.target.value))}>
            {MONTHS_DE.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
          </select>
          <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 4, display: 'block' }}>
            Erster Fälligkeitsmonat — danach alle {INTERVALS[interval]?.months} Monate.
          </span>
        </div>
      )}

      {/* Beginn */}
      <div className="form-group">
        <label>Beginn (optional)</label>
        <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
      </div>

      {/* Unbefristet */}
      <div className="form-group">
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', margin: 0 }}>
          <input type="checkbox" checked={isOpen} onChange={(e) => setIsOpen(e.target.checked)}
            style={{ width: 'auto', accentColor: 'var(--accent)' }} />
          Unbefristet / läuft bis auf Weiteres
        </label>
      </div>

      {/* Ende / Laufzeit */}
      {!isOpen && (
        <>
          <div className="form-group">
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', margin: 0 }}>
              <input type="checkbox" checked={useDurationMonths}
                onChange={(e) => setUseDurationMonths(e.target.checked)}
                style={{ width: 'auto', accentColor: 'var(--accent)' }} />
              Laufzeit in Monaten angeben
            </label>
          </div>

          {useDurationMonths ? (
            <div className="form-group">
              <label>Laufzeit (Monate)</label>
              <input type="number" value={durationMonths}
                onChange={(e) => setDurationMonths(e.target.value)}
                min="1" step="1" placeholder="z.B. 24" />
              {durationMonths && startDate && (() => {
                const s = new Date(startDate);
                if (!isNaN(s) && parseInt(durationMonths) > 0) {
                  const e = new Date(s);
                  e.setMonth(e.getMonth() + parseInt(durationMonths));
                  return (
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 4, display: 'block' }}>
                      Ende: {e.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                    </span>
                  );
                }
                return null;
              })()}
            </div>
          ) : (
            <div className="form-group">
              <label>Ende (optional)</label>
              <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </div>
          )}
        </>
      )}

      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 4 }}>
        {tpl && (
          <button className="btn btn-danger" style={{ marginRight: 'auto' }}
            onClick={() => onDelete(tpl.id)}>
            Löschen
          </button>
        )}
        <button className="btn btn-secondary" onClick={onClose}>Abbrechen</button>
        <button className="btn btn-primary" onClick={submit}>Speichern</button>
      </div>
    </Modal>
  );
}
