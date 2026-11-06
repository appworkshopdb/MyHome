// Tokens der Design-Werkstatt: Datei design/tokens.json (Quelle der Wahrheit) und daraus erzeugtes design/tokens.css.
// tokens.css ist ZUR ZEIT nicht in der App eingebunden. Erst wenn die App auf Tokens umgestellt wird, importiert sie die Datei.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
export const JSON_PATH = path.join(ROOT, 'design/tokens.json');
export const CSS_PATH = path.join(ROOT, 'design/tokens.css');

export function readTokens() {
  return JSON.parse(fs.readFileSync(JSON_PATH, 'utf8'));
}

const num = (v, def, min, max) => (Number.isFinite(v) && v >= min && v <= max ? v : def);
const HEX = /^#[0-9a-fA-F]{6}$/;

// Übernimmt nur bekannte Schlüssel mit gültigen Zahlen/Farben, alles andere fällt auf den gespeicherten Wert zurück.
export function sanitize(input, base) {
  const out = JSON.parse(JSON.stringify(base));
  for (const k of Object.keys(base.type)) {
    const i = input?.type?.[k] ?? {};
    out.type[k] = { size: num(i.size, base.type[k].size, 8, 64), weight: num(i.weight, base.type[k].weight, 400, 900), lh: num(i.lh, base.type[k].lh, 0.9, 2) };
  }
  for (const k of Object.keys(base.space)) out.space[k] = num(input?.space?.[k], base.space[k], 0, 96);
  for (const k of Object.keys(base.radius)) out.radius[k] = num(input?.radius?.[k], base.radius[k], 0, 64);
  for (const k of Object.keys(base.size)) out.size[k] = num(input?.size?.[k], base.size[k], 24, 96);
  out.colors = { light: {}, dark: {} };
  for (const theme of ['light', 'dark']) {
    for (const [group, vals] of Object.entries(input?.colors?.[theme] ?? {})) {
      if (!/^[a-z-]{1,16}$/.test(group) || typeof vals !== 'object') continue;
      for (const [part, hex] of Object.entries(vals)) {
        if (/^[a-z-]{1,16}$/.test(part) && HEX.test(hex)) (out.colors[theme][group] ??= {})[part] = hex.toLowerCase();
      }
    }
  }
  out.status = input?.status === 'Beschlossen' ? 'Beschlossen' : 'Vorschlag';
  return out;
}

export function toCss(t) {
  const lines = ['/* Erzeugt von der Design-Werkstatt aus design/tokens.json. Nicht von Hand ändern. */', ':root {'];
  for (const [k, v] of Object.entries(t.type)) {
    lines.push(`  --fs-${k}: ${v.size}px; --fw-${k}: ${v.weight}; --lh-${k}: ${v.lh};`);
  }
  for (const [k, v] of Object.entries(t.space)) lines.push(`  --sp-${k}: ${v}px;`);
  for (const [k, v] of Object.entries(t.radius)) lines.push(`  --rad-${k}: ${v}px;`);
  lines.push(`  --hit-min: ${t.size.hit}px; --ctl-h: ${t.size.control}px; --ctl-h-sm: ${t.size.controlSm}px;`, '}', '');
  const overrides = JSON.stringify(t.colors);
  lines.push(`/* Farb-Abweichungen (noch nicht ausgegeben, siehe tokens.json): ${overrides} */`, '');
  return lines.join('\n');
}

export function writeTokens(input) {
  const base = readTokens();
  const next = sanitize(input, base);
  fs.writeFileSync(JSON_PATH, JSON.stringify(next, null, 2) + '\n');
  fs.writeFileSync(CSS_PATH, toCss(next));
  return next;
}
