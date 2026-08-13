export const GENDER = [{ key: 'm', label: 'Männlich' }, { key: 'w', label: 'Weiblich' }];
export const ACTIVITY = [
  { key: 'sitzend', label: 'Sitzend' }, { key: 'leicht', label: 'Leicht aktiv' },
  { key: 'moderat', label: 'Moderat' }, { key: 'aktiv', label: 'Aktiv' }, { key: 'sehrAktiv', label: 'Sehr aktiv' },
];
export const GOAL = [
  { key: 'abnehmen', label: 'Abnehmen' }, { key: 'halten', label: 'Halten' },
  { key: 'zunehmen', label: 'Zunehmen' }, { key: 'muskel', label: 'Muskelaufbau' },
];
const NUMBER_FIELDS = [
  ['age', 'Alter', 'Jahre', 1, 120],
  ['height', 'Größe', 'cm', 100, 230],
  ['weight', 'Gewicht', 'kg', 30, 300],
];

// Körperdaten-Formular — lebt in core/, weil die Daten seit der
// Migration in body_profile liegen und mehreren Modulen gehören
// (aktuell Ernährung, künftig Sport). Rein präsentational: value/
// onChange, keine eigene Datenanbindung.
export default function BodyProfileForm({ value, onChange }) {
  function set(key, val) {
    onChange({ ...value, [key]: val });
  }

  return (
    <>
      <div className="card-title" style={{ marginTop: 4 }}>Körperdaten</div>
      <div className="segmented cols-2" style={{ marginBottom: 12 }}>
        {GENDER.map((g) => (
          <button key={g.key} className={value.gender === g.key ? 'active' : ''} onClick={() => set('gender', g.key)}>{g.label}</button>
        ))}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 20 }}>
        {NUMBER_FIELDS.map(([key, label, unit, min, max]) => (
          <div className="form-group" key={key}>
            <label>{label} ({unit})</label>
            <input
              type="number" min={min} max={max} style={{ textAlign: 'center' }}
              value={value[key] || ''}
              onChange={(e) => set(key, +e.target.value || '')}
            />
          </div>
        ))}
      </div>

      <div className="card-title">Aktivität &amp; Ziel</div>
      <div className="form-group" style={{ marginBottom: 10 }}>
        <label>Aktivitätslevel</label>
        <div className="segmented cols-3">
          {ACTIVITY.map((a) => (
            <button key={a.key} className={value.activity === a.key ? 'active' : ''} onClick={() => set('activity', a.key)}>{a.label}</button>
          ))}
        </div>
      </div>
      <div className="form-group">
        <label>Ziel</label>
        <div className="segmented cols-4">
          {GOAL.map((g) => (
            <button key={g.key} className={value.goal === g.key ? 'active' : ''} onClick={() => set('goal', g.key)}>{g.label}</button>
          ))}
        </div>
      </div>
    </>
  );
}
