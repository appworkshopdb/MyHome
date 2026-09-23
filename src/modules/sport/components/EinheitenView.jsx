import { resolveTypeLabel } from '../lib/typeLabel';
import { PREDEFINED_UNITS } from '../lib/data/predefinedUnits';
import { EinheitRow, Card } from './EinheitenListShared';

// Design-Handoff "Sport Einheiten Mockups", Variante 1a. Bewusst KEINE
// Buttons und KEINE Zeilen-Interaktion mehr — Neuanlegen/Übernehmen/
// Verwalten laufen einheitlich über den FAB (SportQuickSheet.jsx).
// MusclePreview/EinheitRow/Card leben jetzt in EinheitenListShared.jsx,
// damit die Pläne-Liste (PlaeneView.jsx) dieselbe Optik pro Tag zeigen
// kann, ohne sie zu duplizieren.
export default function EinheitenView({ units, loading }) {
  return (
    <div className="page">
      <Card title="Vordefinierte Einheiten">
        {PREDEFINED_UNITS.map((preset, i) => (
          <EinheitRow
            key={preset.key}
            title={preset.title}
            subtitle={resolveTypeLabel(preset.type_key) ?? 'Kein Typ'}
            tags={preset.muscle_groups}
            isLast={i === PREDEFINED_UNITS.length - 1}
          />
        ))}
      </Card>

      <Card title="Eigene Einheiten">
        {loading ? (
          <p style={{ color: '#545C6B', margin: 0, fontSize: 13 }}>Lädt…</p>
        ) : units.length === 0 ? (
          <p style={{ color: '#545C6B', margin: 0, fontSize: 13 }}>
            Noch keine eigene Einheit — über den Button unten rechts anlegen.
          </p>
        ) : (
          units.map((unit, i) => (
            <EinheitRow
              key={unit.id}
              title={unit.title}
              subtitle={[resolveTypeLabel(unit.type_key) ?? 'Kein Typ', unit.duration_min ? `${unit.duration_min} Min.` : null].filter(Boolean).join(' · ')}
              tags={unit.muscle_groups}
              isLast={i === units.length - 1}
            />
          ))
        )}
      </Card>
    </div>
  );
}
