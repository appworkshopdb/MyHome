// modules/shopping/lib/recipeImport.js
// Reine Rechenlogik für "Rezept → Einkaufsliste": Zutaten auf Portionen
// umrechnen, Kategorie bestimmen, mit vorhandenen Artikeln der Liste
// zusammenführen. Kein Netzwerk — die Schreibzugriffe stehen in shoData.js
// (applyShoppingPlan), die Oberfläche in core/components/RecipeToShoppingSheet.jsx.

import { CATEGORY_MAP, getCategory } from './data/items.js';

// Einheiten der Lebensmittel (nut_foods.unit): alles außer diesen gilt als Gramm.
const FOOD_UNITS = ['ml', 'Scheibe', 'Stück', 'Zehe', 'EL'];

const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

// ─── Mengen ───────────────────────────────────────────────────
// g/kg und ml/L sind miteinander verrechenbar, alles andere nur bei gleicher Einheit.
function baseOf(qty, unit) {
  if (unit === 'kg') return { qty: qty * 1000, key: 'g' };
  if (unit === 'L')  return { qty: qty * 1000, key: 'ml' };
  return { qty, key: unit || 'Stück' }; // Menge ohne Einheit meint Stück
}

// 1500 g → 1,5 kg, 1200 ml → 1,2 L, sonst unverändert.
export function normalizeAmount(qty, unit) {
  const { qty: q, key } = baseOf(qty, unit);
  if (key === 'g'  && q >= 1000) return { quantity: round2(q / 1000), unit: 'kg' };
  if (key === 'ml' && q >= 1000) return { quantity: round2(q / 1000), unit: 'L' };
  return { quantity: round2(q), unit: key === 'Stück' && !unit ? null : key };
}

const nf = new Intl.NumberFormat('de-DE', { maximumFractionDigits: 2 });
export function fmtAmount(qty, unit) {
  if (qty == null) return unit || '';
  const n = normalizeAmount(qty, unit);
  return `${nf.format(n.quantity)}${n.unit ? ` ${n.unit}` : ''}`;
}

// ─── Basis-Zutaten ────────────────────────────────────────────
// Hat man meist im Haus (Salz, Öl, Gewürze …): nicht vorgewählt.
const BASIC_NAME = /(^|\s)(salz|pfeffer|wasser|zucker|essig)(\s|$)|öl(\s|$)/i;
export function isBasic(food) {
  return food.group === 'Gewürze' || BASIC_NAME.test(food.name || '');
}

// ─── Kategorie ────────────────────────────────────────────────
const GROUP_TO_CATEGORY = [
  [/obst|gemüse/i,            'Obst & Gemüse'],
  [/milch|eier|käse/i,        'Milch & Eier'],
  [/fleisch|fisch|wurst/i,    'Fleisch & Fisch'],
  [/tiefkühl/i,               'Tiefkühl'],
  [/getränk/i,                'Getränke'],
  [/snack|süß|nüsse/i,        'Snacks & Süßes'],
  [/brot|back/i,              'Brot & Backwaren'],
  [/getreide|nudel|reis|hülsen/i, 'Nudeln & Reis'],
  [/fett|öl|gewürz|soße|sauce/i,  'Vorrat'],
];

export function categoryFor(name, group) {
  const exact = getCategory(name);
  if (exact !== 'Sonstiges') return exact;
  // "Rote Linsen" → über das Einzelwort "Linsen"
  const words = String(name).toLowerCase().split(/[\s(),/-]+/).filter(Boolean);
  for (const w of words) {
    const hit = Object.keys(CATEGORY_MAP).find((k) => k.toLowerCase() === w);
    if (hit) return CATEGORY_MAP[hit];
  }
  for (const [re, cat] of GROUP_TO_CATEGORY) {
    if (group && re.test(group)) return cat;
  }
  return 'Sonstiges';
}

// ─── Zutaten eines Rezepts ────────────────────────────────────
// Das Rezept ist für `servings` Portionen angelegt; `portions` rechnet um.
// Zutaten ohne Lebensmittel (gelöscht) werden übersprungen.
export function recipeRows(recipe, foodsById, portions) {
  const base = Math.max(1, recipe.servings || 1);
  const factor = portions / base;
  const rows = [];
  (recipe.ingredients || []).forEach((ing, idx) => {
    const food = foodsById[ing.foodId];
    if (!food) return;
    const unit = FOOD_UNITS.includes(food.unit) ? food.unit : 'g';
    const amount = (Number(ing.amount) || 0) * factor;
    if (amount <= 0) return;
    rows.push({
      key:      String(idx),
      name:     food.name,
      amount,
      unit,
      category: categoryFor(food.name, food.group),
      basic:    isBasic(food),
    });
  });
  return rows;
}

// ─── Zusammenführen ───────────────────────────────────────────
// Gleicher Name (ohne Groß-/Kleinschreibung) und verrechenbare Einheit.
// Ein Artikel ohne Menge und Einheit passt zu jeder Einheit.
function matches(item, row) {
  if ((item.name || '').trim().toLowerCase() !== row.name.trim().toLowerCase()) return false;
  if (item.quantity == null && !item.unit) return true;
  return baseOf(1, item.unit).key === baseOf(1, row.unit).key;
}

function sumOf(item, row) {
  if (item.quantity == null && !item.unit) return normalizeAmount(row.amount, row.unit);
  const a = baseOf(item.quantity ?? 0, item.unit);
  const b = baseOf(row.amount, row.unit);
  return normalizeAmount(a.qty + b.qty, a.key);
}

