// modules/habits/components/CalendarView.jsx
// Verlauf: Monatskalender + Jahres-Heatmap im "Kompakte Tiefe"-Design

import { useState, useMemo } from 'react';
import { buildHeatmap, isDueOn, isDone, dateRange, toDateStr, today } from '../lib/habUtils.js';

const MONTH_NAMES   = ['Januar','Februar','März','April','Mai','Juni','Juli','August','September','Oktober','November','Dezember'];
const DAY_SHORT     = ['Mo','Di','Mi','Do','Fr','Sa','So'];

// Heatmap-Intensität → Design-Token statt color-mix
// data-track = leer/kein Eintrag, data-1..3 = leicht..mittel, action-primary = voll
const INTENSITY_BG = [
  'var(--data-track)',    // 0 — nichts
  'var(--data-3)',        // 1 — wenig
  'var(--data-2)',        // 2 — halb
  'var(--data-2)',        // 3 — viel
  'var(--data-1)',        // 4 — alles
];

export default function CalendarView({ habits, entries }) {
  const todayStr = today();
  const nowDate  = new Date();
  const [year,  setYear]          = useState(nowDate.getFullYear());
  const [month, setMonth]         = useState(nowDate.getMonth());
  const [selectedHabit, setHabit] = useState('all');

  const activeHabits = habits.filter((h) => h.active && !h.deleted_at);

  const heatmapData = useMemo(() => {
    const rel = selectedHabit === 'all' ? activeHabits : activeHabits.filter((h) => h.id === selectedHabit);
    return buildHeatmap(rel, entries, year);
  }, [activeHabits, entries, year, selectedHabit]);

  const heatmapByDate = useMemo(() => {
    const m = {};
    for (const d of heatmapData) m[d.date] = d;
    return m;
  }, [heatmapData]);

  const monthDays = useMemo(() => {
    const first = new Date(year, month, 1);
    const last  = new Date(year, month + 1, 0);
    const days  = [];
    const startWd = (first.getDay() + 6) % 7;
    for (let i = 0; i < startWd; i++) days.push(null);
    for (let d = 1; d <= last.getDate(); d++) days.push(new Date(year, month, d));
    return days;
  }, [year, month]);

  function prevMonth() { if (month === 0) { setMonth(11); setYear((y) => y - 1); } else setMonth((m) => m - 1); }
  function nextMonth() { if (month === 11) { setMonth(0); setYear((y) => y + 1); } else setMonth((m) => m + 1); }

  return (
    <div className="hab-cal-wrap">

      {/* Habit-Filter */}
      <div className="hab-cal-filter">
        <select
          className="hab-cal-select"
          value={selectedHabit}
          onChange={(e) => setHabit(e.target.value)}
        >
          <option value="all">Alle Gewohnheiten</option>
          {activeHabits.map((h) => (
            <option key={h.id} value={h.id}>{h.icon} {h.name}</option>
          ))}
        </select>
      </div>

      {/* ── Monatskalender ─────────────────────────────── */}
      <div className="hab-cal-section-title">Monatsübersicht</div>
      <div className="area-list hab-month-card">

        {/* Navigation */}
        <div className="hab-month-nav">
          <button className="hab-nav-btn" onClick={prevMonth}>‹</button>
          <span className="hab-month-label">{MONTH_NAMES[month]} {year}</span>
          <button
            className="hab-nav-btn"
            onClick={nextMonth}
            disabled={year === nowDate.getFullYear() && month === nowDate.getMonth()}
          >›</button>
        </div>

        {/* Wochentag-Header */}
        <div className="hab-month-weekdays">
          {DAY_SHORT.map((d) => <div key={d} className="hab-month-wd">{d}</div>)}
        </div>

        {/* Kacheln */}
        <div className="hab-month-grid">
          {monthDays.map((date, i) => {
            if (!date) return <div key={`e-${i}`} />;
            const ds      = toDateStr(date);
            const status  = heatmapByDate[ds] ?? { intensity: 0, done: 0, total: 0 };
            const isToday = ds === todayStr;
            const isFuture = ds > todayStr;
            return (
              <div
                key={ds}
                className={`hab-month-day ${isToday ? 'is-today' : ''} ${isFuture ? 'is-future' : ''}`}
                style={!isFuture && status.total > 0 ? { background: INTENSITY_BG[status.intensity] } : {}}
                title={!isFuture && status.total > 0 ? `${status.done}/${status.total} erledigt` : ds}
              >
                <span className="hab-month-day-num">{date.getDate()}</span>
                {!isFuture && status.intensity === 4 && <span className="hab-month-check">✓</span>}
              </div>
            );
          })}
        </div>

        {/* Legende */}
        <div className="hab-cal-legend">
          <span className="hab-legend-lbl">Weniger</span>
          {INTENSITY_BG.map((bg, i) => (
            <div key={i} className="hab-legend-dot" style={{ background: bg }} />
          ))}
          <span className="hab-legend-lbl">Mehr</span>
        </div>
      </div>

      {/* ── Jahres-Heatmap ──────────────────────────────── */}
      <div className="hab-cal-section-title" style={{ marginTop: 20 }}>
        Jahresrückblick
        <div className="hab-year-nav">
          <button className="hab-nav-btn" onClick={() => setYear((y) => y - 1)}>‹</button>
          <span>{year}</span>
          <button className="hab-nav-btn" onClick={() => setYear((y) => y + 1)} disabled={year >= nowDate.getFullYear()}>›</button>
        </div>
      </div>
      <div className="area-list hab-heatmap-card">
        <HeatmapGrid data={heatmapData} year={year} todayStr={todayStr} intensityBg={INTENSITY_BG} />
      </div>

    </div>
  );
}

function HeatmapGrid({ data, year, todayStr, intensityBg }) {
  const weeks = useMemo(() => {
    if (!data.length) return [];
    const byDate = {};
    for (const d of data) byDate[d.date] = d;

    const jan1 = new Date(year, 0, 1);
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

  const MONTH_ABBR = ['Jan','Feb','Mär','Apr','Mai','Jun','Jul','Aug','Sep','Okt','Nov','Dez'];
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
        <div className="hab-hm-months">
          {weeks.map((_, wi) => (
            <div key={wi} className="hab-hm-month-cell">{monthLabels[wi] ?? ''}</div>
          ))}
        </div>
        <div className="hab-hm-row-labels">
          {['Mo','','Mi','','Fr','','So'].map((l, i) => (
            <div key={i} className="hab-hm-row-lbl">{l}</div>
          ))}
        </div>
        <div className="hab-hm-weeks">
          {weeks.map((week, wi) => (
            <div key={wi} className="hab-hm-week">
              {week.map((day) => {
                const isFuture = day.date > todayStr;
                const inYear   = day.date >= `${year}-01-01` && day.date <= `${year}-12-31`;
                return (
                  <div
                    key={day.date}
                    className="hab-hm-cell"
                    style={{
                      background: isFuture || !inYear ? 'transparent' : intensityBg[day.intensity],
                      opacity: inYear ? 1 : 0,
                    }}
                    title={inYear && !isFuture ? `${day.date}: ${day.done}/${day.total}` : ''}
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
