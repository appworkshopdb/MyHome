// Zentrale Modul-Liste für die "Zuhause"-App-Hülle.
//
// TEMPORÄR (Testphase): alle Module auf built: true, damit die ganze
// App-Hülle inkl. Ziele-Muster durchklickbar ist. Module ohne echten
// Bildschirm laufen über StubModule.jsx (reiner Platzhalter). Vor dem
// echten Launch hier wieder built: false setzen für alles, was noch
// keinen fertigen Bildschirm hat — das ist der einzige Schalter, den
// es dafür braucht (siehe App.jsx: MODULE_COMPONENTS wird ignoriert,
// wenn built: false).
//
// HINWEIS: Das "Alltag"-Modul wurde gestrichen. Sein ehemaliger
// Bottom-Nav-Slot ist jetzt der Start-Button (→ Hub).

export const MODULES = [
  { id: 'shopping', name: 'Einkauf', tier: 'frei', color: '#4E8A56', built: true },
  { id: 'nutrition', name: 'Ernährung', tier: 'paid', price: '4,99 €', color: '#A8792A', built: true },
  { id: 'finance', name: 'Finanzen', tier: 'paid', price: '4,99 €', color: '#7A57A8', built: true },
  { id: 'sport', name: 'Sport', tier: 'paid', price: '4,99 €', color: '#A84A3F', built: true },
  { id: 'habits', name: 'Gewohnheiten', tier: 'paid', price: '3,99 €', color: '#2F8385', built: true },
];

export function getModule(id) {
  return MODULES.find((m) => m.id === id);
}
