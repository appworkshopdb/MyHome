// Zentrale Modul-Liste für die "Zuhause"-App-Hülle.
//
// TEMPORÄR (Testphase): alle Module auf built: true, damit die ganze
// App-Hülle inkl. Ziele-Muster durchklickbar ist. Module ohne echten
// Bildschirm laufen über StubModule.jsx (reiner Platzhalter). Vor dem
// echten Launch hier wieder built: false setzen für alles, was noch
// keinen fertigen Bildschirm hat — das ist der einzige Schalter, den
// es dafür braucht (siehe App.jsx: MODULE_COMPONENTS wird ignoriert,
// wenn built: false).

export const MODULES = [
  { id: 'everyday', name: 'Alltag', tier: 'frei', color: '#426A9E', built: true },
  { id: 'shopping', name: 'Einkauf', tier: 'frei', color: '#4F8A52', built: true },
  { id: 'nutrition', name: 'Ernährung', tier: 'paid', price: '4,99 €', color: '#BE8225', built: true },
  { id: 'finance', name: 'Finanzen', tier: 'paid', price: '4,99 €', color: '#75579B', built: true },
  { id: 'sport', name: 'Sport', tier: 'paid', price: '4,99 €', color: '#B94A3E', built: true },
  { id: 'habits', name: 'Gewohnheiten', tier: 'paid', price: '3,99 €', color: '#2F8385', built: true },
];

export function getModule(id) {
  return MODULES.find((m) => m.id === id);
}
