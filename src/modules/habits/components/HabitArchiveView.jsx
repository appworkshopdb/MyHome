// modules/habits/components/HabitArchiveView.jsx
// Archiv: alle gelöschten Gewohnheiten (eigene und aus Vorlagen übernommene).
// Wiederherstellen, oder aus der Statistik entfernen bzw. wieder einblenden.
// Pausierte Gewohnheiten stehen hier nicht, sie bleiben in der Liste unter "Pausiert".

import { useState, useEffect } from 'react';
import { loadDeletedHabits, restoreHabit, setStatsHidden } from '../lib/habData.js';
import Icon from '../../../core/components/Icon';
import { SkeletonList } from '../../../core/components/ui';

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
      setError('Konnte nicht geändert werden. Ist die Migration hab_stats_hidden eingespielt?');
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
      <div className="hab-tl-top">
        <div>
          <h2>Archiv</h2>
          <small>Gelöschte Gewohnheiten, auch aus Vorlagen</small>
        </div>
      </div>
      {error && <div className="toast toast-error">{error}</div>}
      {loading && <SkeletonList rows={4} />}
      {!loading && archived.length === 0 && (
        <div className="hab-empty">
          <div className="hab-empty-icon">📦</div>
          <div className="hab-empty-title">Archiv ist leer</div>
          <div className="hab-empty-text">Gelöschte Gewohnheiten erscheinen hier und können wiederhergestellt werden.</div>
        </div>
      )}
      {!loading && archived.length > 0 && (
        <div className="hab-manage-list">
          {archived.map((habit) => (
            <div key={habit.id} className="hab-manage-card hab-manage-card--paused">
              <div className="hab-manage-card-left">
                <span className="hab-item-icon">{habit.icon}</span>
                <div>
                  <div className="hab-manage-name">{habit.name}</div>
                  <div className="hab-manage-meta">
                    {habit.category} · Gelöscht am {new Date(habit.deleted_at).toLocaleDateString('de-DE')}
                    {habit.stats_hidden ? ' · nicht in Statistik' : ' · in Statistik'}
                  </div>
                </div>
              </div>
              <div className="hab-manage-card-right">
                <button
                  type="button"
                  className="hab-manage-btn hab-manage-btn--text"
                  onClick={() => handleToggleStatsHidden(habit)}
                  disabled={busyId === habit.id}
                >
                  {habit.stats_hidden ? 'In Statistik zeigen' : 'Aus Statistik entfernen'}
                </button>
                <button
                  type="button"
                  className="hab-manage-btn"
                  onClick={() => handleRestore(habit)}
                  disabled={busyId === habit.id}
                  title="Wiederherstellen"
                  aria-label="Wiederherstellen"
                >
                  {busyId === habit.id ? '…' : <Icon name="restore" size={null} className="glyph" />}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
