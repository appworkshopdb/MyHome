import { useState } from 'react';
import { IconSearch, IconBack, IconChevronDown, IconCheck } from '../../../core/components/Icons';
import { TIPPS, TIPP_CATS } from '../lib/data/tipps';
import { BODY_DATA } from '../lib/data/body';
import { TIPP_ICONS } from '../lib/nutrition';
import Icon from '../../../core/components/Icon';
import { Segmented, Button } from '../../../core/components/ui';

const WIRKUNG_STYLE = {
  positiv: { bg: 'var(--success-light)', text: 'var(--success)' },
  negativ: { bg: 'var(--danger-light)', text: 'var(--danger)' },
  neutral: { bg: 'var(--bg-card)', text: 'var(--text-secondary)' },
};

export default function TippsView() {
  const [tab, setTab] = useState('tipps'); // 'tipps' | 'body'
  const [openCats, setOpenCats] = useState(() => new Set());
  const [openTips, setOpenTips] = useState(() => new Set());
  const [organSearch, setOrganSearch] = useState('');
  const [organ, setOrgan] = useState(null);

  function toggleCat(key) {
    setOpenCats((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  }
  function toggleTip(id) {
    setOpenTips((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  const allOrgans = BODY_DATA.flatMap((cat) => (cat.organe || []).map((o) => ({ ...o, katName: cat.name })));
  const organResults = organSearch.trim()
    ? allOrgans.filter((o) => o.name.toLowerCase().includes(organSearch.toLowerCase()) || o.katName.toLowerCase().includes(organSearch.toLowerCase()))
    : allOrgans;

  return (
    <>
      <Segmented
        label="Bereich"
        options={[{ value: 'tipps', label: 'Ernährungs-Tipps' }, { value: 'body', label: 'Körper & Nährstoffe' }]}
        value={tab}
        onChange={setTab}
      />

      {tab === 'tipps' && TIPP_CATS.map((c) => {
        const items = TIPPS.filter((t) => t.cat === c.key);
        const isOpen = openCats.has(c.key);
        return (
          <div key={c.key} className="card tip-group">
            <button className="tip-group-header" onClick={() => toggleCat(c.key)}>
              <span className="emoji">{TIPP_ICONS[c.key] || '💡'}</span>
              <span className="title">{c.label}</span>
              <span className="count">{items.length} Tipps</span>
              <span className={`tip-chev${isOpen ? ' is-open' : ''}`}><Icon name="expand" size={18} /></span>
            </button>
            {isOpen && items.map((t) => {
              const tipOpen = openTips.has(t.id);
              return (
                <div key={t.id} className="tip-item">
                  <button className="tip-item-head" onClick={() => toggleTip(t.id)}>
                    <span className="bullet"><IconCheck /></span>
                    <span className="tip-item-text">
                      <div className="tip-item-title">{t.title}</div>
                      <div className="tip-item-sub">{t.short}</div>
                    </span>
                    <span className={`tip-chev${tipOpen ? ' is-open' : ''}`}><Icon name="expand" size={18} /></span>
                  </button>
                  {tipOpen && <div className="tip-item-body">{t.text}</div>}
                </div>
              );
            })}
          </div>
        );
      })}

      {tab === 'body' && (
        organ ? (
          <div>
            <Button variant="text" size="s" icon="back" className="organ-back" onClick={() => setOrgan(null)}>Zurück</Button>
            <h3 className="organ-title">{organ.name}</h3>
            <p className="organ-desc">{organ.beschreibung}</p>
            {(organ.naehrstoffe || []).map((n, idx) => {
              const style = WIRKUNG_STYLE[n.wirkung] || WIRKUNG_STYLE.neutral;
              return (
                <div key={idx} className="nutrient-block" style={{ background: style.bg }}>
                  <div className="head">
                    <span className="name" style={{ color: style.text }}>{n.name}</span>
                    <span className="badge" style={{ background: 'var(--bg-secondary)', color: style.text }}>{n.wirkung}</span>
                  </div>
                  <div className="text" style={{ color: style.text }}>{n.text}</div>
                </div>
              );
            })}
          </div>
        ) : (
          <>
            <div className="nut-search">
              <IconSearch />
              <input value={organSearch} onChange={(e) => setOrganSearch(e.target.value)} placeholder="Organ oder Kategorie suchen…" />
            </div>
            {organSearch.trim() ? (
              <div className="organ-grid">
                {organResults.map((o) => (
                  <button key={o.id} className="organ-card" onClick={() => setOrgan(o)}>
                    <div className="emoji">{o.emoji || '🫀'}</div>
                    <div className="name">{o.name}</div>
                    <div className="kat">{o.katName}</div>
                  </button>
                ))}
              </div>
            ) : (
              BODY_DATA.map((c) => (
                <div key={c.name} className="organ-cat">
                  <div className="card-title organ-cat-title">{c.name}</div>
                  <div className="organ-grid">
                    {(c.organe || []).map((o) => (
                      <button key={o.id} className="organ-card" onClick={() => setOrgan(o)}>
                        <div className="emoji">{o.emoji || '🫀'}</div>
                        <div className="name">{o.name}</div>
                      </button>
                    ))}
                  </div>
                </div>
              ))
            )}
          </>
        )
      )}
    </>
  );
}
