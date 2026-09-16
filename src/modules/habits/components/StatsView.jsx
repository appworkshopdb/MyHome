// modules/habits/components/StatsView.jsx
// "Statistik" — zusammengeführte Verlauf+Auswertung-Seite
//
// Hauptseite:
//   1. KPI-Kacheln (4 Schnellzahlen)
//   2. Wochen-Balkendiagramm
//   3. Monatskalender
//   4. Einstiegskarte → Unterseite "Jahresrückblick" (Heatmap)
//   5. Einstiegskarte → Unterseite "Verlauf" (Per-Habit + Badges)
//
// Unterseiten über internen subView-State, TopBar bekommt onBack-Prop.

import { useState, useMemo } from 'react';
import {
  calcStreak, calcLongestStreak, completionRate, overallRate,
  getEarnedBadges, BADGES, today, dateRange, isDueOn, isDone,
  buildHeatmap, toDateStr,
} from '../lib/habUtils.js';

// ─── Hilfs-Konstanten ─────────────────────────────────────

const MONTH_NAMES = [
  'Januar','Februar','März','April','Mai','Juni',
  'Juli','August','September','Oktober','November','Dezember',
];
const MONTH_ABBR = ['Jan','Feb','Mär','Apr','Mai','Jun','Jul','Aug','Sep','Okt','Nov','Dez'];
const DAY_LABELS_SHORT = ['Mo','Di','Mi','Do','Fr','Sa','So'];

// Heatmap-Intensitätsfarben über semantische Data-Tokens
const INTENSITY_COLORS = [
  'var(--data-track)',
  'color-mix(in srgb, var(--data-1) 25%, var(--data-track))',
  'color-mix(in srgb, var(--data-1) 50%, var(--data-track))',
  'color-mix(in srgb, var(--data-1) 75%, var(--data-track))',
  'var(--data-1)',
];

// ─── Haupt-Export ─────────────────────────────────────────

export default function StatsView({ habits, entries, hasWarnings, onSubViewChange }) {
  const [subView, setSubView] = useState(null); // null | 'jahresrueckblick' | 'verlauf'

  function openSub(v) {
    setSubView(v);
    onSubViewChange?.(v);
  }
  function closeSub() {
    setSubView(null);
    onSubViewChange?.(null);
  }

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

  // Unterseiten
  if (subView === 'jahresrueckblick') {
    return (
      <JahresrueckblickScreen
        habits={activeHabits}
        entries={entries}
        hasWarnings={hasWarnings}
        onBack={closeSub}
      />
    );
  }
  if (subView === 'verlauf') {
    return (
      <VerlaufScreen
        habits={activeHabits}
        entries={entries}
        hasWarnings={hasWarnings}
        onBack={closeSub}
      />
    );
  }

  // Hauptseite
  return (
    <StatistikHauptseite
      habits={activeHabits}
      entries={entries}
      onOpenSub={openSub}
    />
  );
}

// ─── Hauptseite ───────────────────────────────────────────

