// modules/habits/components/CalendarView.jsx
// Verlaufs-Ansicht: Monatskalender + Jahres-Heatmap pro Habit oder gesamt

import { useState, useMemo } from 'react';
import { buildHeatmap, isDueOn, isDone, dateRange, toDateStr, today } from '../lib/habUtils.js';

const MONTH_NAMES = [
  'Januar','Februar','März','April','Mai','Juni',
  'Juli','August','September','Oktober','November','Dezember',
];
const DAY_LABELS_SHORT = ['Mo','Di','Mi','Do','Fr','Sa','So'];

export default function CalendarView({ habits, entries }) {
  const todayStr   = today();
  const nowDate    = new Date();
  const [year, setYear]         = useState(nowDate.getFullYear());
  const [month, setMonth]       = useState(nowDate.getMonth()); // 0-11
  const [selectedHabit, setSelectedHabit] = useState('all'); // 'all' | habitId

  const activeHabits = habits.filter((h) => h.active && !h.deleted_at);

  // Heatmap-Daten für das gewählte Jahr
  const heatmapData = useMemo(() => {
    const relevantHabits = selectedHabit === 'all'
      ? activeHabits
      : activeHabits.filter((h) => h.id === selectedHabit);
    return buildHeatmap(relevantHabits, entries, year);
  }, [activeHabits, entries, year, selectedHabit]);

  // Monatskalender
  const monthDays = useMemo(() => {
    const firstDay = new Date(year, month, 1);
    const lastDay  = new Date(year, month + 1, 0);
    const days = [];
    // Leere Felder am Anfang (Montag = 0)
    const startWd = (firstDay.getDay() + 6) % 7;
    for (let i = 0; i < startWd; i++) days.push(null);
    for (let d = 1; d <= lastDay.getDate(); d++) {
      days.push(new Date(year, month, d));
    }
    return days;
  }, [year, month]);

  function prevMonth() {
    if (month === 0) { setMonth(11); setYear((y) => y - 1); }
    else setMonth((m) => m - 1);
  }
  function nextMonth() {
    if (month === 11) { setMonth(0); setYear((y) => y + 1); }
    else setMonth((m) => m + 1);
  }

  const intensityColors = [
    'var(--bg-card)',       // 0 = nichts fällig / nicht gemacht
    'var(--accent-light)',  // 1 = wenig
    'color-mix(in srgb, var(--accent) 40%, var(--accent-light))', // 2
    'color-mix(in srgb, var(--accent) 70%, transparent)',         // 3
    'var(--accent)',        // 4 = alles erledigt
  ];

  const heatmapByDate = useMemo(() => {
    const map = {};
    for (const d of heatmapData) map[d.date] = d;
    return map;
  }, [heatmapData]);

  // Monatskalender-Einträge berechnen
  function getDayStatus(date) {
    if (!date) return null;
    const dateStr = toDateStr(date);
    const d = heatmapByDate[dateStr];
    if (!d) return { intensity: 0, done: 0, total: 0 };
    return d;
  }

  return (
    <div className="hab-calendar-view">

      {/* Habit-Selector */}
      <div className="hab-cal-filter">
        <select
          className="form-input"
          value={selectedHabit}
          onChange={(e) => setSelectedHabit(e.target.value)}
        >
          <option value="all">Alle Gewohnheiten</option>
          {activeHabits.map((h) => (
            <option key={h.id} value={h.id}>{h.icon} {h.name}</option>
          ))}
        </select>
      </div>

      {/* Monatskalender */}
      <div className="hab-month-nav">
        <button className="hab-nav-btn" onClick={prevMonth}>‹</button>
        <span className="hab-month-label">{MONTH_NAMES[month]} {year}</span>
        <button
          className="hab-nav-btn"
          onClick={nextMonth}
          disabled={year === nowDate.getFullYear() && month === nowDate.getMonth()}
        >›</button>
      </div>

      <div className="hab-month-grid">
        {/* Wochentag-Header */}
        {DAY_LABELS_SHORT.map((d) => (
          <div key={d} className="hab-month-weekday">{d}</div>
        ))}
        {/* Tage */}
        {monthDays.map((date, i) => {
          if (!date) return <div key={`e-${i}`} className="hab-month-day--empty" />;
          const dateStr = toDateStr(date);
          const status  = getDayStatus(date);
          const isToday = dateStr === todayStr;
          const isFuture = dateStr > todayStr;

          const intensity = isFuture ? -1 : (status?.intensity ?? 0);

          return (
            <div
              key={dateStr}
              className={`hab-month-day ${isToday ? 'hab-month-day--today' : ''} ${isFuture ? 'hab-month-day--future' : ''}`}
              style={intensity >= 0 ? { backgroundColor: intensityColors[intensity] } : {}}
              title={
                status && !isFuture
                  ? `${dateStr}: ${status.done}/${status.total} erledigt`
                  : dateStr
              }
            >
              <span className="hab-month-day-num">{date.getDate()}</span>
              {!isFuture && status?.total > 0 && intensity === 4 && (
                <span className="hab-month-day-check">✓</span>
              )}
            </div>
          );
        })}
      </div>

      {/* Jahres-Heatmap (GitHub-Stil) */}
      <div className="hab-heatmap-wrap">
        <div className="hab-heatmap-header">
          <div className="hab-heatmap-title">Jahresrückblick {year}</div>
          <div className="hab-year-nav">
            <button className="hab-nav-btn" onClick={() => setYear((y) => y - 1)}>‹</button>
            <span>{year}</span>
            <button
              className="hab-nav-btn"
              onClick={() => setYear((y) => y + 1)}
              disabled={year >= nowDate.getFullYear()}
            >›</button>
          </div>
        </div>

        <HeatmapGrid data={heatmapData} year={year} intensityColors={intensityColors} />

        {/* Legende */}
        <div className="hab-heatmap-legend">
          <span className="hab-legend-label">Weniger</span>
          {intensityColors.map((col, i) => (
            <div
              key={i}
              className="hab-legend-cell"
              style={{ backgroundColor: col, border: '1px solid var(--border)' }}
            />
          ))}
          <span className="hab-legend-label">Mehr</span>
        </div>
      </div>

      {/* Leer-Zustand */}
      {activeHabits.length === 0 && (
        <div className="hab-empty" style={{ marginTop: 24 }}>
          <div className="hab-empty-icon">📅</div>
          <div className="hab-empty-title">Noch keine Daten</div>
          <div className="hab-empty-text">Sobald du Gewohnheiten anlegst und abhakst, siehst du hier deinen Verlauf.</div>
        </div>
      )}
    </div>
  );
}

