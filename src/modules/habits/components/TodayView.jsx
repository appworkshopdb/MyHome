// modules/habits/components/TodayView.jsx
// Heute-Ansicht: alle fälligen Habits abhaken, Streak anzeigen

import { useState, useMemo } from 'react';
import { today, isDueOn, isDone, getEntry, calcStreak, todayCompletionRate } from '../lib/habUtils.js';
import { toggleEntry, setEntryCount } from '../lib/habData.js';

export default function TodayView({ habits, entries, onEntriesChange, onNavigateToHabits }) {
  const [loading, setLoading] = useState(null); // habitId das gerade geladen wird
  const [error, setError]     = useState(null);

  const todayStr = today();
  const dueHabits = useMemo(
    () => habits.filter((h) => h.active && isDueOn(h, todayStr)),
    [habits, todayStr]
  );
  const doneHabits   = dueHabits.filter((h) => isDone(entries, h.id, todayStr, h.target_count));
  const totalDue     = dueHabits.length;
  const totalDone    = doneHabits.length;
  const allDone      = totalDue > 0 && totalDone === totalDue;
  const rate         = totalDue > 0 ? Math.round((totalDone / totalDue) * 100) : 0;

  async function handleToggle(habit) {
    if (loading) return;
    setError(null);
    setLoading(habit.id);
    try {
      await toggleEntry(habit.id, todayStr);
      await onEntriesChange();
    } catch (e) {
      setError('Konnte nicht gespeichert werden.');
    } finally {
      setLoading(null);
    }
  }

  async function handleCount(habit, delta) {
    if (loading) return;
    setError(null);
    setLoading(habit.id);
    try {
      const entry = getEntry(entries, habit.id, todayStr);
      const current = entry ? entry.count : 0;
      const next = Math.max(0, Math.min(habit.target_count * 2, current + delta));
      await setEntryCount(habit.id, todayStr, next);
      await onEntriesChange();
    } catch (e) {
      setError('Konnte nicht gespeichert werden.');
    } finally {
      setLoading(null);
    }
  }

  // Datum formatiert
  const dateLabel = new Date().toLocaleDateString('de-DE', {
    weekday: 'long', day: 'numeric', month: 'long',
  });

  return (
    <div className="hab-today">

      {/* Tages-Header */}
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
              <div
                className="hab-progress-fill"
                style={{ width: `${rate}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {error && <div className="toast toast-error" style={{ margin: '0 0 12px' }}>{error}</div>}

      {/* Leer-Zustand */}
      {totalDue === 0 && (
        <div className="hab-empty">
          <div className="hab-empty-icon">🌱</div>
          <div className="hab-empty-title">Keine Gewohnheiten für heute</div>
          <div className="hab-empty-text">
            Füge deine erste Gewohnheit hinzu und starte deinen Streak.
          </div>
          <button className="btn btn-primary" onClick={onNavigateToHabits}>
            Gewohnheit hinzufügen
          </button>
        </div>
      )}

      {/* Alles erledigt Banner */}
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
            const entry   = getEntry(entries, habit.id, todayStr);
            const done    = entry && !entry.deleted_at && entry.count >= habit.target_count;
            const count   = entry && !entry.deleted_at ? entry.count : 0;
            const isCount = habit.target_count > 1;
            const streak  = calcStreak(habit, entries);
            const busy    = loading === habit.id;

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
                        </span>
                      )}
                      {isCount && (
                        <span className="hab-count-label">
                          {count} / {habit.target_count} {habit.unit}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="hab-item-right">
                  {isCount ? (
                    <div className="hab-count-controls">
                      <button
                        className="hab-count-btn"
                        onClick={() => handleCount(habit, -1)}
                        disabled={busy || count === 0}
                        aria-label="Weniger"
                      >−</button>
                      <div
                        className={`hab-count-ring ${done ? 'done' : ''}`}
                        title={`${count} von ${habit.target_count}`}
                      >
                        <svg viewBox="0 0 36 36" width="44" height="44">
                          <circle
                            cx="18" cy="18" r="15"
                            fill="none"
                            stroke="var(--border)"
                            strokeWidth="2.5"
                          />
                          <circle
                            cx="18" cy="18" r="15"
                            fill="none"
                            stroke={done ? 'var(--accent)' : 'var(--accent)'}
                            strokeWidth="2.5"
                            strokeDasharray={`${Math.min(count / habit.target_count, 1) * 94.2} 94.2`}
                            strokeLinecap="round"
                            transform="rotate(-90 18 18)"
                            opacity={count === 0 ? 0.3 : 1}
                          />
                        </svg>
                        <span className="hab-count-ring-num">{count}</span>
                      </div>
                      <button
                        className="hab-count-btn"
                        onClick={() => handleCount(habit, 1)}
                        disabled={busy}
                        aria-label="Mehr"
                      >+</button>
                    </div>
                  ) : (
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
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
