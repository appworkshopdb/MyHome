// Vorgefertigte Trainingspläne, statisch im Frontend — für alle
// Nutzer:innen gleich, deshalb NICHT in spo_plans. Ein Nutzer, der sich
// einen Vorschlag "merkt"/anpasst, bekommt daraus eine eigene Zeile in
// spo_plans + spo_plan_items (source_preset = key hier), siehe
// matching.js für die Auswahllogik.
//
// items[].exercise_key muss auf exercises.js verweisen. target_*-Felder
// spiegeln spo_plan_items, damit "Vorschlag übernehmen" 1:1 kopieren
// kann, ohne Werte umzurechnen.

export const PLANS = [
  {
    key: 'preset.push.einsteiger',
    title: 'Push – Einsteiger',
    type_key: 'strength.push',
    notes: 'Grundlegendes Oberkörper-Drück-Training, 2 Aufwärmsätze nicht mitgezählt.',
    items: [
      { exercise_key: 'bankdruecken', target_sets: 3, target_reps: 10 },
      { exercise_key: 'schulterdruecken', target_sets: 3, target_reps: 10 },
    ],
  },
  {
    key: 'preset.pull.einsteiger',
    title: 'Pull – Einsteiger',
    type_key: 'strength.pull',
    notes: 'Latzug statt Klimmzüge, bis die Kraft für Klimmzüge reicht.',
    items: [
      { exercise_key: 'latzug', target_sets: 3, target_reps: 10 },
      { exercise_key: 'rudern_langhantel', target_sets: 3, target_reps: 10 },
    ],
  },
  {
    key: 'preset.legs.grundlage',
    title: 'Beine – Grundlage',
    type_key: 'strength.legs',
    notes: 'Kniebeuge als Hauptübung, Ausfallschritte zum Ausklang.',
    items: [
      { exercise_key: 'kniebeuge', target_sets: 4, target_reps: 8 },
      { exercise_key: 'ausfallschritte', target_sets: 3, target_reps: 12 },
    ],
  },
  {
    key: 'preset.run.grundlage',
    title: 'Lauf – Grundlage',
    type_key: 'endurance.run',
    notes: 'Lockeres Tempo, Distanz wichtiger als Geschwindigkeit.',
    items: [
      { exercise_key: 'laufen', target_duration_sec: 1800, target_distance_km: 5 },
    ],
  },
];

export function getPlan(key) {
  return PLANS.find((p) => p.key === key) ?? null;
}
