// Rein funktional, kein DB-Zugriff, keine Modul-Kenntnis: prüft ein
// geladenes Datenobjekt gegen eine Liste von {key, label}-Feldern und
// gibt zurück, welche davon leer sind. Jedes Modul kann das mit seiner
// eigenen Spec + eigenen Daten nutzen.
export function getMissingFields(spec, data) {
  return spec.filter(({ key }) => {
    const v = data?.[key];
    return v === null || v === undefined || v === '' || (Array.isArray(v) && v.length === 0);
  });
}
