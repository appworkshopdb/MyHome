// Statischer Referenzinhalt, für alle Nutzer:innen gleich — analog zum
// Übungskatalog (exercises.js). Die Bilder liegen als statische Assets
// in public/images/muscles/thumb/ (wie public/sounds/ beim Feedback-
// System), relativ referenziert (base: './' in vite.config.js — kein
// führender Schrägstrich!).
//
// BILDER: Der Dateiname ist der `key` des Eintrags, das Format ist WebP.
// Die Originale (~1,4 MB PNG je Bild) liegen nur lokal unter
// public/images/muscles/_original/ und werden per `npm run images:optimize`
// in die ausgelieferten Varianten umgerechnet — sie sind bewusst NICHT im
// Repo, sonst würde die Muskelauswahl bis zu 39 MB nachladen für Kacheln,
// die 48x48px groß sind. Neues Bild ergänzen: Original in _original/
// ablegen, Zuordnung in scripts/optimize-muscle-images.mjs eintragen,
// Skript laufen lassen.
//
// DREI EBENEN, nach fachlicher Vorgabe:
//   Muskelgruppen  — grob, der ganze Muskel (6 Stück: Brust, Rücken,
//                    Schultern, Arme, Beine, Bauch)
//   Einzelmuskeln  — fein, ein Teilbereich eines Muskels (24 Stück,
//                    z.B. "Obere Brust", "Hintere Schulter")
//   Kombinationen  — mehrere Muskeln in einer Einheit (z.B. "Brust &
//                    Bizeps") — bewusst LEER, kommt erst, wenn eigene
//                    Bilder dafür existieren. Kein Platzhalter-Eintrag.

export const MUSCLE_LEVELS = ['Muskelgruppen', 'Einzelmuskeln', 'Kombinationen'];

export const MUSCLE_GROUPS = [
  { key: 'brust-ganz', label: 'Brust', level: 'Muskelgruppen' },
  { key: 'ruecken-ganz', label: 'Rücken', level: 'Muskelgruppen' },
  { key: 'schultern-ganz', label: 'Schultern', level: 'Muskelgruppen' },
  { key: 'arme-ganz', label: 'Arme', level: 'Muskelgruppen' },
  { key: 'beine-ganz', label: 'Beine', level: 'Muskelgruppen' },
  { key: 'bauch-ganz', label: 'Bauch', level: 'Muskelgruppen' },
];

export const MUSCLE_SINGLES = [
  // --- Vorne ---------------------------------------------------------
  { key: 'obere-brust', label: 'Obere Brust', level: 'Einzelmuskeln', region: 'Vorne' },
  { key: 'mittlere-untere-brust', label: 'Mittlere/untere Brust', level: 'Einzelmuskeln', region: 'Vorne' },
  { key: 'vordere-schulter', label: 'Vordere Schulter', level: 'Einzelmuskeln', region: 'Vorne' },
  { key: 'seitliche-schulter', label: 'Seitliche Schulter', level: 'Einzelmuskeln', region: 'Vorne' },
  { key: 'bizeps', label: 'Bizeps', level: 'Einzelmuskeln', region: 'Vorne' },
  { key: 'unterarme', label: 'Unterarme', level: 'Einzelmuskeln', region: 'Vorne' },
  { key: 'bauch-oben', label: 'Gerade Bauchmuskeln oben', level: 'Einzelmuskeln', region: 'Vorne' },
  { key: 'bauch-unten', label: 'Gerade Bauchmuskeln unten', level: 'Einzelmuskeln', region: 'Vorne' },
  { key: 'bauch-schraeg', label: 'Schräge/Seitliche Bauchmuskeln', level: 'Einzelmuskeln', region: 'Vorne' },
  { key: 'quadrizeps', label: 'Quadrizeps (Oberschenkel vorne)', level: 'Einzelmuskeln', region: 'Vorne' },
  { key: 'adduktoren', label: 'Adduktoren (Oberschenkel innen)', level: 'Einzelmuskeln', region: 'Vorne' },
  { key: 'abduktoren', label: 'Abduktoren (Oberschenkel außen)', level: 'Einzelmuskeln', region: 'Vorne' },

  // --- Hinten ----------------------------------------------------------
  { key: 'latissimus', label: 'Latissimus', level: 'Einzelmuskeln', region: 'Hinten' },
  { key: 'ruecken-oben', label: 'Oberer Rücken ganz', level: 'Einzelmuskeln', region: 'Hinten' },
  { key: 'ruecken-mitte', label: 'Mittlerer Rücken', level: 'Einzelmuskeln', region: 'Hinten' },
  { key: 'trapezmuskel', label: 'Trapezmuskel (Nacken)', level: 'Einzelmuskeln', region: 'Hinten' },
  { key: 'ruecken-unten', label: 'Unterer Rücken', level: 'Einzelmuskeln', region: 'Hinten' },
  { key: 'hintere-schulter', label: 'Hintere Schulter', level: 'Einzelmuskeln', region: 'Hinten' },
  { key: 'trizeps', label: 'Trizeps', level: 'Einzelmuskeln', region: 'Hinten' },
  { key: 'hamstrings', label: 'Hamstrings (Oberschenkel hinten)', level: 'Einzelmuskeln', region: 'Hinten' },
  { key: 'gluteus', label: 'Gluteus', level: 'Einzelmuskeln', region: 'Hinten' },
  { key: 'waden-ganz', label: 'Waden ganz', level: 'Einzelmuskeln', region: 'Hinten' },
  { key: 'gastrocnemius', label: 'Gastrocnemius', level: 'Einzelmuskeln', region: 'Hinten' },
  { key: 'soleus', label: 'Soleus', level: 'Einzelmuskeln', region: 'Hinten' },
];

// Wird nachträglich befüllt, sobald Kombi-Bilder existieren (z.B.
// { key: 'brust-bizeps', label: 'Brust & Bizeps', level: 'Kombinationen' },
// dazu public/images/muscles/thumb/brust-bizeps.webp). Bewusst leer
// statt erfunden.
export const MUSCLE_COMBOS = [];

export const ALL_MUSCLE_VISUALS = [...MUSCLE_GROUPS, ...MUSCLE_SINGLES, ...MUSCLE_COMBOS];

export function getMuscleVisual(key) {
  return ALL_MUSCLE_VISUALS.find((m) => m.key === key) ?? null;
}

export function muscleVisualsByLevel(level) {
  return ALL_MUSCLE_VISUALS.filter((m) => m.level === level);
}

export function muscleSinglesByRegion(region) {
  return MUSCLE_SINGLES.filter((m) => m.region === region);
}

// Kein encodeURI mehr nötig: die Dateinamen sind jetzt die keys, also
// reine ASCII-Slugs ohne Leerzeichen, Umlaute oder Klammern.
export function muscleImagePath(item) {
  if (!item) return '';
  return `./images/muscles/thumb/${item.key}.webp`;
}

// Große Variante für eine spätere Detailansicht. Wird aktuell nirgends
// verwendet — die full/-Dateien werden deshalb erst erzeugt, wenn es
// eine Ansicht gibt, die sie braucht (siehe optimize-muscle-images.mjs).
export function muscleImagePathFull(item) {
  if (!item) return '';
  return `./images/muscles/full/${item.key}.webp`;
}
