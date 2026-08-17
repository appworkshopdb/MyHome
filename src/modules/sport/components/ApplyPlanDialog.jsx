import { useState } from 'react';

const TODAY = () => new Date().toISOString().slice(0, 10);
const WEEKDAYS = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];

// Zeigt vor dem Übertragen konkret, auf welche Kalendertage die Vorlage
// fällt. Ohne diese Vorschau müsste man raten, wo ein 5-Tage-Plan mit
// Ruhetag in der Mitte endet.
export default function ApplyPlanDialog({ plan, onApply, onCancel }) {
  const [startDate, setStartDate] = useState(TODAY);

  const start = new Date(`${startDate}T00:00:00`);
  const preview = plan.items.map((item) => {
    const date = new Date(start);
    date.setDate(date.getDate() + item.day_index);
    return { item, date };
  });

  return (
    <div className="card">
      <div className="card-title">„{plan.title}" eintragen</div>

      <div className="form-group">
        <label>Startdatum</label>
        <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
      </div>

      <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: 8 }}>
        Vorschau
      </div>

      {preview.map(({ item, date }) => (
        <div
          key={item.day_index}
          style={{
            display: 'flex', justifyContent: 'space-between', gap: 8,
            padding: '6px 0', borderBottom: '1px solid var(--border)',
            fontSize: '0.85rem', opacity: item.is_rest ? 0.55 : 1,
          }}
        >
          <span style={{ color: 'var(--text-secondary)' }}>
            {WEEKDAYS[date.getDay()].slice(0, 2)}. {date.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' })}
          </span>
          <span style={{ fontWeight: item.is_rest ? 400 : 600, textAlign: 'right' }}>
            {item.is_rest ? 'Ruhetag (kein Eintrag)' : item.title}
          </span>
        </div>
      ))}

      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 12 }}>
        <button className="btn btn-secondary" onClick={onCancel}>Abbrechen</button>
        <button className="btn btn-primary" onClick={() => onApply(plan, startDate)}>In Kalender eintragen</button>
      </div>
    </div>
  );
}
