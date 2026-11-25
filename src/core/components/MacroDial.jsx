import { useEffect, useLayoutEffect, useRef, useState } from 'react';

// Ring in der Mitte, vier antippbare Werte (Eiweiß + Kohlenh. links, Fett + Kcal rechts).
// Teil des Ernährungsblocks (NutritionBlock in DayPlan.jsx): Hub (variant "tile") und Modul
// (variant "hero"). Rein darstellend; Zahlen kommen aus buildNutritionDay (core/lib/nutritionDay.js).
//
// Nichts gewählt: Ring und Mitte zeigen den Mittelwert aus erfüllt/Ziel aller vier Werte.
// Ein Wert gewählt (Einzelauswahl, nur lokaler Zustand): Ring zeigt nur diesen Wert, die Mitte
// die offene Menge (bei Überschreitung "+x"). Beim Wechsel fliegt die Mitte per Web Animations
// API zur Kachel bzw. von ihr zurück; mit "Bewegung reduzieren" entfällt das (WAAPI kennt den
// globalen Reset in base.css nicht, deshalb hier von Hand geprüft).

const TILES = [
  { key: 'protein', label: 'Eiweiß', unit: 'g', side: 'l' },
  { key: 'carbs', label: 'Kohlenh.', unit: 'g', side: 'l' },
  { key: 'fat', label: 'Fett', unit: 'g', side: 'r' },
  { key: 'kcal', label: 'Kcal', unit: '', side: 'r' },
];

const R = 61;
const STROKE = 8;
const C = 2 * Math.PI * R;
const DISK_R = R - STROKE / 2 - 5;

const fmt = (n) => Math.round(n).toLocaleString('de-DE');
const reduceMotion = () => typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

// Zeigt der Tag alle vier Werte? Sonst (kein Körperprofil / Ziel fehlt) bleibt der Block wie bisher.
export function hasMacroDial(data) {
  return !!(data.kcal && data.macros?.protein && data.macros?.carbs && data.macros?.fat);
}

