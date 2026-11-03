// modules/sport/components/OverviewSection.jsx
// Modul-Übersicht für Sport — passt ohne Scrollen auf einen Screen
// (siehe UMBAU-PLAN.md Schritt 7). Alle Kennzahlen kommen aus dem
// bereits in SportModule geladenen State (workouts/units/plans/
// bodyWeight) — kein zusätzlicher Netzwerk-Zugriff.
//
// Das frühere scrollIntoView für "Starten aus Plan" entfällt: der
// Bereich "Pläne" navigiert jetzt direkt auf den Kalender-Screen, auf
// dem das Formular ohnehin lebt (siehe SportModule.startFromPlan).

import { resolveTypeLabel } from '../lib/typeLabel';
import FocusCard from '../../../core/components/FocusCard.jsx';
import PageSection from '../../../core/components/PageSection.jsx';
import AreaList from '../../../core/components/AreaList.jsx';
import AreaRow from '../../../core/components/AreaRow.jsx';

const WEEKDAYS_DE = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];

function iso(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// Montag der laufenden Woche (Sonntag zählt zur Vorwoche — deutsche
// Wochenordnung, wie im Wochenraster des Mockups)
function mondayOfWeek(date) {
  const d = new Date(date);
  const shift = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - shift);
  d.setHours(0, 0, 0, 0);
  return d;
}

// Zustand eines Wochenfelds — Reihenfolge ist die Priorität:
// erledigt schlägt Ruhetag schlägt geplant.
function dayState(dayWorkouts, isToday) {
  if (dayWorkouts.some((w) => w.status === 'done' && !w.is_rest)) return 'done';
  if (dayWorkouts.some((w) => w.is_rest)) return 'rest';
  if (dayWorkouts.length > 0) return 'planned';
  return isToday ? 'today' : 'empty';
}

