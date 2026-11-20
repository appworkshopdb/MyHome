import { PREDEFINED_UNITS } from './data/predefinedUnits';
import { getSport, sportTypeKey } from '../../../core/lib/sportsData';
import { symbolForSport } from './sportSymbols';
import { resolveUnitVisual } from './planMuscles';

// Ein Katalog für die Einheiten-Auswahl (Plan-Wizard und Plan-Editor).
// Kategorien: split · muskel · kombi (zusammen "Kraft"), aus, beweg ("Mobility"), sport
// (Sportarten aus dem Profil) und eigen (eigene Einheiten) — die beiden letzten stehen im Reiter "Eigene".
//
// Eintrag: { key, title, type_key, muscle_groups, icon, cat, own?, duration_min? }
//   key  'pre.*' (vordefiniert), 'sport.<key>' (Sportart) oder die uuid einer eigenen Einheit.

export const UNIT_TABS = [
  { key: 'kraft', label: 'Kraft', cats: ['split', 'muskel', 'kombi'] },
  { key: 'aus', label: 'Ausdauer', cats: ['aus'] },
  { key: 'beweg', label: 'Mobility', cats: ['beweg'] },
  // Eigene Einheiten und die Sportarten aus dem Profil (früher eigener Reiter "Sport")
  { key: 'eigen', label: 'Eigene', cats: ['eigen', 'sport'] },
];

export const KRAFT_SUBS = [
  { key: 'split', label: 'Splits' },
  { key: 'muskel', label: 'Muskeln' },
  { key: 'kombi', label: 'Kombinationen' },
];

const SPLIT_KEYS = ['pre.ganzkoerper', 'pre.oberkoerper', 'pre.unterkoerper', 'pre.push', 'pre.pull', 'pre.legs'];
const MUSKEL_KEYS = ['pre.brust', 'pre.ruecken', 'pre.schultern', 'pre.arme', 'pre.bauch'];
const AUS_KEYS = ['pre.lauf', 'pre.langer-lauf', 'pre.intervalle', 'pre.hiit', 'pre.rad', 'pre.schwimmen', 'pre.rudern', 'pre.walking'];
const BEWEG_KEYS = ['pre.mobilitaet', 'pre.dehnen', 'pre.yoga', 'pre.erholung'];

function categoryOf(key) {
  if (SPLIT_KEYS.includes(key)) return 'split';
  if (MUSKEL_KEYS.includes(key)) return 'muskel';
  if (AUS_KEYS.includes(key)) return 'aus';
  if (BEWEG_KEYS.includes(key)) return 'beweg';
  return 'kombi';
}

export function buildCatalog({ units = [], userSports = [] } = {}) {
  const predefined = PREDEFINED_UNITS.map((u) => ({
    key: u.key,
    title: u.title,
    type_key: u.type_key,
    muscle_groups: u.muscle_groups ?? [],
    icon: u.icon ?? '',
    cat: categoryOf(u.key),
  }));

  const sports = userSports
    .map((k) => getSport(k))
    .filter(Boolean)
    .map((s) => ({
      key: `sport.${s.key}`,
      title: s.label,
      type_key: sportTypeKey(s.key),
      muscle_groups: [],
      icon: symbolForSport(s.key),
      cat: 'sport',
    }));

  // Eigene Einheiten: gespeicherte Muskeln oder Symbol; ältere Einträge ohne beides
  // bekommen Bild bzw. Symbol aus Name/Typ (dieselbe Regel wie überall, planMuscles.js)
  const own = units.map((u) => {
    const visual = resolveUnitVisual(u);
    return {
      key: u.id,
      title: u.title,
      type_key: u.type_key ?? null,
      duration_min: u.duration_min ?? null,
      muscle_groups: visual.tags,
      icon: visual.icon || 'stern',
      cat: 'eigen',
      own: true,
    };
  });

  return [...predefined, ...sports, ...own];
}

export function tabOf(cat) {
  return UNIT_TABS.find((t) => t.cats.includes(cat))?.key ?? 'kraft';
}

// Umlaut- und Groß-/Kleinschreibung-unabhängig; alle Wörter müssen passen
const norm = (t) => String(t ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ß/g, 'ss');

export function searchCatalog(catalog, query) {
  const words = norm(query).split(/\s+/).filter(Boolean);
  if (words.length === 0) return catalog;
  return catalog.filter((e) => {
    const hay = norm(`${e.title} ${(e.muscle_groups ?? []).join(' ')}`);
    return words.every((w) => hay.includes(w));
  });
}

// Herkunft eines Eintrags für die Anzeige ("Vorlage", "Eigene Einheit" …)
export function unitKindLabel(entry) {
  if (!entry) return '';
  if (entry.own) return 'Eigene Einheit';
  if (entry.cat === 'sport') return 'Sportart aus deinem Profil';
  if (String(entry.key ?? '').startsWith('combo:')) return 'Muskeln, nur für dieses Training';
  return 'Vorlage';
}
