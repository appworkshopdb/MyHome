// Gemeinsame Farblogik für eine Kalenderzelle (Tag), genutzt sowohl von
// der Monats- als auch der neuen Wochenansicht — ohne diese Auslagerung
// würden beide Ansichten getrennt gepflegt und könnten auseinanderlaufen
// (z.B. Ruhetag-Muster nur in einer der beiden aktualisiert).
export function computeCellStyle({ dayWorkouts, isSelected, isToday }) {
  // Ruhetage separat behandeln: sie haben status='done' (siehe
  // applyPlan), zählen aber nicht als absolvierte/geplante Einheit —
  // sonst würde ein Ruhetag fälschlich limette gefüllt erscheinen.
  const realWorkouts = dayWorkouts.filter((w) => !w.is_rest);
  const hasDone = realWorkouts.some((w) => w.status === 'done');
  const hasPlanned = realWorkouts.some((w) => w.status !== 'done');
  const hasRest = dayWorkouts.some((w) => w.is_rest);

  const background = isSelected
    ? 'var(--text-primary)'
    : hasDone ? 'var(--accent)'
    : 'transparent';

  // Streifenmuster statt Flächenfarbe: eine reine Graufläche war im
  // Dunkelmodus kontrastarm und kaum von einem leeren Tag zu
  // unterscheiden.
  const restPattern = hasRest && !hasPlanned && !hasDone && !isSelected
    ? 'repeating-linear-gradient(135deg, var(--bg-input), var(--bg-input) 4px, var(--border-strong) 4px, var(--border-strong) 8px)'
    : undefined;

  const color = isSelected
    ? 'var(--bg-primary)'
    : hasDone ? 'var(--on-accent)' : 'var(--text-primary)';

  return {
    background: restPattern ?? background,
    color,
    border: hasPlanned && !hasDone ? '2px solid var(--accent)' : 'none',
    fontWeight: isToday ? 700 : 400,
  };
}
