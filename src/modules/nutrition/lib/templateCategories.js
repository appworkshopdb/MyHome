// Kategorien der Rezeptvorlagen. Nichts davon wird gespeichert: jede Kategorie ist
// eine Regel auf den Eigenschaften eines Rezepts (recipeFacts, Nährwerte je Portion),
// ein Rezept kann also in mehreren Kategorien auftauchen. Reine Funktionen.
//
// it = { recipe, facts } (wie in RezepteView). Schwellen stehen bewusst hier an einer
// Stelle, damit sie leicht anzupassen sind.

export const TEMPLATE_CATS = [
  // Nach Mahlzeit (gespeicherte Mahlzeit des Rezepts)
  { key: 'fruehstueck', kind: 'meal', label: 'Frühstück', tone: 'ochre', cover: { name: 'Protein-Overnight-Oats', category: 'fruehstueck' }, test: (it) => it.recipe.category === 'fruehstueck' },
  { key: 'mittag',      kind: 'meal', label: 'Mittag',    tone: 'gruen', cover: { name: 'Reis-Bowl mit Hähnchen & Ei', category: 'mittag' }, test: (it) => it.recipe.category === 'mittag' },
  { key: 'abend',       kind: 'meal', label: 'Abend',     tone: 'blau',  cover: { name: 'Lachs mit Quinoa & Gurke', category: 'abend' }, test: (it) => it.recipe.category === 'abend' },
  { key: 'snack',       kind: 'meal', label: 'Snack',     tone: 'rot',   cover: { name: 'Protein-Shake mit Banane & Magerquark', category: 'snack' }, test: (it) => it.recipe.category === 'snack' },

  // Nach Ziel & Typ (aus Zutaten und Nährwerten abgeleitet)
  { key: 'schnell',   kind: 'theme', label: 'Schnell & einfach',   icon: 'bolt',    tone: 'gruen', hint: 'bis 4 Zutaten',          test: (it) => it.facts.ingCount <= 4 },
  { key: 'suess',     kind: 'theme', label: 'Süßes',               icon: 'sweet',   tone: 'rot',   hint: 'mit Obst oder Honig',     test: (it) => (it.facts.groups.has('Obst') || it.facts.groups.has('Süßungsmittel')) && !it.facts.groups.has('Gemüse') && !it.facts.meat && !it.facts.fish },
  { key: 'sport',     kind: 'theme', label: 'Sportlich',           icon: 'sport',   tone: 'blau',  hint: 'ab 30 g Eiweiß',          perPortion: true, test: (it) => it.facts.protein >= 30 },
  { key: 'pflanzlich', kind: 'theme', label: 'Vegetarisch & vegan', icon: 'leaf',   tone: 'gruen', hint: 'ohne Fleisch und Fisch',  test: (it) => it.facts.vegetarian },
  { key: 'prep',      kind: 'theme', label: 'Meal Prep',           icon: 'box',     tone: 'ochre', hint: 'zum Vorkochen',           test: (it) => it.facts.servings >= 3 || (it.facts.servings >= 2 && ['mittag', 'abend'].includes(it.recipe.category)) },
  { key: 'leicht',    kind: 'theme', label: 'Leicht',              icon: 'feather', tone: 'lila',  hint: 'unter 300 kcal',          perPortion: true, test: (it) => it.facts.kcal < 300 },
  { key: 'fisch',     kind: 'theme', label: 'Fisch & Meer',        icon: 'fish',    tone: 'blau',  hint: 'Fisch, Garnelen & Co.',   test: (it) => it.facts.fish },
  { key: 'lowcarb',   kind: 'theme', label: 'Low Carb',            icon: 'wheat',   tone: 'grau',  hint: 'bis 30 g Kohlenhydrate',  perPortion: true, test: (it) => it.facts.carbs <= 30 },
];

export const TEMPLATE_CAT_BY_KEY = Object.fromEntries(TEMPLATE_CATS.map((c) => [c.key, c]));

// Anzahl Rezepte je Kategorie (items = [{ recipe, facts }])
export function countTemplateCats(items) {
  return Object.fromEntries(TEMPLATE_CATS.map((c) => [c.key, items.filter(c.test).length]));
}
