// core/lib/snapshotCache.js
//
// Letzter geladener Stand eines Moduls, nur im Arbeitsspeicher. Wechselt man
// zwischen Modulen, wird das alte Modul abgebaut (App.jsx rendert nur das
// offene) und das neue lädt seine Daten neu. Mit einem Snapshot kann ein Modul
// beim Wiederbetreten SOFORT den zuletzt gesehenen Stand zeigen und danach im
// Hintergrund aktualisieren — wie es der Hub schon über hubCache.js macht.
//
// Regeln:
//   - Je Nutzer: Wechselt die Person, wird alles verworfen (nie fremde Daten).
//   - Nur LESEN-Stand. Nach Schreibzugriffen lädt das Modul wie bisher frisch
//     nach und überschreibt den Snapshot.
//   - Geht beim Neuladen der Seite verloren (bewusst: kein Speicher auf Platte,
//     keine Nutzerdaten im localStorage über das Nötige hinaus).

let owner = null;
const store = new Map();

export function snapshotGet(userId, key) {
  if (!userId || owner !== userId) return undefined;
  return store.get(key);
}

export function snapshotSet(userId, key, value) {
  if (!userId) return;
  if (owner !== userId) { store.clear(); owner = userId; }
  store.set(key, value);
}

export function snapshotClear() {
  store.clear();
  owner = null;
}
