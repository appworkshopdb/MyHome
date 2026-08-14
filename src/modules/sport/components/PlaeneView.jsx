import PlanSuggestions from './PlanSuggestions';

// "Starten" wechselt hier ins Training-Tab mit vorbefülltem Formular —
// onStartFromPlan kommt von SportModule, das sowohl den Tab-Wechsel als
// auch den Formular-Zustand kennt.
export default function PlaeneView({ session, onStartFromPlan }) {
  return (
    <div className="page">
      <PlanSuggestions session={session} onStartFromPlan={onStartFromPlan} />
    </div>
  );
}
