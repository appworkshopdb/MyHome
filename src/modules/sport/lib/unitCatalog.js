import { PREDEFINED_UNITS } from './data/predefinedUnits';
import { getSport, sportTypeKey } from '../../../core/lib/sportsData';

// Ein Katalog für die Einheiten-Auswahl (Plan-Wizard und Plan-Editor).
// Kategorien: split · muskel · kombi (zusammen "Kraft"), aus, beweg, sport
// (Sportarten aus dem Profil), eigen (eigene Einheiten).
//
// Eintrag: { key, title, type_key, muscle_groups, icon, cat, own?, duration_min? }
//   key  'pre.*' (vordefiniert), 'sport.<key>' (Sportart) oder die uuid einer eigenen Einheit.

export const UNIT_TABS = [
  { key: 'kraft', label: 'Kraft', cats: ['split', 'muskel', 'kombi'] },
  { key: 'aus', label: 'Ausdauer', cats: ['aus'] },
  { key: 'beweg', label: 'Beweglichkeit', cats: ['beweg'] },
  { key: 'sport', label: 'Sport', cats: ['sport'] },
  { key: 'eigen', label: 'Eigene', cats: ['eigen'] },
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

export const SPORT_ICON = '🏅'; // Platzhalter, bis es feste Bilder je Einheit gibt

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
      icon: SPORT_ICON,
      cat: 'sport',
    }));

  const own = units.map((u) => ({
    key: u.id,
    title: u.title,
    type_key: u.type_key ?? null,
    duration_min: u.duration_min ?? null,
    muscle_groups: u.muscle_groups ?? [],
    icon: '',
    cat: 'eigen',
    own: true,
  }));

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
