// Zählt alle Gestaltungswerte im CSS und die Inline-Styles im Code der App.
//   node tools/werkstatt/scan.mjs      (läuft auch automatisch bei `npm run werkstatt`)
// Ergebnis: tools/werkstatt/generated/inventory.json (nicht im Git).
// Reine Zählung, ändert nichts an der App. Keine Abhängigkeiten.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const SRC = path.join(ROOT, 'src');
const OUT_DIR = path.join(ROOT, 'tools/werkstatt/generated');
// Hier dürfen feste Farbwerte stehen, überall sonst sollen Tokens benutzt werden.
const TOKEN_FILES = new Set(['src/styles/base.css', 'src/styles/themes.css']);

function walk(dir, exts, out = []) {
  for (const name of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, name.name);
    if (name.isDirectory()) walk(p, exts, out);
    else if (exts.some((e) => name.name.endsWith(e))) out.push(p);
  }
  return out;
}
const rel = (p) => path.relative(ROOT, p).split(path.sep).join('/');

class Counter {
  constructor() { this.map = new Map(); }
  add(value, file) {
    const e = this.map.get(value) ?? { count: 0, files: new Set() };
    e.count += 1; e.files.add(file); this.map.set(value, e);
  }
  get distinct() { return this.map.size; }
  get total() { let n = 0; for (const e of this.map.values()) n += e.count; return n; }
  top(n = 40) {
    return [...this.map.entries()].sort((a, b) => b[1].count - a[1].count || String(a[0]).localeCompare(String(b[0])))
      .slice(0, n).map(([value, e]) => ({ value, count: e.count, files: [...e.files].sort() }));
  }
}

const norm = (v) => v.replace(/!important/g, '').replace(/\s+/g, ' ').trim().toLowerCase();
// rem → px (16 px Basis), damit 0.75rem und 12px als gleicher Wert zählen
function toPx(v) {
  const m = /^(-?\d*\.?\d+)(px|rem)$/.exec(v);
  if (!m) return null;
  const n = m[2] === 'rem' ? parseFloat(m[1]) * 16 : parseFloat(m[1]);
  return Math.round(n * 10) / 10 + 'px';
}

const cssFiles = walk(SRC, ['.css']);
const fontRaw = new Counter(), fontPx = new Counter(), radius = new Counter(), gap = new Counter(),
  padding = new Counter(), shadow = new Counter(), hexAll = new Counter(), hexOutside = new Counter(), btn = new Counter();
const perFile = [];
let cssLines = 0;
let fontVar = 0, fontPxCount = 0, fontRemCount = 0;

for (const file of cssFiles) {
  const text = fs.readFileSync(file, 'utf8');
  const r = rel(file);
  const lines = text.split('\n').length; cssLines += lines;
  const css = text.replace(/\/\*[\s\S]*?\*\//g, '');
  const fonts = new Set();
  for (const m of css.matchAll(/(?<![-\w])font-size\s*:\s*([^;}{]+)/g)) {
    const v = norm(m[1]); fontRaw.add(v, r);
    if (v.startsWith('var(')) { fontVar += 1; continue; }
    if (v.endsWith('px')) fontPxCount += 1; else if (v.endsWith('rem')) fontRemCount += 1;
    const px = toPx(v) ?? v; fontPx.add(px, r); fonts.add(px);
  }
  for (const m of css.matchAll(/(?<![-\w])border-radius\s*:\s*([^;}{]+)/g)) radius.add(norm(m[1]), r);
  for (const m of css.matchAll(/(?<![-\w])gap\s*:\s*([^;}{]+)/g)) gap.add(norm(m[1]), r);
  for (const m of css.matchAll(/(?<![-\w])padding\s*:\s*([^;}{]+)/g)) padding.add(norm(m[1]), r);
  for (const m of css.matchAll(/(?<![-\w])box-shadow\s*:\s*([^;}{]+)/g)) shadow.add(norm(m[1]), r);
  for (const m of css.matchAll(/#[0-9a-fA-F]{3,8}\b/g)) {
    const v = m[0].toLowerCase(); hexAll.add(v, r);
    if (!TOKEN_FILES.has(r)) hexOutside.add(v, r);
  }
  for (const m of css.matchAll(/\.([a-z0-9_-]*(?:btn|button|pill)[a-z0-9_-]*)/gi)) btn.add('.' + m[1], r);
  perFile.push({ path: r, lines, distinctFontSizes: fonts.size });
}

const jsxFiles = walk(SRC, ['.jsx']);
let inlineTotal = 0;
const inlineByFile = [];
for (const file of jsxFiles) {
  const n = (fs.readFileSync(file, 'utf8').match(/style=\{\{/g) ?? []).length;
  inlineTotal += n;
  if (n) inlineByFile.push({ path: rel(file), count: n });
}
inlineByFile.sort((a, b) => b.count - a.count);

const inventory = {
  generated: new Date().toISOString(),
  totals: {
    cssFiles: cssFiles.length, cssLines, jsxFiles: jsxFiles.length, inlineStyles: inlineTotal,
    fontSizeRaw: fontRaw.distinct, fontSizeNormalized: fontPx.distinct, fontSizeUses: fontRaw.total,
    fontSizeVar: fontVar, fontSizePx: fontPxCount, fontSizeRem: fontRemCount,
    radius: radius.distinct, radiusUses: radius.total, gap: gap.distinct, gapUses: gap.total,
    padding: padding.distinct, paddingUses: padding.total, shadow: shadow.distinct,
    hexAll: hexAll.distinct, hexAllUses: hexAll.total, hexOutside: hexOutside.distinct, hexOutsideUses: hexOutside.total,
    buttonClasses: btn.distinct,
  },
  fontSize: fontPx.top(), radius: radius.top(), gap: gap.top(), padding: padding.top(), shadow: shadow.top(),
  hex: hexOutside.top(60), buttonClasses: btn.top(200),
  files: perFile.sort((a, b) => b.lines - a.lines),
  inlineByFile: inlineByFile.slice(0, 25),
};

fs.mkdirSync(OUT_DIR, { recursive: true });
fs.writeFileSync(path.join(OUT_DIR, 'inventory.json'), JSON.stringify(inventory, null, 1));
const t = inventory.totals;
console.log(`Werkstatt-Zählung: ${t.cssFiles} CSS-Dateien (${t.cssLines} Zeilen), ${t.fontSizeNormalized} Schriftgrößen (${t.fontSizeRaw} roh), ${t.radius} Radien, ${t.padding} Paddings, ${t.hexOutside} feste Farben außerhalb der Token-Dateien, ${t.buttonClasses} Button-Klassen, ${t.inlineStyles} Inline-Styles.`);
