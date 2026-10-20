import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Eigenständige App (eigener Build, eigene Adresse) — teilt sich mit der
// Nutzer-App nur das Repository. Läuft über Cloudflare Pages mit
// "Root directory = admin" (siehe README.md in diesem Ordner).
export default defineConfig({
  plugins: [react()],
});
