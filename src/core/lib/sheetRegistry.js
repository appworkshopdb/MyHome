// src/core/lib/sheetRegistry.js
// Sheet-Registry: Module melden ihre Erfassen-Sheets hier an, core/ holt sie
// über den Schlüssel ab. So kann der globale FAB (core/components/GlobalFab.jsx)
// und die Tour (core/components/ModuleTutorial.jsx) ein Modul-Sheet öffnen,
// ohne aus modules/ zu importieren (Architektur-Regel: core importiert nie aus
// modules/). Auch zwei Module, die sich nicht gegenseitig importieren dürfen
// (Ernährung → Einkauf), finden ihre Sheets so.
//
// Angemeldet wird in modules/<modul>/sheets.js. App.jsx importiert diese
// Dateien beim Start (vor dem ersten Rendern), deshalb sind alle Sheets da,
// auch wenn das Modul selbst erst später nachgeladen wird.
//
// Schlüssel: '<modul>.<sheet>'
//   habits.quick        neue Gewohnheit (FAB)
//   habits.templates    erste Gewohnheiten aus Vorlagen (Tour)
//   sport.quick         Sport erfassen (FAB, Tour)
//   shopping.quick      Einkaufsliste anlegen (FAB, Tour)
//   shopping.fromRecipe Rezept-Zutaten auf die Liste (Ernährung)

const sheets = new Map();

export function registerSheet(key, Component) {
  sheets.set(key, Component);
}

// Liefert die angemeldete Komponente oder null.
export function getSheet(key) {
  return sheets.get(key) || null;
}
