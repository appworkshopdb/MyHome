// core/lib/shoppingHandoff.js
// Übergaben zwischen Ernährung und Einkauf, nur im Speicher (nie persistent).
// Liegt in core/, weil Module sich nicht gegenseitig importieren dürfen.
//
//  markFreshItems / takeFreshItems   "Rezept → Einkaufsliste" markiert, was gerade
//      dazukam (artikel-id → 'new' | 'merged'); die Artikelansicht zeigt das beim
//      nächsten Öffnen einmalig an.
//  notifyShoppingChanged / SHOPPING_CHANGED   Der Anlege-Wizard (core) meldet, dass Listen dazukamen;
//      das Einkaufsmodul lädt seine Listen daraufhin neu (der Wizard liegt außerhalb des Moduls).
//  requestOpenList / takeOpenListRequest   "Liste öffnen" im Hinweis nach dem
//      Hinzufügen: das Einkaufsmodul öffnet beim Start gezielt diese Liste.

let freshMarks = null;
let openListRequest = null;

export function markFreshItems(map) { freshMarks = map; }
// Gibt die Markierungen für die übergebenen Artikel-Ids zurück und löscht nur diese —
// öffnet man zuerst eine andere Liste, bleiben die Markierungen für die richtige erhalten.
export function takeFreshItems(ids) {
  const out = {};
  if (!freshMarks) return out;
  for (const id of ids) {
    if (freshMarks[id]) { out[id] = freshMarks[id]; delete freshMarks[id]; }
  }
  return out;
}
export function requestOpenList(listId) { openListRequest = listId; }
export function takeOpenListRequest() { const id = openListRequest; openListRequest = null; return id; }

export const SHOPPING_CHANGED = 'nestua:shopping-changed';
export function notifyShoppingChanged() { window.dispatchEvent(new Event(SHOPPING_CHANGED)); }
