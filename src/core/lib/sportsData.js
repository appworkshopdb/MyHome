// Sportarten-Katalog — statischer Referenzinhalt, für alle Nutzer:innen
// gleich (analog zur Basis-Lebensmittelliste im Ernährungs-Modul).
//
// Liegt bewusst in core/lib/ und NICHT in modules/sport/: die Auswahl
// gehört zum Körperprofil (body_profile.sports) und wird von
// core/components/BodyProfileForm.jsx gerendert — core darf laut
// Architektur-Regel nicht aus modules/ importieren.
//
// Auswahl orientiert sich an den mitgliederstärksten Verbänden im DOSB
// (Fußball, Turnen, Tennis, Leichtathletik, Handball, Reiten, Golf,
// Schwimmen, Alpenverein) und ergänzt breit um Freizeit-, Kampf-,
// Wasser- und Wintersport, damit die Auswahl niemanden ausschließt.
//
// group dient nur der Gruppierung im Auswahl-Dialog. Ein neuer Eintrag
// hier genügt — weder DB-Migration noch Änderung am Sport-Modul nötig.

export const SPORTS = [
  // Ballsport / Mannschaft
  { key: 'fussball', label: 'Fußball', group: 'Ballsport' },
  { key: 'basketball', label: 'Basketball', group: 'Ballsport' },
  { key: 'handball', label: 'Handball', group: 'Ballsport' },
  { key: 'volleyball', label: 'Volleyball', group: 'Ballsport' },
  { key: 'beachvolleyball', label: 'Beachvolleyball', group: 'Ballsport' },
  { key: 'hockey', label: 'Hockey', group: 'Ballsport' },
  { key: 'rugby', label: 'Rugby', group: 'Ballsport' },
  { key: 'american_football', label: 'American Football', group: 'Ballsport' },
  { key: 'baseball', label: 'Baseball', group: 'Ballsport' },
  { key: 'futsal', label: 'Futsal', group: 'Ballsport' },
  { key: 'wasserball', label: 'Wasserball', group: 'Ballsport' },

  // Rückschlagsport
  { key: 'tennis', label: 'Tennis', group: 'Rückschlagsport' },
  { key: 'tischtennis', label: 'Tischtennis', group: 'Rückschlagsport' },
  { key: 'badminton', label: 'Badminton', group: 'Rückschlagsport' },
  { key: 'squash', label: 'Squash', group: 'Rückschlagsport' },
  { key: 'padel', label: 'Padel', group: 'Rückschlagsport' },

  // Ausdauer
  { key: 'laufen', label: 'Laufen / Joggen', group: 'Ausdauer' },
  { key: 'trailrunning', label: 'Trailrunning', group: 'Ausdauer' },
  { key: 'radfahren', label: 'Radfahren', group: 'Ausdauer' },
  { key: 'mountainbike', label: 'Mountainbike', group: 'Ausdauer' },
  { key: 'triathlon', label: 'Triathlon', group: 'Ausdauer' },
  { key: 'leichtathletik', label: 'Leichtathletik', group: 'Ausdauer' },
  { key: 'walking', label: 'Walking / Nordic Walking', group: 'Ausdauer' },
  { key: 'rudern', label: 'Rudern', group: 'Ausdauer' },

  // Kraft & Fitness
  { key: 'krafttraining', label: 'Krafttraining', group: 'Kraft & Fitness' },
  { key: 'bodybuilding', label: 'Bodybuilding', group: 'Kraft & Fitness' },
  { key: 'crossfit', label: 'CrossFit / Functional', group: 'Kraft & Fitness' },
  { key: 'calisthenics', label: 'Calisthenics', group: 'Kraft & Fitness' },
  { key: 'powerlifting', label: 'Powerlifting', group: 'Kraft & Fitness' },
  { key: 'gewichtheben', label: 'Gewichtheben', group: 'Kraft & Fitness' },
  { key: 'hiit', label: 'HIIT / Zirkeltraining', group: 'Kraft & Fitness' },

  // Kampfsport
  { key: 'boxen', label: 'Boxen', group: 'Kampfsport' },
  { key: 'kickboxen', label: 'Kickboxen', group: 'Kampfsport' },
  { key: 'mma', label: 'MMA', group: 'Kampfsport' },
  { key: 'bjj', label: 'Brazilian Jiu-Jitsu', group: 'Kampfsport' },
  { key: 'judo', label: 'Judo', group: 'Kampfsport' },
  { key: 'karate', label: 'Karate', group: 'Kampfsport' },
  { key: 'taekwondo', label: 'Taekwondo', group: 'Kampfsport' },
  { key: 'ringen', label: 'Ringen', group: 'Kampfsport' },
  { key: 'muay_thai', label: 'Muay Thai', group: 'Kampfsport' },
  { key: 'fechten', label: 'Fechten', group: 'Kampfsport' },

  // Wassersport
  { key: 'schwimmen', label: 'Schwimmen', group: 'Wassersport' },
  { key: 'surfen', label: 'Surfen', group: 'Wassersport' },
  { key: 'kitesurfen', label: 'Kitesurfen', group: 'Wassersport' },
  { key: 'segeln', label: 'Segeln', group: 'Wassersport' },
  { key: 'kanu', label: 'Kanu / Kajak', group: 'Wassersport' },
  { key: 'tauchen', label: 'Tauchen', group: 'Wassersport' },
  { key: 'sup', label: 'Stand-up-Paddling', group: 'Wassersport' },

  // Wintersport
  { key: 'ski_alpin', label: 'Ski Alpin', group: 'Wintersport' },
  { key: 'langlauf', label: 'Skilanglauf', group: 'Wintersport' },
  { key: 'snowboard', label: 'Snowboard', group: 'Wintersport' },
  { key: 'eishockey', label: 'Eishockey', group: 'Wintersport' },
  { key: 'eiskunstlauf', label: 'Eiskunstlauf', group: 'Wintersport' },
  { key: 'skitouren', label: 'Skitouren', group: 'Wintersport' },

  // Gymnastik, Tanz & Körperarbeit
  { key: 'turnen', label: 'Turnen', group: 'Gymnastik & Tanz' },
  { key: 'yoga', label: 'Yoga', group: 'Gymnastik & Tanz' },
  { key: 'pilates', label: 'Pilates', group: 'Gymnastik & Tanz' },
  { key: 'tanzen', label: 'Tanzen', group: 'Gymnastik & Tanz' },
  { key: 'ballett', label: 'Ballett', group: 'Gymnastik & Tanz' },
  { key: 'rhythmische_sportgymnastik', label: 'Rhythmische Sportgymnastik', group: 'Gymnastik & Tanz' },
  { key: 'mobility', label: 'Mobility / Dehnen', group: 'Gymnastik & Tanz' },

  // Outdoor & Natur
  { key: 'wandern', label: 'Wandern', group: 'Outdoor' },
  { key: 'klettern', label: 'Klettern', group: 'Outdoor' },
  { key: 'bouldern', label: 'Bouldern', group: 'Outdoor' },
  { key: 'bergsteigen', label: 'Bergsteigen', group: 'Outdoor' },
  { key: 'reiten', label: 'Reiten', group: 'Outdoor' },
  { key: 'golf', label: 'Golf', group: 'Outdoor' },
  { key: 'skaten', label: 'Skaten / Inline', group: 'Outdoor' },

  // Sonstige
  { key: 'schiessen', label: 'Schießsport', group: 'Sonstige' },
  { key: 'bogenschiessen', label: 'Bogenschießen', group: 'Sonstige' },
  { key: 'kegeln', label: 'Kegeln / Bowling', group: 'Sonstige' },
  { key: 'motorsport', label: 'Motorsport', group: 'Sonstige' },
  { key: 'esport', label: 'E-Sport', group: 'Sonstige' },
];

export const SPORT_GROUPS = [...new Set(SPORTS.map((s) => s.group))];

export function getSport(key) {
  return SPORTS.find((s) => s.key === key) ?? null;
}

// Workouts speichern eine Sportart als type_key 'sport.<key>' — dadurch
// braucht spo_workouts keine zusätzliche Spalte, und Trainingstypen und
// Sportarten teilen sich dasselbe Feld.
export const SPORT_TYPE_PREFIX = 'sport.';

export function sportTypeKey(sportKey) {
  return `${SPORT_TYPE_PREFIX}${sportKey}`;
}

export function sportFromTypeKey(typeKey) {
  if (!typeKey?.startsWith(SPORT_TYPE_PREFIX)) return null;
  return getSport(typeKey.slice(SPORT_TYPE_PREFIX.length));
}
