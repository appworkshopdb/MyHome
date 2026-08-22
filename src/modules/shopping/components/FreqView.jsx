// modules/shopping/components/FreqView.jsx
// Zeigt die am häufigsten gekauften Artikel.
// Tap auf einen Artikel → direkt zu einer Liste hinzufügen.

import { useState, useEffect } from 'react';
import { IconPlus } from '../../../core/components/Icons.jsx';
import { loadFrequentItems, loadLists, saveItem } from '../lib/shoData.js';

export default function FreqView() {
  const [items,    setItems]    = useState([]);
  const [lists,    setLists]    = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [adding,   setAdding]   = useState(null); // name des Items das gerade hinzugefügt wird
  const [feedback, setFeedback] = useState(null); // { name, listName }
  const [error,    setError]    = useState(null);

  useEffect(() => {
    Promise.all([loadFrequentItems(), loadLists()])
      .then(([freq, ls]) => { setItems(freq); setLists(ls); })
      .catch(() => setError('Konnte nicht geladen werden.'))
      .finally(() => setLoading(false));
  }, []);

  async function handleAdd(item) {
    if (lists.length === 0) {
      setError('Erst eine Liste anlegen.');
      return;
    }
    // Zur ersten Liste hinzufügen (oder zur einzigen)
    const target = lists[0];
    setAdding(item.name);
    try {
      await saveItem({
        list_id:  target.id,
        name:     item.name,
        category: item.category,
        quantity: item.quantity ?? null,
        unit:     item.unit ?? null,
      });
      setFeedback({ name: item.name, listName: target.name });
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

      {/* Feedback-Banner */}
      {feedback && (
        <div className="sho-msg-success">
          ✓ „{feedback.name}" zu „{feedback.listName}" hinzugefügt
        </div>
      )}

      {/* Hinweis welche Liste */}
      {lists.length > 0 && (
        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: 16 }}>
          Wird hinzugefügt zu: <strong style={{ color: 'var(--text-primary)' }}>{lists[0].name}</strong>
          {lists.length > 1 && ` (${lists.length} Listen vorhanden)`}
        </div>
      )}

      {/* Leerliste */}
      {items.length === 0 && (
        <div className="sho-empty">
          <div className="sho-empty-icon">📊</div>
          <div className="sho-empty-title">Noch keine Daten</div>
          <div className="sho-empty-text">
            Sobald du Artikel einkaufst, erscheinen hier deine häufigsten.
          </div>
        </div>
      )}

      {/* Häufige Artikel */}
      <div className="sho-freq-list">
        {items.map((item) => (
          <div key={item.name} className="sho-freq-item">
            <div className="sho-freq-info">
              <span className="sho-freq-name">{item.name}</span>
              <span className="sho-freq-meta">
                {item.category && <span className="sho-freq-cat">{item.category}</span>}
                <span className="sho-freq-count">{item.count}× gekauft</span>
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
              disabled={adding === item.name}
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
