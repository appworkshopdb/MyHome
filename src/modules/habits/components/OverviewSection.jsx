// modules/habits/components/OverviewSection.jsx
// Modul-Übersicht für Gewohnheiten — passt ohne Scrollen auf einen Screen
// (siehe UMBAU-PLAN.md Schritt 5). Berechnet alle Kennzahlen aus dem
// bereits geladenen Modul-State (habits/entries aus habitsStore), kein
// zusätzlicher Netzwerk-Zugriff.
//
// KEIN eigener "Heute"-Bereich mehr: TodayView wird hier nicht mehr als
// Detail-Screen gerendert — der "Alle X ›"-Ausstieg der "Offen heute"-
// Karte führt laut Mockup auf "Meine Gewohnheiten" (die Gesamtzahl aktiver
// Habits), nicht auf eine eigene Heute-Seite. Die Wochenübersicht aus
// TodayView (Toggle "Wochenübersicht ↓") hat dadurch aktuell keinen
// Platz mehr — bewusst ausgelassen, siehe Rückmeldung an den Nutzer.

import { useState } from 'react';
import { getDueToday, toggleHabitOn, setHabitCount } from '../../../core/lib/habitsStore.js';
import { isDone, getEntry, today, isDueOn, overallRate } from '../lib/habUtils.js';
import { useGamificationStore } from '../../../core/lib/gamificationStore.js';
import { fb } from '../../../core/lib/feedback.js';
import FocusCard from '../../../core/components/FocusCard.jsx';
import PageSection from '../../../core/components/PageSection.jsx';
import AreaList from '../../../core/components/AreaList.jsx';
import AreaRow from '../../../core/components/AreaRow.jsx';

function isoDaysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().split('T')[0];
}

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

  // Monatsrate (letzte 30 Tage) — dieselbe Funktion wie in StatsView
  // (habUtils.overallRate), damit Fokuskarte und Auswertung nie auseinanderlaufen.
  const monthFrom = isoDaysAgo(29);
  const monthRate = overallRate(activeHabits, entries, monthFrom, todayStr);

  // "Verlauf": perfekte Tage der letzten 7 Tage (alle fälligen Habits erledigt)
  const last7 = Array.from({ length: 7 }, (_, i) => isoDaysAgo(6 - i));
  const perfectDays = last7.filter((d) => {
    const due = activeHabits.filter((h) => isDueOn(h, d));
    return due.length > 0 && due.every((h) => isDone(entries, h.id, d, h.target_count));
  }).length;

  const [showDone, setShowDone] = useState(false);
  const [busyId, setBusyId]     = useState(null);

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

      {/* Fokuskarte: Ring + Status */}
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
                : totalDue - totalDone === 0 ? 'Alles erledigt'
                : `${totalDue - totalDone} noch offen`}
            </div>
            <div className="hab-ring-meta">
              Serie: {current_streak} {current_streak === 1 ? 'Tag' : 'Tage'} · {Math.round(monthRate * 100)} % im Monat
            </div>
          </div>
        </div>
      </FocusCard>

      {/* Offen heute */}
      <PageSection
        title="Offen heute"
        action={{ label: `Alle ${activeHabits.length} ›`, onPress: () => onNavigate('gewohnheiten') }}
      >
        <AreaList>
          {openToday.length === 0 && doneToday.length === 0 && (
            <div className="hab-overview-empty">Keine Gewohnheiten für heute.</div>
          )}
          {openToday.map((h) => (
            <button
              key={h.id}
              className="hab-open-row"
              onClick={() => handleToggle(h)}
              disabled={busyId === h.id}
            >
              <span className="hab-open-check" aria-hidden="true" />
              <span className="hab-open-name">{h.name}</span>
              {h.target_count > 1 && (
                <span className="hab-open-value">{h.target_count} {h.unit}</span>
              )}
            </button>
          ))}
          {showDone && doneToday.map((h) => (
            <button
              key={h.id}
              className="hab-open-row hab-open-row--done"
              onClick={() => handleToggle(h)}
              disabled={busyId === h.id}
            >
              <span className="hab-open-check hab-open-check--done" aria-hidden="true">✓</span>
              <span className="hab-open-name">{h.name}</span>
            </button>
          ))}
          {doneToday.length > 0 && (
            <button className="hab-overview-footer" onClick={() => setShowDone((v) => !v)}>
              {showDone
                ? `${doneToday.length} erledigte ausblenden`
                : `${doneToday.length} erledigte einblenden`}
            </button>
          )}
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
