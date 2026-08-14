// Eigene Pflichtfeld-Spec fürs Sport-Modul — BEWUSST nicht identisch mit
// BODY_REQUIRED_FIELDS aus core/lib/bodyProfileData.js. Würde Sport
// diese Konstante erweitern, würde Ernährung plötzlich training_focus
// einfordern, obwohl es das Feld nicht braucht. Beide Module prüfen
// stattdessen unabhängig gegen dasselbe body_profile-Objekt.
export const SPORT_REQUIRED_FIELDS = [
  { key: 'gender', label: 'Geschlecht' },
  { key: 'age', label: 'Alter' },
  { key: 'weight', label: 'Gewicht' },
  { key: 'goal', label: 'Ziel' },
  { key: 'training_focus', label: 'Trainingsfokus' },
];
