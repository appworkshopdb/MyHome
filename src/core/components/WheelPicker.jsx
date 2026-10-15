// core/components/WheelPicker.jsx
// Vertikaler Wählregler im Stil des iPhone-Timers: Werte scrollen durch ein
// Fenster mit 5 Zeilen, der mittlere rastet ein (CSS scroll-snap). Gespeichert
// wird erst, wenn die Bewegung ausgelaufen ist — nicht bei jedem Pixel.
//
// Leerer Wert (noch nie gesetzt): der Regler steht auf `fallback`, aber ein
// Wert wird erst übernommen, wenn die Person ihn wirklich bewegt oder die
// mittlere Zeile antippt (sonst würde ein Pflichtfeld unbemerkt „ausgefüllt").

import { useEffect, useMemo, useRef } from 'react';
import { fb, primeFeedback } from '../lib/feedback';

const ITEM = 38; // px — muss zu --wheel-item in app-extra.css passen

export default function WheelPicker({ value, min, max, step = 1, fallback, format, onChange, ariaLabel }) {
  const fmt = format || ((n) => String(n));
  const options = useMemo(() => {
    const out = [];
    for (let v = min; v <= max + 1e-9; v += step) out.push(Math.round(v * 100) / 100);
    return out;
  }, [min, max, step]);

  const idxOf = (v) => Math.max(0, Math.min(options.length - 1, Math.round((v - min) / step)));
  const empty = value === '' || value === null || value === undefined;
  const currentIdx = idxOf(empty ? fallback : value);

  const scrollRef = useRef(null);
  const settle = useRef(null);
  const touched = useRef(false);
  const lastIdx = useRef(currentIdx);
  const tickIdx = useRef(currentIdx);

  function paint(idx) {
    const el = scrollRef.current;
    if (!el) return;
    for (let i = 0; i < el.children.length; i++) el.children[i].classList.toggle('sel', i === idx);
  }

  // Von außen geänderten Wert (oder erstes Anzeigen) in die Scrollposition übersetzen
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    if (Math.round(el.scrollTop / ITEM) !== currentIdx) el.scrollTop = currentIdx * ITEM;
    lastIdx.current = currentIdx;
    tickIdx.current = currentIdx;
    paint(currentIdx);
  }, [currentIdx]); // eslint-disable-line react-hooks/exhaustive-deps

  function commit(idx) {
    touched.current = false;
    if (idx === lastIdx.current && !empty) return;
    lastIdx.current = idx;
    onChange(options[idx]);
  }

  function onScroll() {
    const el = scrollRef.current;
    const idx = Math.max(0, Math.min(options.length - 1, Math.round(el.scrollTop / ITEM)));
    paint(idx);
    // Tick (Haptik + leiser Klick), sobald eine neue Zeile in die Mitte rückt —
    // nur bei echter Bedienung, nicht wenn der Regler sich selbst positioniert.
    if (touched.current && idx !== tickIdx.current) fb.tick();
    tickIdx.current = idx;
    clearTimeout(settle.current);
    settle.current = setTimeout(() => { if (touched.current) commit(idx); }, 120);
  }

  function goTo(idx, smooth = true) {
    touched.current = true;
    scrollRef.current.scrollTo({ top: idx * ITEM, behavior: smooth ? 'smooth' : 'auto' });
    if (empty || Math.round(scrollRef.current.scrollTop / ITEM) === idx) commit(idx);
  }

  function onKeyDown(e) {
    const dir = e.key === 'ArrowUp' ? -1 : e.key === 'ArrowDown' ? 1 : 0;
    if (!dir) return;
    e.preventDefault();
    goTo(Math.max(0, Math.min(options.length - 1, currentIdx + dir)));
  }

  return (
    <div className={`wheel${empty ? ' is-empty' : ''}`}>
      <div
        ref={scrollRef}
        className="wheel-scroll"
        role="spinbutton"
        tabIndex={0}
        aria-label={ariaLabel}
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={empty ? undefined : value}
        aria-valuetext={empty ? 'nicht gesetzt' : fmt(value)}
        onScroll={onScroll}
        onPointerDown={() => { touched.current = true; primeFeedback(); }}
        onTouchStart={() => { touched.current = true; primeFeedback(); }}
        onWheel={() => { touched.current = true; }}
        onKeyDown={onKeyDown}
      >
        {options.map((o, i) => (
          <div key={o} className="wheel-item" onClick={() => goTo(i)}>{fmt(o)}</div>
        ))}
      </div>
    </div>
  );
}
