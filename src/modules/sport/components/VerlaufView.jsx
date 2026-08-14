import { useState } from 'react';
import WorkoutCalendar from './WorkoutCalendar';
import DayDetail from './DayDetail';

const TODAY = () => new Date().toISOString().slice(0, 10);

// Der frühere Verlauf (einfache Liste) ist jetzt der Kalender —
// Planen, Abhaken und Bearbeiten passieren alle hier.
export default function VerlaufView({ workouts, loading, onToggleDone, onEdit, onDelete, onPlanNew }) {
  const [month, setMonth] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const [selectedDate, setSelectedDate] = useState(TODAY);

  if (loading) {
    return <div className="page"><div className="card">Lädt…</div></div>;
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
      <DayDetail
        date={selectedDate}
        workouts={workouts}
        onToggleDone={onToggleDone}
        onEdit={onEdit}
        onDelete={onDelete}
        onPlanNew={onPlanNew}
      />
    </div>
  );
}
