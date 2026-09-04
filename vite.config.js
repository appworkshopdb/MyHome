import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // Relative Pfade, damit der Build unabhängig vom Repo-Namen auch unter
  // https://<user>.github.io/<repo>/ korrekt lädt (GitHub Pages).
  base: './',

  build: {
    rollupOptions: {
      output: {
        // Grosse Fremdbibliotheken in eigene Dateien trennen. Zweck ist
        // nicht die Startgroesse (das erledigt React.lazy in App.jsx),
        // sondern der Browser-Cache: React und supabase-js aendern sich
        // selten, der eigene Code bei jedem Deploy. Getrennt bleiben die
        // Vendor-Dateien ueber Releases hinweg gueltig und muessen nicht
        // erneut geladen werden.
        manualChunks(id) {
          if (!id.includes('node_modules')) return;
          if (id.includes('chart.js') || id.includes('react-chartjs')) return 'vendor-chart';
          if (id.includes('@dnd-kit')) return 'vendor-dnd';
          if (id.includes('@supabase')) return 'vendor-supabase';
          if (id.includes('/react/') || id.includes('/react-dom/') || id.includes('/scheduler/')) {
            return 'vendor-react';
          }
        },
      },
    },
  },
});
