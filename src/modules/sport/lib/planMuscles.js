import { PREDEFINED_UNITS } from './data/predefinedUnits';
import { getMuscleVisual } from './data/muscleGroups';
import { fallbackSymbol, isSymbol } from './sportSymbols';

// Bilder einer Einheit: Plan-Tage (spo_plan_items), Kalender-Einheiten
// (spo_workouts) und Plan-Tage im Editor haben dieselbe Form.
//
// Seit der Migration spo_muscle_groups_migration.sql tragen die Zeilen ihre
// Muskelgruppen selbst (`muscle_groups`) — das ist die feste Zuordnung. Für
// Zeilen davor (und solange die Migration fehlt) bleibt die Auflösung als
// Rückfall, in dieser Reihenfolge:
//   1. row.muscle_groups
//   2. die persönliche Einheit über unit_id
//   3. die vordefinierte Einheit anhand des Titels
//   4. die vordefinierte Einheit anhand des Typs (jeder Typ gehört zu genau einer)
const BY_TITLE = new Map(PREDEFINED_UNITS.map((u) => [u.title, u]));
const BY_TYPE = new Map(PREDEFINED_UNITS.filter((u) => u.type_key).map((u) => [u.type_key, u]));

// Muskelgruppen, die zu einem Trainingstyp gehören (leer, wenn es keine gibt)
export function muscleGroupsForType(typeKey) {
  return BY_TYPE.get(typeKey)?.muscle_groups ?? [];
}

export function resolvePlanMuscleGroups(item, units = []) {
  if (item.muscle_groups?.length) return item.muscle_groups;

  if (item.unit_id) {
    const unit = units.find((u) => u.id === item.unit_id);
    if (unit?.muscle_groups?.length) return unit.muscle_groups;
  }

  const byTitle = BY_TITLE.get(item.title);
  if (byTitle?.muscle_groups?.length) return byTitle.muscle_groups;
  return muscleGroupsForType(item.type_key);
}

// Symbol für Einheiten ohne Muskelbilder (lib/sportSymbols.js): das gespeicherte,
// sonst das der Vorlage (Titel, Typ), sonst aus Sportart, Kategorie oder Namen.
export function resolvePlanIcon(item) {
  if (isSymbol(item.icon)) return item.icon;
  const byTitle = BY_TITLE.get(item.title);
  if (byTitle?.icon) return byTitle.icon;
  const byType = BY_TYPE.get(item.type_key);
  if (byType?.icon) return byType.icon;
  return fallbackSymbol(item) || item.icon || '';
}

// { tags, icon } für UnitVisual: Muskelbilder, sonst das Platzhalter-Symbol
export function resolveUnitVisual(row, units = []) {
  const tags = resolvePlanMuscleGroups(row, units);
  return { tags, icon: tags.length ? '' : resolvePlanIcon(row) };
}

// "Quadrizeps (Oberschenkel vorne)" → "Quadrizeps"
export function muscleLabel(key) {
  const m = getMuscleVisual(key);
  return m ? m.label.split(' (')[0] : key;
}

export function muscleLabels(keys, max = 3) {
  return (keys ?? []).slice(0, max).map(muscleLabel).join(', ');
}

// "7 Tage · 5 Einheiten · 2 Ruhetage" (Ruhetage nur, wenn es welche gibt)
export function planCounts(items) {
  const rest = items.filter((i) => i.is_rest).length;
  const train = items.length - rest;
  return `${items.length} Tage · ${train} Einheiten${rest ? ` · ${rest} Ruhetage` : ''}`;
}
