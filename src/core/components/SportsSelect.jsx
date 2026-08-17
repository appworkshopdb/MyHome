import { useState } from 'react';
import { SPORTS, SPORT_GROUPS, getSport } from '../lib/sportsData';

// Mehrfachauswahl über 70+ Sportarten. Bewusst NICHT als lange
// Button-Reihe wie Geschlecht/Ziel: bei dieser Menge braucht es Suche
// und Gruppierung, sonst ist die Liste auf dem Handy unbenutzbar.
// Ausgewählte Sportarten stehen immer oben als entfernbare Chips, damit
// die Auswahl sichtbar bleibt, auch wenn die Liste zugeklappt ist.
export default function SportsSelect({ value = [], onChange }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  function toggle(key) {
    onChange(value.includes(key) ? value.filter((k) => k !== key) : [...value, key]);
  }

  const q = query.trim().toLowerCase();
  const matches = q ? SPORTS.filter((s) => s.label.toLowerCase().includes(q)) : SPORTS;

  return (
    <div className="form-group">
      <label>Sportarten (Mehrfachauswahl)</label>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
        {value.length === 0 && (
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Noch keine ausgewählt</span>
        )}
        {value.map((key) => (
          <button
            key={key}
            onClick={() => toggle(key)}
            style={{
              padding: '6px 10px', borderRadius: 'var(--radius-sm)', border: 'none',
              background: 'var(--accent)', color: 'var(--on-accent)',
              fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer',
            }}
          >
            {getSport(key)?.label ?? key} ×
          </button>
        ))}
      </div>

      <button
        onClick={() => setOpen(!open)}
        style={{
          width: '100%', padding: '10px', borderRadius: 'var(--radius-xs)',
          border: '1.5px solid var(--border)', background: 'var(--bg-secondary)',
          color: 'var(--text-secondary)', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer',
        }}
      >
        {open ? 'Auswahl schließen' : 'Sportart hinzufügen'}
      </button>

      {open && (
        <div style={{ marginTop: 8 }}>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Suchen, z.B. Fußball…"
            style={{ marginBottom: 8 }}
          />
          <div style={{ maxHeight: 260, overflowY: 'auto' }}>
            {(q ? ['Treffer'] : SPORT_GROUPS).map((group) => {
              const items = q ? matches : matches.filter((s) => s.group === group);
              if (items.length === 0) return null;
              return (
                <div key={group} style={{ marginBottom: 10 }}>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: 4 }}>{group}</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {items.map((s) => {
                      const active = value.includes(s.key);
                      return (
                        <button
                          key={s.key}
                          onClick={() => toggle(s.key)}
                          style={{
                            padding: '6px 10px', borderRadius: 'var(--radius-sm)',
                            border: `1.5px solid ${active ? 'var(--accent)' : 'var(--border)'}`,
                            background: active ? 'var(--accent)' : 'var(--bg-secondary)',
                            color: active ? 'var(--on-accent)' : 'var(--text-secondary)',
                            fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer',
                          }}
                        >
                          {s.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
            {matches.length === 0 && (
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Keine Sportart gefunden.</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
