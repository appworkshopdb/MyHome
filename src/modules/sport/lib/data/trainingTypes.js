// Statischer Referenzinhalt, für alle Nutzer:innen gleich — analog zur
// Basis-Lebensmittelliste im Ernährungs-Modul. Lebt bewusst NICHT in der
// DB: ein neuer Trainingstyp ist ein Code-Change, keine Migration.
//
// Jeder Typ trägt Merkmale statt einer festen "passt zu Ziel X"-Regel.
// matching.js vergleicht diese Merkmale mit body_profile.goal/
// training_focus — dadurch bleibt die Zuordnung nachvollziehbar
// begründbar und erweitert sich von selbst, wenn ein neues Ziel oder
// ein neuer Typ dazukommt.
//
// WICHTIG: Die keys der ursprünglichen fünf Typen (strength.push/pull/
// legs, endurance.run, mobility.general) sind unverändert — sie stehen
// bereits als type_key in gespeicherten Einheiten. Neue Typen nur
// ergänzen, bestehende keys nie umbenennen.
//
// Feldbedeutung:
//   key              eindeutig, wird als spo_workouts.type_key gespeichert
//   group            nur für die Gruppierung im Auswahl-Dropdown
//   stimulus         'kraft' | 'ausdauer' | 'mobilitaet' — muss zu
//                     body_profile.training_focus passen ('beides' passt
//                     zu allem)
//   goals            welche body_profile.goal-Werte dieser Typ bedient
//                     ('abnehmen' | 'halten' | 'zunehmen' | 'muskel')
//   intensity        'niedrig' | 'mittel' | 'hoch'
//   typical_duration_min  Richtwert für die Vorbelegung
//   muscle_groups    grobe Zielgruppen, für Übungsauswahl/-filterung
//   level            'einsteiger' | 'fortgeschritten' | 'alle'

