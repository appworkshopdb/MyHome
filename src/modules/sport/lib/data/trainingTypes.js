// Statischer Referenzinhalt, für alle Nutzer:innen gleich — analog zur
// Basis-Lebensmittelliste im Ernährungs-Modul. Lebt bewusst NICHT in der
// DB: ein neuer Trainingstyp ist ein Code-Change, keine Migration.
//
// Jeder Typ trägt Merkmale statt einer festen "passt zu Ziel X"-Regel.
// matching.js vergleicht diese Merkmale mit body_profile.goal/
// training_focus — dadurch bleibt die Zuordnung nachvollziehbar
// begründbar und erweitert sich von selbst, wenn ein neues Ziel oder
// ein neuer Typ dazukommt (siehe Projektkontext: "Vorschlags-Mechanismus
// über Merkmale, nicht über eine feste Zuordnungstabelle").
//
// Feldbedeutung:
//   key              eindeutig, wird als spo_workouts.type_key gespeichert
//   stimulus         'kraft' | 'ausdauer' | 'mobilitaet' — muss zu
//                     body_profile.training_focus passen ('beides' passt
//                     zu allem)
//   goals            welche body_profile.goal-Werte dieser Typ bedient
//   intensity        'niedrig' | 'mittel' | 'hoch' — grobe Einordnung,
//                     u.a. für Level-Filterung
//   typical_duration_min  Richtwert für die Vorbelegung im Kalender
//   muscle_groups    grobe Zielgruppen, für Übungsauswahl/-filterung
//   level            'einsteiger' | 'fortgeschritten' | 'alle'

export const TRAINING_TYPES = [
  {
    key: 'strength.push',
    label: 'Push (Kraft)',
    stimulus: 'kraft',
    goals: ['muskel', 'zunehmen', 'halten'],
    intensity: 'hoch',
    typical_duration_min: 60,
    muscle_groups: ['brust', 'schultern', 'trizeps'],
    level: 'alle',
  },
  {
    key: 'strength.pull',
    label: 'Pull (Kraft)',
    stimulus: 'kraft',
    goals: ['muskel', 'zunehmen', 'halten'],
    intensity: 'hoch',
    typical_duration_min: 60,
    muscle_groups: ['ruecken', 'bizeps'],
    level: 'alle',
  },
  {
    key: 'strength.legs',
    label: 'Beine (Kraft)',
    stimulus: 'kraft',
    goals: ['muskel', 'zunehmen', 'halten', 'abnehmen'],
    intensity: 'hoch',
    typical_duration_min: 60,
    muscle_groups: ['beine', 'gesaess'],
    level: 'alle',
  },
  {
    key: 'endurance.run',
    label: 'Lauf (Ausdauer)',
    stimulus: 'ausdauer',
    goals: ['abnehmen', 'halten'],
    intensity: 'mittel',
    typical_duration_min: 40,
    muscle_groups: ['beine', 'herz_kreislauf'],
    level: 'alle',
  },
  {
    key: 'mobility.general',
    label: 'Mobilität',
    stimulus: 'mobilitaet',
    goals: ['halten', 'abnehmen', 'muskel', 'zunehmen'],
    intensity: 'niedrig',
    typical_duration_min: 25,
    muscle_groups: ['ganzkoerper'],
    level: 'einsteiger',
  },
];

export function getTrainingType(key) {
  return TRAINING_TYPES.find((t) => t.key === key) ?? null;
}
