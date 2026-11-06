// Eigene Vite-Konfiguration NUR für die Design-Werkstatt (Entwicklungswerkzeug).
// Der App-Build (vite.config.js im Hauptordner) kennt diesen Ordner nicht:
// `npm run build` baut ausschließlich die App, die Werkstatt landet weder in dist/ noch im Store.
import { defineConfig } from 'vite';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  root: here,
  base: './',
  server: { port: 5180, strictPort: false, fs: { allow: [path.resolve(here, '../..')] } },
  build: { outDir: path.resolve(here, 'generated/dist'), emptyOutDir: true },
});
