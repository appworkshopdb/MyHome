// Ein Design, zwei Modi: Hell und Dunkel (plus "System"). Die frühere
// Auswahl aus 4 Farbvorlagen wurde entfernt — das Design ist jetzt fest
// auf Schwarz/Weiß + einem Akzent (Limette) angelegt, wie in den
// Referenz-Mockups festgelegt. Die Auswahl bleibt bewusst in localStorage
// (Geräte-Einstellung, nicht Kontodaten) — so kann dasselbe Konto auf dem
// Handy dunkel und am Desktop hell laufen.

export const MODES = [
  { key: 'light', label: 'Hell' },
  { key: 'dark', label: 'Dunkel' },
  { key: 'auto', label: 'System' },
];

export function getThemePref() {
  return {
    mode: localStorage.getItem('mode') || 'auto',
  };
}

export function isDarkActive(mode) {
  return (
    mode === 'dark' ||
    (mode === 'auto' && window.matchMedia('(prefers-color-scheme: dark)').matches)
  );
}

export function applyTheme(mode) {
  const root = document.documentElement;
  root.classList.toggle('dark', isDarkActive(mode));

  // PWA-/Browserleisten-Farbe an die aktive Fläche angleichen
  const bg = getComputedStyle(root).getPropertyValue('--bg-primary').trim();
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta && bg) meta.setAttribute('content', bg);
}
