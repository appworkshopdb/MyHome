import { useState } from 'react';
import { startOfWeek } from '../lib/stats';
import CalendarHeader from './CalendarHeader';
import WorkoutCalendar from './WorkoutCalendar';
import WorkoutWeekView from './WorkoutWeekView';
import CalendarLegend from './CalendarLegend';
import DayDetail from './DayDetail';
import PlanPicker from './PlanPicker';
import ApplyPlanDialog from './ApplyPlanDialog';
import WorkoutForm from './WorkoutForm';

const TODAY = () => new Date().toISOString().slice(0, 10);

// Der frühere Verlauf (einfache Liste) ist jetzt der Kalender — Planen,
// Abhaken und Bearbeiten passieren alle hier. pickingDate/chosenPlan
// sind reine Navigationszustände (welcher Schritt der Plan-Auswahl
// gerade läuft) und bleiben deshalb lokal — nur onApplyPlan verlässt
// diese Komponente, weil das eigentliche Anlegen der Einheiten in
// SportModule passiert (dort liegen auch workouts/plans).
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
  workouts, plans, units, loading, onToggleDone, onEdit, onDelete, onPlanNew, onApplyPlan,
  formInitial, onOpenForm, onCancelForm, onSaveForm, userSports, showToast,
}) {
  const [viewMode, setViewMode] = useState('month');
  const [referenceDate, setReferenceDate] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const [selectedDate, setSelectedDate] = useState(TODAY);
  const [pickingDate, setPickingDate] = useState(false); // Tag, für den gerade ein Plan gesucht wird
  const [chosenPlan, setChosenPlan] = useState(null);    // gewählter Plan, wartet auf Startdatum-Bestätigung

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

  function cancelPicking() {
    setPickingDate(false);
    setChosenPlan(null);
  }

  async function handleApply(plan, startDate) {
    await onApplyPlan(plan, startDate);
    cancelPicking();
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

      {chosenPlan ? (
        <ApplyPlanDialog plan={chosenPlan} defaultDate={pickingDate} onApply={handleApply} onCancel={cancelPicking} />
      ) : pickingDate ? (
        <PlanPicker plans={plans} onChoose={setChosenPlan} onCancel={cancelPicking} />
      ) : (
        <DayDetail
          date={selectedDate}
          workouts={workouts}
          plans={plans}
          onToggleDone={onToggleDone}
          onEdit={onEdit}
          onDelete={onDelete}
          onPlanNew={onPlanNew}
          onPickPlan={setPickingDate}
        />
      )}
    </div>
  );
}
