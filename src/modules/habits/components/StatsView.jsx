// modules/habits/components/StatsView.jsx
// "Statistik" — Cockpit mit Zeitraum- und Gewohnheits-Filter
//
// Eine Seite, alles reagiert auf die beiden Filter:
//   1. Zeitraum-Chips (7 / 30 / 90 Tage / 6 Monate)
//   2. Gewohnheits-Chips (Alle oder einzelne Gewohnheit)
//   3. Hero: Quote + Veränderung zum gleich langen Zeitraum davor
//   4. Verlaufslinie über den gewählten Zeitraum
//   5. Ranking der Gewohnheiten (Tipp filtert) bzw. Streak/Rekord bei Einzelauswahl
//   6. Rhythmus: Heatmap der letzten 12 Wochen
//   7. Badges

import { useState, useMemo } from 'react';
import {
  calcStreak, calcLongestStreak, getEarnedBadges, BADGES,
  today, dateRange, isDueOn, toDateStr,
} from '../lib/habUtils.js';

// ─── Konstanten ───────────────────────────────────────────

const MONTH_ABBR = ['Jan','Feb','Mär','Apr','Mai','Jun','Jul','Aug','Sep','Okt','Nov','Dez'];

const PERIODS = [
  { days: 7,   label: '7 Tage' },
  { days: 30,  label: '30 Tage' },
  { days: 90,  label: '90 Tage' },
  { days: 180, label: '6 Monate' },
];

// Tage pro Messpunkt der Verlaufslinie
const BUCKET_DAYS = { 7: 1, 30: 3, 90: 7, 180: 15 };

const HEAT_WEEKS = 12;

// Heatmap-Intensitätsfarben über semantische Data-Tokens
const INTENSITY_COLORS = [
  'var(--data-track)',
  'color-mix(in srgb, var(--data-1) 25%, var(--data-track))',
  'color-mix(in srgb, var(--data-1) 50%, var(--data-track))',
  'color-mix(in srgb, var(--data-1) 75%, var(--data-track))',
  'var(--data-1)',
];

// ─── Hilfsfunktionen ──────────────────────────────────────

function addDays(dateStr, n) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return toDateStr(new Date(y, m - 1, d + n));
}

function fmtShort(dateStr) {
  const [, m, d] = dateStr.split('-').map(Number);
  return `${d}. ${MONTH_ABBR[m - 1]}`;
}

function fmtPct(rate) {
  return rate === null ? '–' : `${Math.round(rate * 100)} %`;
}

function intensityOf(rate) {
  if (rate === null || rate <= 0) return 0;
  if (rate >= 1)    return 4;
  if (rate >= 0.75) return 3;
  if (rate >= 0.5)  return 2;
  return 1;
}

/** Zählt fällige und erledigte Einheiten über Habits × Tage. */
function countRange(habits, doneIdx, dates) {
  let due = 0;
  let done = 0;
  for (const d of dates) {
    for (const h of habits) {
      if (!isDueOn(h, d)) continue;
      due++;
      if ((doneIdx.get(`${h.id}|${d}`) ?? 0) >= (h.target_count ?? 1)) done++;
    }
  }
  return { due, done, rate: due > 0 ? done / due : null };
}

// ─── Haupt-Export ─────────────────────────────────────────

export default function StatsView({ habits, entries }) {
  const activeHabits = habits.filter((h) => h.active && !h.deleted_at);

  if (activeHabits.length === 0) {
    return (
      <div className="hab-empty" style={{ marginTop: 32 }}>
        <div className="hab-empty-icon">📊</div>
        <div className="hab-empty-title">Noch keine Statistik</div>
        <div className="hab-empty-text">
          Leg Gewohnheiten an und hak sie ab — hier siehst du dann deine Statistiken.
        </div>
      </div>
    );
  }

  return <Cockpit habits={activeHabits} entries={entries} />;
}

// ─── Cockpit ──────────────────────────────────────────────

