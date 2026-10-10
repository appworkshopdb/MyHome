// core/lib/scanFoods.js
// Lebensmittel der Ernährungs-App für den Mahlzeit-Scan.
//
// Der Scan (photoScan.js, core/) schickt der Edge Function die Lebensmittel-
// Datenbank mit, damit die KI erkannte Bestandteile direkt einem Lebensmittel
// zuordnet und die Nährwerte aus der Datenbank kommen. Die Daten gehören dem
// Modul Ernährung (modules/nutrition), core/ darf von dort nichts importieren —
// deshalb trägt das Modul seine Liste hier ein, solange es offen ist.
//
// Nur Name, Gruppe und Nährwerte pro 100 g/ml gehen raus (keine Vitamine, Tags o. Ä.).
// Die Function entscheidet über die Gruppe, was davon als Text an die KI geht.

const NUTRIENTS = ['kcal', 'protein', 'carbs', 'sugar', 'fat', 'satfat', 'fiber', 'salt'];

let current = [];

// foods: Lebensmittel-Objekte des Ernährungsmoduls (id, name, kcal, protein, …)
export function setScanFoods(foods) {
  current = (foods || [])
    .filter((f) => f && f.id != null && f.name && Number.isFinite(Number(f.kcal)))
    .map((f) => {
      const out = { id: f.id, name: String(f.name), group: f.group ? String(f.group) : null };
      for (const k of NUTRIENTS) out[k] = Number(f[k]) || 0;
      return out;
    });
}

export function getScanFoods() {
  return current;
}
