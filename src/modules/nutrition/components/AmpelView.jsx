import { useMemo, useState } from 'react';
import { IconSearch, IconPlus, IconChevronDown } from '../../../core/components/Icons';
import { AMPEL_CATS, GROUP_COLORS, TAG_COLORS, CUSTOM_TAGS, basis } from '../lib/nutrition';
import FoodDetailModal from './FoodDetailModal';
import FoodFormModal from './FoodFormModal';
import CompareModal from './CompareModal';

export default function AmpelView({ foods, currentUserId, onSaveFood, onDeleteFood }) {
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('all');
  const [tag, setTag] = useState('all');
  const [glutenfrei, setGlutenfrei] = useState(false);
  const [laktosefrei, setLaktosefrei] = useState(false);
  const [collapsed, setCollapsed] = useState(() => new Set(foods.map((f) => f.group)));
  const [selected, setSelected] = useState(null);
  const [formFood, setFormFood] = useState(null); // undefined = closed, null = new, object = edit
  const [showForm, setShowForm] = useState(false);
  const [compare, setCompare] = useState([]);
  const [showCompare, setShowCompare] = useState(false);

  const allGroups = useMemo(() => [...new Set(foods.map((f) => f.group))].sort((a, b) => a.localeCompare(b, 'de')), [foods]);

  const filtered = useMemo(() => {
    let list = foods;
    if (category !== 'all') list = list.filter((f) => f.category === category);
    if (tag !== 'all') list = list.filter((f) => (f.tags || []).includes(tag));
    if (glutenfrei) list = list.filter((f) => f.glutenfrei);
    if (laktosefrei) list = list.filter((f) => f.laktosefrei);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((f) => f.name.toLowerCase().includes(q) || (f.group || '').toLowerCase().includes(q));
    }
    return list;
  }, [foods, category, tag, glutenfrei, laktosefrei, search]);

  const grouped = useMemo(() => {
    const g = {};
    for (const f of filtered) (g[f.group] || (g[f.group] = [])).push(f);
    return g;
  }, [filtered]);
  const groupNames = Object.keys(grouped).sort((a, b) => a.localeCompare(b, 'de'));

  function toggleGroup(name) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      next.has(name) ? next.delete(name) : next.add(name);
      return next;
    });
  }

  function openCompare(food) {
    setCompare((prev) => {
      if (prev.find((f) => f.id === food.id)) return prev;
      if (prev.length >= 4) return prev;
      return [...prev, food];
    });
    setShowCompare(true);
  }

  async function handleSave(food) {
    await onSaveFood(food);
    setShowForm(false);
    setSelected(null);
  }

  async function handleDelete(food) {
    if (!confirm(`"${food.name}" wirklich löschen?`)) return;
    await onDeleteFood(food);
    setSelected(null);
  }

  return (
    <>
      <div className="nut-search">
        <IconSearch />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Lebensmittel suchen…"
        />
      </div>

      <div className="chip-row" style={{ marginBottom: 6 }}>
        <button className={`chip ${category === 'all' ? 'active' : ''}`} onClick={() => setCategory('all')}>Alle</button>
        {AMPEL_CATS.map((c) => (
          <button key={c.key} className={`chip ${category === c.key ? 'active' : ''}`} onClick={() => setCategory(c.key)}>
            {c.label}
          </button>
        ))}
        <button className={`chip ${glutenfrei ? 'active' : ''}`} onClick={() => setGlutenfrei((v) => !v)}>GF</button>
        <button className={`chip ${laktosefrei ? 'active' : ''}`} onClick={() => setLaktosefrei((v) => !v)}>LF</button>
      </div>

      <div className="chip-row" style={{ marginBottom: 10 }}>
        <button className={`chip ${tag === 'all' ? 'active' : ''}`} onClick={() => setTag('all')}>Alle Tags</button>
        {CUSTOM_TAGS.map((t) => (
          <button
            key={t}
            className="chip"
            style={tag === t ? { background: TAG_COLORS[t], color: '#fff' } : {}}
            onClick={() => setTag(tag === t ? 'all' : t)}
          >
            {t}
          </button>
        ))}
      </div>

      {compare.length > 0 && (
        <div className="card" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px' }}>
          <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>{compare.length} zum Vergleich</span>
          <button className="btn btn-primary" style={{ marginLeft: 'auto', padding: '6px 12px' }} onClick={() => setShowCompare(true)}>Vergleichen</button>
          <button className="btn-ghost" onClick={() => setCompare([])}>×</button>
        </div>
      )}

      {groupNames.length === 0 && (
        <div className="empty-state">
          <IconSearch />
          <p>Keine Treffer</p>
        </div>
      )}

      {groupNames.map((name) => {
        const items = grouped[name];
        const isCollapsed = collapsed.has(name);
        return (
          <div key={name}>
            <button className="food-group-header" onClick={() => toggleGroup(name)}>
              <span className="dot" style={{ background: GROUP_COLORS[name] || '#94a3b8' }} />
              <span className="name">{name}</span>
              <span className="count">{items.length}</span>
              <span style={{ transform: isCollapsed ? 'rotate(-90deg)' : 'none', display: 'flex' }}><IconChevronDown /></span>
            </button>
            {!isCollapsed && items.map((f) => {
              const cat = AMPEL_CATS.find((c) => c.key === f.category) || AMPEL_CATS[0];
              return (
                <button key={f.id} className="food-row" onClick={() => setSelected(f)}>
                  <span className="bar" style={{ background: cat.color }} />
                  <span className="info">
                    <span className="name">
                      {f.name}
                      {f.glutenfrei && <span className="sub">GF</span>}
                      {f.laktosefrei && <span className="sub">LF</span>}
                    </span>
                    <span className="meta">{f.kcal} kcal · {basis(f.unit)} · {f.protein}g Protein</span>
                    {(f.tags || []).length > 0 && (
                      <span className="tags">
                        {f.tags.slice(0, 3).map((t) => (
                          <span key={t} className="tag-chip" style={{ background: TAG_COLORS[t] || '#94a3b8' }}>{t}</span>
                        ))}
                      </span>
                    )}
                  </span>
                  <span className={`ampel-badge ${f.category}`}>{f.category === 'tabu' ? 'TABU' : 'OK'}</span>
                </button>
              );
            })}
          </div>
        );
      })}

      <button className="fab" onClick={() => { setFormFood(null); setShowForm(true); }}>
        <IconPlus />
      </button>

      {selected && (
        <FoodDetailModal
          food={selected}
          currentUserId={currentUserId}
          onEdit={(f) => { setFormFood(f); setShowForm(true); setSelected(null); }}
          onDelete={handleDelete}
          onCompare={() => openCompare(selected)}
          compareCount={compare.length}
          inCompare={!!compare.find((f) => f.id === selected.id)}
          onClose={() => setSelected(null)}
        />
      )}

      {showForm && (
        <FoodFormModal
          food={formFood}
          allGroups={allGroups}
          onSave={handleSave}
          onClose={() => setShowForm(false)}
        />
      )}

      {showCompare && (
        <CompareModal
          items={compare}
          onRemove={(id) => setCompare((prev) => prev.filter((f) => f.id !== id))}
          onClose={() => setShowCompare(false)}
        />
      )}
    </>
  );
}