function Cockpit({ habits, entries }) {
  const [period, setPeriod]     = useState(30);
  const [filterId, setFilterId] = useState('all');

  const todayStr = today();

  // Index "habitId|datum" → count, einmal pro Entries-Änderung
  const doneIdx = useMemo(() => {
    const m = new Map();
    for (const e of entries) {
      if (e.deleted_at) continue;
      m.set(`${e.habit_id}|${e.logged_on}`, e.count ?? 1);
    }
    return m;
  }, [entries]);

  const selected = habits.find((h) => h.id === filterId) ?? null;
  const shown    = selected ? [selected] : habits;

  // Aktueller Zeitraum und der gleich lange davor
  const curDates  = useMemo(() => dateRange(addDays(todayStr, -(period - 1)), todayStr), [todayStr, period]);
  const prevDates = useMemo(() => dateRange(addDays(todayStr, -(2 * period - 1)), addDays(todayStr, -period)), [todayStr, period]);

  const cur  = useMemo(() => countRange(shown, doneIdx, curDates),  [shown, doneIdx, curDates]);
  const prev = useMemo(() => countRange(shown, doneIdx, prevDates), [shown, doneIdx, prevDates]);

  // Verlaufslinie
  const trend = useMemo(() => {
    const size = BUCKET_DAYS[period];
    const pts = [];
    for (let i = 0; i < curDates.length; i += size) {
      pts.push(countRange(shown, doneIdx, curDates.slice(i, i + size)).rate);
    }
    return pts;
  }, [shown, doneIdx, curDates, period]);

  // Ranking aller Gewohnheiten (nur bei Auswahl "Alle")
  const ranking = useMemo(() => {
    if (selected) return [];
    return habits
      .map((h) => ({
        habit: h,
        cur:   countRange([h], doneIdx, curDates),
        prev:  countRange([h], doneIdx, prevDates),
      }))
      .sort((a, b) => (b.cur.rate ?? -1) - (a.cur.rate ?? -1));
  }, [habits, selected, doneIdx, curDates, prevDates]);

  const earnedBadges = useMemo(() => getEarnedBadges(habits, entries), [habits, entries]);
  const lockedBadges = BADGES.filter((b) => !earnedBadges.find((e) => e.id === b.id));

  return (
    <div className="hab-stats-view hab-cp">

      {/* Filter */}
      <div className="hab-cp-chips" role="group" aria-label="Zeitraum">
        {PERIODS.map((p) => (
          <button
            key={p.days}
            type="button"
            className={`hab-cp-chip${period === p.days ? ' on' : ''}`}
            aria-pressed={period === p.days}
            onClick={() => setPeriod(p.days)}
          >
            {p.label}
          </button>
        ))}
      </div>
      <div className="hab-cp-chips" role="group" aria-label="Gewohnheit">
        <button
          type="button"
          className={`hab-cp-chip${!selected ? ' on' : ''}`}
          aria-pressed={!selected}
          onClick={() => setFilterId('all')}
        >
          Alle
        </button>
        {habits.map((h) => (
          <button
            key={h.id}
            type="button"
            className={`hab-cp-chip${filterId === h.id ? ' on' : ''}`}
            aria-pressed={filterId === h.id}
            onClick={() => setFilterId(h.id)}
          >
            {h.icon} {h.name.split(' ')[0]}
          </button>
        ))}
      </div>

      {/* Hero */}
      <Hero cur={cur} prev={prev} />

      {/* Verlauf */}
      <div className="hab-cp-card">
        <div className="hab-cp-label">Verlauf <span>Quote in %</span></div>
        <TrendChart points={trend} startLabel={fmtShort(curDates[0])} />
      </div>

      {/* Ranking / Einzel-Kennzahlen */}
      <div className="hab-cp-card">
        <div className="hab-cp-label">
          {selected ? `${selected.icon} ${selected.name}` : 'Gewohnheiten'}
          {!selected && <span>antippen zum Filtern</span>}
        </div>
        {selected ? (
          <div className="hab-cp-stats3">
            <div className="hab-cp-stat"><b>{calcStreak(selected, entries)}</b><span>Streak</span></div>
            <div className="hab-cp-stat"><b>{calcLongestStreak(selected, entries)}</b><span>Rekord</span></div>
            <div className="hab-cp-stat"><b>{cur.done}/{cur.due}</b><span>erledigt</span></div>
          </div>
        ) : (
          ranking.map(({ habit, cur: c, prev: p }) => (
            <button
              key={habit.id}
              type="button"
              className="hab-cp-row"
              onClick={() => setFilterId(habit.id)}
              aria-label={`Nur ${habit.name} anzeigen`}
            >
              <span className="hab-cp-row-icon">{habit.icon}</span>
              <span className="hab-cp-row-name">{habit.name}</span>
              <span className="hab-cp-row-pct">
                {fmtPct(c.rate)} <Delta cur={c.rate} prev={p.rate} />
              </span>
              <span className="hab-cp-row-bar"><i style={{ width: `${Math.round((c.rate ?? 0) * 100)}%` }} /></span>
            </button>
          ))
        )}
      </div>

      {/* Rhythmus */}
      <div className="hab-cp-card">
        <div className="hab-cp-label">Rhythmus <span>{HEAT_WEEKS} Wochen</span></div>
        <RhythmHeatmap habits={shown} doneIdx={doneIdx} todayStr={todayStr} />
      </div>

      {/* Badges */}
      <div
        className="hab-cp-card"
        style={{ marginBottom: 'calc(var(--nav-height) + 30px + env(safe-area-inset-bottom))' }}
      >
        <div className="hab-cp-label">Badges <span>{earnedBadges.length} von {BADGES.length}</span></div>
        <div className="hab-badges-grid">
          {earnedBadges.map((badge) => (
            <div key={badge.id} className="hab-badge hab-badge--earned" title={badge.desc}>
              <span className="hab-badge-icon">{badge.icon}</span>
              <span className="hab-badge-label t-meta">{badge.label}</span>
            </div>
          ))}
          {lockedBadges.map((badge) => (
            <div key={badge.id} className="hab-badge hab-badge--locked" title={badge.desc}>
              <span className="hab-badge-icon" style={{ filter: 'grayscale(1)', opacity: 0.35 }}>{badge.icon}</span>
              <span className="hab-badge-label t-meta" style={{ opacity: 0.4 }}>{badge.label}</span>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}

// ─── Teilkomponenten ──────────────────────────────────────

function Delta({ cur, prev }) {
  if (cur === null || prev === null) return <span className="hab-cp-delta flat">–</span>;
  const pp = Math.round((cur - prev) * 100);
  if (pp > 0) return <span className="hab-cp-delta up">▲ {pp} PP</span>;
  if (pp < 0) return <span className="hab-cp-delta down">▼ {Math.abs(pp)} PP</span>;
  return <span className="hab-cp-delta flat">● ±0</span>;
}

function Hero({ cur, prev }) {
  const R = 34;
  const C = 2 * Math.PI * R;
  const offset = C * (1 - (cur.rate ?? 0));

  return (
    <div className="hab-cp-card hab-cp-hero">
      <svg width="84" height="84" viewBox="0 0 84 84" role="img" aria-label={`Quote ${fmtPct(cur.rate)}`}>
        <circle cx="42" cy="42" r={R} fill="none" stroke="var(--data-track)" strokeWidth="9" />
        <circle
          cx="42" cy="42" r={R} fill="none" stroke="var(--data-1)" strokeWidth="9"
          strokeLinecap="round" strokeDasharray={C} strokeDashoffset={offset}
          transform="rotate(-90 42 42)"
        />
      </svg>
      <div>
        <div className="hab-cp-hero-num">{fmtPct(cur.rate)}</div>
        <div className="hab-cp-hero-sub">{cur.done} von {cur.due} erledigt</div>
        <div className="hab-cp-hero-delta">
          <Delta cur={cur.rate} prev={prev.rate} />
          <span className="hab-cp-hero-sub"> zum Zeitraum davor</span>
        </div>
      </div>
    </div>
  );
}

function TrendChart({ points, startLabel }) {
  const W = 300, H = 104, L = 26, R = 8, T = 8, B = 18;
  const n  = points.length;
  const xs = (k) => L + (n <= 1 ? 0 : (k * (W - L - R)) / (n - 1));
  const ys = (r) => T + (1 - r) * (H - T - B);

  let line = '';
  let first = null;
  let last = null;
  points.forEach((r, k) => {
    if (r === null) return;
    line += `${line ? 'L' : 'M'}${xs(k).toFixed(1)} ${ys(r).toFixed(1)}`;
    if (first === null) first = k;
    last = k;
  });
  const area = line
    ? `${line}L${xs(last).toFixed(1)} ${ys(0)}L${xs(first).toFixed(1)} ${ys(0)}Z`
    : '';

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="Verlauf der Quote" className="hab-cp-chart">
      {[0, 0.5, 1].map((g) => (
        <g key={g}>
          <line x1={L} x2={W - R} y1={ys(g)} y2={ys(g)} className="hab-cp-grid" />
          <text x={L - 5} y={ys(g) + 3} textAnchor="end">{Math.round(g * 100)}</text>
        </g>
      ))}
      {area && <path d={area} className="hab-cp-area" />}
      {line && <path d={line} className="hab-cp-line" />}
      {last !== null && <circle cx={xs(last)} cy={ys(points[last])} r="4" className="hab-cp-end" />}
      <text x={L} y={H - 4}>{startLabel}</text>
      <text x={W - R} y={H - 4} textAnchor="end">Heute</text>
    </svg>
  );
}

function RhythmHeatmap({ habits, doneIdx, todayStr }) {
  const cells = useMemo(() => {
    const [y, m, d] = todayStr.split('-').map(Number);
    const wd = (new Date(y, m - 1, d).getDay() + 6) % 7;
    const firstMonday = addDays(todayStr, -wd - (HEAT_WEEKS - 1) * 7);
    const out = [];
    for (let row = 0; row < 7; row++) {
      for (let col = 0; col < HEAT_WEEKS; col++) {
        const date = addDays(firstMonday, col * 7 + row);
        if (date > todayStr) { out.push({ date, level: -1 }); continue; }
        const { rate } = countRange(habits, doneIdx, [date]);
        out.push({ date, level: intensityOf(rate) });
      }
    }
    return out;
  }, [habits, doneIdx, todayStr]);

  return (
    <>
      <div className="hab-cp-heat">
        {cells.map(({ date, level }) => (
          <div
            key={date}
            className="hab-cp-heat-cell"
            title={date}
            style={level < 0 ? { background: 'transparent' } : { background: INTENSITY_COLORS[level] }}
          />
        ))}
      </div>
      <div className="hab-cp-legend">
        Weniger
        {INTENSITY_COLORS.map((col, i) => <i key={i} style={{ background: col }} />)}
        Mehr
      </div>
    </>
  );
}
