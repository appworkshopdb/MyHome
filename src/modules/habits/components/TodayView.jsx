// modules/habits/components/TodayView.jsx
// Heute-Ansicht im "Kompakte Tiefe"-Design:
// area-list Karte + hab-check-row Zeilen analog zu TodoSheet/Hub-Aufgaben

import { useState, useMemo } from 'react';
import { today, isDueOn, isDone, getEntry, calcStreak, toDateStr } from '../lib/habUtils.js';
import { toggleHabitOn, setHabitCount } from '../../../core/lib/habitsStore.js';
import { fb } from '../../../core/lib/feedback.js';

const WEEKDAY_LABELS = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];

function getCurrentWeekDays() {
  const now = new Date();
  const mon = new Date(now);
  mon.setDate(now.getDate() - ((now.getDay() + 6) % 7));
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(mon);
    d.setDate(mon.getDate() + i);
    return toDateStr(d);
  });
}

function isStreakProtected(habit, entries) {
  const todayStr = today();
  const yesterday = new Date(todayStr);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = toDateStr(yesterday);
  const dayBefore = new Date(todayStr);
  dayBefore.setDate(dayBefore.getDate() - 2);
  const dayBeforeStr = toDateStr(dayBefore);
  if (!isDueOn(habit, yesterdayStr)) return false;
  if (!isDone(entries, habit.id, yesterdayStr, habit.target_count) === false) return false;
  const missed = !isDone(entries, habit.id, yesterdayStr, habit.target_count);
  if (!missed) return false;
  return isDone(entries, habit.id, dayBeforeStr, habit.target_count) ||
         isDone(entries, habit.id, todayStr, habit.target_count);
}

