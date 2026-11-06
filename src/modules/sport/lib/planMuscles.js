import { PREDEFINED_UNITS } from './data/predefinedUnits';
import { getMuscleVisual } from './data/muscleGroups';
import { SPORT_TYPE_PREFIX } from '../../../core/lib/sportsData';

// Muskelgruppen eines Plan-Tags. spo_plan_items hat KEINE muscle_groups-Spalte,
// deshalb werden sie in dieser Reihenfolge aufgelöst:
//   1. item.muscle_groups (nur im Editor, solange der Tag nicht gespeichert ist)
//   2. die persönliche Einheit über unit_id
//   3. die vordefinierte Einheit anhand des Titels
export function resolvePlanMuscleGroups(item, units = []) {
  if (item.muscle_groups?.length) return item.muscle_groups;

  if (item.unit_id) {
    const unit = units.find((u) => u.id === item.unit_id);
    if (unit?.muscle_groups?.length) return unit.muscle_groups;
  }

  const predefined = PREDEFINED_UNITS.find((u) => u.title === item.title);
  return predefined?.muscle_groups ?? [];
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

// Platzhalter-Symbol für Einheiten ohne Muskelbilder (Ausdauer, Beweglichkeit,
// Sportarten), bis es feste Bilder je Einheit gibt.
export function resolvePlanIcon(item) {
  if (item.icon) return item.icon;
  const predefined = PREDEFINED_UNITS.find((u) => u.title === item.title);
  if (predefined?.icon) return predefined.icon;
  if (item.type_key?.startsWith(SPORT_TYPE_PREFIX)) return '🏅';
  return '';
}
