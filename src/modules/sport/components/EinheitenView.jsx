import { resolveTypeLabel } from '../lib/typeLabel';
import { getMuscleVisual, muscleImagePath } from '../lib/data/muscleGroups';
import { PREDEFINED_UNITS } from '../lib/data/predefinedUnits';

// Design-Handoff "Sport Einheiten Mockups", Variante 1a: überlappende
// 40px-Kreise statt kleiner Bildreihe, max. 3 + "+N"-Platzhalter.
//
// Bewusst KEINE Buttons und KEINE Zeilen-Interaktion mehr — weder pro
// Zeile noch als antippbare ganze Zeile. Neu anlegen, aus einer
// Vorlage übernehmen sowie Bearbeiten/Löschen laufen jetzt einheitlich
// über den modul-eigenen FAB (core/components/GlobalFab.jsx →
// SportQuickSheet.jsx, Modi "Neue Einheit" und "Verwalten") — diese
// Liste ist rein zur Übersicht/zum Nachschauen da. Absicht: dieselbe
// Aktion soll app-weit immer über denselben Weg laufen, nicht über
// wechselnde UI-Muster pro Ansicht.
//
// object-position ist nur für die 9 im Design-Handoff getesteten Keys
// exakt abgestimmt (siehe MUSCLE_OBJECT_POSITION) — alle anderen
// (Einzelmuskeln wie "Latissimus") fallen auf eine zentrierte
// Platzierung zurück, bis dafür eigene Werte vorliegen.
const MUSCLE_OBJECT_POSITION = {
  'brust-ganz': '50% 26%',
  'ruecken-ganz': '50% 30%',
  'schultern-ganz': '50% 23%',
  'trizeps': '50% 33%',
  'bizeps': '50% 33%',
  'beine-ganz': '50% 63%',
  'gluteus': '50% 47%',
  'bauch-ganz': '50% 40%',
};

function objectPositionFor(key) {
  return MUSCLE_OBJECT_POSITION[key] ?? '50% 50%';
}

// Pixelgenau nach Handoff — bewusst mit literalen Werten statt den
// App-eigenen Design-Tokens (Editorial Bold: scharfe Kanten, keine
// Schatten, Instrument Sans). Das ist eine Abweichung vom sonstigen
// Look der App, die der Design-Auftrag hier ausdrücklich so vorgibt.
function MusclePreview({ tags }) {
  if (!tags || tags.length === 0) return null;
  const visible = tags.slice(0, 3);
  const extra = tags.length - 3;

  return (
    <div style={{ display: 'flex', flexShrink: 0 }}>
      {visible.map((key, i) => {
        const m = getMuscleVisual(key);
        if (!m) return null;
        return (
          <img
            key={key}
            src={muscleImagePath(m)}
            alt=""
            width={40}
            height={40}
            loading="lazy"
            decoding="async"
            style={{
              width: 40, height: 40, borderRadius: 999, objectFit: 'cover',
              objectPosition: objectPositionFor(key),
              border: '2px solid var(--surface-raised)', boxShadow: '0 0 0 1.5px var(--border-strong)',
              marginLeft: i === 0 ? 0 : -14, zIndex: visible.length - i,
              background: 'var(--surface-sunken)',
            }}
            onError={(e) => { e.currentTarget.style.visibility = 'hidden'; }}
          />
        );
      })}
      {extra > 0 && (
        <div
          style={{
            width: 40, height: 40, borderRadius: 999, background: 'var(--surface-sunken)',
            border: '2px solid var(--surface-raised)', boxShadow: '0 0 0 1.5px var(--border-strong)',
            marginLeft: -14, zIndex: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)',
          }}
        >
          +{extra}
        </div>
      )}
    </div>
  );
}

function EinheitRow({ title, subtitle, tags, isLast }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12, padding: '12px 0',
      borderBottom: isLast ? 'none' : '1px solid var(--border-hairline)',
    }}>
      <MusclePreview tags={tags} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>{title}</div>
        <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>{subtitle}</div>
      </div>
    </div>
  );
}

function Card({ title, children }) {
  return (
    <div style={{
      background: 'var(--surface-raised)', borderRadius: 14, boxShadow: 'var(--shadow-card)',
      padding: 16, marginBottom: 16,
    }}>
      <div style={{
        fontSize: 11, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase',
        color: 'var(--text-secondary)', marginBottom: 8,
      }}>
        {title}
      </div>
      {children}
    </div>
  );
}

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
          <p style={{ color: 'var(--text-secondary)', margin: 0, fontSize: 13 }}>Lädt…</p>
        ) : units.length === 0 ? (
          <p style={{ color: 'var(--text-secondary)', margin: 0, fontSize: 13 }}>
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