export default function TodayView({ habits, entries, onEntriesChange, onNavigateToHabits }) {
  const [busyId, setBusyId]     = useState(null);
  const [error, setError]       = useState(null);
  const [showWeek, setShowWeek] = useState(false);

  const todayStr = today();
  const weekDays = useMemo(() => getCurrentWeekDays(), []);

  const dueHabits = useMemo(() => {
    const due = habits.filter((h) => h.active && !h.deleted_at && isDueOn(h, todayStr));
    return due.sort((a, b) => {
      const aDone = isDone(entries, a.id, todayStr, a.target_count) ? 1 : 0;
      const bDone = isDone(entries, b.id, todayStr, b.target_count) ? 1 : 0;
      return aDone - bDone;
    });
  }, [habits, entries, todayStr]);

  const totalDue  = dueHabits.length;
  const totalDone = dueHabits.filter((h) => isDone(entries, h.id, todayStr, h.target_count)).length;
  const allDone   = totalDue > 0 && totalDone === totalDue;

  async function handleToggle(habit) {
    if (busyId) return;
    setBusyId(habit.id);
    setError(null);
    try {
      const entry   = getEntry(entries, habit.id, todayStr);
      const wasDone = entry && !entry.deleted_at && entry.count >= habit.target_count;
      if (!wasDone && habit.target_count > 1) {
        await setHabitCount(habit, habit.target_count, todayStr);
      } else {
        await toggleHabitOn(habit, todayStr);
      }
      if (!wasDone) {
        if (totalDone + 1 === totalDue) fb.habitAllDone();
        else fb.habitCheck();
      }
    } catch {
      setError('Konnte nicht gespeichert werden.');
      fb.error();
    } finally {
      setBusyId(null);
    }
  }

  // ─── Leer-Zustand ────────────────────────────────────────
  if (totalDue === 0) {
    return (
      <div className="hab-empty-state">
        <div className="hab-empty-icon">🌱</div>
        <p className="hab-empty-title">Keine Gewohnheiten für heute</p>
        <p className="hab-empty-text">Füge deine erste Gewohnheit über das + hinzu.</p>
      </div>
    );
  }

  return (
    <div className="hab-today-wrap">

      {/* Section-Kopf mit Fortschritt */}
      <div className="hab-today-head">
        <span className="hab-today-head-label">HEUTE FÄLLIG</span>
        <span className="hab-today-head-score">{totalDone} / {totalDue}</span>
      </div>

      {/* Dünner Fortschrittsbalken */}
      <div className="hab-today-bar">
        <div
          className="hab-today-bar-fill"
          style={{ width: `${totalDue > 0 ? Math.round((totalDone / totalDue) * 100) : 0}%` }}
        />
      </div>

      {error && <div className="toast toast-error" style={{ margin: '8px 0' }}>{error}</div>}

      {/* Alles erledigt */}
      {allDone && (
        <div className="hab-all-done-banner">
          🏆 Alle Gewohnheiten erledigt!
        </div>
      )}

      {/* Habit-Liste als area-list-Karte */}
      <div className="area-list hab-check-list">
        {dueHabits.map((habit) => {
          const entry     = getEntry(entries, habit.id, todayStr);
          const done      = entry && !entry.deleted_at && entry.count >= habit.target_count;
          const streak    = calcStreak(habit, entries);
          const protected_ = isStreakProtected(habit, entries);
          const busy      = busyId === habit.id;

          return (
            <button
              key={habit.id}
              className={`hab-check-row ${done ? 'hab-check-row--done' : ''} ${busy ? 'hab-check-row--busy' : ''}`}
              onClick={() => handleToggle(habit)}
              disabled={busy}
              aria-label={done ? `${habit.name} rückgängig` : `${habit.name} abhaken`}
            >
              {/* Checkbox */}
              <span className={`hab-checkbox ${done ? 'hab-checkbox--checked' : ''}`} aria-hidden="true">
                {busy ? <span className="hab-check-spinner" /> : done ? '✓' : ''}
              </span>

              {/* Icon + Info */}
              <span className="hab-check-icon">{habit.icon}</span>
              <span className="hab-check-info">
                <span className="hab-check-name">{habit.name}</span>
                {(streak > 0 || protected_ || habit.target_count > 1) && (
                  <span className="hab-check-meta">
                    {streak > 0 && (
                      <span className="hab-streak-pill">
                        🔥 {streak}{protected_ && ' 🛡'}
                      </span>
                    )}
                    {habit.target_count > 1 && (
                      <span className="hab-check-unit">{habit.target_count} {habit.unit}</span>
                    )}
                  </span>
                )}
              </span>
            </button>
          );
        })}
      </div>

      {/* Wochenübersicht toggle */}
      <button
        className="hab-week-toggle-btn"
        onClick={() => setShowWeek((v) => !v)}
      >
        {showWeek ? '↑ Woche ausblenden' : '↓ Wochenübersicht'}
      </button>

      {/* Wochenübersicht */}
      {showWeek && (
        <div className="area-list hab-week-grid-wrap">
          <div className="hab-week-grid">
            <div className="hab-week-grid-header">
              <div className="hab-week-col-name" />
              {weekDays.map((d, i) => (
                <div key={d} className={`hab-week-col-label ${d === todayStr ? 'is-today' : ''}`}>
                  {WEEKDAY_LABELS[i]}
                </div>
              ))}
            </div>
            {habits.filter((h) => h.active && !h.deleted_at).map((habit) => (
              <div key={habit.id} className="hab-week-grid-row">
                <div className="hab-week-row-name">
                  <span>{habit.icon}</span>
                  <span className="hab-week-row-label">{habit.name}</span>
                </div>
                {weekDays.map((d) => {
                  const due    = isDueOn(habit, d);
                  const done   = isDone(entries, habit.id, d, habit.target_count);
                  const future = d > todayStr;
                  return (
                    <div
                      key={d}
                      className={[
                        'hab-week-cell',
                        !due              ? 'is-skip'   : '',
                        due && done       ? 'is-done'   : '',
                        due && !done && !future ? 'is-missed' : '',
                        future            ? 'is-future' : '',
                        d === todayStr    ? 'is-today'  : '',
                      ].join(' ')}
                    >
                      {due && done && '✓'}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Link zu Verwaltung */}
      <button
        className="area-list hab-manage-link"
        onClick={onNavigateToHabits}
      >
        <span className="area-row-label">Alle Gewohnheiten verwalten</span>
        <span className="area-row-chevron">›</span>
      </button>

    </div>
  );
}
