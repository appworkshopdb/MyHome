import { useState } from 'react';
import WorkoutCalendar from './WorkoutCalendar';
import DayDetail from './DayDetail';
import PlanPicker from './PlanPicker';
import ApplyPlanDialog from './ApplyPlanDialog';

const TODAY = () => new Date().toISOString().slice(0, 10);

// Der frühere Verlauf (einfache Liste) ist jetzt der Kalender — Planen,
// Abhaken und Bearbeiten passieren alle hier. pickingDate/chosenPlan
// sind reine Navigationszustände (welcher Schritt der Plan-Auswahl
// gerade läuft) und bleiben deshalb lokal — nur onApplyPlan verlässt
// diese Komponente, weil das eigentliche Anlegen der Einheiten in
// SportModule passiert (dort liegen auch workouts/plans).
export default function VerlaufView({ workouts, plans, loading, onToggleDone, onEdit, onDelete, onPlanNew, onApplyPlan }) {
  const [month, setMonth] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const [selectedDate, setSelectedDate] = useState(TODAY);
  const [pickingDate, setPickingDate] = useState(false); // Tag, für den gerade ein Plan gesucht wird
  const [chosenPlan, setChosenPlan] = useState(null);    // gewählter Plan, wartet auf Startdatum-Bestätigung

  if (loading) {
    return <div className="page"><div className="card">Lädt…</div></div>;
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
      <WorkoutCalendar
        workouts={workouts}
        month={month}
        onMonthChange={setMonth}
        selectedDate={selectedDate}
        onSelectDate={setSelectedDate}
      />

      {chosenPlan ? (
        <ApplyPlanDialog plan={chosenPlan} defaultDate={pickingDate} onApply={handleApply} onCancel={cancelPicking} />
      ) : pickingDate ? (
        <PlanPicker plans={plans} onChoose={setChosenPlan} onCancel={cancelPicking} />
      ) : (
        <DayDetail
          date={selectedDate}
          workouts={workouts}
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
