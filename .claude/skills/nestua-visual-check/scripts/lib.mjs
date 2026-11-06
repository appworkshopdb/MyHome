// Findet Playwright und Chromium, egal ob lokal installiert oder wie in der Cloud-Sitzung vorinstalliert.
import fs from 'fs';

const PLAYWRIGHT_PATHS = [
  '/opt/node22/lib/node_modules/playwright/index.mjs',
  '/usr/lib/node_modules/playwright/index.mjs',
  '/usr/local/lib/node_modules/playwright/index.mjs',
];
const CHROMIUM_PATHS = ['/opt/pw-browsers/chromium'];

export async function launch() {
  let pw;
  try { pw = await import('playwright'); } catch { /* nächster Weg */ }
  if (!pw) {
    const p = PLAYWRIGHT_PATHS.find((x) => fs.existsSync(x));
    if (!p) throw new Error('Playwright nicht gefunden. Installieren (npm i -D playwright) oder Pfad in lib.mjs ergänzen.');
    pw = await import(p);
  }
  const executablePath = CHROMIUM_PATHS.find((x) => fs.existsSync(x));
  return pw.chromium.launch(executablePath ? { executablePath } : {});
}

export const BASE = process.env.NESTUA_URL || 'http://127.0.0.1:5173';
