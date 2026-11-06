// Eigene Vite-Konfiguration NUR für die Design-Werkstatt (Entwicklungswerkzeug).
// Der App-Build (vite.config.js im Hauptordner) kennt diesen Ordner nicht:
// `npm run build` baut ausschließlich die App, die Werkstatt landet weder in dist/ noch im Store.
import { defineConfig } from 'vite';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readTokens, writeTokens } from './tokens.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));

// Kleine lokale Schnittstelle zum Lesen und Speichern von design/tokens.json (nur im Entwicklungsserver).
function tokensApi() {
  return {
    name: 'werkstatt-tokens-api',
    configureServer(server) {
      server.middlewares.use('/api/tokens', (req, res) => {
        const send = (code, obj) => { res.statusCode = code; res.setHeader('content-type', 'application/json'); res.end(JSON.stringify(obj)); };
        try {
          if (req.method === 'GET') return send(200, readTokens());
          if (req.method === 'POST') {
            let body = '';
            req.on('data', (c) => { body += c; if (body.length > 100000) req.destroy(); });
            req.on('end', () => {
              try { send(200, { ok: true, tokens: writeTokens(JSON.parse(body).tokens) }); }
              catch (e) { send(400, { ok: false, error: String(e.message || e) }); }
            });
            return undefined;
          }
          return send(405, { ok: false });
        } catch (e) { return send(500, { ok: false, error: String(e.message || e) }); }
      });
    },
  };
}

export default defineConfig({
  root: here,
  base: './',
  plugins: [tokensApi()],
  server: { port: 5180, strictPort: false, fs: { allow: [path.resolve(here, '../..')] } },
  build: { outDir: path.resolve(here, 'generated/dist'), emptyOutDir: true },
});
