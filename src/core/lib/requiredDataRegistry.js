// Jedes Modul, das Pflichtdaten hat, meldet sich hier mit einer eigenen
// Prüf-Funktion an (typischerweise beim Import seiner *Module.jsx-Datei).
// core kennt dadurch kein einzelnes Modul — der Hub/das Popup liest
// ausschließlich dieses Register, nie ein Modul direkt.
//
// WICHTIG: der "key" ist NICHT zwingend eine Modul-Id, sondern das Ziel,
// an dem die Lücke behoben wird. Körperdaten (body_profile) gehören
// mehreren Modulen (Ernährung, Sport, ...) gleichzeitig — die melden
// sich deshalb bewusst alle unter demselben Key "profile" an, statt
// unter ihrer eigenen Modul-Id. Mehrere Prüf-Funktionen pro Key sind
// deshalb ausdrücklich erlaubt; ihre fehlenden Felder werden hier
// zusammengeführt und nach Feld-Key dedupliziert, damit z.B. "Gewicht"
// nicht doppelt auftaucht, nur weil zwei Module es beide brauchen.
const registry = [];

// checkFn: async (session) => [{ key, label }, …] (fehlende Felder)
export function registerRequirement(key, checkFn) {
  registry.push({ key, checkFn });
  // Bewusst KEINE Dopplungs-Sperre pro Key mehr (anders als vorher) —
  // genau mehrere Einträge pro Key sind hier der Zweck. Einzige bekannte
  // Nebenwirkung: Vite-HMR im Dev-Modus kann bei wiederholtem Hot-Reload
  // derselben Datei doppelte Einträge anhäufen; ein voller Reload behebt
  // das, in Produktion (einmaliger Bundle-Load) tritt es nicht auf.
}

export async function getAllRequirementStatus(session) {
  const byKey = new Map();

  for (const { key, checkFn } of registry) {
    let missing;
    try {
      missing = await checkFn(session);
    } catch (e) {
      console.error(`[requiredDataRegistry] Prüfung für "${key}" fehlgeschlagen:`, e);
      continue;
    }
    if (!missing || missing.length === 0) continue;

    const merged = byKey.get(key) ?? [];
    for (const field of missing) {
      if (!merged.some((m) => m.key === field.key)) merged.push(field);
    }
    byKey.set(key, merged);
  }

  return [...byKey.entries()].map(([moduleId, missing]) => ({ moduleId, missing }));
}
