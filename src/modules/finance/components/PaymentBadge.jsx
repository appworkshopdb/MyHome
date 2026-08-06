const MAP = {
  Bank: 'bank', Bar: 'bar', Paypal: 'paypal',
  SEPA: 'sepa', Gutschein: 'gutschein', Klarna: 'klarna',
};

export default function PaymentBadge({ payment }) {
  if (!payment) return <span>—</span>;
  return <span className={`badge badge-${MAP[payment] || 'bank'}`}>{payment}</span>;
}
