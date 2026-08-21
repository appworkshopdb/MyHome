// modules/habits/components/StatsView.jsx
// Auswertung: Streaks, Completion-Rates, Wochen-Trend, Badges

import { useMemo } from 'react';
import {
  calcStreak, calcLongestStreak, completionRate,
  getEarnedBadges, BADGES, today, dateRange, isDueOn, isDone,
} from '../lib/habUtils.js';

export default function StatsView({ habits, entries }) {
  const activeHabits = habits.filter((h) => h.active && !h.deleted_at);
  const todayStr = today();

  // Zeitraum-Berechnung
  const nowDate = new Date(todayStr);
  const weekAgo = new Date(nowDate); weekAgo.setDate(nowDate.getDate() - 6);
  const monthAgo = new Date(nowDate); monthAgo.setDate(nowDate.getDate() - 29);

  const weekFrom  = weekAgo.toISOString().split('T')[0];
  const monthFrom = monthAgo.toISOString().split('T')[0];

  // Badges
  const earnedBadges = useMemo(() => getEarnedBadges(activeHabits, entries), [activeHabits, entries]);
  const lockedBadges = BADGES.filter((b) => !earnedBadges.find((e) => e.id === b.id));

  // Gesamt-Stats
  const totalCheckins = entries.filter((e) => !e.deleted_at).length;
  const weekRate  = useMemo(() => overallRate(activeHabits, entries, weekFrom, todayStr), [activeHabits, entries, weekFrom]);
  const monthRate = useMemo(() => overallRate(activeHabits, entries, monthFrom, todayStr), [activeHabits, entries, monthFrom]);

  // Wochen-Trend (letzte 7 Tage, tägl. Completion)
  const weekDays = dateRange(weekFrom, todayStr);
  const weekTrend = weekDays.map((d) => {
    const due  = activeHabits.filter((h) => isDueOn(h, d));
    const done = due.filter((h) => isDone(entries, h.id, d, h.target_count)).length;
    return { date: d, rate: due.length > 0 ? done / due.length : null };
  });

  const maxBarRate = Math.max(...weekTrend.map((d) => d.rate ?? 0), 0.01);

  // Per-Habit Tabelle
  const habitStats = useMemo(() =>
    activeHabits.map((h) => ({
      habit:         h,
      streak:        calcStreak(h, entries),
      longest:       calcLongestStreak(h, entries),
      weekRate:      completionRate(h, entries, weekFrom, todayStr),
      monthRate:     completionRate(h, entries, monthFrom, todayStr),
    })).sort((a, b) => b.streak - a.streak),
    [activeHabits, entries, weekFrom, monthFrom, todayStr]
  );

  if (activeHabits.length === 0) {
    return (
      <div className="hab-empty" style={{ marginTop: 32 }}>
        <div className="hab-empty-icon">📊</div>
        <div className="hab-empty-title">Noch keine Auswertung</div>
        <div className="hab-empty-text">Leg Gewohnheiten an und hak sie ab — hier siehst du dann deine Statistiken.</div>
      </div>
    );
  }

  return (
    <div className="hab-stats-view">

      {/* Kennzahlen-Kacheln */}
      <div className="hab-kpi-grid">
        <div className="hab-kpi-card">
          <div className="hab-kpi-num">{totalCheckins}</div>
          <div className="hab-kpi-label">Gesamt-Check-ins</div>
        </div>
        <div className="hab-kpi-card">
          <div className="hab-kpi-num">{Math.round(weekRate * 100)} %</div>
          <div className="hab-kpi-label">Diese Woche</div>
        </div>
        <div className="hab-kpi-card">
          <div className="hab-kpi-num">{Math.round(monthRate * 100)} %</div>
          <div className="hab-kpi-label">Letzter Monat</div>
        </div>
        <div className="hab-kpi-card">
          <div className="hab-kpi-num">{earnedBadges.length}</div>
          <div className="hab-kpi-label">Badges verdient</div>
        </div>
      </div>

      {/* Wochen-Balkendiagramm */}
      <div className="hab-section">
        <div className="hab-section-label">Letzte 7 Tage</div>
        <div className="hab-week-chart">
          {weekTrend.map(({ date, rate }) => {
            const pct   = rate !== null ? Math.round(rate * 100) : null;
            const height = rate !== null ? Math.round((rate / maxBarRate) * 100) : 0;
            const label  = new Date(date).toLocaleDateString('de-DE', { weekday: 'short' });
            const isToday = date === todayStr;
            return (
              <div key={date} className="hab-week-bar-wrap">
                <div className="hab-week-bar-col">
                  {pct !== null && (
                    <div className="hab-week-bar-pct" style={{ opacity: pct > 0 ? 1 : 0.3 }}>
                      {pct > 0 ? `${pct}%` : '–'}
                    </div>
                  )}
                  <div className="hab-week-bar-track">
                    <div
                      className={`hab-week-bar-fill ${isToday ? 'today' : ''}`}
                      style={{ height: `${height}%` }}
                    />
                  </div>
                </div>
                <div className={`hab-week-bar-label ${isToday ? 'today' : ''}`}>{label}</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Per-Habit Tabelle */}
      <div className="hab-section">
        <div className="hab-section-label">Gewohnheiten im Überblick</div>
        <div className="hab-stats-table">
          {habitStats.map(({ habit, streak, longest, weekRate: wr, monthRate: mr }) => (
            <div key={habit.id} className="hab-stats-row">
              <div className="hab-stats-icon">{habit.icon}</div>
              <div className="hab-stats-name">{habit.name}</div>
              <div className="hab-stats-cells">
                <div className="hab-stats-cell">
                  <div className="hab-stats-val">🔥 {streak}</div>
                  <div className="hab-stats-cell-label">Streak</div>
                </div>
                <div className="hab-stats-cell">
                  <div className="hab-stats-val">{longest}</div>
                  <div className="hab-stats-cell-label">Rekord</div>
                </div>
                <div className="hab-stats-cell">
                  <div className="hab-stats-val">{Math.round(wr * 100)}%</div>
                  <div className="hab-stats-cell-label">7 Tage</div>
                </div>
                <div className="hab-stats-cell">
                  <div className="hab-stats-val">{Math.round(mr * 100)}%</div>
                  <div className="hab-stats-cell-label">30 Tage</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Badges */}
      <div className="hab-section">
        <div className="hab-section-label">Badges</div>
        {earnedBadges.length > 0 && (
          <div className="hab-badges-grid">
            {earnedBadges.map((badge) => (
              <div key={badge.id} className="hab-badge hab-badge--earned" title={badge.desc}>
                <span className="hab-badge-icon">{badge.icon}</span>
                <span className="hab-badge-label">{badge.label}</span>
              </div>
            ))}
          </div>
        )}
        {lockedBadges.length > 0 && (
          <div className="hab-badges-grid" style={{ marginTop: earnedBadges.length > 0 ? 12 : 0 }}>
            {lockedBadges.map((badge) => (
              <div key={badge.id} className="hab-badge hab-badge--locked" title={badge.desc}>
                <span className="hab-badge-icon" style={{ filter: 'grayscale(1)', opacity: 0.35 }}>{badge.icon}</span>
                <span className="hab-badge-label" style={{ opacity: 0.4 }}>{badge.label}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function overallRate(habits, entries, from, to) {
  if (habits.length === 0) return 0;
  const rates = habits.map((h) => {
    const due = dateRange(from, to).filter((d) => isDueOn(h, d));
    if (due.length === 0) return null;
    const done = due.filter((d) => isDone(entries, h.id, d, h.target_count)).length;
    return done / due.length;
  }).filter((r) => r !== null);
  if (rates.length === 0) return 0;
  return rates.reduce((a, b) => a + b, 0) / rates.length;
}
