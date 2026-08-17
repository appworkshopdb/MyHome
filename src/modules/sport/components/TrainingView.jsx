import WorkoutForm from './WorkoutForm';

// Reiner Eintrage-Screen. formInitial/onOpenForm/onCancelForm/onSave
// kommen von SportModule, weil ein Plan-Vorschlag im Pläne-Tab hierher
// wechseln und das Formular vorbefüllt öffnen soll (siehe
// PlaeneView.jsx) — der Formular-Zustand darf deshalb nicht lokal in
// dieser View liegen.
export default function TrainingView({ formInitial, onOpenForm, onCancelForm, onSave, showToast, userSports }) {
  return (
    <div className="page">
      {formInitial !== false ? (
        <WorkoutForm onSave={onSave} onCancel={onCancelForm} showToast={showToast} initialValues={formInitial} userSports={userSports} />
      ) : (
        <button className="btn btn-primary" style={{ width: '100%' }} onClick={() => onOpenForm({})}>
          + Training eintragen
        </button>
      )}
    </div>
  );
}
