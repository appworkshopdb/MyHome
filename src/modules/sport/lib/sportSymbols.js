import { getSport, sportFromTypeKey } from '../../../core/lib/sportsData';

// Symbole für Einheiten ohne Muskelbilder (Ausdauer, Mobility, Sportarten) und für
// eigene Einheiten, die man mit einem Symbol statt mit Muskeln anlegt. Die Zeichnungen
// stehen in components/SportSymbol.jsx; hier nur Schlüssel, Namen und Zuordnungen.
// Schlüssel werden gespeichert (spo_units/spo_workouts/spo_plan_items.icon): nie umbenennen.
export const SYMBOL_KEYS = [
  'kraft', 'laufen', 'rad', 'schwimmen', 'hiit', 'kampf', 'ball', 'schlaeger',
  'mobility', 'wandern', 'klettern', 'tanzen', 'winter', 'wasser', 'gehen', 'stern',
];

export const SYMBOL_LABELS = {
  kraft: 'Kraft', laufen: 'Laufen', rad: 'Rad', schwimmen: 'Schwimmen', hiit: 'HIIT',
  kampf: 'Kampfsport', ball: 'Ballsport', schlaeger: 'Schläger', mobility: 'Mobility',
  wandern: 'Wandern', klettern: 'Klettern', tanzen: 'Tanzen', winter: 'Winter',
  wasser: 'Wassersport', gehen: 'Gehen', stern: 'Sonstiges',
};

export const isSymbol = (key) => Boolean(key) && SYMBOL_KEYS.includes(key);

// Kategorien eigener Einheiten. Gespeichert als type_key 'custom.<key>', damit die
// Auswertung sie zuordnen kann (typeLabel.js), ohne neue Spalte.
export const OWN_CATEGORIES = [
  { key: 'kraft', label: 'Kraft', type_key: 'custom.kraft', symbol: 'kraft' },
  { key: 'ausdauer', label: 'Ausdauer', type_key: 'custom.ausdauer', symbol: 'laufen' },
  { key: 'mobility', label: 'Mobility', type_key: 'custom.mobility', symbol: 'mobility' },
  { key: 'sport', label: 'Sport', type_key: 'custom.sport', symbol: 'stern' },
];
export const CUSTOM_TYPE_PREFIX = 'custom.';

// Vorschlag der Kategorie zum gewählten Symbol
export const SYMBOL_CATEGORY = {
  kraft: 'kraft', laufen: 'ausdauer', rad: 'ausdauer', schwimmen: 'ausdauer', hiit: 'ausdauer',
  wandern: 'ausdauer', wasser: 'ausdauer', gehen: 'ausdauer', mobility: 'mobility',
  kampf: 'sport', ball: 'sport', schlaeger: 'sport', klettern: 'sport', tanzen: 'sport', winter: 'sport', stern: 'sport',
};

// Kategorie aus einem gespeicherten type_key (auch für ältere Einheiten)
export function categoryOfType(typeKey, hasMuscles = false) {
  if (typeKey?.startsWith(CUSTOM_TYPE_PREFIX)) {
    const key = typeKey.slice(CUSTOM_TYPE_PREFIX.length);
    if (OWN_CATEGORIES.some((c) => c.key === key)) return key;
  }
  if (typeKey?.startsWith('strength.')) return 'kraft';
  if (typeKey?.startsWith('endurance.')) return 'ausdauer';
  if (typeKey?.startsWith('mobility.') || typeKey?.startsWith('recovery.')) return 'mobility';
  if (typeKey?.startsWith('sport.')) return 'sport';
  return hasMuscles ? 'kraft' : 'sport';
}

const GROUP_SYMBOL = {
  Ballsport: 'ball', 'Rückschlagsport': 'schlaeger', Ausdauer: 'laufen', 'Kraft & Fitness': 'kraft',
  Kampfsport: 'kampf', 'Gymnastik & Tanz': 'tanzen', Outdoor: 'wandern', Wassersport: 'wasser',
  Wintersport: 'winter', Sonstige: 'stern',
};
const SPORT_SYMBOL = {
  radfahren: 'rad', mountainbike: 'rad', walking: 'gehen', rudern: 'wasser', hiit: 'hiit',
  schwimmen: 'schwimmen', klettern: 'klettern', bouldern: 'klettern', yoga: 'mobility', pilates: 'mobility',
};

export function symbolForSport(sportKey) {
  const sport = getSport(sportKey);
  if (!sport) return 'stern';
  return SPORT_SYMBOL[sport.key] ?? GROUP_SYMBOL[sport.group] ?? 'stern';
}

// Wörter im Namen → Symbol (für ältere eigene Einheiten ohne Symbol)
const TITLE_WORDS = [
  [/box|kampf|mma|ringen|judo|karate|taekwondo|muay|jiu|bjj|fecht/, 'kampf'],
  [/lauf|jogg|run|sprint/, 'laufen'],
  [/rad|bike|cycl|spinning/, 'rad'],
  [/schwimm|swim/, 'schwimmen'],
  [/hiit|zirkel|crossfit|interval|tabata/, 'hiit'],
  [/fußball|fussball|basket|hand ?ball|volley|hockey|rugby|ball/, 'ball'],
  [/tennis|badminton|squash|padel|tischtennis/, 'schlaeger'],
  [/yoga|pilates|dehn|stretch|mobil/, 'mobility'],
  [/wander|hike|trail/, 'wandern'],
  [/kletter|boulder/, 'klettern'],
  [/tanz|dance|zumba|ballett/, 'tanzen'],
  [/ski|snowboard|langlauf|eislauf|schlittschuh/, 'winter'],
  [/ruder|kanu|kajak|surf|segel|sup/, 'wasser'],
  [/walk|spazier|geh/, 'gehen'],
];
export function symbolFromTitle(title) {
  const t = String(title ?? '').toLowerCase();
  return TITLE_WORDS.find(([re]) => re.test(t))?.[1] ?? '';
}

// Symbol einer Einheit ohne eigenes Symbol: Sportart, Kategorie, Name
export function fallbackSymbol({ type_key: typeKey, title } = {}) {
  const sport = sportFromTypeKey(typeKey);
  if (sport) return symbolForSport(sport.key);
  const byTitle = symbolFromTitle(title);
  if (byTitle) return byTitle;
  if (typeKey?.startsWith(CUSTOM_TYPE_PREFIX)) return OWN_CATEGORIES.find((c) => c.type_key === typeKey)?.symbol ?? 'stern';
  return '';
}
