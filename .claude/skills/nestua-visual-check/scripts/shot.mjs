// Screenshot einer Route der App mit Testdaten.
//   node shot.mjs <route> <out.png> [light|dark] [view|full]
//   Beispiel: node shot.mjs /sport/auswertung out.png dark view
// H=<px> setzt die Fensterhöhe (Standard 1900; für "so sieht es auf dem Handy aus" H=844 und "view").
// Gibt Konsolenfehler und nicht gemockte Tabellen aus ("UNKNOWN" → in mock.mjs ergänzen).
import { launch, BASE } from './lib.mjs';
import { newPage } from './mock.mjs';

const route = process.argv[2] || '/';
const out = process.argv[3] || 'out.png';
const dark = process.argv[4] === 'dark';
const full = process.argv[5] !== 'view';
const b = await launch();
const { page, errs, unknown } = await newPage(b, { dark, height: Number(process.env.H || 1900), width: Number(process.env.W || 390) });
await page.goto(`${BASE}/#${route}`);
await page.waitForTimeout(2500);
await page.screenshot({ path: out, fullPage: full });
console.log('FEHLER', errs.filter((e) => !/validateDOMNesting/.test(e)).slice(0, 8));
console.log('UNBEKANNT', [...unknown]);
await b.close();
