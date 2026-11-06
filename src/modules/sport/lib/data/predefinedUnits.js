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
// Verknüpfungstabelle nötig.
//
// type_key: NUR gesetzt, wenn das Label aus trainingTypes.js exakt zum
// Titel hier passt (z.B. 'strength.chest_biceps' → "Brust & Bizeps").
// Sonst bewusst null statt eines mismatchenden Typs — ein früherer
// Entwurf hatte hier mehrfach falsch zugeordnete Typen (z.B. "Rücken &
// Bizeps" mit dem Typ von "Rücken & Trizeps"), was einen irreführenden
// Untertitel erzeugte. "Kein Typ" ist ehrlicher als ein falscher.

export const PREDEFINED_UNITS = [
  // --- Ganzkörper / große Splits — type_key passt exakt ---------------
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

  // --- Push / Pull / Legs — type_key passt exakt ------------------------
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

  // --- Bro-Split (1 Muskel pro Tag) — kein passender Typ vorhanden ----
  { key: 'pre.brust', title: 'Brust', type_key: null, muscle_groups: ['brust-ganz'] },
  { key: 'pre.ruecken', title: 'Rücken', type_key: null, muscle_groups: ['ruecken-ganz'] },
  { key: 'pre.schultern', title: 'Schultern', type_key: null, muscle_groups: ['schultern-ganz'] },
  { key: 'pre.arme', title: 'Arme', type_key: null, muscle_groups: ['bizeps', 'trizeps'] },
  { key: 'pre.bauch', title: 'Bauch', type_key: null, muscle_groups: ['bauch-ganz'] },

  // --- Kombinationen (Antagonisten-Paare + Nachbar-Regionen) ----------
  // Brust und Rücken jeweils mit BEIDEN Arm-Varianten (Bizeps ODER
  // Trizeps) — manche bevorzugen die eine, manche die andere Zuordnung.
  {
    key: 'pre.brust-bizeps', title: 'Brust & Bizeps', type_key: 'strength.chest_biceps',
    muscle_groups: ['brust-ganz', 'bizeps'],
  },
  {
    key: 'pre.brust-trizeps', title: 'Brust & Trizeps', type_key: null,
    muscle_groups: ['brust-ganz', 'trizeps'],
  },
  {
    key: 'pre.ruecken-trizeps', title: 'Rücken & Trizeps', type_key: 'strength.back_triceps',
    muscle_groups: ['ruecken-ganz', 'trizeps'],
  },
  {
    key: 'pre.ruecken-bizeps', title: 'Rücken & Bizeps', type_key: null,
    muscle_groups: ['ruecken-ganz', 'bizeps'],
  },
  {
    key: 'pre.brust-bauch', title: 'Brust & Bauch', type_key: null,
    muscle_groups: ['brust-ganz', 'bauch-ganz'],
  },
  {
    key: 'pre.ruecken-schultern', title: 'Rücken & Schultern', type_key: null,
    muscle_groups: ['ruecken-ganz', 'schultern-ganz'],
  },
  {
    key: 'pre.schultern-bauch', title: 'Schultern & Bauch', type_key: null,
    muscle_groups: ['schultern-ganz', 'bauch-ganz'],
  },
  {
    key: 'pre.brust-schultern', title: 'Brust & Schultern', type_key: null,
    muscle_groups: ['brust-ganz', 'schultern-ganz'],
  },
  {
    key: 'pre.beine-bauch', title: 'Beine & Bauch', type_key: null,
    muscle_groups: ['beine-ganz', 'bauch-ganz'],
  },
  // Aus den Trainingstypen übernommen, damit auch diese Kombinationen im Plan wählbar sind
  {
    key: 'pre.schultern-arme', title: 'Schultern & Arme', type_key: 'strength.shoulders_arms',
    muscle_groups: ['schultern-ganz', 'arme-ganz'],
  },
  {
    key: 'pre.gesaess-beinrueckseite', title: 'Gesäß & Beinrückseite', type_key: 'strength.glutes',
    muscle_groups: ['gluteus', 'hamstrings'],
  },
  {
    key: 'pre.rumpf-bauch', title: 'Rumpf & Bauch', type_key: 'strength.core',
    muscle_groups: ['bauch-ganz', 'ruecken-unten'],
  },

  // --- Ausdauer, Beweglichkeit & Erholung — aus den Trainingstypen ------
  // Noch ohne Muskelbilder: `icon` ist ein Platzhalter (Emoji) bis es feste Bilder
  // je Einheit gibt. Titel NIE ändern: gespeicherte Plan-Tage finden Bild und Icon
  // über den Titel.
  { key: 'pre.lauf', title: 'Lauf', type_key: 'endurance.run', muscle_groups: [], icon: '🏃' },
  { key: 'pre.langer-lauf', title: 'Langer Lauf', type_key: 'endurance.long', muscle_groups: [], icon: '🏃' },
  { key: 'pre.intervalle', title: 'Intervalltraining', type_key: 'endurance.intervals', muscle_groups: [], icon: '⏱️' },
  { key: 'pre.hiit', title: 'HIIT / Zirkel', type_key: 'endurance.hiit', muscle_groups: [], icon: '🔥' },
  { key: 'pre.rad', title: 'Radfahren', type_key: 'endurance.bike', muscle_groups: [], icon: '🚴' },
  { key: 'pre.schwimmen', title: 'Schwimmen', type_key: 'endurance.swim', muscle_groups: [], icon: '🏊' },
  { key: 'pre.rudern', title: 'Rudern / Ergometer', type_key: 'endurance.row', muscle_groups: [], icon: '🚣' },
  { key: 'pre.walking', title: 'Walking', type_key: 'endurance.walk', muscle_groups: [], icon: '🚶' },
  { key: 'pre.mobilitaet', title: 'Mobilität', type_key: 'mobility.general', muscle_groups: [], icon: '🤸' },
  { key: 'pre.dehnen', title: 'Dehnen', type_key: 'mobility.stretching', muscle_groups: [], icon: '🧎' },
  { key: 'pre.yoga', title: 'Yoga', type_key: 'mobility.yoga', muscle_groups: [], icon: '🧘' },
  { key: 'pre.erholung', title: 'Aktive Erholung', type_key: 'recovery.active', muscle_groups: [], icon: '🌿' },
];

export function getPredefinedUnit(key) {
  return PREDEFINED_UNITS.find((u) => u.key === key) ?? null;
}
