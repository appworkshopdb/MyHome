// modules/habits/components/OverviewSection.jsx
// "Offen heute": alle Habits (offen + erledigt) in einer flachen Liste,
// jeder Habit zeigt ein kleines Slot-Badge (🌅 Morgens etc.).
// Erledigte Habits bleiben immer sichtbar — motivierender Fortschrittsblick.

import { getDueToday, toggleHabitOn, setHabitCount } from '../../../core/lib/habitsStore.js';
import { isDone, getEntry, today, isDueOn, overallRate } from '../lib/habUtils.js';
import { useGamificationStore } from '../../../core/lib/gamificationStore.js';
import { fb } from '../../../core/lib/feedback.js';
import { useState, useEffect } from 'react';
import { loadDeletedHabits } from '../lib/habData.js';
import FocusCard from '../../../core/components/FocusCard.jsx';
import Ring from '../../../core/components/Ring.jsx';
import AreaList from '../../../core/components/AreaList.jsx';
import AreaRow from '../../../core/components/AreaRow.jsx';

function isoDaysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().split('T')[0];
}

// Slot-Badge — immer angezeigt, anytime ohne Emoji
const SLOT_BADGE = {
  morning: { emoji: '🌅', label: 'Morgens'  },
  midday:  { emoji: '☀️', label: 'Tagsüber' },
  evening: { emoji: '🌙', label: 'Abends'   },
  anytime: { emoji: '',   label: 'Jederzeit' },
};

export default function OverviewSection({ habits, entries, onNavigate }) {
  const { current_streak } = useGamificationStore();
  const todayStr = today();

  const activeHabits = habits.filter((h) => h.active && !h.deleted_at);
  // Alle Gewohnheiten der Liste (aktiv + pausiert); gelöschte stehen im Archiv
  const ownCount = habits.filter((h) => !h.deleted_at).length;

  // Anzahl im Archiv (null = lädt noch)
  const [archivedCount, setArchivedCount] = useState(null);
  useEffect(() => {
    let alive = true;
    loadDeletedHabits()
      .then((d) => { if (alive) setArchivedCount(d.length); })
      .catch(() => { if (alive) setArchivedCount(null); });
    return () => { alive = false; };
  }, [habits]);
  const dueToday      = getDueToday(activeHabits, entries);
  const doneToday     = dueToday.filter((h) => isDone(entries, h.id, todayStr, h.target_count));
  const openToday     = dueToday.filter((h) => !isDone(entries, h.id, todayStr, h.target_count));
  const totalDue  = dueToday.length;
  const totalDone = doneToday.length;

  const monthFrom = isoDaysAgo(29);
  const monthRate = overallRate(activeHabits, entries, monthFrom, todayStr);

  const last7 = Array.from({ length: 7 }, (_, i) => isoDaysAgo(6 - i));
  const perfectDays = last7.filter((d) => {
    const due = activeHabits.filter((h) => isDueOn(h, d));
    return due.length > 0 && due.every((h) => isDone(entries, h.id, d, h.target_count));
  }).length;

  const [busyId, setBusyId] = useState(null);

  async function handleToggle(habit) {
    if (busyId) return;
    setBusyId(habit.id);
    try {
      const entry   = getEntry(entries, habit.id, todayStr);
      const wasDone = entry && !entry.deleted_at && entry.count >= habit.target_count;
      if (!wasDone && habit.target_count > 1) await setHabitCount(habit, habit.target_count, todayStr);
      else await toggleHabitOn(habit, todayStr);
      if (!wasDone) {
        const nowDone = totalDone + 1;
        if (nowDone === totalDue) fb.habitAllDone();
        else fb.habitCheck();
      }
    } catch {
      fb.error();
    } finally {
      setBusyId(null);
    }
  }

  return (
    <>
      {/* Fokuskarte */}
      <FocusCard>
        <div className="hab-ring-row">
          <Ring size={76} stroke={9} value={totalDue > 0 ? totalDone / totalDue : 0} className="hab-ring">
            <b>{totalDone}/{totalDue}</b>
          </Ring>
          <div className="hab-ring-text">
            <div className="hab-ring-headline">
              {totalDue === 0 ? 'Nichts fällig heute'
                : totalDue - totalDone === 0 ? 'Alles erledigt 🎉'
                : `${totalDue - totalDone} noch offen`}
            </div>
            <div className="hab-ring-meta">
              Serie: {current_streak} {current_streak === 1 ? 'Tag' : 'Tage'} · {Math.round(monthRate * 100)} % im Monat
            </div>
          </div>
        </div>
      </FocusCard>

      {/* Heute — offen + erledigt, flach, immer sichtbar */}
      <section className="page-section">
        <AreaList>
          {totalDue === 0 && (
            <div className="hab-overview-empty">Keine Gewohnheiten für heute.</div>
          )}

          {/* Offene Habits */}
          {openToday.map((h) => {
            const badge = SLOT_BADGE[h.time_slot || 'anytime'];
            return (
              <button
                key={h.id}
                className="hab-open-row"
                onClick={() => handleToggle(h)}
                disabled={busyId === h.id}
              >
                <span className="hab-open-check" aria-hidden="true" />
                <span className="hab-open-name">{h.name}</span>
                <span className="hab-open-right">
                  <span className="hab-slot-badge">{badge.emoji} {badge.label}</span>
                </span>
              </button>
            );
          })}

          {/* Erledigte Habits — immer sichtbar, motivierender Fortschrittsblick */}
          {doneToday.map((h) => {
            const badge = SLOT_BADGE[h.time_slot || 'anytime'];
            return (
              <button
                key={h.id}
                className="hab-open-row hab-open-row--done"
                onClick={() => handleToggle(h)}
                disabled={busyId === h.id}
              >
                <span className="hab-open-check hab-open-check--done" aria-hidden="true">✓</span>
                <span className="hab-open-name">{h.name}</span>
                <span className="hab-open-right">
                  <span className="hab-slot-badge hab-slot-badge--done">{badge.emoji} {badge.label}</span>
                </span>
              </button>
            );
          })}
        </AreaList>
      </section>

      {/* Bereiche, ohne Überschrift */}
      <section className="page-section">
        <AreaList variant="tiles">
          <AreaRow
            label="Eigene"
            icon="habits"
            featured
            value={`${activeHabits.length}/${ownCount} aktiv`}
            onPress={() => onNavigate('gewohnheiten')}
          />
          <AreaRow
            label="Statistik"
            icon="chart"
            value={`${Math.round(monthRate * 100)} % · ${perfectDays}/7 Tage`}
            onPress={() => onNavigate('statistik')}
          />
          <AreaRow
            label="Archiv"
            icon="archive"
            value={archivedCount === null ? '–' : `${archivedCount} ${archivedCount === 1 ? 'Eintrag' : 'Einträge'}`}
            onPress={() => onNavigate('archiv')}
          />
        </AreaList>
      </section>
    </>
  );
}
