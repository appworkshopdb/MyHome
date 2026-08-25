import SportsSelect from './SportsSelect';
import { BODY_REQUIRED_FIELDS } from '../lib/bodyProfileData';

export const GENDER = [{ key: 'm', label: 'Männlich' }, { key: 'w', label: 'Weiblich' }];
export const ACTIVITY = [
  { key: 'sitzend', label: 'Sitzend' }, { key: 'leicht', label: 'Leicht aktiv' },
  { key: 'moderat', label: 'Moderat' }, { key: 'aktiv', label: 'Aktiv' }, { key: 'sehrAktiv', label: 'Sehr aktiv' },
];
export const GOAL = [
  { key: 'abnehmen', label: 'Abnehmen' }, { key: 'halten', label: 'Halten' },
  { key: 'zunehmen', label: 'Zunehmen' }, { key: 'muskel', label: 'Muskelaufbau' },
];
// Trainingsfokus: separat vom Körperziel, weil mehrere Module (aktuell
// nur Sport) ihn brauchen könnten, ohne dass Ernährung ihn einfordert —
// siehe BODY_REQUIRED_FIELDS in bodyProfileData.js, die unverändert bleibt.
export const TRAINING_FOCUS = [
  { key: 'kraft', label: 'Kraft' }, { key: 'ausdauer', label: 'Ausdauer' }, { key: 'beides', label: 'Beides' },
];
const NUMBER_FIELDS = [
  ['age', 'Alter', 'Jahre', 1, 120],
  ['height', 'Größe', 'cm', 100, 230],
  ['weight', 'Gewicht', 'kg', 30, 300],
];

// Körperdaten-Formular — lebt in core/, weil die Daten seit der
// Migration in body_profile liegen und mehreren Modulen gehören
// (aktuell Ernährung, Sport). Rein präsentational: value/onChange,
// keine eigene Datenanbindung.
//
// PFLICHTFELD-MARKIERUNG (generisches Muster, für jedes künftige
// Formular wiederverwendbar): requiredFields nimmt eine Spec im
// getMissingFields-Format ([{key,label}], siehe core/lib/requiredData.js)
// entgegen. Ist ein Feld darin gelistet UND aktuell leer, wird es rot
// umrandet + "*Pflicht" daneben angezeigt — automatisch, ohne dass
// jedes Feld einzeln markiert werden muss. Standard hier:
// BODY_REQUIRED_FIELDS (Ernährungs-Sicht, ohne Trainingsfokus).
// core/Profile.jsx übergibt eine erweiterte Spec inkl. Trainingsfokus,
// weil das die allgemeine Seite für ALLE Module ist — core darf dafür
// aber nicht direkt SPORT_REQUIRED_FIELDS aus modules/sport importieren
// (Architektur-Regel), deshalb dort eine manuell synchron zu haltende
// Kopie, siehe Kommentar in Profile.jsx.
export default function BodyProfileForm({ value, onChange, requiredFields = BODY_REQUIRED_FIELDS }) {
  function set(key, val) {
    onChange({ ...value, [key]: val });
  }

  function isEmptyValue(key) {
    const v = value[key];
    return v === null || v === undefined || v === '' || (Array.isArray(v) && v.length === 0);
  }
  function flagged(key) {
    return requiredFields.some((f) => f.key === key) && isEmptyValue(key);
  }
  function mark(key) {
    return flagged(key) ? <span className="required-mark">*Pflicht</span> : null;
  }

  return (
    <>
      <div className="card-title" style={{ marginTop: 4 }}>Körperdaten</div>
      <label style={{ fontSize: '0.82rem', fontWeight: 500, color: 'var(--text-secondary)' }}>
        Geschlecht{mark('gender')}
      </label>
      <div className={`segmented cols-2 ${flagged('gender') ? 'required-empty' : ''}`} style={{ marginTop: 6, marginBottom: 12 }}>
        {GENDER.map((g) => (
          <button key={g.key} className={value.gender === g.key ? 'active' : ''} onClick={() => set('gender', g.key)}>{g.label}</button>
        ))}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 20 }}>
        {NUMBER_FIELDS.map(([key, label, unit, min, max]) => (
          <div className={`form-group ${flagged(key) ? 'required-empty' : ''}`} key={key}>
            <label>{label} ({unit}){mark(key)}</label>
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
        <label>Aktivitätslevel{mark('activity')}</label>
        <div className={`segmented cols-3 ${flagged('activity') ? 'required-empty' : ''}`}>
          {ACTIVITY.map((a) => (
            <button key={a.key} className={value.activity === a.key ? 'active' : ''} onClick={() => set('activity', a.key)}>{a.label}</button>
          ))}
        </div>
      </div>
      <div className="form-group" style={{ marginBottom: 10 }}>
        <label>Ziel{mark('goal')}</label>
        <div className={`segmented cols-4 ${flagged('goal') ? 'required-empty' : ''}`}>
          {GOAL.map((g) => (
            <button key={g.key} className={value.goal === g.key ? 'active' : ''} onClick={() => set('goal', g.key)}>{g.label}</button>
          ))}
        </div>
      </div>
      <div className="form-group" style={{ marginBottom: 10 }}>
        <label>Trainingsfokus{mark('training_focus')}</label>
        <div className={`segmented cols-3 ${flagged('training_focus') ? 'required-empty' : ''}`}>
          {TRAINING_FOCUS.map((f) => (
            <button key={f.key} className={value.training_focus === f.key ? 'active' : ''} onClick={() => set('training_focus', f.key)}>{f.label}</button>
          ))}
        </div>
      </div>
      <SportsSelect value={value.sports ?? []} onChange={(sports) => set('sports', sports)} />
    </>
  );
}
