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
      <div className="lex-view">
        <div className="lex-detail-head">
          <button className="lex-back" onClick={() => setSelected(null)} aria-label="Zurück zur Liste"><IconBack /></button>
          <h2>{selected.term}</h2>
          {catInfo && <span className="lex-cat">{catInfo.label}</span>}
        </div>

        <p className="lex-detail-short">{selected.short}</p>

        <div className="lex-detail-block">
          <div className="heading">Was ist das?</div>
          <p>{selected.was}</p>
        </div>

        <div className="lex-detail-block">
          <div className="heading">Warum wichtig?</div>
          <p>{selected.warum}</p>
        </div>

        {selected.quellen && (
          <div className="lex-detail-block">
            <div className="heading">Gute Quellen</div>
            <p>{selected.quellen}</p>
          </div>
        )}

        {selected.bedarf && (
          <div className="lex-detail-block need">
            <div className="heading">Tagesbedarf (DGE)</div>
            <p>{selected.bedarf}</p>
          </div>
        )}

        {selected.pro && (
          <>
            <div className="lex-detail-block pro">
              <div className="heading">✓ Vorteile</div>
              <p>{selected.pro}</p>
            </div>
            <div className="lex-detail-block con">
              <div className="heading">⚠ Nachteile / Risiken</div>
              <p>{selected.con}</p>
            </div>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="lex-view">
      <div className="nut-search">
        <IconSearch />
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Im Lexikon suchen…" />
      </div>
      <div className="chip-row" style={{ marginBottom: 12 }}>
        <button className={`chip ${cat === 'all' ? 'active' : ''}`} onClick={() => setCat('all')}>Alle</button>
        {LEX_CATS.map((c) => (
          <button
            key={c.key}
            className={`chip ${cat === c.key ? 'active' : ''}`}
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
                <span className="cat-badge">{c?.label || l.cat}</span>
                <div className="term">{l.term}</div>
                <div className="short">{l.short}</div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