function StatistikHauptseite({ habits, entries, onOpenSub }) {
  const todayStr = today();
  const nowDate  = new Date(todayStr);

  const weekAgo  = new Date(nowDate); weekAgo.setDate(nowDate.getDate() - 6);
  const monthAgo = new Date(nowDate); monthAgo.setDate(nowDate.getDate() - 29);
  const weekFrom  = weekAgo.toISOString().split('T')[0];
  const monthFrom = monthAgo.toISOString().split('T')[0];

  const earnedBadges  = useMemo(() => getEarnedBadges(habits, entries), [habits, entries]);
  const totalCheckins = entries.filter((e) => !e.deleted_at).length;
  const weekRate      = useMemo(() => overallRate(habits, entries, weekFrom, todayStr), [habits, entries, weekFrom]);
  const monthRate     = useMemo(() => overallRate(habits, entries, monthFrom, todayStr), [habits, entries, monthFrom]);

  // Wochen-Balkendiagramm
  const weekDays  = dateRange(weekFrom, todayStr);
  const weekTrend = weekDays.map((d) => {
    const due  = habits.filter((h) => isDueOn(h, d));
    const done = due.filter((h) => isDone(entries, h.id, d, h.target_count)).length;
    return { date: d, rate: due.length > 0 ? done / due.length : null };
  });
  const maxBarRate = Math.max(...weekTrend.map((d) => d.rate ?? 0), 0.01);

  // Monatskalender
  const [calYear, setCalYear]   = useState(nowDate.getFullYear());
  const [calMonth, setCalMonth] = useState(nowDate.getMonth());

  const monthDays = useMemo(() => {
    const firstDay  = new Date(calYear, calMonth, 1);
    const lastDay   = new Date(calYear, calMonth + 1, 0);
    const days      = [];
    const startWd   = (firstDay.getDay() + 6) % 7;
    for (let i = 0; i < startWd; i++) days.push(null);
    for (let d = 1; d <= lastDay.getDate(); d++) days.push(new Date(calYear, calMonth, d));
    return days;
  }, [calYear, calMonth]);

  const heatmapMonth = useMemo(
    () => buildHeatmap(habits, entries, calYear),
    [habits, entries, calYear]
  );
  const heatmapByDate = useMemo(() => {
    const map = {};
    for (const d of heatmapMonth) map[d.date] = d;
    return map;
  }, [heatmapMonth]);

  function prevMonth() {
    if (calMonth === 0) { setCalMonth(11); setCalYear((y) => y - 1); }
    else setCalMonth((m) => m - 1);
  }
  function nextMonth() {
    if (calMonth === 11) { setCalMonth(0); setCalYear((y) => y + 1); }
    else setCalMonth((m) => m + 1);
  }
  const isCurrentMonth = calYear === nowDate.getFullYear() && calMonth === nowDate.getMonth();

  return (
    <div className="hab-stats-view">

      {/* 1. KPI-Kacheln */}
      <div className="hab-kpi-grid">
        <div className="hab-kpi-card">
          <div className="hab-kpi-num t-value">{totalCheckins}</div>
          <div className="hab-kpi-label t-meta">Gesamt Check-ins</div>
        </div>
        <div className="hab-kpi-card">
          <div className="hab-kpi-num t-value">{Math.round(weekRate * 100)} %</div>
          <div className="hab-kpi-label t-meta">Diese Woche</div>
        </div>
        <div className="hab-kpi-card">
          <div className="hab-kpi-num t-value">{Math.round(monthRate * 100)} %</div>
          <div className="hab-kpi-label t-meta">30 Tage</div>
        </div>
        <div className="hab-kpi-card">
          <div className="hab-kpi-num t-value">{earnedBadges.length}</div>
          <div className="hab-kpi-label t-meta">Badges</div>
        </div>
      </div>

      {/* 2. Wochen-Balkendiagramm */}
      <div className="hab-stats-section">
        <div className="hab-stats-section-title t-card-title">Letzte 7 Tage</div>
        <div className="card hab-week-chart">
          {weekTrend.map(({ date, rate }) => {
            const pct    = rate !== null ? Math.round(rate * 100) : null;
            const height = rate !== null ? Math.round((rate / maxBarRate) * 100) : 0;
            const label  = new Date(date + 'T12:00:00').toLocaleDateString('de-DE', { weekday: 'short' });
            const isToday = date === todayStr;
            return (
              <div key={date} className="hab-week-bar-wrap">
                <div className="hab-week-bar-col">
                  <div className="hab-week-bar-pct" style={{ opacity: pct > 0 ? 1 : 0.3 }}>
                    {pct !== null && pct > 0 ? `${pct}%` : '–'}
                  </div>
                  <div className="hab-week-bar-track">
                    <div
                      className={`hab-week-bar-fill${isToday ? ' today' : ''}`}
                      style={{ height: `${height}%` }}
                    />
                  </div>
                </div>
                <div className={`hab-week-bar-label${isToday ? ' today' : ''}`}>{label}</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 3. Monatskalender */}
      <div className="hab-stats-section">
        <div className="hab-stats-section-title t-card-title">Monatskalender</div>
        <div className="card">
          <div className="hab-month-nav">
            <button className="hab-nav-btn" onClick={prevMonth}>‹</button>
            <span className="hab-month-label t-body">{MONTH_NAMES[calMonth]} {calYear}</span>
            <button className="hab-nav-btn" onClick={nextMonth} disabled={isCurrentMonth}>›</button>
          </div>
          <div className="hab-month-grid">
            {DAY_LABELS_SHORT.map((d) => (
              <div key={d} className="hab-month-weekday t-meta">{d}</div>
            ))}
            {monthDays.map((date, i) => {
              if (!date) return <div key={`e-${i}`} className="hab-month-day--empty" />;
              const dateStr  = toDateStr(date);
              const status   = heatmapByDate[dateStr] ?? { intensity: 0, done: 0, total: 0 };
              const isToday  = dateStr === todayStr;
              const isFuture = dateStr > todayStr;
              const intensity = isFuture ? -1 : status.intensity;
              return (
                <div
                  key={dateStr}
                  className={`hab-month-day${isToday ? ' hab-month-day--today' : ''}${isFuture ? ' hab-month-day--future' : ''}`}
                  style={intensity >= 0 ? { backgroundColor: INTENSITY_COLORS[intensity] } : {}}
                  title={!isFuture ? `${dateStr}: ${status.done}/${status.total}` : dateStr}
                >
                  <span className="hab-month-day-num">{date.getDate()}</span>
                  {!isFuture && status.total > 0 && intensity === 4 && (
                    <span className="hab-month-day-check">✓</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* 4. Einstieg Jahresrückblick */}
      <div className="hab-stats-section">
        <button className="hab-sub-entry card" onClick={() => onOpenSub('jahresrueckblick')}>
          <div className="hab-sub-entry-left">
            <span className="hab-sub-entry-icon">📅</span>
            <div>
              <div className="hab-sub-entry-title t-body">Jahresrückblick</div>
              <div className="hab-sub-entry-meta t-meta">Heatmap · Jahresübersicht</div>
            </div>
          </div>
          <span className="hab-sub-entry-chevron">›</span>
        </button>
      </div>

      {/* 5. Einstieg Verlauf */}
      <div className="hab-stats-section" style={{ paddingBottom: 'calc(var(--nav-height) + 30px + env(safe-area-inset-bottom))' }}>
        <button className="hab-sub-entry card" onClick={() => onOpenSub('verlauf')}>
          <div className="hab-sub-entry-left">
            <span className="hab-sub-entry-icon">🏅</span>
            <div>
              <div className="hab-sub-entry-title t-body">Verlauf & Badges</div>
              <div className="hab-sub-entry-meta t-meta">Streak · Rekord · Badges</div>
            </div>
          </div>
          <span className="hab-sub-entry-chevron">›</span>
        </button>
      </div>

    </div>
  );
}

// ─── Unterseite: Jahresrückblick ──────────────────────────

function JahresrueckblickScreen({ habits, entries, onBack }) {
  const nowDate  = new Date();
  const [year, setYear]               = useState(nowDate.getFullYear());
  const [selectedHabit, setSelected]  = useState('all');

  const relevantHabits = selectedHabit === 'all'
    ? habits
    : habits.filter((h) => h.id === selectedHabit);

  const heatmapData = useMemo(
    () => buildHeatmap(relevantHabits, entries, year),
    [relevantHabits, entries, year]
  );

  return (
    <div className="hab-subview">
      <h1 className="page-header">Jahresrückblick</h1>

        {/* Habit-Selector */}
        <div className="hab-cal-filter">
          <select
            className="form-input"
            value={selectedHabit}
            onChange={(e) => setSelected(e.target.value)}
          >
            <option value="all">Alle Gewohnheiten</option>
            {habits.map((h) => (
              <option key={h.id} value={h.id}>{h.icon} {h.name}</option>
            ))}
          </select>
        </div>

        {/* Jahresnavigation */}
        <div className="hab-heatmap-header">
          <div className="hab-heatmap-title t-title">Jahresübersicht {year}</div>
          <div className="hab-year-nav">
            <button className="hab-nav-btn" onClick={() => setYear((y) => y - 1)}>‹</button>
            <span className="t-body">{year}</span>
            <button
              className="hab-nav-btn"
              onClick={() => setYear((y) => y + 1)}
              disabled={year >= nowDate.getFullYear()}
            >›</button>
          </div>
        </div>

        <HeatmapGrid data={heatmapData} year={year} />

        {/* Legende */}
        <div className="hab-heatmap-legend">
          <span className="hab-legend-label t-meta">Weniger</span>
          {INTENSITY_COLORS.map((col, i) => (
            <div key={i} className="hab-legend-cell"
              style={{ backgroundColor: col, border: '1px solid var(--border-hairline)' }} />
          ))}
          <span className="hab-legend-label t-meta">Mehr</span>
        </div>
    </div>
  );
}

// ─── Unterseite: Verlauf & Badges ─────────────────────────

function VerlaufScreen({ habits, entries, onBack }) {
  const todayStr = today();
  const nowDate  = new Date(todayStr);
  const weekAgo  = new Date(nowDate); weekAgo.setDate(nowDate.getDate() - 6);
  const monthAgo = new Date(nowDate); monthAgo.setDate(nowDate.getDate() - 29);
  const weekFrom  = weekAgo.toISOString().split('T')[0];
  const monthFrom = monthAgo.toISOString().split('T')[0];

  const earnedBadges = useMemo(() => getEarnedBadges(habits, entries), [habits, entries]);
  const lockedBadges = BADGES.filter((b) => !earnedBadges.find((e) => e.id === b.id));

  const habitStats = useMemo(() =>
    habits.map((h) => ({
      habit:     h,
      streak:    calcStreak(h, entries),
      longest:   calcLongestStreak(h, entries),
      weekRate:  completionRate(h, entries, weekFrom, todayStr),
      monthRate: completionRate(h, entries, monthFrom, todayStr),
    })).sort((a, b) => b.streak - a.streak),
    [habits, entries, weekFrom, monthFrom, todayStr]
  );

  return (
    <div className="hab-subview">
      <h1 className="page-header">Verlauf & Badges</h1>

        {/* Per-Habit Tabelle */}
        <div className="hab-stats-section">
          <div className="hab-stats-section-title t-card-title">Gewohnheiten im Überblick</div>
          <div className="card hab-stats-table">
            {habitStats.map(({ habit, streak, longest, weekRate: wr, monthRate: mr }) => (
              <div key={habit.id} className="hab-stats-row">
                <div className="hab-stats-icon">{habit.icon}</div>
                <div className="hab-stats-name t-body">{habit.name}</div>
                <div className="hab-stats-cells">
                  <div className="hab-stats-cell">
                    <div className="hab-stats-val t-value">🔥 {streak}</div>
                    <div className="hab-stats-cell-label t-meta">Streak</div>
                  </div>
                  <div className="hab-stats-cell">
                    <div className="hab-stats-val t-value">{longest}</div>
                    <div className="hab-stats-cell-label t-meta">Rekord</div>
                  </div>
                  <div className="hab-stats-cell">
                    <div className="hab-stats-val t-value">{Math.round(wr * 100)}%</div>
                    <div className="hab-stats-cell-label t-meta">7 Tage</div>
                  </div>
                  <div className="hab-stats-cell">
                    <div className="hab-stats-val t-value">{Math.round(mr * 100)}%</div>
                    <div className="hab-stats-cell-label t-meta">30 Tage</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Badges */}
        <div className="hab-stats-section" style={{ paddingBottom: 'calc(var(--nav-height) + 30px + env(safe-area-inset-bottom))' }}>
          <div className="hab-stats-section-title t-card-title">Badges</div>
          {earnedBadges.length > 0 && (
            <div className="card hab-badges-grid" style={{ marginBottom: 12 }}>
              {earnedBadges.map((badge) => (
                <div key={badge.id} className="hab-badge hab-badge--earned" title={badge.desc}>
                  <span className="hab-badge-icon">{badge.icon}</span>
                  <span className="hab-badge-label t-meta">{badge.label}</span>
                </div>
              ))}
            </div>
          )}
          {lockedBadges.length > 0 && (
            <div className="card hab-badges-grid">
              {lockedBadges.map((badge) => (
                <div key={badge.id} className="hab-badge hab-badge--locked" title={badge.desc}>
                  <span className="hab-badge-icon" style={{ filter: 'grayscale(1)', opacity: 0.35 }}>{badge.icon}</span>
                  <span className="hab-badge-label t-meta" style={{ opacity: 0.4 }}>{badge.label}</span>
                </div>
              ))}
            </div>
          )}
        </div>

    </div>
  );
}

// ─── Heatmap-Grid ─────────────────────────────────────────

function HeatmapGrid({ data, year }) {
  const todayStr = today();

  const weeks = useMemo(() => {
    if (!data.length) return [];
    const byDate = {};
    for (const d of data) byDate[d.date] = d;

    const jan1       = new Date(year, 0, 1);
    const startOff   = (jan1.getDay() + 6) % 7;
    const gridStart  = new Date(jan1);
    gridStart.setDate(gridStart.getDate() - startOff);

    const dec31    = new Date(year, 11, 31);
    const endOff   = (6 - (dec31.getDay() + 6) % 7);
    const gridEnd  = new Date(dec31);
    gridEnd.setDate(gridEnd.getDate() + endOff);

    const allDates = dateRange(toDateStr(gridStart), toDateStr(gridEnd));
    const weekList = [];
    for (let i = 0; i < allDates.length; i += 7) {
      weekList.push(
        allDates.slice(i, i + 7).map((d) => ({
          date: d,
          ...(byDate[d] ?? { intensity: 0, done: 0, total: 0 }),
        }))
      );
    }
    return weekList;
  }, [data, year]);

  const monthLabels = useMemo(() => {
    const labels = {};
    weeks.forEach((week, wi) => {
      week.forEach((day) => {
        if (day.date.endsWith('-01') && day.date.startsWith(String(year))) {
          const m = parseInt(day.date.split('-')[1], 10) - 1;
          labels[wi] = MONTH_ABBR[m];
        }
      });
    });
    return labels;
  }, [weeks, year]);

  return (
    <div className="hab-heatmap-scroll">
      <div className="hab-heatmap">
        <div className="hab-heatmap-months">
          {weeks.map((_, wi) => (
            <div key={wi} className="hab-heatmap-month-cell t-meta">
              {monthLabels[wi] ?? ''}
            </div>
          ))}
        </div>
        <div className="hab-heatmap-row-labels">
          {['Mo','','Mi','','Fr','','So'].map((l, i) => (
            <div key={i} className="hab-heatmap-row-label t-meta">{l}</div>
          ))}
        </div>
        <div className="hab-heatmap-weeks">
          {weeks.map((week, wi) => (
            <div key={wi} className="hab-heatmap-week">
              {week.map((day) => {
                const isFuture = day.date > todayStr;
                const inYear   = day.date >= `${year}-01-01` && day.date <= `${year}-12-31`;
                const intensity = isFuture || !inYear ? -1 : day.intensity;
                return (
                  <div
                    key={day.date}
                    className="hab-heatmap-cell"
                    style={{
                      backgroundColor: intensity >= 0 ? INTENSITY_COLORS[intensity] : 'transparent',
                      border: intensity >= 0 ? '1px solid var(--border-hairline)' : 'none',
                      opacity: inYear ? 1 : 0,
                    }}
                    title={inYear && !isFuture ? `${day.date}: ${day.done}/${day.total}` : day.date}
                  />
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
