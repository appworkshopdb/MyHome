import { getMuscleVisual, muscleImagePath } from '../lib/data/muscleGroups';

// Design-Handoff "Sport Einheiten Mockups", Variante 1a — ausgelagert
// aus EinheitenView.jsx, damit die Pläne-Liste (jeder Tag zeigt dieselbe
// Vorschau wie die zugehörige Einheit) dieselben Bausteine nutzt statt
// sie zu duplizieren.
//
// object-position ist nur für die 9 im Design-Handoff getesteten Keys
// exakt abgestimmt — alle anderen (Einzelmuskeln wie "Latissimus")
// fallen auf eine zentrierte Platzierung zurück, bis dafür eigene
// Werte vorliegen.
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
export function MusclePreview({ tags }) {
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
              border: '2px solid #fff', boxShadow: '0 0 0 1.5px #DDE2EB',
              marginLeft: i === 0 ? 0 : -14, zIndex: visible.length - i,
              background: '#EEF1F6',
            }}
            onError={(e) => { e.currentTarget.style.visibility = 'hidden'; }}
          />
        );
      })}
      {extra > 0 && (
        <div
          style={{
            width: 40, height: 40, borderRadius: 999, background: '#EEF1F6',
            border: '2px solid #fff', boxShadow: '0 0 0 1.5px #DDE2EB',
            marginLeft: -14, zIndex: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 11, fontWeight: 700, color: '#545C6B',
          }}
        >
          +{extra}
        </div>
      )}
    </div>
  );
}

export function EinheitRow({ title, subtitle, tags, isLast }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12, padding: '12px 0',
      borderBottom: isLast ? 'none' : '1px solid #EEF1F6',
    }}>
      <MusclePreview tags={tags} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: '#131A28' }}>{title}</div>
        <div style={{ fontSize: 12, color: '#545C6B', marginTop: 2 }}>{subtitle}</div>
      </div>
    </div>
  );
}

export function Card({ title, children }) {
  return (
    <div style={{
      background: '#fff', borderRadius: 14, boxShadow: '0 1px 3px rgba(19,26,40,0.07)',
      padding: 16, marginBottom: 16,
    }}>
      <div style={{
        fontSize: 11, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase',
        color: '#545C6B', marginBottom: 8,
      }}>
        {title}
      </div>
      {children}
    </div>
  );
}
