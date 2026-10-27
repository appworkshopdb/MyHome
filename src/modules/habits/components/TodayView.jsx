// modules/habits/components/TodayView.jsx
// Heute-Ansicht + Wochenübersicht + Streak-Schutz-Anzeige

import { useState, useMemo } from 'react';
import { today, isDueOn, isDone, getEntry, calcStreak, dateRange, toDateStr } from '../lib/habUtils.js';
import { toggleHabitOn, setHabitCount } from '../../../core/lib/habitsStore.js';
import { fb } from '../../../core/lib/feedback.js';

const WEEKDAY_LABELS = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];

// Gibt die 7 Tage der aktuellen Woche zurück (Mo–So)
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

// Streak-Schutz: war gestern ein Fehltag, aber vorgestern erledigt?
function isStreakProtected(habit, entries) {
  const todayStr = today();
  const yesterday = new Date(todayStr);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = toDateStr(yesterday);
  const dayBefore = new Date(todayStr);
  dayBefore.setDate(dayBefore.getDate() - 2);
  const dayBeforeStr = toDateStr(dayBefore);

  if (!isDueOn(habit, yesterdayStr)) return false;
  const missedYesterday = !isDone(entries, habit.id, yesterdayStr, habit.target_count);
  if (!missedYesterday) return false;
  const doneBeforeYesterday = isDone(entries, habit.id, dayBeforeStr, habit.target_count);
  const doneToday = isDone(entries, habit.id, todayStr, habit.target_count);
  return doneBeforeYesterday || doneToday; // Streak noch aktiv via never-miss-twice
}