export const TRAINING_TYPES = [
  // --- Kraft: Splits ------------------------------------------------
  {
    key: 'strength.push', label: 'Push (Brust, Schultern, Trizeps)', group: 'Kraft',
    stimulus: 'kraft', goals: ['muskel', 'zunehmen', 'halten'],
    intensity: 'hoch', typical_duration_min: 60,
    muscle_groups: ['brust', 'schultern', 'trizeps'], level: 'alle',
  },
  {
    key: 'strength.pull', label: 'Pull (Rücken, Bizeps)', group: 'Kraft',
    stimulus: 'kraft', goals: ['muskel', 'zunehmen', 'halten'],
    intensity: 'hoch', typical_duration_min: 60,
    muscle_groups: ['ruecken', 'bizeps'], level: 'alle',
  },
  {
    key: 'strength.legs', label: 'Beine', group: 'Kraft',
    stimulus: 'kraft', goals: ['muskel', 'zunehmen', 'halten', 'abnehmen'],
    intensity: 'hoch', typical_duration_min: 60,
    muscle_groups: ['beine', 'gesaess'], level: 'alle',
  },
  {
    key: 'strength.upper', label: 'Oberkörper', group: 'Kraft',
    stimulus: 'kraft', goals: ['muskel', 'zunehmen', 'halten'],
    intensity: 'hoch', typical_duration_min: 60,
    muscle_groups: ['brust', 'ruecken', 'schultern', 'bizeps', 'trizeps'], level: 'alle',
  },
  {
    key: 'strength.lower', label: 'Unterkörper', group: 'Kraft',
    stimulus: 'kraft', goals: ['muskel', 'zunehmen', 'halten', 'abnehmen'],
    intensity: 'hoch', typical_duration_min: 60,
    muscle_groups: ['beine', 'gesaess'], level: 'alle',
  },
  {
    key: 'strength.fullbody', label: 'Ganzkörper', group: 'Kraft',
    stimulus: 'kraft', goals: ['muskel', 'zunehmen', 'halten', 'abnehmen'],
    intensity: 'hoch', typical_duration_min: 60,
    muscle_groups: ['ganzkoerper'], level: 'einsteiger',
  },

  // --- Kraft: klassische Muskelgruppen-Tage -------------------------
  {
    key: 'strength.chest_biceps', label: 'Brust & Bizeps', group: 'Kraft',
    stimulus: 'kraft', goals: ['muskel', 'zunehmen', 'halten'],
    intensity: 'hoch', typical_duration_min: 60,
    muscle_groups: ['brust', 'bizeps'], level: 'alle',
  },
  {
    key: 'strength.back_triceps', label: 'Rücken & Trizeps', group: 'Kraft',
    stimulus: 'kraft', goals: ['muskel', 'zunehmen', 'halten'],
    intensity: 'hoch', typical_duration_min: 60,
    muscle_groups: ['ruecken', 'trizeps'], level: 'alle',
  },
  {
    key: 'strength.shoulders_arms', label: 'Schultern & Arme', group: 'Kraft',
    stimulus: 'kraft', goals: ['muskel', 'zunehmen', 'halten'],
    intensity: 'mittel', typical_duration_min: 45,
    muscle_groups: ['schultern', 'bizeps', 'trizeps'], level: 'alle',
  },
  {
    key: 'strength.glutes', label: 'Gesäß & Beinrückseite', group: 'Kraft',
    stimulus: 'kraft', goals: ['muskel', 'zunehmen', 'halten', 'abnehmen'],
    intensity: 'mittel', typical_duration_min: 45,
    muscle_groups: ['gesaess', 'beine'], level: 'alle',
  },
  {
    key: 'strength.core', label: 'Rumpf & Bauch', group: 'Kraft',
    stimulus: 'kraft', goals: ['muskel', 'halten', 'abnehmen'],
    intensity: 'mittel', typical_duration_min: 30,
    muscle_groups: ['rumpf'], level: 'einsteiger',
  },

  // --- Ausdauer -----------------------------------------------------
  {
    key: 'endurance.run', label: 'Lauf', group: 'Ausdauer',
    stimulus: 'ausdauer', goals: ['abnehmen', 'halten'],
    intensity: 'mittel', typical_duration_min: 40,
    muscle_groups: ['beine', 'herz_kreislauf'], level: 'alle',
  },
  {
    key: 'endurance.long', label: 'Langer Lauf (Grundlage)', group: 'Ausdauer',
    stimulus: 'ausdauer', goals: ['abnehmen', 'halten'],
    intensity: 'mittel', typical_duration_min: 75,
    muscle_groups: ['beine', 'herz_kreislauf'], level: 'fortgeschritten',
  },
  {
    key: 'endurance.intervals', label: 'Intervalltraining', group: 'Ausdauer',
    stimulus: 'ausdauer', goals: ['abnehmen', 'halten'],
    intensity: 'hoch', typical_duration_min: 45,
    muscle_groups: ['beine', 'herz_kreislauf'], level: 'fortgeschritten',
  },
  {
    key: 'endurance.hiit', label: 'HIIT / Zirkeltraining', group: 'Ausdauer',
    stimulus: 'ausdauer', goals: ['abnehmen', 'halten', 'muskel'],
    intensity: 'hoch', typical_duration_min: 30,
    muscle_groups: ['ganzkoerper', 'herz_kreislauf'], level: 'alle',
  },
  {
    key: 'endurance.bike', label: 'Radfahren', group: 'Ausdauer',
    stimulus: 'ausdauer', goals: ['abnehmen', 'halten'],
    intensity: 'mittel', typical_duration_min: 60,
    muscle_groups: ['beine', 'herz_kreislauf'], level: 'alle',
  },
  {
    key: 'endurance.swim', label: 'Schwimmen', group: 'Ausdauer',
    stimulus: 'ausdauer', goals: ['abnehmen', 'halten'],
    intensity: 'mittel', typical_duration_min: 45,
    muscle_groups: ['ganzkoerper', 'herz_kreislauf'], level: 'alle',
  },
  {
    key: 'endurance.row', label: 'Rudern / Ergometer', group: 'Ausdauer',
    stimulus: 'ausdauer', goals: ['abnehmen', 'halten', 'muskel'],
    intensity: 'mittel', typical_duration_min: 40,
    muscle_groups: ['ruecken', 'beine', 'herz_kreislauf'], level: 'alle',
  },
  {
    key: 'endurance.walk', label: 'Zügiges Gehen / Walking', group: 'Ausdauer',
    stimulus: 'ausdauer', goals: ['abnehmen', 'halten'],
    intensity: 'niedrig', typical_duration_min: 45,
    muscle_groups: ['beine', 'herz_kreislauf'], level: 'einsteiger',
  },

  // --- Beweglichkeit & Regeneration ---------------------------------
  {
    key: 'mobility.general', label: 'Mobilität', group: 'Beweglichkeit',
    stimulus: 'mobilitaet', goals: ['halten', 'abnehmen', 'muskel', 'zunehmen'],
    intensity: 'niedrig', typical_duration_min: 25,
    muscle_groups: ['ganzkoerper'], level: 'einsteiger',
  },
  {
    key: 'mobility.stretching', label: 'Dehnen', group: 'Beweglichkeit',
    stimulus: 'mobilitaet', goals: ['halten', 'abnehmen', 'muskel', 'zunehmen'],
    intensity: 'niedrig', typical_duration_min: 20,
    muscle_groups: ['ganzkoerper'], level: 'einsteiger',
  },
  {
    key: 'mobility.yoga', label: 'Yoga', group: 'Beweglichkeit',
    stimulus: 'mobilitaet', goals: ['halten', 'abnehmen', 'muskel', 'zunehmen'],
    intensity: 'niedrig', typical_duration_min: 45,
    muscle_groups: ['ganzkoerper'], level: 'alle',
  },
  {
    key: 'recovery.active', label: 'Aktive Erholung', group: 'Beweglichkeit',
    stimulus: 'mobilitaet', goals: ['halten', 'abnehmen', 'muskel', 'zunehmen'],
    intensity: 'niedrig', typical_duration_min: 30,
    muscle_groups: ['ganzkoerper'], level: 'einsteiger',
  },
];

// Reihenfolge der Gruppen im Dropdown — ergibt sich aus der Reihenfolge
// oben, damit an einer Stelle gepflegt wird.
export const TRAINING_TYPE_GROUPS = [...new Set(TRAINING_TYPES.map((t) => t.group))];

export function getTrainingType(key) {
  return TRAINING_TYPES.find((t) => t.key === key) ?? null;
}

export function trainingTypesByGroup(group) {
  return TRAINING_TYPES.filter((t) => t.group === group);
}
