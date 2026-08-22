// modules/shopping/components/FreqView.jsx
// Rangliste der häufigsten (abgehakten) Artikel über alle Listen.
// Filter: Top 3 / Top 10 / Top 20.
// Tap + → zur ausgewählten Liste hinzufügen.

import { useState, useEffect } from 'react';
import { IconPlus } from '../../../core/components/Icons.jsx';
import { loadFrequentItems, loadLists, saveItem } from '../lib/shoData.js';

const LIMITS = [
  { label: 'Top 3',  value: 3  },
  { label: 'Top 10', value: 10 },
  { label: 'Top 20', value: 20 },
];

export default function FreqView() {
  const [allItems,  setAllItems]  = useState([]);   // alle freq items ungefiltert
  const [lists,     setLists]     = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [limit,     setLimit]     = useState(10);   // aktiver Filter
  const [targetId,  setTargetId]  = useState(null); // welche Liste
  const [adding,    setAdding]    = useState(null);
  const [feedback,  setFeedback]  = useState(null);
  const [error,     setError]     = useState(null);

  useEffect(() => {
    Promise.all([loadFrequentItems(20), loadLists()])
      .then(([freq, ls]) => {
        setAllItems(freq);
        setLists(ls);
        if (ls.length > 0) setTargetId(ls[0].id);
      })
      .catch(() => setError('Konnte nicht geladen werden.'))
      .finally(() => setLoading(false));
  }, []);

  const items       = allItems.slice(0, limit);
  const targetList  = lists.find((l) => l.id === targetId);
  const totalUnique = allItems.length;

  async function handleAdd(item) {
    if (!targetId) { setError('Bitte eine Zielliste wählen.'); return; }
    setAdding(item.name);
    try {
      await saveItem({
        list_id:  targetId,
        name:     item.name,
        category: item.category,
        quantity: item.quantity ?? null,
        unit:     item.unit    ?? null,
      });
      setFeedback({ name: item.name, listName: targetList?.name });
      setTimeout(() => setFeedback(null), 2500);
    } catch {
      setError('Hinzufügen fehlgeschlagen.');
    } finally {
      setAdding(null);
    }
  }

  if (loading) return <div className="page-loading">Wird geladen …</div>;

  return (
    <div>
      {error && (
        <div style={{ fontSize: '0.85rem', color: 'var(--danger)', marginBottom: 12 }}>
          {error}
        </div>
      )}

      {feedback && (
        <div className="sho-msg-success">
          ✓ „{feedback.name}" zu „{feedback.listName}" hinzugefügt
        </div>
      )}

      {/* Zielliste wählen */}
      {lists.length > 1 && (
        <div className="sho-freq-controls">
          <label className="sho-freq-label">Hinzufügen zu</label>
          <select
            value={targetId || ''}
            onChange={(e) => setTargetId(e.target.value)}
            className="sho-unit-select"
            style={{ flex: 1 }}
          >
            {lists.map((l) => (
              <option key={l.id} value={l.id}>{l.icon || '🛒'} {l.name}</option>
            ))}
          </select>
        </div>
      )}
      {lists.length === 1 && (
        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: 12 }}>
          Wird hinzugefügt zu: <strong style={{ color: 'var(--text-primary)' }}>{lists[0].name}</strong>
        </div>
      )}

      {/* Top-Filter Pills */}
      <div className="sho-freq-filter">
        {LIMITS.map((l) => (
          <button
            key={l.value}
            className={`sho-freq-pill ${limit === l.value ? 'active' : ''}`}
            onClick={() => setLimit(l.value)}
          >
            {l.label}
          </button>
        ))}
        {totalUnique > 0 && (
          <span className="sho-freq-total">{totalUnique} verschiedene Artikel</span>
        )}
      </div>

      {/* Leerliste */}
      {allItems.length === 0 && (
        <div className="sho-empty">
          <div className="sho-empty-icon">📊</div>
          <div className="sho-empty-title">Noch keine Daten</div>
          <div className="sho-empty-text">
            Hak Artikel in deinen Listen ab — sie erscheinen hier sobald du mindestens 2 verschiedene Artikel erledigt hast.
          </div>
        </div>
      )}

      {/* Rangliste */}
      <div className="sho-freq-list">
        {items.map((item, index) => (
          <div key={item.name} className="sho-freq-item">

            {/* Rang-Nummer */}
            <div className="sho-freq-rank">
              {index === 0 && <span className="sho-freq-medal">🥇</span>}
              {index === 1 && <span className="sho-freq-medal">🥈</span>}
              {index === 2 && <span className="sho-freq-medal">🥉</span>}
              {index >= 3  && <span className="sho-freq-ranknum">{index + 1}</span>}
            </div>

            <div className="sho-freq-info">
              <span className="sho-freq-name">{item.name}</span>
              <span className="sho-freq-meta">
                {item.category && (
                  <span className="sho-freq-cat">{item.category}</span>
                )}
                <span className="sho-freq-count">{item.count}× abgehakt</span>
                {(item.quantity || item.unit) && (
                  <span className="sho-freq-qty">
                    {item.quantity && item.unit
                      ? `${item.quantity} ${item.unit}`
                      : item.quantity ?? item.unit}
                  </span>
                )}
              </span>
            </div>

            <button
              className="sho-freq-add"
              onClick={() => handleAdd(item)}
              disabled={adding === item.name || !targetId}
              aria-label={`${item.name} zur Liste hinzufügen`}
            >
              {adding === item.name
                ? <span style={{ fontSize: '0.8rem' }}>…</span>
                : <IconPlus />}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
