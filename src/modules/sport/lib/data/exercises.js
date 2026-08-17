// Basis-Übungskatalog, statisch im Frontend — analog zur großen
// Lebensmittelliste im Ernährungs-Modul. Nur selbst angelegte oder
// bearbeitete Übungen landen in spo_exercises (DB); diese Liste ist für
// alle Nutzer:innen gleich.
//
// Feldnamen sind bewusst identisch zu spo_exercises, damit
// matching.js/mergeExercises() beide Quellen gleich behandeln kann,
// ohne zwei verschiedene Formen zu kennen.
//
// unit bestimmt, welche Felder in spo_entries befüllt werden:
//   'reps_weight'   → reps, weight_kg
//   'duration'      → duration_sec
//   'distance'      → duration_sec, distance_km

export const EXERCISES = [
  // Push
  { key: 'bankdruecken', name: 'Bankdrücken', stimulus: 'kraft', muscle_groups: ['brust', 'trizeps'], equipment: 'langhantel', unit: 'reps_weight', level: 'alle' },
  { key: 'schulterdruecken', name: 'Schulterdrücken', stimulus: 'kraft', muscle_groups: ['schultern', 'trizeps'], equipment: 'kurzhantel', unit: 'reps_weight', level: 'alle' },
  { key: 'dips', name: 'Dips', stimulus: 'kraft', muscle_groups: ['brust', 'trizeps'], equipment: 'koerpergewicht', unit: 'reps_weight', level: 'fortgeschritten' },

  // Pull
  { key: 'klimmzuege', name: 'Klimmzüge', stimulus: 'kraft', muscle_groups: ['ruecken', 'bizeps'], equipment: 'koerpergewicht', unit: 'reps_weight', level: 'fortgeschritten' },
  { key: 'rudern_langhantel', name: 'Rudern (Langhantel)', stimulus: 'kraft', muscle_groups: ['ruecken'], equipment: 'langhantel', unit: 'reps_weight', level: 'alle' },
  { key: 'latzug', name: 'Latzug', stimulus: 'kraft', muscle_groups: ['ruecken', 'bizeps'], equipment: 'kabelzug', unit: 'reps_weight', level: 'einsteiger' },

  // Beine
  { key: 'kniebeuge', name: 'Kniebeuge', stimulus: 'kraft', muscle_groups: ['beine', 'gesaess'], equipment: 'langhantel', unit: 'reps_weight', level: 'alle' },
  { key: 'kreuzheben', name: 'Kreuzheben', stimulus: 'kraft', muscle_groups: ['beine', 'ruecken', 'gesaess'], equipment: 'langhantel', unit: 'reps_weight', level: 'fortgeschritten' },
  { key: 'ausfallschritte', name: 'Ausfallschritte', stimulus: 'kraft', muscle_groups: ['beine', 'gesaess'], equipment: 'koerpergewicht', unit: 'reps_weight', level: 'einsteiger' },

  // Rumpf
  { key: 'plank', name: 'Plank', stimulus: 'kraft', muscle_groups: ['rumpf'], equipment: 'koerpergewicht', unit: 'duration', level: 'einsteiger' },
  { key: 'crunches', name: 'Crunches', stimulus: 'kraft', muscle_groups: ['rumpf'], equipment: 'koerpergewicht', unit: 'reps_weight', level: 'einsteiger' },
  { key: 'beinheben', name: 'Beinheben', stimulus: 'kraft', muscle_groups: ['rumpf'], equipment: 'koerpergewicht', unit: 'reps_weight', level: 'alle' },

  // Ausdauer
  { key: 'laufen', name: 'Laufen', stimulus: 'ausdauer', muscle_groups: ['beine', 'herz_kreislauf'], equipment: 'keins', unit: 'distance', level: 'alle' },
  { key: 'radfahren', name: 'Radfahren', stimulus: 'ausdauer', muscle_groups: ['beine', 'herz_kreislauf'], equipment: 'fahrrad', unit: 'distance', level: 'alle' },
  { key: 'schwimmen', name: 'Schwimmen', stimulus: 'ausdauer', muscle_groups: ['ganzkoerper', 'herz_kreislauf'], equipment: 'keins', unit: 'distance', level: 'alle' },
  { key: 'rudergeraet', name: 'Rudergerät', stimulus: 'ausdauer', muscle_groups: ['ruecken', 'beine', 'herz_kreislauf'], equipment: 'rudergeraet', unit: 'distance', level: 'alle' },
];

export function getExercise(key) {
  return EXERCISES.find((e) => e.key === key) ?? null;
}

// Merkt statische Basisübungen und persönliche spo_exercises-Zeilen
// zusammen, ohne die Herkunft zu verlieren — dieselbe Idee wie
// mergeFoods() im Ernährungs-Modul. Eigene Übungen mit gleichem key
// überschreiben die Basisversion (z.B. abgewandelte Variante).
export function mergeExercises(customExercises = []) {
  const byKey = new Map(EXERCISES.map((e) => [e.key, { ...e, custom: false }]));
  for (const row of customExercises) {
    byKey.set(row.key, {
      key: row.key,
      name: row.name,
      stimulus: row.stimulus,
      muscle_groups: row.muscle_groups ?? [],
      equipment: row.equipment,
      unit: 'reps_weight',
      level: 'alle',
      custom: true,
      _rowId: row.id,
    });
  }
  return [...byKey.values()];
}
