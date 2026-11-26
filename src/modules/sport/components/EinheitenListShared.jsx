import { getMuscleVisual, muscleImagePath } from '../lib/data/muscleGroups';

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

export function MusclePreview({ tags, size = 40 }) {
  if (!tags || tags.length === 0) return null;
  const visible = tags.slice(0, 3);
  const extra = tags.length - 3;
  const overlap = Math.round(size * 0.35);
  const border = size <= 30 ? 1.5 : 2;
  const fontSize = size <= 30 ? 9 : 11;

  return (
    <div className="sp-u-noshrink">
      {visible.map((key, i) => {
        const m = getMuscleVisual(key);
        if (!m) return null;
        return (
          <img
            key={key}
            src={muscleImagePath(m)}
            alt=""
            width={size}
            height={size}
            loading="lazy"
            decoding="async"
            style={{
              width: size, height: size, borderRadius: 999, objectFit: 'cover',
              objectPosition: objectPositionFor(key),
              border: `${border}px solid #fff`, boxShadow: '0 0 0 1.5px #DDE2EB',
              marginLeft: i === 0 ? 0 : -overlap, zIndex: visible.length - i,
              background: '#EEF1F6',
            }}
            onError={(e) => { e.currentTarget.style.visibility = 'hidden'; }}
          />
        );
      })}
      {extra > 0 && (
        <div
          style={{
            width: size, height: size, borderRadius: 999, background: '#EEF1F6',
            border: `${border}px solid #fff`, boxShadow: '0 0 0 1.5px #DDE2EB',
            marginLeft: -overlap, zIndex: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize, fontWeight: 700, color: '#545C6B',
          }}
        >
          +{extra}
        </div>
      )}
    </div>
  );
}
