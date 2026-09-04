// scripts/optimize-muscle-images.mjs
//
// Erzeugt aus den Original-PNGs in public/images/muscles/_original/ zwei
// WebP-Varianten pro Muskelbild:
//
//   public/images/muscles/thumb/<key>.webp   Höhe 300px — Chips, Pills
//   public/images/muscles/full/<key>.webp    Höhe 866px — Detailansicht
//
// Hintergrund: Die Originale sind ~1,4 MB grosse PNGs mit rund 1050x1500px,
// werden in der UI aber als 48x48- und 20x20-Kacheln gerendert. Ohne diesen
// Schritt laedt die Muskelauswahl bis zu 39 MB fuer Vorschaubilder.
//
// Der Dateiname der Ausgabe ist der `key` aus muscleGroups.js (bereits ein
// URL-sicherer Slug) — damit entfaellt das encodeURI fuer Umlaute und
// Leerzeichen in den Original-Dateinamen.
//
// Aufruf:  npm run images:optimize
// Voraussetzung:  npm i -D sharp
//
// Die Originale bleiben unter public/images/muscles/_original/ liegen, damit
// spaeter groessere Varianten nachgerendert werden koennen. Dieser Ordner
// wird NICHT ins Repo committet (siehe .gitignore) — er ist nur die lokale
// Quelle fuer dieses Skript.

import sharp from 'sharp';
import { mkdir, readdir, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC_DIR = path.join(root, 'public/images/muscles/_original');
const OUT_DIR = path.join(root, 'public/images/muscles');

const VARIANTS = [
  { name: 'thumb', height: 300, quality: 82 },
  { name: 'full',  height: 866, quality: 82 },
];

// Zuordnung Original-Dateiname -> key aus muscleGroups.js.
// Bewusst explizit statt automatisch abgeleitet: die Originalnamen sind
// uneinheitlich (Umlaute, Klammern, fehlende Trennzeichen), eine Slug-Regel
// wuerde frueher oder spaeter danebenliegen.
const FILE_TO_KEY = {
  'BrustGanz.png': 'brust-ganz',
  'RückenGanz.png': 'ruecken-ganz',
  'SchulternGanz.png': 'schultern-ganz',
  'ArmeGanz.png': 'arme-ganz',
  'BeineGanz.png': 'beine-ganz',
  'BauchGanz.png': 'bauch-ganz',
  'Obere Brust.png': 'obere-brust',
  'Mittlereuntere Brust.png': 'mittlere-untere-brust',
  'Vordere Schulter.png': 'vordere-schulter',
  'Seitliche Schulter.png': 'seitliche-schulter',
  'Bizeps.png': 'bizeps',
  'Unterarme.png': 'unterarme',
  'Gerade Bauchmuskeln oben.png': 'bauch-oben',
  'Gerade Bauchmuskeln unten.png': 'bauch-unten',
  'SchrägeSeitliche Bauchmuskeln.png': 'bauch-schraeg',
  'Quadrizeps (Oberschenkel vorne).png': 'quadrizeps',
  'Adduktoren (Oberschenkel innen).png': 'adduktoren',
  'Abduktoren (Oberschenkel außen).png': 'abduktoren',
  'Latissimus.png': 'latissimus',
  'Oberer Rücken ganz.png': 'ruecken-oben',
  'Mittlerer Rücken.png': 'ruecken-mitte',
  'Trapezmuskel (Nacken).png': 'trapezmuskel',
  'Unterer Rücken.png': 'ruecken-unten',
  'Hintere Schulter.png': 'hintere-schulter',
  'Trizeps.png': 'trizeps',
  'Hamstrings (Oberschenkel hinten).png': 'hamstrings',
  'Gluteus.png': 'gluteus',
  'Waden ganz.png': 'waden-ganz',
  'Gastrocnemius.png': 'gastrocnemius',
  'Soleus.png': 'soleus',
};

if (!existsSync(SRC_DIR)) {
  console.error(
    `Quellordner fehlt: ${SRC_DIR}\n` +
      'Lege die Original-PNGs dort ab (Ordner "_original") und starte erneut.'
  );
  process.exit(1);
}

for (const v of VARIANTS) {
  await mkdir(path.join(OUT_DIR, v.name), { recursive: true });
}

const files = (await readdir(SRC_DIR)).filter((f) => /\.png$/i.test(f));
const unbekannt = files.filter((f) => !FILE_TO_KEY[f]);
const fehlend = Object.keys(FILE_TO_KEY).filter((f) => !files.includes(f));

if (unbekannt.length) console.warn('Ohne key-Zuordnung (übersprungen):', unbekannt);
if (fehlend.length) console.warn('Erwartet, aber nicht gefunden:', fehlend);

let vorher = 0;
let nachher = 0;

for (const file of files) {
  const key = FILE_TO_KEY[file];
  if (!key) continue;

  const input = path.join(SRC_DIR, file);
  const bild = sharp(input);
  const meta = await bild.metadata();
  vorher += meta.size ?? 0;

  for (const v of VARIANTS) {
    const ziel = path.join(OUT_DIR, v.name, `${key}.webp`);
    // Nur die Höhe vorgeben: die Originale haben leicht unterschiedliche
    // Seitenverhältnisse (1044x1507 und 1085x1450). Eine feste Breite
    // würde einzelne Figuren verzerren.
    const buf = await sharp(input)
      .resize({ height: v.height, fit: 'inside', withoutEnlargement: true })
      .webp({ quality: v.quality })
      .toBuffer();
    await writeFile(ziel, buf);
    nachher += buf.byteLength;
  }
}

const mb = (n) => `${(n / 1024 / 1024).toFixed(2)} MB`;
console.log(`\n${files.length} Bilder verarbeitet.`);
console.log(`Originale: ${mb(vorher)}  ->  WebP (thumb + full): ${mb(nachher)}`);
