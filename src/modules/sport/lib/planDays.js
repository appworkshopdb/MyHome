import { PREDEFINED_UNITS } from './data/predefinedUnits';
import { resolvePlanIcon, resolvePlanMuscleGroups } from './planMuscles';

// Plan-Tage im Wizard und im Editor. Ein Tag ist entweder ein Ruhetag oder eine
// Einheit aus dem Katalog (unitCatalog.js). spo_plan_items kennt keine
// muscle_groups und kein icon, beides dient nur der Anzeige.

export const emptyDay = () => ({
  unit_id: '', _selectedUnitKey: '', title: '', type_key: '', duration_min: '', muscle_groups: [], icon: '', is_rest: false,
});

export const restDay = () => ({
  unit_id: '', _selectedUnitKey: '', title: 'Ruhetag', type_key: '', duration_min: '', muscle_groups: [], icon: '', is_rest: true,
});

export function dayFromEntry(entry) {
  return {
    unit_id: entry.own ? entry.key : '',
    _selectedUnitKey: entry.key,
    title: entry.title,
    type_key: entry.type_key ?? '',
    duration_min: entry.duration_min != null ? String(entry.duration_min) : '',
    muscle_groups: entry.muscle_groups ?? [],
    icon: entry.icon ?? '',
    is_rest: false,
  };
}

// Schlüssel der Auswahl für einen gespeicherten Plan-Tag
function selectedKeyFor(item, units) {
  if (item.unit_id) return item.unit_id;
  const predefined = PREDEFINED_UNITS.find((u) => u.title === item.title);
  if (predefined) return predefined.key;
  if (item.type_key?.startsWith('sport.')) return item.type_key;
  return units.find((u) => u.title === item.title)?.id ?? '';
}

export function daysFromItems(items, units = []) {
  if (!items?.length) return [emptyDay()];
  return items.map((i) => ({
    unit_id: i.unit_id ?? '',
    _selectedUnitKey: i.is_rest ? '' : selectedKeyFor(i, units),
    title: i.title ?? '',
    type_key: i.type_key ?? '',
    duration_min: i.duration_min != null ? String(i.duration_min) : '',
    muscle_groups: i.is_rest ? [] : resolvePlanMuscleGroups(i, units),
    icon: i.is_rest ? '' : resolvePlanIcon(i),
    is_rest: i.is_rest,
  }));
}

// Zeilen für savePlan (gleiche Form wie bisher)
export function itemsFromDays(days) {
  return days.map((d) => ({
    unit_id: d.is_rest ? null : (d.unit_id || null),
    title: d.is_rest ? (d.title.trim() || 'Ruhetag') : d.title,
    type_key: d.is_rest ? null : (d.type_key || null),
    duration_min: d.duration_min === '' ? null : parseInt(d.duration_min, 10),
    muscle_groups: d.is_rest ? [] : (d.muscle_groups ?? []),
    is_rest: d.is_rest,
  }));
}

export const daysAreComplete = (days) => days.length > 0 && !days.some((d) => !d.is_rest && !d.unit_id && !d._selectedUnitKey);

// "3 Tage · 2 Einheiten · 1 Ruhetag"
export function daysSummary(days) {
  const rest = days.filter((d) => d.is_rest).length;
  const train = days.length - rest;
  const n = (c, one, many) => `${c} ${c === 1 ? one : many}`;
  return `${n(days.length, 'Tag', 'Tage')} · ${n(train, 'Einheit', 'Einheiten')} · ${n(rest, 'Ruhetag', 'Ruhetage')}`;
}
