// src/core/modules.js
// Die Module unterscheiden sich über Symbol, Name UND eine Farbfamilie.
// Die Farben stehen nicht hier, sondern als Tokens in base.css/themes.css
// (--mod-<familie>-*, Kontext über data-module auf <html>, siehe CLAUDE.md
// "Farbsystem"). Zuordnung: finance=Blau, nutrition=Grün, sport=Koralle,
// habits=Gold, shopping=Violett; Hub-Funktionen bleiben neutral.

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
