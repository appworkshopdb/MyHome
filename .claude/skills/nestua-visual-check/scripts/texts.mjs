// Prüft mehrere Routen auf Text (z. B. "es darf nirgends mehr eine Dauer stehen").
//   node texts.mjs "<regex>" /route1 /route2 ...
//   Beispiel: node texts.mjs "\d+ Min" / /sport /sport/kalender
import { launch, BASE } from './lib.mjs';
import { newPage } from './mock.mjs';

const [pattern, ...routes] = process.argv.slice(2);
const re = new RegExp(pattern, 'g');
const b = await launch();
const { page, errs } = await newPage(b, { height: 1400 });
for (const r of routes) {
  await page.goto(`${BASE}/#${r}`);
  await page.waitForTimeout(1500);
  const text = await page.evaluate(() => document.body.innerText);
  const hits = [...text.matchAll(new RegExp(`[^\\n]*(?:${pattern})[^\\n]*`, 'g'))].map((m) => m[0]);
  console.log(r, hits.length ? hits : 'keine Treffer');
}
console.log('FEHLER', errs.filter((e) => !/validateDOMNesting/.test(e)).slice(0, 5));
await b.close();
