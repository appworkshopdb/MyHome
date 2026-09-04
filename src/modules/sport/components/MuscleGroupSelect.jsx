import { useState } from 'react';
import {
  MUSCLE_GROUPS, MUSCLE_COMBOS,
  getMuscleVisual, muscleSinglesByRegion, muscleImagePath,
} from '../lib/data/muscleGroups';

const REGIONS = ['Vorne', 'Hinten'];

function ChipGrid({ items, value, onToggle }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(76px, 1fr))', gap: 6 }}>
      {items.map((m) => {
        const active = value.includes(m.key);
        return (
          <button
            key={m.key}
            onClick={() => onToggle(m.key)}
            style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
              padding: '6px', borderRadius: 'var(--radius-sm)',
              border: `1.5px solid ${active ? 'var(--accent)' : 'var(--border)'}`,
              background: active ? 'var(--accent)' : 'var(--bg-secondary)',
              color: active ? 'var(--on-accent)' : 'var(--text-secondary)',
              cursor: 'pointer',
            }}
          >
            {/* Bild in der Auswahl selbst — vorher gab es Bilder nur bei
                bereits ausgewählten Chips und in der fertigen Liste,
                nicht beim eigentlichen Durchsuchen/Anklicken. onError
                blendet fehlende Dateien unsichtbar aus, das Label bleibt
                trotzdem lesbar.
                width/height als echte Attribute (nicht nur CSS): das Grid
                reserviert den Platz, bevor das Bild da ist — sonst springt
                die Liste beim Nachladen. loading="lazy" lädt nur die
                Kacheln, die beim Aufklappen wirklich sichtbar sind. */}
            <img
              src={muscleImagePath(m)} alt=""
              width={48} height={48}
              loading="lazy" decoding="async"
              style={{ width: 48, height: 48, borderRadius: 4, objectFit: 'cover', background: 'var(--bg-input)' }}
              onError={(e) => { e.currentTarget.style.display = 'none'; }}
            />
            <span style={{ fontSize: '0.7rem', fontWeight: 600, textAlign: 'center', lineHeight: 1.2 }}>{m.label}</span>
          </button>
        );
      })}
    </div>
  );
}

// Mehrfachauswahl über drei fachliche Ebenen (siehe muscleGroups.js):
// Muskelgruppen (grob, 6), Einzelmuskeln (fein, 24, nach Vorne/Hinten
// sortiert), Kombinationen (mehrere Muskeln je Bild — bewusst nur
// sichtbar, sobald mindestens ein Eintrag existiert, kein leerer
// Abschnitt). Eine Einheit kann Einträge aus mehreren Ebenen gleichzeitig
// wählen (z.B. "Brust" (Gruppe) + "Trizeps" (Einzelmuskel)).
export default function MuscleGroupSelect({ value = [], onChange }) {
  const [open, setOpen] = useState(false);

  function toggle(key) {
    onChange(value.includes(key) ? value.filter((k) => k !== key) : [...value, key]);
  }

  return (
    <div className="form-group">
      <label>Trainierte Muskeln</label>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
        {value.length === 0 && (
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Noch keine ausgewählt</span>
        )}
        {value.map((key) => {
          const m = getMuscleVisual(key);
          return (
            <button
              key={key}
              onClick={() => toggle(key)}
              style={{
                display: 'flex', alignItems: 'center', gap: 5,
                padding: '4px 10px 4px 4px', borderRadius: 'var(--radius-sm)', border: 'none',
                background: 'var(--accent)', color: 'var(--on-accent)',
                fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer',
              }}
            >
              {m && (
                <img
                  src={muscleImagePath(m)} alt=""
                  width={20} height={20}
                  decoding="async"
                  style={{ width: 20, height: 20, borderRadius: 3, objectFit: 'cover', background: 'var(--on-accent)' }}
                  onError={(e) => { e.currentTarget.style.display = 'none'; }}
                />
              )}
              {m?.label ?? key} ×
            </button>
          );
        })}
      </div>

      <button
        onClick={() => setOpen(!open)}
        style={{
          width: '100%', padding: '10px', borderRadius: 'var(--radius-xs)',
          border: '1.5px solid var(--border)', background: 'var(--bg-secondary)',
          color: 'var(--text-secondary)', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer',
        }}
      >
        {open ? 'Auswahl schließen' : 'Muskel(n) hinzufügen'}
      </button>

      {open && (
        <div style={{ marginTop: 8, maxHeight: 320, overflowY: 'auto' }}>
          <div style={{ marginBottom: 10 }}>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: 4 }}>Muskelgruppen</div>
            <ChipGrid items={MUSCLE_GROUPS} value={value} onToggle={toggle} />
          </div>

          {REGIONS.map((region) => (
            <div key={region} style={{ marginBottom: 10 }}>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: 4 }}>
                Einzelmuskeln · {region}
              </div>
              <ChipGrid items={muscleSinglesByRegion(region)} value={value} onToggle={toggle} />
            </div>
          ))}

          {/* Bewusst nur sichtbar, sobald Kombinationen existieren —
              kein leerer Abschnitt für eine Ebene ohne Einträge. */}
          {MUSCLE_COMBOS.length > 0 && (
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: 4 }}>Kombinationen</div>
              <ChipGrid items={MUSCLE_COMBOS} value={value} onToggle={toggle} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