export default function TodayView({ habits, entries, onEntriesChange, onNavigateToHabits }) {
  const [loading, setLoading]   = useState(null);
  const [error, setError]       = useState(null);
  const [showWeek, setShowWeek] = useState(false);

  const todayStr  = today();
  const weekDays  = useMemo(() => getCurrentWeekDays(), []);

  const dueHabits = useMemo(() => {
    const due = habits.filter((h) => h.active && !h.deleted_at && isDueOn(h, todayStr));
    // Erledigte nach unten sortieren — neu berechnen wenn entries sich ändern
    return due.sort((a, b) => {
      const aDone = isDone(entries, a.id, todayStr, a.target_count) ? 1 : 0;
      const bDone = isDone(entries, b.id, todayStr, b.target_count) ? 1 : 0;
      return aDone - bDone;
    });
  }, [habits, entries, todayStr]);

  const totalDue  = dueHabits.length;
  const totalDone = dueHabits.filter((h) => isDone(entries, h.id, todayStr, h.target_count)).length;
  const allDone   = totalDue > 0 && totalDone === totalDue;
  const rate      = totalDue > 0 ? Math.round((totalDone / totalDue) * 100) : 0;

  async function handleToggle(habit) {
    if (loading) return;
    setError(null);
    setLoading(habit.id);
    try {
      const entry  = getEntry(entries, habit.id, todayStr);
      const wasDone = entry && !entry.deleted_at && entry.count >= habit.target_count;

      // Läuft über den gemeinsamen Store — Hub sieht die Änderung sofort
      if (!wasDone && habit.target_count > 1) {
        await setHabitCount(habit, habit.target_count, todayStr);
      } else {
        await toggleHabitOn(habit, todayStr);
      }

      // Feedback nur beim Abhaken, nicht beim Rückgängigmachen
      if (!wasDone) {
        const nowDone = totalDone + 1;
        if (nowDone === totalDue) fb.habitAllDone();
        else                      fb.habitCheck();
      }
    } catch (e) {
      setError('Konnte nicht gespeichert werden.');
      fb.error();
    } finally {
      setLoading(null);
    }
  }

  const dateLabel = new Date().toLocaleDateString('de-DE', {
    weekday: 'long', day: 'numeric', month: 'long',
  });

  return (
    <div className="hab-today">

      {/* Header */}
      <div className="hab-today-header">
        <div className="hab-today-date">{dateLabel}</div>
        {totalDue > 0 && (
          <div className="hab-today-progress-wrap">
            <div className="hab-today-score">
              <span className="hab-today-score-num">{totalDone}</span>
              <span className="hab-today-score-sep">/</span>
              <span className="hab-today-score-total">{totalDue}</span>
            </div>
            <div className="hab-progress-bar">
              <div className="hab-progress-fill" style={{ width: `${rate}%` }} />
            </div>
          </div>
        )}
      </div>

      {error && <div className="toast toast-error" style={{ margin: '0 0 12px' }}>{error}</div>}

      {/* Wochenübersicht Toggle */}
      {totalDue > 0 && (
        <button
          className="hab-week-toggle"
          onClick={() => setShowWeek((v) => !v)}
        >
          {showWeek ? 'Woche ausblenden ↑' : 'Wochenübersicht ↓'}
        </button>
      )}

      {/* Wochenübersicht */}
      {showWeek && habits.filter((h) => h.active && !h.deleted_at).length > 0 && (
        <div className="hab-week-overview">
          {/* Wochentag-Header */}
          <div className="hab-week-grid-header">
            <div className="hab-week-grid-name-col" />
            {weekDays.map((d, i) => (
              <div
                key={d}
                className={`hab-week-grid-day-label ${d === todayStr ? 'today' : ''}`}
              >
                {WEEKDAY_LABELS[i]}
              </div>
            ))}
          </div>
          {/* Habit-Zeilen */}
          {habits.filter((h) => h.active && !h.deleted_at).map((habit) => (
            <div key={habit.id} className="hab-week-grid-row">
              <div className="hab-week-grid-name">
                <span>{habit.icon}</span>
                <span className="hab-week-grid-name-text">{habit.name}</span>
              </div>
              {weekDays.map((d) => {
                const due    = isDueOn(habit, d);
                const done   = isDone(entries, habit.id, d, habit.target_count);
                const future = d > todayStr;
                return (
                  <div
                    key={d}
                    className={`hab-week-grid-cell
                      ${!due ? 'hab-week-cell--skip' : ''}
                      ${due && done ? 'hab-week-cell--done' : ''}
                      ${due && !done && !future ? 'hab-week-cell--missed' : ''}
                      ${future ? 'hab-week-cell--future' : ''}
                      ${d === todayStr ? 'hab-week-cell--today' : ''}
                    `}
                  >
                    {due && done && '✓'}
                    {due && !done && !future && '·'}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      )}

      {/* Leer-Zustand */}
      {totalDue === 0 && (
        <div className="hab-empty">
          <div className="hab-empty-icon">🌱</div>
          <div className="hab-empty-title">Keine Gewohnheiten für heute</div>
          <div className="hab-empty-text">Füge deine erste Gewohnheit hinzu und starte deinen Streak.</div>
          <button className="btn btn-primary" onClick={onNavigateToHabits}>
            Gewohnheit hinzufügen
          </button>
        </div>
      )}

      {/* Alles erledigt */}
      {allDone && (
        <div className="hab-all-done">
          <span className="hab-all-done-icon">🏆</span>
          <span>Alle Gewohnheiten erledigt!</span>
        </div>
      )}

      {/* Habit-Liste */}
      {totalDue > 0 && (
        <div className="hab-list">
          {dueHabits.map((habit) => {
            const entry     = getEntry(entries, habit.id, todayStr);
            const done      = entry && !entry.deleted_at && entry.count >= habit.target_count;
            const streak    = calcStreak(habit, entries);
            const protected_ = isStreakProtected(habit, entries);
            const busy      = loading === habit.id;

            return (
              <div
                key={habit.id}
                className={`hab-item ${done ? 'hab-item--done' : ''} ${busy ? 'hab-item--busy' : ''}`}
              >
                <div className="hab-item-left">
                  <div className="hab-item-icon">{habit.icon}</div>
                  <div className="hab-item-info">
                    <div className="hab-item-name">{habit.name}</div>
                    <div className="hab-item-meta">
                      {streak > 0 && (
                        <span className="hab-streak-badge">
                          🔥 {streak}
                          {protected_ && (
                            <span className="hab-streak-shield" title="Streak-Schutz aktiv — gestern verpasst, aber noch im Rennen">🛡</span>
                          )}
                        </span>
                      )}
                      {streak === 0 && protected_ && (
                        <span className="hab-streak-shield-only" title="Streak-Schutz aktiv">🛡 Schutz aktiv</span>
                      )}
                      {habit.target_count > 1 && (
                        <span className="hab-count-label">{habit.target_count} {habit.unit}</span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="hab-item-right">
                  <button
                    className={`hab-check-btn ${done ? 'hab-check-btn--done' : ''}`}
                    onClick={() => handleToggle(habit)}
                    disabled={busy}
                    aria-label={done ? 'Rückgängig' : 'Erledigt markieren'}
                  >
                    {busy ? (
                      <span className="hab-check-spinner" />
                    ) : done ? (
                      <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                        <path d="M5 13l4 4L19 7" stroke="var(--on-accent)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    ) : (
                      <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                        <circle cx="12" cy="12" r="10" stroke="var(--border-strong)" strokeWidth="2"/>
                      </svg>
                    )}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
