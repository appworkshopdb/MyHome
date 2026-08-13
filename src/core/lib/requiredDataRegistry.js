// Jedes Modul, das Pflichtdaten hat, meldet sich hier mit einer eigenen
// Prüf-Funktion an (typischerweise beim Import seiner *Module.jsx-Datei,
// siehe modules/nutrition/NutritionModule.jsx). core kennt dadurch kein
// einzelnes Modul — der Hub liest ausschließlich dieses Register, nie
// ein Modul direkt. Analog zum measurements/goals-Muster: geteilte
// Infrastruktur in core, Inhalt/Wissen bleibt beim jeweiligen Modul.

const registry = [];

// checkFn: async (session) => [{ key, label }, …] (fehlende Felder)
export function registerRequirement(moduleId, checkFn) {
  if (registry.some((r) => r.moduleId === moduleId)) return; // z.B. bei HMR im Dev-Modus
  registry.push({ moduleId, checkFn });
}

export async function getAllRequirementStatus(session) {
  const results = await Promise.all(
    registry.map(async ({ moduleId, checkFn }) => {
      try {
        const missing = await checkFn(session);
        return { moduleId, missing };
      } catch (e) {
        console.error(`[requiredDataRegistry] Prüfung für "${moduleId}" fehlgeschlagen:`, e);
        return { moduleId, missing: [] };
      }
    })
  );
  return results.filter((r) => r.missing.length > 0);
}
