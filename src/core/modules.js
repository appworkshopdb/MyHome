// src/core/modules.js
// Schritt 3: Modulfarben entfernt (UMBAU.md).
// Module unterscheiden sich künftig über Symbol und Name, nicht über Farbe.
// Die alten color-Felder (Salbei, Violett, Ziegelrot, Petrol) sind weg.

export const MODULES = [
  { id: 'shopping',  name: 'Einkauf',       tier: 'frei', built: true },
  { id: 'nutrition', name: 'Ernährung',      tier: 'paid', price: '4,99 €', built: true },
  { id: 'finance',   name: 'Finanzen',       tier: 'paid', price: '4,99 €', built: true },
  { id: 'sport',     name: 'Sport',          tier: 'paid', price: '4,99 €', built: true },
  { id: 'habits',    name: 'Gewohnheiten',   tier: 'paid', price: '3,99 €', built: true },
];

export function getModule(id) {
  return MODULES.find((m) => m.id === id);
}
