// Zentrale Modul-Liste für die "Zuhause"-App-Hülle. Nur "finance" ist
// tatsächlich gebaut — alle anderen sind bewusst als ehrliche
// "noch nicht verfügbar"-Vorschau markiert, keine vorgetäuschte
// Kauffunktion. Reihenfolge hier = Reihenfolge der Register-Reiter.

export const MODULES = [
  { id: 'everyday', name: 'Alltag', tier: 'frei', color: '#426A9E', built: false },
  { id: 'shopping', name: 'Einkauf', tier: 'frei', color: '#4F8A52', built: false },
  { id: 'nutrition', name: 'Ernährung', tier: 'paid', price: '4,99 €', color: '#BE8225', built: true },
  { id: 'finance', name: 'Finanzen', tier: 'paid', price: '4,99 €', color: '#75579B', built: true },
  { id: 'sport', name: 'Sport', tier: 'paid', price: '4,99 €', color: '#B94A3E', built: false },
  { id: 'habits', name: 'Gewohnheiten', tier: 'paid', price: '3,99 €', color: '#2F8385', built: false },
];

export function getModule(id) {
  return MODULES.find((m) => m.id === id);
}
