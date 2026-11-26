// modules/shopping/components/FreqView.jsx
// Rangliste der häufigsten (abgehakten) Artikel über alle Listen.
// Filter: Top 3 / Top 10 / Top 20.
// Tap + → zur ausgewählten Liste hinzufügen.

import { useState, useEffect } from 'react';
import { useUi } from '../../../core/lib/UiContext';
import { loadFrequentItems, loadLists, saveItem } from '../lib/shoData.js';
import { SkeletonList, ListGroup, ListRow, FilterChip, EmptyState, ErrorState, IconButton, Field } from '../../../core/components/ui';

const LIMITS = [
  { label: 'Top 3',  value: 3  },
  { label: 'Top 10', value: 10 },
  { label: 'Top 20', value: 20 },
];

export default function FreqView() {
  const { showToast } = useUi();
  const [allItems,  setAllItems]  = useState([]);   // alle freq items ungefiltert
  const [lists,     setLists]     = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [limit,     setLimit]     = useState(10);   // aktiver Filter
  const [targetId,  setTargetId]  = useState(null); // welche Liste
  const [adding,    setAdding]    = useState(null);
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
    if (!targetId) { setError('Keine Zielliste gewählt.'); return; }
    setAdding(item.name);
    try {
      await saveItem({
        list_id:  targetId,
        name:     item.name,
        category: item.category,
        quantity: item.quantity ?? null,
        unit:     item.unit    ?? null,
      });
      showToast(`„${item.name}“ zu „${targetList?.name}“ hinzugefügt`);
    } catch {
      setError('Hinzufügen fehlgeschlagen.');
    } finally {
      setAdding(null);
    }
  }

  if (loading) return <SkeletonList rows={5} />;

  return (
    <div className="sho-freq-view">
      {error && <ErrorState title={error} />}

      {lists.length > 1 && (
        <Field label="Hinzufügen zu" htmlFor="sho-freq-target">
          <select id="sho-freq-target" value={targetId || ''} onChange={(e) => setTargetId(e.target.value)} className="ui-input">
            {lists.map((l) => (
              <option key={l.id} value={l.id}>{l.icon || '🛒'} {l.name}</option>
            ))}
          </select>
        </Field>
      )}

      <div className="sho-freq-filter">
        {LIMITS.map((l) => (
          <FilterChip key={l.value} selected={limit === l.value} onClick={() => setLimit(l.value)}>{l.label}</FilterChip>
        ))}
        {totalUnique > 0 && <span className="sho-freq-total">{totalUnique} Artikel</span>}
      </div>

      {allItems.length === 0 && <EmptyState icon="list" title="Noch keine Daten" />}

      <ListGroup>
        {items.map((item, index) => (
          <ListRow
            key={item.name}
            leading={<span className={`sho-freq-rank${index < 3 ? ' is-top' : ''}`}>{index + 1}</span>}
            title={item.name}
            sub={[item.category, `${item.count}× abgehakt`, (item.quantity || item.unit) && (item.quantity && item.unit ? `${item.quantity} ${item.unit}` : (item.quantity ?? item.unit))].filter(Boolean).join(' · ')}
            trailing={(
              <IconButton
                icon="plus"
                label={`${item.name} zur Liste hinzufügen`}
                variant="quiet"
                disabled={adding === item.name || !targetId}
                onClick={() => handleAdd(item)}
              />
            )}
          />
        ))}
      </ListGroup>
    </div>
  );
}
