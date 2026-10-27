// Bewusst in core/, nicht in modules/finance/lib/finance.js — der Hub
// darf laut Architektur-Regel nicht aus einem Modul importieren, auch
// nicht nur für eine Formatierungsfunktion.

export function formatEur(val) {
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(val || 0);
}

export function formatRelativeDate(isoDate) {
  const date = new Date(isoDate);
  const today = new Date();
  const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diffDays = Math.round((startOfDay(today) - startOfDay(date)) / 86400000);

  if (diffDays === 0) return 'Heute';
  if (diffDays === 1) return 'Gestern';
  if (diffDays > 1 && diffDays < 7) return `Vor ${diffDays} Tagen`;
  return date.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
}
