import { useState } from 'react';
import { MusclePreview } from './EinheitenListShared';
import { MUSCLE_GROUPS, MUSCLE_SINGLES, muscleSinglesByRegion } from '../lib/data/muscleGroups';
import { muscleLabel } from '../lib/planMuscles';

// Muskeln wählen für eine eigene Einheit (z. B. Brust + Beine): zuerst die sechs
// Muskelgruppen mit ihren Bildern, auf Wunsch darunter die einzelnen Muskeln
// (vorne/hinten). Die Reihenfolge der Auswahl bleibt erhalten, die ersten
// Bilder sind später die der Einheit.
function Card({ item, on, onToggle }) {
  return (
    <button type="button" className={`mp-card${on ? ' is-on' : ''}`} aria-pressed={on} onClick={() => onToggle(item.key)}>
      <MusclePreview tags={[item.key]} size={44} />
      <b>{muscleLabel(item.key)}</b>
    </button>
  );
}

export default function MusclePicker({ value, onChange }) {
  const [more, setMore] = useState(value.some((k) => MUSCLE_SINGLES.some((s) => s.key === k)));
  const toggle = (key) => onChange(value.includes(key) ? value.filter((k) => k !== key) : [...value, key]);

  return (
    <div className="mp">
      <div className="mp-label">Muskelgruppen</div>
      <div className="mp-grid">
        {MUSCLE_GROUPS.map((m) => <Card key={m.key} item={m} on={value.includes(m.key)} onToggle={toggle} />)}
      </div>
      <button type="button" className="mp-more" aria-expanded={more} onClick={() => setMore((o) => !o)}>
        {more ? 'Einzelne Muskeln ausblenden' : 'Einzelne Muskeln anzeigen'}
      </button>
      {more && ['Vorne', 'Hinten'].map((region) => (
        <div key={region}>
          <div className="mp-label">{region}</div>
          <div className="mp-grid">
            {muscleSinglesByRegion(region).map((m) => <Card key={m.key} item={m} on={value.includes(m.key)} onToggle={toggle} />)}
          </div>
        </div>
      ))}
    </div>
  );
}
