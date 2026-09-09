import SheetShell from './SheetShell';

// Ernährung hat zwei Anlege-Wege (Rezept, Lebensmittel), die beide in
// modules/nutrition/ mit eigenen, bereits bestehenden Formularen leben
// (RecipeEditorModal, FoodFormModal). core/ darf nicht direkt aus
// modules/ importieren — deshalb feuert die Auswahl hier ein window-
// Event, genau wie sport:data-changed, nur in die andere Richtung.
// NutritionModule.jsx hört zu und öffnet den passenden Dialog selbst.
const OPTIONS = [
  { event: 'nutrition:new-recipe', icon: '📖', label: 'Neues Rezept' },
  { event: 'nutrition:new-food',   icon: '🥗', label: 'Neues Lebensmittel' },
];

export default function NutritionFabMenu({ onClose }) {
  function choose(eventName) {
    window.dispatchEvent(new Event(eventName));
    onClose();
  }

  return (
    <SheetShell onClose={onClose}>
      <div className="sheet-header">
        <span className="sheet-title">Was möchtest du anlegen?</span>
        <button className="sheet-cancel" onClick={onClose}>Abbrechen</button>
      </div>

      <div className="qsheet-body">
        <div className="qsheet-mode-grid">
          {OPTIONS.map((o) => (
            <button
              key={o.event}
              className="qsheet-mode-btn"
              onClick={() => choose(o.event)}
            >
              {o.icon} {o.label}
            </button>
          ))}
        </div>
      </div>
    </SheetShell>
  );
}