// ─── Heatmap-Grid ──────────────────────────────────────────

function HeatmapGrid({ data, year, intensityColors }) {
  // Daten nach Wochen gruppieren (Montag-basiert)
  const weeks = useMemo(() => {
    if (!data.length) return [];
    const byDate = {};
    for (const d of data) byDate[d.date] = d;

    const jan1 = new Date(year, 0, 1);
    // Zum letzten Montag vor/am 1. Jan gehen
    const startOffset = (jan1.getDay() + 6) % 7;
    const gridStart = new Date(jan1);
    gridStart.setDate(gridStart.getDate() - startOffset);

    const dec31 = new Date(year, 11, 31);
    const endOffset = (6 - (dec31.getDay() + 6) % 7);
    const gridEnd = new Date(dec31);
    gridEnd.setDate(gridEnd.getDate() + endOffset);

    const allDates = dateRange(toDateStr(gridStart), toDateStr(gridEnd));
    const weekList = [];
    for (let i = 0; i < allDates.length; i += 7) {
      weekList.push(allDates.slice(i, i + 7).map((d) => ({ date: d, ...(byDate[d] ?? { intensity: 0, done: 0, total: 0 }) })));
    }
    return weekList;
  }, [data, year]);

  const todayStr = today();
  const MONTH_ABBR = ['Jan','Feb','Mär','Apr','Mai','Jun','Jul','Aug','Sep','Okt','Nov','Dez'];

  // Monatsbeschriftungen: welche Woche ist der erste im Monat?
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
        {/* Monatslabels über den Wochen */}
        <div className="hab-heatmap-months">
          {weeks.map((_, wi) => (
            <div key={wi} className="hab-heatmap-month-cell">
              {monthLabels[wi] ?? ''}
            </div>
          ))}
        </div>
        {/* Wochentag-Labels links */}
        <div className="hab-heatmap-row-labels">
          {['Mo','','Mi','','Fr','','So'].map((l, i) => (
            <div key={i} className="hab-heatmap-row-label">{l}</div>
          ))}
        </div>
        {/* Wochen-Spalten */}
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
                      backgroundColor: intensity >= 0
                        ? intensityColors[intensity]
                        : 'transparent',
                      border: intensity >= 0 ? '1px solid var(--border)' : 'none',
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
