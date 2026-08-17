import { getTrainingType } from './data/trainingTypes';
import { sportFromTypeKey } from '../../../core/lib/sportsData';

// type_key kann zweierlei sein: ein Trainingstyp aus trainingTypes.js
// ('strength.push') oder eine Sportart aus dem Profil ('sport.fussball').
// Beide teilen sich dasselbe Feld, damit spo_workouts ohne zusätzliche
// Spalte auskommt — dieser Helfer ist die EINZIGE Stelle, die den
// Unterschied kennt. Sonst müsste jede Ansicht beide Fälle prüfen.
export function resolveTypeLabel(typeKey) {
  if (!typeKey || typeKey === 'sonstiges') return null;
  return getTrainingType(typeKey)?.label ?? sportFromTypeKey(typeKey)?.label ?? null;
}
