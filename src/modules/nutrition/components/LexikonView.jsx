import { useMemo, useState } from 'react';
import { IconSearch, IconBack, IconBook } from '../../../core/components/Icons';
import { LEX_CATS } from '../lib/nutrition';
import { LEXIKON } from '../lib/data/lexikon';

export default function LexikonView() {
  const [selected, setSelected] = useState(null);
  const [search, setSearch] = useState('');
  const [cat, setCat] = useState('all');

  const filtered = useMemo(() => {
    let list = LEXIKON;
    if (cat !== 'all') list = list.filter((l) => l.cat === cat);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((l) => l.term.toLowerCase().includes(q) || l.short.toLowerCase().includes(q));
    }
    return list;
  }, [search, cat]);

  if (selected) {
    const catInfo = LEX_CATS.find((c) => c.key === selected.cat);
    return (
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
          <button className="btn-icon" onClick={() => setSelected(null)}><IconBack /></button>
          <h2 style={{ flex: 1, fontSize: '1.1rem' }}>{selected.term}</h2>
          {catInfo && <span className="chip" style={{ background: catInfo.color, color: '#fff' }}>{catInfo.label}</span>}
        </div>

        <p style={{ fontWeight: 600, marginBottom: 14 }}>{selected.short}</p>

        <div className="lex-detail-block">
          <div className="heading">Was ist das?</div>
          <div style={{ fontSize: '0.85rem' }}>{selected.was}</div>
        </div>

        <div className="lex-detail-block">
          <div className="heading">Warum wichtig?</div>
          <div style={{ fontSize: '0.85rem' }}>{selected.warum}</div>
        </div>

        {selected.quellen && (
          <div className="lex-detail-block">
            <div className="heading">Gute Quellen</div>
            <div style={{ fontSize: '0.85rem' }}>{selected.quellen}</div>
          </div>
        )}

        {selected.bedarf && (
          <div className="lex-detail-block" style={{ background: 'var(--accent-light)' }}>
            <div className="heading" style={{ color: 'var(--text-primary)' }}>Tagesbedarf (DGE)</div>
            <div style={{ fontSize: '0.85rem' }}>{selected.bedarf}</div>
          </div>
        )}

        {selected.pro && (
          <>
            <div className="lex-detail-block pro">
              <div className="heading">✓ Vorteile</div>
              <div style={{ fontSize: '0.85rem' }}>{selected.pro}</div>
            </div>
            <div className="lex-detail-block con">
              <div className="heading">⚠ Nachteile / Risiken</div>
              <div style={{ fontSize: '0.85rem' }}>{selected.con}</div>
            </div>
          </>
        )}
      </div>
    );
  }

  return (
    <>
      <div className="nut-search">
        <IconSearch />
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Im Lexikon suchen…" />
      </div>
      <div className="chip-row" style={{ marginBottom: 12 }}>
        <button className={`chip ${cat === 'all' ? 'active' : ''}`} onClick={() => setCat('all')}>Alle</button>
        {LEX_CATS.map((c) => (
          <button
            key={c.key}
            className="chip"
            style={cat === c.key ? { background: c.color, color: '#fff' } : {}}
            onClick={() => setCat(cat === c.key ? 'all' : c.key)}
          >
            {c.label}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="empty-state"><IconBook /><p>Kein Eintrag gefunden</p></div>
      ) : (
        <div className="lex-columns">
          {filtered.map((l) => {
            const c = LEX_CATS.find((x) => x.key === l.cat);
            return (
              <button key={l.id} className="lex-card" onClick={() => setSelected(l)}>
                <span className="cat-badge" style={{ background: c?.color || '#94a3b8' }}>{c?.label || l.cat}</span>
                <div className="term">{l.term}</div>
                <div className="short">{l.short}</div>
              </button>
            );
          })}
        </div>
      )}
    </>
  );
}
