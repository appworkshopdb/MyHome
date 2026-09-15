// core/components/PaymentsEditor.jsx
// Wiederverwendbar für EntrySheet (Wizard) und EntryModal (Bearbeiten).

const QUICK_PAYMENTS = ['Bar', 'Bank', 'Paypal', 'SEPA', 'Klarna', 'Sparschwein', 'Gutschein'];

export default function PaymentsEditor({ payments, onChange, totalAmount }) {
  const multi = payments.length > 1;

  function getRestAmount() {
    const sumOthers = payments.slice(0, -1)
      .reduce((s, p) => s + (parseFloat(p.amount) || 0), 0);
    const rest = (parseFloat(totalAmount) || 0) - sumOthers;
    return rest >= 0 ? rest.toFixed(2) : '0.00';
  }

  function setMethod(idx, method) {
    onChange(payments.map((p, i) => i === idx ? { ...p, method } : p));
  }

  function setAmount(idx, val) {
    onChange(payments.map((p, i) => i === idx ? { ...p, amount: val } : p));
  }

  function addPayment() {
    onChange([...payments, { method: 'Bank', amount: '' }]);
  }

  function removePayment(idx) {
    if (payments.length <= 1) return;
    onChange(payments.filter((_, i) => i !== idx));
  }

  return (
    <div className="wiz-payments">
      {payments.map((p, idx) => {
        const isLast = idx === payments.length - 1;
        return (
          <div key={idx} className="wiz-payment-row">
            {/* Zahlungsart Pills */}
            <div className="wiz-pay-row">
              {QUICK_PAYMENTS.map((m) => (
                <button
                  key={m}
                  className={`wiz-pay ${p.method === m ? 'active' : ''}`}
                  onClick={() => setMethod(idx, m)}
                >
                  {m}
                </button>
              ))}
            </div>

            {/* Betrag + Entfernen — nur bei mehreren Zahlungsarten */}
            {multi && (
              <div className="wiz-payment-amount-row">
                {isLast ? (
                  // Letzter Eintrag: Rest automatisch berechnet
                  <div className="wiz-payment-rest">
                    <span className="t-meta" style={{ color: 'var(--text-muted)' }}>Rest</span>
                    <span className="t-body" style={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
                      {getRestAmount()} €
                    </span>
                  </div>
                ) : (
                  <input
                    className="wiz-input wiz-payment-amount-input"
                    type="number"
                    inputMode="decimal"
                    value={p.amount ?? ''}
                    onChange={(e) => setAmount(idx, e.target.value)}
                    placeholder="Betrag"
                    min="0"
                    step="0.01"
                  />
                )}
                <button
                  className="wiz-payment-remove"
                  onClick={() => removePayment(idx)}
                  aria-label="Zahlungsart entfernen"
                >
                  ×
                </button>
              </div>
            )}
          </div>
        );
      })}

      <button className="wiz-payment-add" onClick={addPayment}>
        + Weitere Zahlungsart
      </button>
    </div>
  );
}
