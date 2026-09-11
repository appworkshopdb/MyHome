// modules/habits/components/StatsView.jsx
// Auswertung im "Kompakte Tiefe"-Design:
// KPI-Kacheln als area-list, Balkendiagramm, Per-Habit-Liste, Badges

import { useMemo } from 'react';
import {
  calcStreak, calcLongestStreak, completionRate, overallRate,
  getEarnedBadges, BADGES, today, dateRange, isDueOn, isDone,
} from '../lib/habUtils.js';

export default function StatsView({ habits, entries }) {
  const activeHabits = habits.filter((h) => h.active && !h.deleted_at);
  const todayStr = today();

  const nowDate  = new Date(todayStr);
  const weekAgo  = new Date(nowDate); weekAgo.setDate(nowDate.getDate() - 6);
  const monthAgo = new Date(nowDate); monthAgo.setDate(nowDate.getDate() - 29);
  const weekFrom  = weekAgo.toISOString().split('T')[0];
  const monthFrom = monthAgo.toISOString().split('T')[0];

  const earnedBadges  = useMemo(() => getEarnedBadges(activeHabits, entries), [activeHabits, entries]);
  const lockedBadges  = BADGES.filter((b) => !earnedBadges.find((e) => e.id === b.id));
  const totalCheckins = entries.filter((e) => !e.deleted_at).length;
  const weekRate      = useMemo(() => overallRate(activeHabits, entries, weekFrom, todayStr),  [activeHabits, entries, weekFrom]);
  const monthRate     = useMemo(() => overallRate(activeHabits, entries, monthFrom, todayStr), [activeHabits, entries, monthFrom]);

  const weekDays  = dateRange(weekFrom, todayStr);
  const weekTrend = weekDays.map((d) => {
    const due  = activeHabits.filter((h) => isDueOn(h, d));
    const done = due.filter((h) => isDone(entries, h.id, d, h.target_count)).length;
    return { date: d, rate: due.length > 0 ? done / due.length : null };
  });
  const maxBarRate = Math.max(...weekTrend.map((d) => d.rate ?? 0), 0.01);

  const habitStats = useMemo(() =>
    activeHabits.map((h) => ({
      habit:     h,
      streak:    calcStreak(h, entries),
      longest:   calcLongestStreak(h, entries),
      weekRate:  completionRate(h, entries, weekFrom, todayStr),
      monthRate: completionRate(h, entries, monthFrom, todayStr),
    })).sort((a, b) => b.streak - a.streak),
    [activeHabits, entries, weekFrom, monthFrom, todayStr]
  );

  if (activeHabits.length === 0) {
    return (
      <div className="hab-empty-state">
        <div className="hab-empty-icon">📊</div>
        <p className="hab-empty-title">Noch keine Auswertung</p>
        <p className="hab-empty-text">Leg Gewohnheiten an und hak sie ab — hier siehst du dann deine Statistiken.</p>
      </div>
    );
  }

  return (
    <div className="hab-stats-wrap">

      {/* KPI — 2×2 Grid als vier area-list-ähnliche Kacheln */}
      <div className="hab-kpi-grid">
        {[
          { num: totalCheckins,                  label: 'Check-ins gesamt' },
          { num: `${Math.round(weekRate * 100)} %`,  label: 'Diese Woche' },
          { num: `${Math.round(monthRate * 100)} %`, label: '30 Tage' },
          { num: earnedBadges.length,            label: 'Badges' },
        ].map(({ num, label }) => (
          <div key={label} className="hab-kpi-card">
            <div className="hab-kpi-num">{num}</div>
            <div className="hab-kpi-label">{label}</div>
          </div>
        ))}
      </div>

      {/* Wochen-Balkendiagramm */}
      <div className="hab-stats-section">
        <div className="hab-stats-section-title">Letzte 7 Tage</div>
        <div className="area-list hab-bar-card">
          <div className="hab-bar-chart">
            {weekTrend.map(({ date, rate }) => {
              const pct    = rate !== null ? Math.round(rate * 100) : null;
              const height = rate !== null ? Math.round((rate / maxBarRate) * 100) : 0;
              const label  = new Date(date).toLocaleDateString('de-DE', { weekday: 'short' });
              const isToday = date === todayStr;
              return (
                <div key={date} className="hab-bar-col">
                  <div className="hab-bar-pct">{pct !== null && pct > 0 ? `${pct}%` : ''}</div>
                  <div className="hab-bar-track">
                    <div
                      className={`hab-bar-fill ${isToday ? 'is-today' : ''}`}
                      style={{ height: `${height}%` }}
                    />
                  </div>
                  <div className={`hab-bar-day ${isToday ? 'is-today' : ''}`}>{label}</div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Per-Habit Tabelle */}
      <div className="hab-stats-section">
        <div className="hab-stats-section-title">Gewohnheiten im Überblick</div>
        <div className="area-list">
          {habitStats.map(({ habit, streak, longest, weekRate: wr, monthRate: mr }) => (
            <div key={habit.id} className="hab-habit-stat-row">
              <span className="hab-habit-stat-icon">{habit.icon}</span>
              <span className="hab-habit-stat-name">{habit.name}</span>
              <div className="hab-habit-stat-cells">
                <div className="hab-stat-cell">
                  <span className="hab-stat-val">🔥 {streak}</span>
                  <span className="hab-stat-lbl">Streak</span>
                </div>
                <div className="hab-stat-cell">
                  <span className="hab-stat-val">{longest}</span>
                  <span className="hab-stat-lbl">Rekord</span>
                </div>
                <div className="hab-stat-cell">
                  <span className="hab-stat-val">{Math.round(wr * 100)}%</span>
                  <span className="hab-stat-lbl">7 Tage</span>
                </div>
                <div className="hab-stat-cell">
                  <span className="hab-stat-val">{Math.round(mr * 100)}%</span>
                  <span className="hab-stat-lbl">30 T.</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Badges */}
      <div className="hab-stats-section">
        <div className="hab-stats-section-title">Badges</div>

        {earnedBadges.length > 0 && (
          <div className="hab-badges-grid">
            {earnedBadges.map((badge) => (
              <div key={badge.id} className="hab-badge hab-badge--earned" title={badge.desc}>
                <span className="hab-badge-icon">{badge.icon}</span>
                <span className="hab-badge-name">{badge.label}</span>
              </div>
            ))}
          </div>
        )}

        {lockedBadges.length > 0 && (
          <div className="hab-badges-grid" style={{ marginTop: earnedBadges.length ? 10 : 0 }}>
            {lockedBadges.map((badge) => (
              <div key={badge.id} className="hab-badge hab-badge--locked" title={badge.desc}>
                <span className="hab-badge-icon">{badge.icon}</span>
                <span className="hab-badge-name">{badge.label}</span>
              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  );
}
