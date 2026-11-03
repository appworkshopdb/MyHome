import { useState } from 'react';
import { startOfWeek } from '../lib/stats';
import CalendarHeader from './CalendarHeader';
import WorkoutCalendar from './WorkoutCalendar';
import WorkoutWeekView from './WorkoutWeekView';
import CalendarLegend from './CalendarLegend';
import DayDetail from './DayDetail';
import WorkoutForm from './WorkoutForm';
import { todayIso } from '../../../core/lib/wizardDates';

// Lokales Kalenderdatum (toISOString würde zwischen 0 und 2 Uhr den Vortag liefern)
const TODAY = todayIso;

// Der frühere Verlauf (einfache Liste) ist jetzt der Kalender — Planen,
// Abhaken und Bearbeiten passieren alle hier. Pläne werden nicht mehr
// von hier aus eingetragen: ein Plan wird im Bereich "Pläne" aktiviert
// und füllt den Kalender selbst auf (core/lib/sportPlanSync.js).
//
// formInitial/onOpenForm/onCancelForm/onSaveForm kommen von SportModule:
// seit der Einheiten-Bibliothek gibt es keinen eigenen "Training"-Tab
// mehr, der das Formular zeigt — Bearbeiten/Neu-Anlegen/Vorschlag-
// Starten öffnen es jetzt direkt hier, ohne Tab-Wechsel.
//
// referenceDate ersetzt das frühere "month": in der Monatsansicht zeigt
// es (immer auf Tag 1 normiert) den sichtbaren Monat, in der
// Wochenansicht irgendein Tag der sichtbaren Woche — CalendarHeader
// rechnet je nach viewMode unterschiedlich damit weiter.
export default function VerlaufView({
  workouts, plans, units, loading, activePlan, onToggleDone, onEdit, onDelete, onPlanNew, onAddRest,
  formInitial, onOpenForm, onCancelForm, onSaveForm, userSports, showToast,
}) {
  const [viewMode, setViewMode] = useState('month');
  const [referenceDate, setReferenceDate] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const [selectedDate, setSelectedDate] = useState(TODAY);

  if (loading) {
    return <div className="page"><div className="card">Lädt…</div></div>;
  }

  if (formInitial !== false) {
    return (
      <div className="page">
        <WorkoutForm onSave={onSaveForm} onCancel={onCancelForm} showToast={showToast} initialValues={formInitial} userSports={userSports} units={units} />
      </div>
    );
  }

  function handleViewModeChange(mode) {
    setViewMode(mode);
    // Beim Wechsel auf Monat den Referenztag auf den 1. normieren —
    // sonst würde z.B. der 31. eines Monats beim Weiterklicken in
    // Monaten mit weniger Tagen überspringen.
    if (mode === 'month') {
      setReferenceDate(new Date(referenceDate.getFullYear(), referenceDate.getMonth(), 1));
    }
  }

  return (
    <div className="page">
      <CalendarHeader
        viewMode={viewMode}
        onViewModeChange={handleViewModeChange}
        referenceDate={referenceDate}
        onReferenceChange={setReferenceDate}
      />

      <div className="card">
        {viewMode === 'month' ? (
          <WorkoutCalendar
            workouts={workouts}
            year={referenceDate.getFullYear()}
            monthIndex={referenceDate.getMonth()}
            selectedDate={selectedDate}
            onSelectDate={setSelectedDate}
          />
        ) : (
          <WorkoutWeekView
            workouts={workouts}
            weekStart={startOfWeek(referenceDate)}
            selectedDate={selectedDate}
            onSelectDate={setSelectedDate}
          />
        )}
        <CalendarLegend />
      </div>

      <DayDetail
        date={selectedDate}
        workouts={workouts}
        plans={plans}
        activePlan={activePlan}
        onToggleDone={onToggleDone}
        onEdit={onEdit}
        onDelete={onDelete}
        onPlanNew={onPlanNew}
        onAddRest={onAddRest}
      />
    </div>
  );
}
