// core/lib/hubCache.js
//
// Der Hub zeigt beim Öffnen sofort den zuletzt gespeicherten Stand (Cache) und
// lädt dann nach. Ändert sich im Finanzen-Modul etwas (Posten bezahlt, neu,
// gelöscht), wird der Cache hier verworfen — sonst würde der Hub kurz noch die
// alte Anzahl/Summe der offenen Posten zeigen.

// v7: Sparschwein-Einzahlungen ("Ersparnisse") zählen nicht mehr als offene Posten.
export const HUB_CACHE_KEY = 'hub-cache-v7';

export function invalidateHubCache() {
  try { localStorage.removeItem(HUB_CACHE_KEY); } catch { /* egal */ }
}
