import WorkoutList from './WorkoutList';

export default function VerlaufView({ workouts, loading, onDelete }) {
  return (
    <div className="page">
      {loading ? (
        <div className="card">Lädt…</div>
      ) : (
        <WorkoutList workouts={workouts} onDelete={onDelete} />
      )}
    </div>
  );
}