export default function MacroDial({ data, approx = false, onOpenMeals }) {
  const [sel, setSel] = useState(null);
  const [ready, setReady] = useState(false);
  const centerRef = useRef(null);
  const ghostRef = useRef(null);
  const tileRefs = useRef({});
  const mounted = useRef(false);

  // Beim ersten Zeichnen von 0 auf den Wert animieren (Ring und Balken)
  useEffect(() => {
    const id = setTimeout(() => setReady(true), reduceMotion() ? 0 : 120);
    return () => clearTimeout(id);
  }, []);

  const info = {};
  for (const t of TILES) {
    const p = t.key === 'kcal' ? data.kcal : data.macros[t.key];
    info[t.key] = {
      ...t,
      eaten: p.eaten,
      goal: p.goal,
      open: p.open,
      over: Math.max(0, p.eaten - p.goal),
      ratio: Math.min(1, Math.max(0, p.eaten / p.goal)),
    };
  }
  const avg = TILES.reduce((a, t) => a + info[t.key].ratio, 0) / TILES.length;
  const picked = sel ? info[sel] : null;
  const arcRatio = picked ? picked.ratio : avg;
  const arcOver = !!picked && picked.over > 0;
  const prefix = approx ? '≈ ' : '';

  let center;
  if (!picked) {
    center = { big: String(Math.round(avg * 100)), unit: '%', label: 'erfüllt', sub: '' };
  } else {
    const val = picked.over > 0 ? picked.over : picked.open;
    center = {
      big: `${prefix}${picked.over > 0 ? '+' : ''}${fmt(val)}`,
      unit: picked.unit,
      label: '',
      sub: `${fmt(picked.eaten)} / ${fmt(picked.goal)}`,
    };
  }

  // Mittelpunkt der Kachel relativ zur Mitte des Rings
  function offset(key) {
    const c = centerRef.current;
    const t = key && tileRefs.current[key];
    if (!c || !t) return null;
    const a = c.getBoundingClientRect();
    const b = t.getBoundingClientRect();
    return { dx: b.left + b.width / 2 - (a.left + a.width / 2), dy: b.top + b.height / 2 - (a.top + a.height / 2) };
  }

  function flyOut(key) {
    const c = centerRef.current;
    const g = ghostRef.current;
    if (!c || !g || !c.animate || reduceMotion()) return;
    const o = offset(key);
    const clone = c.cloneNode(true);
    clone.removeAttribute('aria-live');
    g.appendChild(clone);
    const end = o ? `translate(${o.dx}px, ${o.dy}px) scale(0.35)` : 'scale(0.6)';
    const an = clone.animate(
      [{ transform: 'none', opacity: 1 }, { transform: end, opacity: 0 }],
      { duration: 420, easing: 'cubic-bezier(0.4, 0, 0.2, 1)', fill: 'forwards' },
    );
    an.onfinish = () => clone.remove();
  }

  function flyIn(key) {
    const c = centerRef.current;
    if (!c || !c.animate || reduceMotion()) return;
    const o = offset(key);
    const start = o ? `translate(${o.dx}px, ${o.dy}px) scale(0.35)` : 'scale(0.6)';
    c.animate(
      [{ transform: start, opacity: 0 }, { transform: 'none', opacity: 1 }],
      { duration: 480, delay: 80, easing: 'cubic-bezier(0.2, 0, 0, 1)', fill: 'backwards' },
    );
    const t = key && tileRefs.current[key];
    if (t?.animate) t.animate([{ transform: 'scale(1)' }, { transform: 'scale(0.94)' }, { transform: 'scale(1)' }], { duration: 320, easing: 'ease-out' });
  }

  function toggle(key) {
    flyOut(sel);
    setSel(sel === key ? null : key);
  }

  // Nach dem Wechsel die neue Mitte einfliegen lassen (nicht beim ersten Zeichnen)
  useLayoutEffect(() => {
    if (!mounted.current) { mounted.current = true; return; }
    flyIn(sel);
  }, [sel]);

  const tile = (t) => {
    const m = info[t.key];
    const on = sel === t.key;
    const over = m.over > 0;
    const unit = t.unit ? ` ${t.unit}` : '';
    return (
      <button
        key={t.key}
        type="button"
        ref={(el) => { tileRefs.current[t.key] = el; }}
        className={`dp-tile dp-tile--${t.side} ${on ? 'is-on' : ''} ${over ? 'is-over' : ''}`}
        aria-pressed={on}
        aria-label={`${t.label}: ${over ? `${fmt(m.over)}${unit} drüber` : `${fmt(m.open)}${unit} offen`}`}
        onClick={() => toggle(t.key)}
      >
        <span className="dp-tile-label"><i className="dp-tile-dot" />{t.label}</span>
        <b className="dp-tile-val">{prefix}{over ? `+${fmt(m.over)}` : fmt(m.open)}{unit}</b>
        <span className="dp-tile-bar"><em style={{ width: `${ready ? m.ratio * 100 : 0}%` }} /></span>
      </button>
    );
  };

  return (
    <div className="dp-dial">
      <div className="dp-dial-col dp-dial-col--l">{TILES.filter((t) => t.side === 'l').map(tile)}</div>
      <button type="button" className="dp-dial-ring" onClick={onOpenMeals} aria-label="Mahlzeiten öffnen">
        <svg viewBox="0 0 132 132" aria-hidden="true">
          <circle className="dp-dial-disk" cx="66" cy="66" r={DISK_R} />
          <circle className="dp-dial-track" cx="66" cy="66" r={R} fill="none" strokeWidth={STROKE} />
          <circle
            className={`dp-dial-arc ${arcOver ? 'is-over' : ''}`} cx="66" cy="66" r={R} fill="none"
            strokeWidth={STROKE} strokeLinecap="round" strokeDasharray={C.toFixed(2)}
            strokeDashoffset={(ready ? C * (1 - arcRatio) : C).toFixed(2)}
          />
        </svg>
        <span className="dp-dial-ghost" ref={ghostRef} aria-hidden="true" />
        <span className={`dp-dial-center ${arcOver ? 'is-over' : ''}`} ref={centerRef} aria-live="polite">
          <b className={center.big.length >= 5 ? 'is-sm' : ''}>{center.big}{center.unit && <small>{center.unit}</small>}</b>
          {center.label && <span className="dp-dial-label">{center.label}</span>}
          {center.sub && <span className="dp-dial-sub">{center.sub}</span>}
        </span>
      </button>
      <div className="dp-dial-col dp-dial-col--r">{TILES.filter((t) => t.side === 'r').map(tile)}</div>
    </div>
  );
}
