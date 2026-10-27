// Schlanke Diagramme für die Auswertung: HTML/CSS-Säulen und ein SVG-Verlauf.
// Bewusst ohne Chart.js — spart den großen Chunk, folgt den Design-Tokens
// (Hell/Dunkel ohne JS) und die Säulen sind echte Buttons (antippbar, per
// Tastatur erreichbar).

import { niceAxis, compactEur } from '../../lib/analytics.js';
import { eur0 } from './ui.jsx';

const PLOT_H = 130;

function barWidth(n) {
  if (n <= 4) return 18;
  if (n <= 12) return 9;
  if (n <= 24) return 5;
  return 3;
}

function MonthLabels({ series }) {
  const every = series.length > 24 ? 3 : series.length > 12 ? 2 : 1;
  return (
    <div className="rp-mrow" aria-hidden="true">
      {series.map((s, i) => <span key={s.idx}>{i % every === 0 ? s.label : ''}</span>)}
    </div>
  );
}

function Grid({ ticks, top, height }) {
  return ticks.map((t) => (
    <div key={t}>
      <div className="rp-gl" style={{ bottom: (t / top) * height }} />
      <span className="rp-yl" style={{ bottom: (t / top) * height - 6 }}>{compactEur(t)}</span>
    </div>
  ));
}

// Einnahmen und Ausgaben je Monat nebeneinander. Prognose-Monate nur als Umriss.
export function MonthBars({ series, selected, onSelect, label }) {
  const axis = niceAxis(Math.max(...series.map((s) => Math.max(s.ein, s.aus)), 0));
  const h = (v) => Math.max(0, (v / axis.top) * PLOT_H);
  return (
    <div className="rp-chart" style={{ '--bw': `${barWidth(series.length)}px` }}>
      <div className="rp-plot" role="group" aria-label={label} style={{ height: PLOT_H }}>
        <Grid ticks={axis.ticks} top={axis.top} height={PLOT_H} />
        {series.map((s) => (
          <button
            key={s.idx}
            type="button"
            className={`rp-slot ${selected === s.idx ? 'is-sel' : ''}`}
            onClick={() => onSelect(s.idx)}
            aria-pressed={selected === s.idx}
            aria-label={`${s.label} ${s.year}${s.forecast ? ' (Prognose)' : ''}: Einnahmen ${eur0(s.ein)}, Ausgaben ${eur0(s.aus)}`}
          >
            <i className={`rp-bar rp-bar--ein ${s.forecast ? 'is-fc' : ''}`} style={{ height: h(s.ein) }} />
            <i className={`rp-bar rp-bar--aus ${s.forecast ? 'is-fc' : ''}`} style={{ height: h(s.aus) }} />
          </button>
        ))}
      </div>
      <MonthLabels series={series} />
    </div>
  );
}

// Ausgaben je Monat, gestapelt nach Kategorie (Fix unten), mit Monatsschnitt-Linie.
export function StackedBars({ series, selected, onSelect, label }) {
  const real = series.filter((s) => !s.forecast && s.count > 0);
  const avg = real.length ? real.reduce((a, s) => a + s.aus, 0) / real.length : 0;
  const axis = niceAxis(Math.max(...series.map((s) => s.aus), avg, 0));
  const h = (v) => (v > 0 ? Math.max(2, (v / axis.top) * PLOT_H) : 0);
  return (
    <div className="rp-chart rp-chart--stack" style={{ '--bw': `${Math.max(barWidth(series.length), 10)}px` }}>
      <div className="rp-plot" role="group" aria-label={label} style={{ height: PLOT_H }}>
        <Grid ticks={axis.ticks} top={axis.top} height={PLOT_H} />
        {avg > 0 && (
          <>
            <div className="rp-avg" style={{ bottom: (avg / axis.top) * PLOT_H }} />
            <span className="rp-avg-l" style={{ bottom: (avg / axis.top) * PLOT_H + 3 }}>Ø {eur0(avg)}</span>
          </>
        )}
        {series.map((s) => (
          <button
            key={s.idx}
            type="button"
            className={`rp-slot rp-slot--stack ${selected === s.idx ? 'is-sel' : ''}`}
            onClick={() => onSelect(s.idx)}
            aria-pressed={selected === s.idx}
            aria-label={`${s.label} ${s.year}: Fixkosten ${eur0(s.fix)}, variabel ${eur0(s.var)}, sonstige ${eur0(s.sonst)}`}
          >
            <i className="rp-stk rp-stk--sonst" style={{ height: h(s.sonst) }} />
            <i className="rp-stk rp-stk--var" style={{ height: h(s.var) }} />
            <i className="rp-stk rp-stk--fix" style={{ height: h(s.fix) }} />
          </button>
        ))}
      </div>
      <MonthLabels series={series} />
    </div>
  );
}

// Verlauf als Linie. points: [{ idx, label, value|null, forecast? }]
export function LineChart({ points, label }) {
  const W = 292; const H = 100; const padTop = 16; const plotH = H - padTop - 2;
  const vals = points.map((p) => p.value).filter((v) => v !== null);
  const maxV = Math.max(0, ...vals);
  const minV = Math.min(0, ...vals);
  const topAxis = niceAxis(maxV).top;
  const botAxis = minV < 0 ? -niceAxis(-minV).top : 0;
  const span = topAxis - botAxis || 1;
  const x = (i) => ((i + 0.5) * W) / points.length;
  const y = (v) => padTop + ((topAxis - v) / span) * plotH;
  const y0 = y(0);

  const actual = points.map((p, i) => ({ ...p, i })).filter((p) => p.value !== null && !p.forecast);
  const fc = points.map((p, i) => ({ ...p, i })).filter((p) => p.value !== null && p.forecast);
  const path = (arr) => arr.map((p) => `${x(p.i).toFixed(1)},${y(p.value).toFixed(1)}`).join(' ');
  const last = actual[actual.length - 1];
  const fcPath = last && fc.length ? path([last, ...fc]) : null;
  const ticks = botAxis < 0 ? [topAxis, 0, botAxis] : [topAxis, topAxis / 2, 0];

  return (
    <div className="rp-chart">
      <div className="rp-line">
        <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label} style={{ overflow: 'visible' }}>
          {ticks.map((t) => (
            <g key={t}>
              <line x1="0" x2={W} y1={y(t)} y2={y(t)} className={t === 0 ? 'rp-axis' : 'rp-grid'} />
              <text x="-6" y={y(t) + 3.5} textAnchor="end" className="rp-svg-tick">{compactEur(t)}</text>
            </g>
          ))}
          {actual.length > 1 && (
            <polygon
              points={`${x(actual[0].i).toFixed(1)},${y0.toFixed(1)} ${path(actual)} ${x(last.i).toFixed(1)},${y0.toFixed(1)}`}
              className="rp-area"
            />
          )}
          {actual.length > 1 && <polyline points={path(actual)} className="rp-lineseries" />}
          {fcPath && <polyline points={fcPath} className="rp-lineseries rp-lineseries--fc" />}
          {last && (
            <>
              <circle cx={x(last.i)} cy={y(last.value)} r="4" className="rp-dot" />
              <text
                x={x(last.i)} y={y(last.value) - 9}
                textAnchor={x(last.i) > W - 34 ? 'end' : 'middle'} className="rp-svg-end"
              >
                {eur0(last.value)}
              </text>
            </>
          )}
        </svg>
      </div>
      <MonthLabels series={points} />
    </div>
  );
}
