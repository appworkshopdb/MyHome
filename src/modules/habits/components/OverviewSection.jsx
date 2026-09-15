// modules/habits/components/OverviewSection.jsx
// "Offen heute": alle Habits (offen + erledigt) in einer flachen Liste,
// jeder Habit zeigt ein kleines Slot-Badge (🌅 Morgens etc.).
// Erledigte Habits bleiben immer sichtbar — motivierender Fortschrittsblick.

import { getDueToday, toggleHabitOn, setHabitCount } from '../../../core/lib/habitsStore.js';
import { isDone, getEntry, today, isDueOn, overallRate } from '../lib/habUtils.js';
import { useGamificationStore } from '../../../core/lib/gamificationStore.js';
import { fb } from '../../../core/lib/feedback.js';
import { useState } from 'react';
import FocusCard from '../../../core/components/FocusCard.jsx';
import PageSection from '../../../core/components/PageSection.jsx';
import AreaList from '../../../core/components/AreaList.jsx';
import AreaRow from '../../../core/components/AreaRow.jsx';

function isoDaysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().split('T')[0];
}

// Slot-Badge-Text (kurz, passt in eine kleine Pille)
const SLOT_BADGE = {
  morning: { emoji: '🌅', label: 'Morgens'  },
  midday:  { emoji: '☀️', label: 'Tagsüber' },
  evening: { emoji: '🌙', label: 'Abends'   },
  anytime: null, // kein Badge für "Jederzeit" — wäre bei fast allen Habits redundant
};

export default function OverviewSection({ habits, entries, onNavigate }) {
  const { current_streak } = useGamificationStore();
  const todayStr = today();

  const activeHabits = habits.filter((h) => h.active && !h.deleted_at);
  const dueToday      = getDueToday(activeHabits, entries);
  const doneToday     = dueToday.filter((h) => isDone(entries, h.id, todayStr, h.target_count));
  const openToday     = dueToday.filter((h) => !isDone(entries, h.id, todayStr, h.target_count));
  const totalDue  = dueToday.length;
  const totalDone = doneToday.length;
  const ringDeg   = totalDue > 0 ? Math.round((totalDone / totalDue) * 360) : 0;

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
      <h1 className="overview-page-title">Gewohnheiten</h1>

      {/* Fokuskarte */}
      <FocusCard>
        <div className="hab-ring-row">
          <div
            className="hab-ring"
            style={{ background: `conic-gradient(#FFFFFF 0deg ${ringDeg}deg, var(--raw-navy-600) ${ringDeg}deg 360deg)` }}
          >
            <div className="hab-ring-inner">{totalDone}/{totalDue}</div>
          </div>
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
      <PageSection
        title="Heute"
        action={{ label: `Alle ${activeHabits.length} ›`, onPress: () => onNavigate('gewohnheiten') }}
      >
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
                  {h.target_count > 1 && (
                    <span className="hab-open-value">{h.target_count} {h.unit}</span>
                  )}
                  {badge && (
                    <span className="hab-slot-badge">{badge.emoji} {badge.label}</span>
                  )}
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
                  {badge && (
                    <span className="hab-slot-badge hab-slot-badge--done">{badge.emoji} {badge.label}</span>
                  )}
                </span>
              </button>
            );
          })}
        </AreaList>
      </PageSection>

      {/* Bereiche */}
      <PageSection title="Bereiche">
        <AreaList fabClearance>
          <AreaRow
            label="Meine Gewohnheiten"
            value={`${activeHabits.length} aktiv`}
            onPress={() => onNavigate('gewohnheiten')}
          />
          <AreaRow
            label="Verlauf"
            value={`${perfectDays} von 7 Tagen`}
            onPress={() => onNavigate('verlauf')}
          />
          <AreaRow
            label="Auswertung"
            value={`${Math.round(monthRate * 100)} %`}
            onPress={() => onNavigate('auswertung')}
          />
        </AreaList>
      </PageSection>
    </>
  );
}
