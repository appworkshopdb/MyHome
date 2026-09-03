// Vordefinierte Trainingseinheiten — statischer Referenzinhalt, analog
// zu trainingTypes.js/exercises.js. Erscheinen bei JEDEM Nutzer sofort,
// egal ob gerade zum ersten Mal eingeloggt oder schon lange dabei, weil
// es KEINE DB-Zeilen sind (kein Seeding, kein Backfill nötig) — im
// Gegensatz zu "Deine Einheiten" (spo_units), die jede Person selbst
// anlegt.
//
// muscle_groups referenziert dieselben keys wie muscleGroups.js — die
// Bild-Zuordnung ist damit bereits "getaggt": ein Bild und ein
// vordefinierter Eintrag teilen sich denselben key, keine zusätzliche
// Verknüpfungstabelle nötig. Wird eine Einheit aus dieser Liste
// übernommen (Kalender/Pläne), werden Titel/Typ/Muskeln als Snapshot
// kopiert — wie bei eigenen Einheiten auch, siehe spoData.js.
//
// Deckt die gängigen Splits ab: Ganzkörper, Push/Pull/Legs,
// Ober-/Unterkörper, Antagonisten-Paare, Bro-Split. Bewusst kein
// Anspruch auf Vollständigkeit — Kombinationen mit eigenem Bild
// (MUSCLE_COMBOS in muscleGroups.js) kommen erst, sobald es dafür
// Bilder gibt.

export const PREDEFINED_UNITS = [
  // --- Ganzkörper / große Splits --------------------------------------
  {
    key: 'pre.ganzkoerper', title: 'Ganzkörper', type_key: 'strength.fullbody',
    muscle_groups: ['brust-ganz', 'ruecken-ganz', 'schultern-ganz', 'arme-ganz', 'beine-ganz', 'bauch-ganz'],
  },
  {
    key: 'pre.oberkoerper', title: 'Oberkörper', type_key: 'strength.upper',
    muscle_groups: ['brust-ganz', 'ruecken-ganz', 'schultern-ganz', 'arme-ganz'],
  },
  {
    key: 'pre.unterkoerper', title: 'Unterkörper', type_key: 'strength.lower',
    muscle_groups: ['beine-ganz', 'gluteus'],
  },

  // --- Push / Pull / Legs ----------------------------------------------
  {
    key: 'pre.push', title: 'Push', type_key: 'strength.push',
    muscle_groups: ['brust-ganz', 'schultern-ganz', 'trizeps'],
  },
  {
    key: 'pre.pull', title: 'Pull', type_key: 'strength.pull',
    muscle_groups: ['ruecken-ganz', 'bizeps'],
  },
  {
    key: 'pre.legs', title: 'Legs', type_key: 'strength.legs',
    muscle_groups: ['beine-ganz', 'gluteus'],
  },

  // --- Bro-Split (1 Muskel pro Tag) -----------------------------------
  {
    key: 'pre.brust', title: 'Brust', type_key: 'strength.chest_biceps',
    muscle_groups: ['brust-ganz'],
  },
  {
    key: 'pre.ruecken', title: 'Rücken', type_key: 'strength.back_triceps',
    muscle_groups: ['ruecken-ganz'],
  },
  {
    key: 'pre.schultern', title: 'Schultern', type_key: 'strength.shoulders_arms',
    muscle_groups: ['schultern-ganz'],
  },
  {
    key: 'pre.arme', title: 'Arme', type_key: 'strength.shoulders_arms',
    muscle_groups: ['bizeps', 'trizeps'],
  },
  {
    key: 'pre.bauch', title: 'Bauch', type_key: 'strength.core',
    muscle_groups: ['bauch-ganz'],
  },

  // --- Antagonisten-Paare (häufigster Fall in der Praxis) -------------
  {
    key: 'pre.brust-trizeps', title: 'Brust & Trizeps', type_key: 'strength.chest_biceps',
    muscle_groups: ['brust-ganz', 'trizeps'],
  },
  {
    key: 'pre.ruecken-bizeps', title: 'Rücken & Bizeps', type_key: 'strength.back_triceps',
    muscle_groups: ['ruecken-ganz', 'bizeps'],
  },
  {
    key: 'pre.schultern-bauch', title: 'Schultern & Bauch', type_key: 'strength.shoulders_arms',
    muscle_groups: ['schultern-ganz', 'bauch-ganz'],
  },
  {
    key: 'pre.beine-bauch', title: 'Beine & Bauch', type_key: 'strength.legs',
    muscle_groups: ['beine-ganz', 'bauch-ganz'],
  },
];

export function getPredefinedUnit(key) {
  return PREDEFINED_UNITS.find((u) => u.key === key) ?? null;
}
