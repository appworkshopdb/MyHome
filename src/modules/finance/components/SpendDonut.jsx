// modules/finance/components/SpendDonut.jsx
//
// Schnellübersicht der Finanzen-Startseite als Kreisdiagramm: in der Mitte die Einnahmen
// des Monats, im Ring die drei Ausgabebereiche im Verhältnis zueinander. Tippen auf ein
// Segment oder eine Legendenzeile zeigt den Bereich in der Mitte (Betrag und Anteil an den
// Ausgaben), noch einmal tippen bringt die Einnahmen zurück. Darunter: Ausgaben gesamt und
// ihr Anteil an den Einnahmen. Zahlen kommen fertig von der Übersicht (OverviewSection).
import { useState } from 'react';
import { formatEur } from '../lib/finance';

const SIZE = 144;
const R = 57;
const SW = 17;
const GAP = 4;
const C = 2 * Math.PI * R;
const pct = (v, total) => (total > 0 ? Math.round((v / total) * 100) : 0);

// cats: [{ key, label, value, tone: 'a'|'b'|'c' }]
export default function SpendDonut({ cats, income, monthLabel }) {
  const [sel, setSel] = useState(null);
  const total = cats.reduce((s, c) => s + c.value, 0);

  const visible = cats.filter((c) => c.value > 0);
  const gap = visible.length > 1 ? GAP : 0;
  const avail = C - gap * visible.length;
  let offset = gap / 2;
  const segs = visible.map((c) => {
    const len = (avail * c.value) / total;
    const seg = { ...c, len, offset };
    offset += len + gap;
    return seg;
  });

  const active = cats.find((c) => c.key === sel) || null;
  const toggle = (key) => setSel((cur) => (cur === key ? null : key));
  const ratio = income > 0 ? Math.round((total / income) * 100) : null;

  return (
    <div className="fin-donut">
      <div className="fin-donut-top">
        <div className="fin-donut-ring">
          <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} aria-hidden="true">
            <circle cx={SIZE / 2} cy={SIZE / 2} r={R} fill="none" strokeWidth={SW} className="fin-donut-track" />
            <g className={active ? 'fin-donut-segs fin-donut-segs--dim' : 'fin-donut-segs'}>
              {segs.map((s) => (
                <circle
                  key={s.key}
                  className={`fin-donut-seg fin-donut-seg--${s.tone}${s.key === sel ? ' is-on' : ''}`}
                  cx={SIZE / 2}
                  cy={SIZE / 2}
                  r={R}
                  fill="none"
                  strokeWidth={SW}
                  strokeDasharray={`${s.len.toFixed(2)} ${(C - s.len).toFixed(2)}`}
                  strokeDashoffset={(-s.offset).toFixed(2)}
                  transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}
                  onClick={() => toggle(s.key)}
                />
              ))}
            </g>
          </svg>
          <div className="fin-donut-center" aria-live="polite">
            <small>{active ? active.label : 'Einnahmen'}</small>
            <b>{formatEur(active ? active.value : income)}</b>
            <span>{active ? `${pct(active.value, total)} % der Ausgaben` : monthLabel}</span>
          </div>
        </div>

        <div className="fin-donut-legend">
          {cats.map((c) => (
            <button
              key={c.key}
              type="button"
              className={`fin-donut-lg${c.key === sel ? ' is-on' : ''}`}
              aria-pressed={c.key === sel}
              onClick={() => toggle(c.key)}
            >
              <i className={`fin-donut-dot fin-donut-dot--${c.tone}`} aria-hidden="true" />
              <span className="fin-donut-lg-t">
                <small>{c.label}</small>
                <span className="fin-donut-lg-v">
                  <b>{formatEur(c.value)}</b>
                  <em>{pct(c.value, total)} %</em>
                </span>
              </span>
            </button>
          ))}
        </div>
      </div>

      <div className="fin-donut-foot">
        <div className="fin-donut-foot-h">
          <span>Ausgaben <b>{formatEur(total)}</b></span>
          {ratio !== null && (
            <span className={ratio > 100 ? 'fin-donut-over' : ''}>{ratio} % der Einnahmen</span>
          )}
        </div>
        <div className="fin-donut-meter" aria-hidden="true">
          <i
            className={ratio !== null && ratio > 100 ? 'fin-donut-meter-over' : ''}
            style={{ width: `${Math.min(100, ratio ?? 0)}%` }} /* pruefer:ok berechnete Breite des Fortschrittsbalkens */
          />
        </div>
      </div>
    </div>
  );
}