// Vorschau für eine einzelne Zutat gegen die offenen Artikel: { from, to } oder null.
export function mergeHint(row, openItems) {
  const hit = openItems.find((i) => matches(i, row));
  if (!hit) return null;
  const to = sumOf(hit, row);
  return { from: fmtAmount(hit.quantity, hit.unit) || 'ohne Menge', to: fmtAmount(to.quantity, to.unit) };
}

// Rechnet die gewählten Zutaten gegen die offenen Artikel der Liste.
// Mehrere Zutaten mit gleichem Namen laufen nacheinander zusammen.
// openItems: nicht abgehakte, nicht gelöschte Artikel { id, name, quantity, unit, note }.
export function planImport(rows, openItems, recipeName) {
  const work = openItems.map((i) => ({ ...i, prev: { quantity: i.quantity ?? null, unit: i.unit ?? null, note: i.note ?? null } }));
  const adds = [];
  const touched = new Map(); // id → Eintrag in work

  for (const row of rows) {
    const hit = work.find((i) => matches(i, row));
    if (hit) {
      const to = sumOf(hit, row);
      hit.quantity = to.quantity;
      hit.unit = to.unit;
      if (!hit.isNew) {
        const had = hit.note || '';
        if (!had.includes(recipeName)) hit.note = had ? `${had} + ${recipeName}` : `inkl. ${recipeName}`;
        touched.set(hit.id, hit);
      }
    } else {
      const n = normalizeAmount(row.amount, row.unit);
      const add = { name: row.name, category: row.category, quantity: n.quantity, unit: n.unit, note: `für ${recipeName}` };
      adds.push(add);
      work.push({ ...add, isNew: true, add });
    }
  }
  // Mengen neu angelegter Artikel nachtragen, falls später noch eine gleiche Zutat dazukam
  for (const w of work) if (w.isNew) { w.add.quantity = w.quantity; w.add.unit = w.unit; }

  const updates = [...touched.values()].map((w) => ({
    id: w.id, quantity: w.quantity, unit: w.unit, note: w.note, prev: w.prev,
  }));
  return { adds, updates };
}

// ─── Nicht gekaufte Artikel auf eine andere Liste übertragen ──
// Gleiche Regeln wie beim Rezept-Import, nur mit Artikeln statt Zutaten: steht ein Artikel
// (gleicher Name, verrechenbare Einheit) dort schon offen drauf, wird aufgestockt. Artikel ohne
// Menge sind möglich: kennt eine Seite keine Menge, bleibt die der anderen.
// items: { name, category, quantity, unit, note, item_store_name }; targetOpen: offene Artikel
// der Zielliste. Liefert wie planImport { adds, updates } plus `merged` (Anzahl zusammengeführt).
function sameName(a, b) { return (a.name || '').trim().toLowerCase() === (b.name || '').trim().toLowerCase(); }
function comparable(target, item) {
  const noAmount = (x) => x.quantity == null && !x.unit;
  if (noAmount(target) || noAmount(item)) return true;
  return baseOf(1, target.unit).key === baseOf(1, item.unit).key;
}

export function planTransfer(items, targetOpen) {
  const work = targetOpen.map((i) => ({ ...i, prev: { quantity: i.quantity ?? null, unit: i.unit ?? null, note: i.note ?? null } }));
  const adds = [];
  const touched = new Map();
  let merged = 0;

  for (const it of items) {
    const hit = work.find((w) => sameName(w, it) && comparable(w, it));
    if (!hit) {
      const add = {
        name: it.name, category: it.category ?? null, quantity: it.quantity ?? null, unit: it.unit ?? null,
        note: it.note ?? null, item_store_name: it.item_store_name ?? null,
      };
      adds.push(add);
      work.push({ ...add, isNew: true, add });
      continue;
    }
    merged += 1;
    if (it.quantity != null) {
      if (hit.quantity == null && !hit.unit) {
        hit.quantity = it.quantity;
        hit.unit = it.unit ?? null;
      } else {
        const a = baseOf(hit.quantity ?? 0, hit.unit);
        const b = baseOf(it.quantity, it.unit);
        const n = normalizeAmount(a.qty + b.qty, a.key);
        hit.quantity = n.quantity;
        hit.unit = n.unit;
      }
    }
    if (it.note) {
      // "für Suppe" an "für Pasta" hängen: "für Pasta + Suppe"
      const extra = it.note.replace(/^(für|inkl\.)\s+/i, '');
      if (!(hit.note || '').includes(extra)) hit.note = hit.note ? `${hit.note} + ${extra}` : it.note;
    }
    if (!hit.isNew) touched.set(hit.id, hit);
  }
  for (const w of work) if (w.isNew) { w.add.quantity = w.quantity ?? null; w.add.unit = w.unit ?? null; w.add.note = w.note ?? null; }

  const updates = [...touched.values()].map((w) => ({
    id: w.id, quantity: w.quantity ?? null, unit: w.unit ?? null, note: w.note ?? null, prev: w.prev,
  }));
  return { adds, updates, merged };
}

// Vorschau für einen Artikel gegen die offenen Artikel der Zielliste:
// null (neue Zeile) oder 'steht schon drauf' bzw. 'steht schon drauf: 200 g → 250 g'.
export function transferHint(item, targetOpen) {
  const hit = targetOpen.find((w) => sameName(w, item) && comparable(w, item));
  if (!hit) return null;
  if (item.quantity == null) return 'steht schon drauf';
  const probe = planTransfer([item], [hit]);
  const to = probe.updates[0];
  if (!to || to.quantity == null) return 'steht schon drauf';
  const from = fmtAmount(hit.quantity, hit.unit);
  return from ? `steht schon drauf: ${from} → ${fmtAmount(to.quantity, to.unit)}` : 'steht schon drauf';
}
