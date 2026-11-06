// Gibt die aufgelösten Farb-Tokens (Hell und Dunkel) als JSON aus — Grundlage für Mockups.
//   node tokens.mjs
import { launch, BASE } from './lib.mjs';
import { newPage } from './mock.mjs';

const names = ['surface-page', 'surface-raised', 'surface-sunken', 'text-primary', 'text-secondary', 'text-muted', 'border-hairline', 'border-strong', 'status-critical', 'status-positive', 'shadow-card', 'shadow-float', 'r-2xl', 'r-tile', 'r-hero'];
const families = ['fin', 'food', 'sport', 'hab', 'shop'];
const parts = ['tint', 'ink', 'ac', 'on', 'deep', 'hero', 'hero-ink', 'pill'];
const b = await launch();
for (const dark of [false, true]) {
  const { page } = await newPage(b, { dark, height: 900 });
  await page.goto(`${BASE}/#/`);
  await page.waitForTimeout(1500);
  const out = await page.evaluate(([n, f, p]) => {
    const cs = getComputedStyle(document.documentElement);
    const o = {};
    n.forEach((k) => { o[k] = cs.getPropertyValue(`--${k}`).trim(); });
    f.forEach((fam) => p.forEach((part) => { o[`mod-${fam}-${part}`] = cs.getPropertyValue(`--mod-${fam}-${part}`).trim(); }));
    return o;
  }, [names, families, parts]);
  console.log(dark ? 'DARK' : 'LIGHT', JSON.stringify(out));
}
await b.close();
