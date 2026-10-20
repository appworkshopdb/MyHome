import { useEffect, useState } from 'react';
import { rpc } from './api';

export const AREA_NAMES = {
  hub: 'Hub', habits: 'Gewohnheiten', finance: 'Finanzen', nutrition: 'Ernährung',
  sport: 'Sport', shopping: 'Einkauf', profile: 'Profil',
};

export function areaName(module) {
  return AREA_NAMES[module] || module || '–';
}

export function screenLabel(module, view) {
  return view ? `${areaName(module)} · ${view}` : areaName(module);
}

export const nf = new Intl.NumberFormat('de-DE');
export const nf1 = new Intl.NumberFormat('de-DE', { maximumFractionDigits: 1, minimumFractionDigits: 1 });

export function timeOf(iso) {
  return new Date(iso).toLocaleTimeString('de-DE', { timeZone: 'Europe/Berlin', hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

export function dateTimeOf(iso) {
  return new Date(iso).toLocaleString('de-DE', { timeZone: 'Europe/Berlin', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export function dateOf(iso) {
  if (!iso) return '–';
  return new Date(iso).toLocaleDateString('de-DE', { timeZone: 'Europe/Berlin', day: '2-digit', month: '2-digit', year: 'numeric' });
}

export function shortId(userId) {
  return `u_${String(userId).replace(/-/g, '').slice(0, 4)}`;
}

// Lädt per RPC; refreshMs lädt still im Hintergrund nach (Live-Ansicht).
export function useRpc(fn, args, refreshMs) {
  const key = JSON.stringify([fn, args]);
  const [state, setState] = useState({ data: null, error: null, loading: true });

  useEffect(() => {
    let alive = true;
    setState((s) => ({ ...s, loading: true }));
    const run = () =>
      rpc(fn, args)
        .then((data) => alive && setState({ data, error: null, loading: false }))
        .catch((error) => alive && setState((s) => ({ data: s.data, error, loading: false })));
    run();
    const timer = refreshMs ? setInterval(run, refreshMs) : null;
    return () => { alive = false; if (timer) clearInterval(timer); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, refreshMs]);

  return state;
}

export function Card({ title, aside, children, className = '' }) {
  return (
    <section className={`card ${className}`}>
      {(title || aside) && (
        <header className="card-head">
          {title && <h2>{title}</h2>}
          {aside && <span className="card-aside">{aside}</span>}
        </header>
      )}
      {children}
    </section>
  );
}

export function Bar({ value, max, color }) {
  const w = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <span className="bar" aria-hidden="true">
      <span className="bar-fill" style={{ width: `${w}%`, background: color }} />
    </span>
  );
}

export function State({ state, children }) {
  if (state.error && !state.data) return <div className="note error" role="alert">{state.error.message}</div>;
  if (!state.data) return <div className="note">Lädt…</div>;
  return children(state.data);
}
