// src/modules/sport/lib/dayVisualState.js
// Schritt 3-Fix: Tage werden nicht mehr blau gefüllt.
// Stattdessen: nur Umrandung + kleines Symbol oben rechts.
// hasDone  → blaue Umrandung + Häkchen-Symbol
// hasPlanned → blaue Umrandung + Uhr-Symbol
// isSelected → volle Füllung (Auswahl-Zustand, nicht Training-Zustand)
// hasRest → Streifenmuster (bleibt wie bisher)

export function computeCellStyle({ dayWorkouts, isSelected, isToday }) {
  const realWorkouts = dayWorkouts.filter((w) => !w.is_rest);
  const hasDone    = realWorkouts.some((w) => w.status === 'done');
  const hasPlanned = realWorkouts.some((w) => w.status !== 'done');
  const hasRest    = dayWorkouts.some((w) => w.is_rest);

  // Ausgewählt: volle Füllung — Auswahl-Zustand, kein Training-Feedback
  if (isSelected) {
    return {
      background: 'var(--action-primary)',
      color: 'var(--text-on-accent)',
      border: 'none',
      fontWeight: isToday ? 700 : 400,
      position: 'relative',
    };
  }

  // Ruhetag: Streifenmuster
  if (hasRest && !hasPlanned && !hasDone) {
    return {
      background: 'repeating-linear-gradient(135deg, var(--surface-sunken), var(--surface-sunken) 4px, var(--border-strong) 4px, var(--border-strong) 8px)',
      color: 'var(--text-muted)',
      border: 'none',
      fontWeight: isToday ? 700 : 400,
      position: 'relative',
    };
  }

  // Erledigt oder Geplant: nur Umrandung, transparentes Innere
  if (hasDone || hasPlanned) {
    return {
      background: 'transparent',
      color: 'var(--text-primary)',
      border: '2px solid var(--action-primary)',
      fontWeight: isToday ? 700 : 400,
      position: 'relative', // für das Symbol oben rechts (absolut positioniert in WorkoutCalendar)
    };
  }

  // Kein Training
  return {
    background: 'transparent',
    color: 'var(--text-primary)',
    border: 'none',
    fontWeight: isToday ? 700 : 400,
    position: 'relative',
  };
}

// Welches Symbol oben rechts anzeigen?
// Gibt 'done' | 'planned' | null zurück
export function getCellBadge({ dayWorkouts }) {
  const realWorkouts = dayWorkouts.filter((w) => !w.is_rest);
  if (realWorkouts.some((w) => w.status === 'done'))   return 'done';
  if (realWorkouts.some((w) => w.status !== 'done'))   return 'planned';
  return null;
}
