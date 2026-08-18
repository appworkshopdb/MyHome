export default function CalendarLegend() {
  return (
    <div style={{ display: 'flex', gap: 16, marginTop: 12, fontSize: '0.75rem', color: 'var(--text-secondary)', flexWrap: 'wrap' }}>
      <span><span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 3, background: 'var(--accent)', marginRight: 4 }} />erledigt</span>
      <span><span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 3, border: '2px solid var(--accent)', marginRight: 4 }} />geplant</span>
      <span><span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 3, background: 'repeating-linear-gradient(135deg, var(--bg-input), var(--bg-input) 2px, var(--border-strong) 2px, var(--border-strong) 4px)', marginRight: 4 }} />Ruhetag</span>
    </div>
  );
}
