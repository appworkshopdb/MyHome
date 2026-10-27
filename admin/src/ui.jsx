import { useEffect, useState } from 'react';
import { rpc } from './api';

export const AREA_NAMES = {
  hub: 'Hub', habits: 'Gewohnheiten', finance: 'Finanzen', nutrition: 'Ernährung',
  sport: 'Sport', shopping: 'Einkauf', profile: 'Profil', statistiken: 'Statistiken',
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

// "Online": letztes Ereignis liegt weniger als 3 Minuten zurück (wie "Gerade aktiv").
// Die App sendet jede Minute einen Heartbeat, solange sie sichtbar und bedient wird.
export const ONLINE_MS = 3 * 60 * 1000;

export function isOnline(iso) {
  return Boolean(iso) && Date.now() - new Date(iso).getTime() < ONLINE_MS;
}

export function ago(iso) {
  const s = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return 'vor wenigen Sekunden';
  const m = Math.round(s / 60);
  if (m < 60) return `vor ${m} Min.`;
  const h = Math.round(m / 60);
  if (h < 48) return `vor ${h} Std.`;
  return `vor ${Math.round(h / 24)} Tagen`;
}

export function shortId(userId) {
  return `u_${String(userId).replace(/-/g, '').slice(0, 4)}`;
}

export function initials(userId) {
  return String(userId).replace(/-/g, '').slice(0, 2).toUpperCase();
}

export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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

const ICONS = {
  grid: <><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /></>,
  funnel: <path d="M3 5h18l-7 8v6l-4 2v-8z" />,
  users: <><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20c0-3.6 2.9-6 6.5-6s6.5 2.4 6.5 6" /><path d="M16 4.5a3.5 3.5 0 0 1 0 7M18 14.5c2 .7 3.5 2.6 3.5 5.5" /></>,
  alert: <><path d="M12 3 2.5 20h19z" /><path d="M12 10v4M12 17.2v.1" /></>,
  back: <path d="M15 5l-7 7 7 7" />,
  chevron: <path d="M9 5l7 7-7 7" />,
};

export function Icon({ name, size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {ICONS[name]}
    </svg>
  );
}

// Kleiner Verlauf ohne Achsen; nur sinnvoll mit mindestens 2 Werten.
export function Spark({ values }) {
  if (!values || values.length < 2) return null;
  const min = Math.min(...values), max = Math.max(...values);
  const pts = values.map((v, i) => `${(i / (values.length - 1)) * 100},${28 - ((v - min) / (max - min || 1)) * 24}`).join(' ');
  return (
    <svg viewBox="0 0 100 30" preserveAspectRatio="none" className="spark" aria-hidden="true">
      <polyline points={pts} fill="none" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

export function RangeControl({ days, onChange, ranges = [7, 30, 90] }) {
  return (
    <div className="range" role="group" aria-label="Zeitraum">
      {ranges.map((r) => (
        <button key={r} type="button" className={r === days ? 'active' : ''} aria-pressed={r === days} onClick={() => onChange(r)}>{r} Tage</button>
      ))}
    </div>
  );
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

export function Bar({ value, max, color, className = '' }) {
  const w = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return (
    <span className={`bar ${className}`} aria-hidden="true">
      <span className="bar-fill" style={{ width: `${w}%`, background: color }} />
    </span>
  );
}

export function State({ state, children }) {
  if (state.error && !state.data) return <div className="note error" role="alert">{state.error.message}</div>;
  if (!state.data) return <div className="note">Lädt…</div>;
  return children(state.data);
}
