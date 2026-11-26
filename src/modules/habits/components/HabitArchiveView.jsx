// modules/habits/components/HabitArchiveView.jsx
// Archiv: alle gelöschten Gewohnheiten (eigene und aus Vorlagen übernommene).
// Wiederherstellen, oder aus der Statistik entfernen bzw. wieder einblenden.
// Pausierte Gewohnheiten stehen hier nicht, sie bleiben in der Liste unter "Pausiert".

import { useState, useEffect } from 'react';
import { loadDeletedHabits, restoreHabit, setStatsHidden } from '../lib/habData.js';
import { SkeletonList, ListGroup, ListRow, EmptyState, ErrorState, IconButton } from '../../../core/components/ui';

export default function HabitArchiveView({ onHabitsChange }) {
  const [archived, setArchived] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [busyId, setBusyId]     = useState(null);
  const [error, setError]       = useState(null);

  useEffect(() => {
    let alive = true;
    loadDeletedHabits()
      .then((d) => { if (alive) setArchived(d); })
      .catch(() => { if (alive) setError('Archiv konnte nicht geladen werden.'); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, []);

  async function handleToggleStatsHidden(habit) {
    setBusyId(habit.id);
    setError(null);
    try {
      await setStatsHidden(habit.id, !habit.stats_hidden);
      setArchived(await loadDeletedHabits());
    } catch {
      setError('Konnte nicht geändert werden.');
    } finally {
      setBusyId(null);
    }
  }

  async function handleRestore(habit) {
    setBusyId(habit.id);
    setError(null);
    try {
      await restoreHabit(habit.id, { wasHidden: habit.stats_hidden });
      await onHabitsChange?.();
      setArchived(await loadDeletedHabits());
    } catch {
      setError('Wiederherstellen fehlgeschlagen.');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="hab-archive">
      {error && <ErrorState title={error} />}
      {loading && <SkeletonList rows={4} />}
      {!loading && archived.length === 0 && <EmptyState icon="archive" title="Archiv ist leer" />}
      {!loading && archived.length > 0 && (
        <ListGroup>
          {archived.map((habit) => (
            <ListRow
              key={habit.id}
              className="hab-arow"
              leading={<span className="hab-lead">{habit.icon}</span>}
              title={habit.name}
              sub={[habit.category, `Gelöscht ${new Date(habit.deleted_at).toLocaleDateString('de-DE')}`, habit.stats_hidden && 'ohne Statistik'].filter(Boolean).join(' · ')}
              trailing={(
                <>
                  <IconButton
                    icon={habit.stats_hidden ? 'eye' : 'eyeOff'}
                    label={habit.stats_hidden ? 'In Statistik zeigen' : 'Aus Statistik entfernen'}
                    disabled={busyId === habit.id}
                    onClick={() => handleToggleStatsHidden(habit)}
                  />
                  <IconButton icon="restore" label="Wiederherstellen" disabled={busyId === habit.id} onClick={() => handleRestore(habit)} />
                </>
              )}
            />
          ))}
        </ListGroup>
      )}
    </div>
  );
}