export default function OverviewSection({
  workouts, units, plans, activePlan, bodyWeight, loading,
  onToggleDone, onEdit, onPlanToday, onNavigate,
}) {
  const today    = new Date();
  const todayIso = iso(today);

  // ── Fokuskarte: heutiges Training ──────────────────────────────
  const todayWorkouts = workouts.filter((w) => w.occurred_on === todayIso);
  // Die eine Einheit, um die es heute geht: eine offene zuerst, sonst
  // die erste erledigte (dann steht die Karte auf "geschafft").
  const focusWorkout =
    todayWorkouts.find((w) => w.status !== 'done') ?? todayWorkouts[0] ?? null;
  const focusDone = focusWorkout?.status === 'done';

  const weekdayLabel = today.toLocaleDateString('de-DE', { weekday: 'long' });

  // Zeile aus dem Dauerplan: "Plan Tag 3 von 5" (nur für unberührte Plan-Einträge)
  const focusPlan = focusWorkout?.auto_planned && focusWorkout.plan_day_index != null
    ? plans.find((p) => p.id === focusWorkout.plan_id)
    : null;
  const focusPlanText = focusPlan ? ` · Plan Tag ${focusWorkout.plan_day_index + 1} von ${focusPlan.items.length}` : '';

  // ── Wochenraster ───────────────────────────────────────────────
  const monday = mondayOfWeek(today);
  const week = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(d.getDate() + i);
    const key = iso(d);
    const dayWorkouts = workouts.filter((w) => w.occurred_on === key);
    return { key, label: WEEKDAYS_DE[i], dateNum: d.getDate(), state: dayState(dayWorkouts, key === todayIso) };
  });

  // ── Bereichs-Kennzahlen ────────────────────────────────────────
  const monthPrefix = todayIso.slice(0, 7);
  const doneThisMonth = workouts.filter(
    (w) => w.status === 'done' && !w.is_rest && (w.occurred_on || '').startsWith(monthPrefix)
  ).length;

  return (
    <>
      <h1 className="overview-page-title">Sport</h1>

      {/* Fokuskarte: Heute */}
      <FocusCard>
        <FocusCard.Eyebrow right={focusWorkout ? (focusDone ? 'ERLEDIGT' : focusWorkout.is_rest ? 'RUHETAG' : 'GEPLANT') : null}>
          Heute · {weekdayLabel}
        </FocusCard.Eyebrow>

        {loading ? (
          <div className="spo-focus-title">Lädt …</div>
        ) : focusWorkout ? (
          <>
            <div className="spo-focus-title">
              {focusWorkout.is_rest ? 'Ruhetag' : focusWorkout.title}
            </div>
            <FocusCard.Meta>
              <span>
                {focusWorkout.is_rest
                  ? 'Erholung eingeplant'
                  : `${resolveTypeLabel(focusWorkout.type_key)}${focusPlanText}`}
              </span>
            </FocusCard.Meta>
            <FocusCard.ActionRow>
              <FocusCard.ActionPrimary onPress={() => onToggleDone(focusWorkout)}>
                {focusDone ? 'Zurücksetzen' : 'Erledigt'}
              </FocusCard.ActionPrimary>
              <FocusCard.ActionSecondary onPress={() => onEdit(focusWorkout)}>
                Ändern
              </FocusCard.ActionSecondary>
            </FocusCard.ActionRow>
          </>
        ) : (
          <>
            <div className="spo-focus-title">Nichts geplant</div>
            <FocusCard.Meta>
              <span>Für heute steht keine Einheit im Kalender.</span>
            </FocusCard.Meta>
            <FocusCard.ActionRow>
              <FocusCard.ActionPrimary onPress={onPlanToday}>
                Training eintragen
              </FocusCard.ActionPrimary>
            </FocusCard.ActionRow>
          </>
        )}
      </FocusCard>

      {/* Diese Woche */}
      <PageSection
        title="Diese Woche"
        action={{ label: 'Kalender ›', onPress: () => onNavigate('kalender') }}
      >
        <div className="spo-week-card">
          {week.map((d) => (
            <div key={d.key} className="spo-week-day">
              <span className="spo-week-label">{d.label}</span>
              <span className={`spo-week-cell spo-week-cell--${d.state}`}>
                {d.state === 'done' && '✓'}
                {d.state === 'rest' && 'Rest'}
                {d.state === 'planned' && d.dateNum}
              </span>
            </div>
          ))}
        </div>
      </PageSection>

      {/* Aktiver Plan (nur wenn einer läuft, sonst bleibt die Übersicht ruhig) */}
      {activePlan && (
        <button type="button" className="spo-planstrip" onClick={() => onNavigate('plaene')}>
          <span className="spo-planstrip-bd" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 12a7 7 0 0 1 12-5l3 3M20 12a7 7 0 0 1-12 5l-3-3M19 5v5h-5M5 19v-5h5" />
            </svg>
          </span>
          <span className="spo-planstrip-tx">
            <b>{activePlan.plan.title}</b>
            <span>{activePlan.start_date > todayIso ? `Startet am ${activePlan.start_date.split('-').reverse().slice(0, 2).join('.')}.` : 'Aktiver Plan · bis auf weiteres'}</span>
          </span>
          <span className="spo-planstrip-chev" aria-hidden="true">›</span>
        </button>
      )}

      {/* Bereiche */}
      <PageSection title="Bereiche">
        <AreaList variant="tiles">
          <AreaRow
            label="Einheiten"
            icon="sport"
            featured
            value={`${units.length}`}
            onPress={() => onNavigate('einheiten')}
          />
          <AreaRow
            label="Pläne"
            icon="plan"
            value={`${plans.length}`}
            onPress={() => onNavigate('plaene')}
          />
          <AreaRow
            label="Auswertung"
            icon="chart"
            value={`${doneThisMonth} im Monat`}
            onPress={() => onNavigate('auswertung')}
          />
          <AreaRow
            label="Gewicht"
            icon="scale"
            value={bodyWeight ? `${String(bodyWeight).replace('.', ',')} kg` : 'kein Wert'}
            onPress={() => onNavigate('gewicht')}
          />
        </AreaList>
      </PageSection>
    </>
  );
}
