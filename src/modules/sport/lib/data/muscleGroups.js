// Statischer Referenzinhalt, für alle Nutzer:innen gleich — analog zum
// Übungskatalog (exercises.js). Die Bilder liegen als statische Assets
// in public/images/muscles/ (wie public/sounds/ beim Feedback-System),
// relativ referenziert (base: './' in vite.config.js — kein führender
// Schrägstrich!).
//
// DREI EBENEN, nach fachlicher Vorgabe:
//   Muskelgruppen  — grob, der ganze Muskel (6 Stück: Brust, Rücken,
//                    Schultern, Arme, Beine, Bauch)
//   Einzelmuskeln  — fein, ein Teilbereich eines Muskels (24 Stück,
//                    z.B. "Obere Brust", "Hintere Schulter")
//   Kombinationen  — mehrere Muskeln in einer Einheit (z.B. "Brust &
//                    Bizeps") — bewusst LEER, kommt erst, wenn eigene
//                    Bilder dafür existieren. Kein Platzhalter-Eintrag.
//
// `file` ist der EXAKTE, tatsächliche Dateiname (inkl. Leerzeichen/
// Klammern/Umlauten) — bewusst nicht umbenannt, damit die bereits
// erstellten Bilder unverändert hochgeladen werden können. `key` ist
// die technische, URL-/DB-sichere Kennung.

export const MUSCLE_LEVELS = ['Muskelgruppen', 'Einzelmuskeln', 'Kombinationen'];

export const MUSCLE_GROUPS = [
  { key: 'brust-ganz', label: 'Brust', level: 'Muskelgruppen', file: 'BrustGanz.png' },
  { key: 'ruecken-ganz', label: 'Rücken', level: 'Muskelgruppen', file: 'RückenGanz.png' },
  { key: 'schultern-ganz', label: 'Schultern', level: 'Muskelgruppen', file: 'SchulternGanz.png' },
  { key: 'arme-ganz', label: 'Arme', level: 'Muskelgruppen', file: 'ArmeGanz.png' },
  { key: 'beine-ganz', label: 'Beine', level: 'Muskelgruppen', file: 'BeineGanz.png' },
  { key: 'bauch-ganz', label: 'Bauch', level: 'Muskelgruppen', file: 'BauchGanz.png' },
];

export const MUSCLE_SINGLES = [
  // --- Vorne ---------------------------------------------------------
  { key: 'obere-brust', label: 'Obere Brust', level: 'Einzelmuskeln', region: 'Vorne', file: 'Obere Brust.png' },
  { key: 'mittlere-untere-brust', label: 'Mittlere/untere Brust', level: 'Einzelmuskeln', region: 'Vorne', file: 'Mittlereuntere Brust.png' },
  { key: 'vordere-schulter', label: 'Vordere Schulter', level: 'Einzelmuskeln', region: 'Vorne', file: 'Vordere Schulter.png' },
  { key: 'seitliche-schulter', label: 'Seitliche Schulter', level: 'Einzelmuskeln', region: 'Vorne', file: 'Seitliche Schulter.png' },
  { key: 'bizeps', label: 'Bizeps', level: 'Einzelmuskeln', region: 'Vorne', file: 'Bizeps.png' },
  { key: 'unterarme', label: 'Unterarme', level: 'Einzelmuskeln', region: 'Vorne', file: 'Unterarme.png' },
  { key: 'bauch-oben', label: 'Gerade Bauchmuskeln oben', level: 'Einzelmuskeln', region: 'Vorne', file: 'Gerade Bauchmuskeln oben.png' },
  { key: 'bauch-unten', label: 'Gerade Bauchmuskeln unten', level: 'Einzelmuskeln', region: 'Vorne', file: 'Gerade Bauchmuskeln unten.png' },
  { key: 'bauch-schraeg', label: 'Schräge/Seitliche Bauchmuskeln', level: 'Einzelmuskeln', region: 'Vorne', file: 'SchrägeSeitliche Bauchmuskeln.png' },
  { key: 'quadrizeps', label: 'Quadrizeps (Oberschenkel vorne)', level: 'Einzelmuskeln', region: 'Vorne', file: 'Quadrizeps (Oberschenkel vorne).png' },
  { key: 'adduktoren', label: 'Adduktoren (Oberschenkel innen)', level: 'Einzelmuskeln', region: 'Vorne', file: 'Adduktoren (Oberschenkel innen).png' },
  { key: 'abduktoren', label: 'Abduktoren (Oberschenkel außen)', level: 'Einzelmuskeln', region: 'Vorne', file: 'Abduktoren (Oberschenkel außen).png' },

  // --- Hinten ----------------------------------------------------------
  { key: 'latissimus', label: 'Latissimus', level: 'Einzelmuskeln', region: 'Hinten', file: 'Latissimus.png' },
  { key: 'ruecken-oben', label: 'Oberer Rücken ganz', level: 'Einzelmuskeln', region: 'Hinten', file: 'Oberer Rücken ganz.png' },
  { key: 'ruecken-mitte', label: 'Mittlerer Rücken', level: 'Einzelmuskeln', region: 'Hinten', file: 'Mittlerer Rücken.png' },
  { key: 'trapezmuskel', label: 'Trapezmuskel (Nacken)', level: 'Einzelmuskeln', region: 'Hinten', file: 'Trapezmuskel (Nacken).png' },
  { key: 'ruecken-unten', label: 'Unterer Rücken', level: 'Einzelmuskeln', region: 'Hinten', file: 'Unterer Rücken.png' },
  { key: 'hintere-schulter', label: 'Hintere Schulter', level: 'Einzelmuskeln', region: 'Hinten', file: 'Hintere Schulter.png' },
  { key: 'trizeps', label: 'Trizeps', level: 'Einzelmuskeln', region: 'Hinten', file: 'Trizeps.png' },
  { key: 'hamstrings', label: 'Hamstrings (Oberschenkel hinten)', level: 'Einzelmuskeln', region: 'Hinten', file: 'Hamstrings (Oberschenkel hinten).png' },
  { key: 'gluteus', label: 'Gluteus', level: 'Einzelmuskeln', region: 'Hinten', file: 'Gluteus.png' },
  { key: 'waden-ganz', label: 'Waden ganz', level: 'Einzelmuskeln', region: 'Hinten', file: 'Waden ganz.png' },
  { key: 'gastrocnemius', label: 'Gastrocnemius', level: 'Einzelmuskeln', region: 'Hinten', file: 'Gastrocnemius.png' },
  { key: 'soleus', label: 'Soleus', level: 'Einzelmuskeln', region: 'Hinten', file: 'Soleus.png' },
];

// Wird nachträglich befüllt, sobald Kombi-Bilder existieren (z.B.
// { key: 'brust-bizeps', label: 'Brust & Bizeps', level: 'Kombinationen',
//   file: 'BrustBizeps.png' }). Bewusst leer statt erfunden.
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

// encodeURI statt encodeURIComponent: behandelt Leerzeichen/Umlaute in
// den echten Dateinamen korrekt, ohne den Schrägstrich im Pfad selbst
// zu escapen.
export function muscleImagePath(item) {
  if (!item) return '';
  return encodeURI(`./images/muscles/${item.file}`);
}
