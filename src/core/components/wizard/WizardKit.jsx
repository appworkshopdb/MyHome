// core/components/wizard/WizardKit.jsx
// Bausteine, die ALLE Eingabe-Wizards teilen (Aufgabe, Gewohnheit, Finanzen,
// Sport, Ernährung, Einkauf). Stile: src/styles/wizard.css (Präfix wz-).
//
//  WizardFrame   Kopf (‹ Titel ✕), Fortschritt, scrollender Inhalt, Fußleiste
//  WizardFoot    Fußleiste mit Hinweis "Noch nötig: …"
//  WheelPicker   senkrechter Wechselregler wie der iPhone-Timer
//  DateButton    Datum-Button, öffnet einen Kalender
//  IconDropdown  Symbol-Button, klappt eine breite Tabelle auf
//  ChipGroup / SegGroup / Stepper / VStepper / MoreButton

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { MONTHS_FULL, fmtDate, isoLocal, parseIso, todayIso } from '../../lib/wizardDates';
import { fb, primeFeedback } from '../../lib/feedback';

// ── Icons ────────────────────────────────────────────────────
const svgProps = { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2.2, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true };
export const WzIconBack  = () => <svg {...svgProps}><path d="M15 5l-7 7 7 7" /></svg>;
export const WzIconClose = () => <svg {...svgProps}><path d="M6 6l12 12M18 6L6 18" /></svg>;
export const WzIconCal   = () => <svg {...svgProps} strokeWidth={2}><rect x="3.5" y="5" width="17" height="15" rx="3" /><path d="M3.5 10h17M8 3v4M16 3v4" /></svg>;
export const WzIconStar  = () => <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 3.5l2.6 5.6 6.1.7-4.5 4.2 1.2 6L12 17l-5.4 3 1.2-6L3.3 9.8l6.1-.7z" /></svg>;

// ── Rahmen ───────────────────────────────────────────────────
// total > 1 zeigt den Fortschrittsbalken (step = 1-basiert).
// onBack fehlt → kein ‹ (erster Schritt).
export function WizardFrame({ title, sub, step = 0, total = 0, onBack, onClose, footer, nut = false, stepKey, children }) {
  const scrollRef = useRef(null);
  useEffect(() => { if (scrollRef.current) scrollRef.current.scrollTop = 0; }, [stepKey]);

  return (
    <div className={`wz-frame${nut ? ' wz-nut' : ''}`}>
      <div className={`wz-head${onBack ? '' : ' no-back'}`}>
        {onBack && (
          <button type="button" className="wz-ico wz-back" onClick={onBack} aria-label="Zurück"><WzIconBack /></button>
        )}
        <div className="wz-ttl">
          <div className="wz-title">{title}</div>
          {sub ? <div className="wz-sub">{sub}</div> : null}
        </div>
        <button type="button" className="wz-ico" onClick={onClose} aria-label="Schließen"><WzIconClose /></button>
      </div>
      {total > 1 && (
        <div className="wz-prog" aria-hidden="true">
          {Array.from({ length: total }, (_, i) => <i key={i} className={i < step ? 'on' : ''} />)}
        </div>
      )}
      <div className="wz-scroll" ref={scrollRef}>{children}</div>
      {footer}
    </div>
  );
}

// Fußleiste. one = nur ein Button (volle Breite). hint = "Noch nötig: …"
export function WizardFoot({ one = false, hint, children }) {
  return (
    <div className={`wz-foot${one ? ' one' : ''}`}>
      {hint ? <div className="wz-foot-hint" role="status">{hint}</div> : null}
      {children}
    </div>
  );
}

// Baut den Hinweis aus [[Feldname, fehlt?], …]
export function missingHint(pairs) {
  const m = pairs.filter(([, missing]) => missing).map(([label]) => label);
  return m.length ? `Noch nötig: ${m.join(', ')}` : '';
}

export function MoreButton({ open, onClick, labelClosed = 'Mehr Details', labelOpen = 'Weniger Details' }) {
  return (
    <button type="button" className="btn btn-secondary" onClick={onClick} aria-expanded={open}>
      {open ? labelOpen : labelClosed}<span className="wz-caret" aria-hidden="true">▾</span>
    </button>
  );
}

// ── Auswahl ──────────────────────────────────────────────────
const optOf = (o) => (typeof o === 'object' && o !== null ? o : { value: o, label: o });

// Einzelauswahl (multi=false) oder Mehrfachauswahl (multi=true, value = Array).
// optional: erneutes Tippen auf die gewählte Option hebt sie auf.
export function ChipGroup({ options, value, onChange, multi = false, optional = false, label }) {
  function click(v) {
    if (multi) {
      const cur = Array.isArray(value) ? value : [];
      onChange(cur.includes(v) ? cur.filter((x) => x !== v) : [...cur, v]);
    } else if (optional && value === v) onChange('');
    else onChange(v);
  }
  return (
    <div className="wz-chips" role="group" aria-label={label}>
      {options.map((raw) => {
        const o = optOf(raw);
        const on = multi ? (value || []).includes(o.value) : value === o.value;
        return (
          <button key={o.value} type="button" className={`wz-chip${on ? ' on' : ''}`} aria-pressed={on} onClick={() => click(o.value)}>
            {o.icon || null}{o.label}
          </button>
        );
      })}
    </div>
  );
}

export function SegGroup({ options, value, onChange, label, style }) {
  return (
    <div className="wz-seg" role="group" aria-label={label} style={style}>
      {options.map((raw) => {
        const o = optOf(raw);
        return (
          <button key={o.value} type="button" className={`wz-seg-b${value === o.value ? ' on' : ''}`} aria-pressed={value === o.value} onClick={() => onChange(o.value)}>
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export function Stepper({ value, onChange, min = 0, max = 99, step = 1, suffix = '' }) {
  const set = (v) => onChange(Math.max(min, Math.min(max, v)));
  return (
    <div className="wz-stepper">
      <button type="button" onClick={() => set(value - step)} aria-label="weniger">−</button>
      <span className="val">{value}{suffix}</span>
      <button type="button" onClick={() => set(value + step)} aria-label="mehr">+</button>
    </div>
  );
}

// Kompakte Zahl mit Pfeilen hoch/runter, gleich hoch wie ein Dropdown
export function VStepper({ value, onChange, min = 1, max = 50, step = 1, label = 'Anzahl' }) {
  const set = (v) => onChange(Math.max(min, Math.min(max, v)));
  return (
    <div className="wz-vstep">
      <span className="val" aria-live="polite">{value}</span>
      <div className="ar">
        <button type="button" onClick={() => set(value + step)} aria-label={`${label} erhöhen`}>▲</button>
        <button type="button" onClick={() => set(value - step)} aria-label={`${label} verringern`}>▼</button>
      </div>
    </div>
  );
}

// ── Wechselregler ────────────────────────────────────────────
const ITEM_H = 36;

export function WheelPicker({ items, value, onChange, label }) {
  const norm = useMemo(() => items.map((i) => (typeof i === 'object' ? { value: String(i.value), label: i.label } : { value: String(i), label: String(i) })), [items]);
  const listRef = useRef(null);
  const timer = useRef(null);
  const drag = useRef(null);
  const moved = useRef(false);
  const touched = useRef(false);   // echte Bedienung (nicht, wenn sich der Regler selbst positioniert)
  const tickIdx = useRef(-1);

  // Zeilen nach Abstand zur Mitte ausblenden und kippen (Trommel-Effekt)
  const mark = useCallback(() => {
    const list = listRef.current;
    if (!list) return;
    const f = list.scrollTop / ITEM_H;
    [...list.children].forEach((el, j) => {
      const d = Math.abs(j - f);
      el.style.opacity = String(Math.max(0.1, 1 - 0.3 * d));
      el.style.transform = `rotateX(${(j - f) * -20}deg) scale(${Math.max(0.62, 1 - 0.09 * d)})`;
    });
  }, []);

  // Position an den Wert anpassen (nur wenn sie nicht ohnehin schon stimmt)
  useLayoutEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const i = Math.max(0, norm.findIndex((n) => n.value === String(value)));
    if (Math.round(list.scrollTop / ITEM_H) !== i) {
      list.style.scrollSnapType = 'none';
      list.scrollTop = i * ITEM_H;
      list.style.scrollSnapType = '';
    }
    tickIdx.current = i;
    mark();
  }, [value, norm, mark]);

  useEffect(() => () => clearTimeout(timer.current), []);

  const idxNow = () => Math.max(0, Math.min(norm.length - 1, Math.round(listRef.current.scrollTop / ITEM_H)));

  function commit() {
    const v = norm[idxNow()]?.value;
    touched.current = false;
    if (v !== undefined && v !== String(value)) onChange(v);
  }

  function onScroll() {
    mark();
    // Tick (Haptik + leiser Klick) wie bei den Wählreglern im Profil, sobald eine neue Zeile in die Mitte rückt
    const i = idxNow();
    if (touched.current && i !== tickIdx.current) fb.tick();
    tickIdx.current = i;
    clearTimeout(timer.current);
    timer.current = setTimeout(() => { if (!drag.current) commit(); }, 90);
  }

  function onKeyDown(e) {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    e.preventDefault();
    const i = Math.max(0, Math.min(norm.length - 1, idxNow() + (e.key === 'ArrowDown' ? 1 : -1)));
    listRef.current.scrollTo({ top: i * ITEM_H, behavior: 'smooth' });
  }

  // Maus: Ziehen wie auf dem Touchscreen
  function onPointerDown(e) {
    touched.current = true;
    primeFeedback();
    if (e.pointerType !== 'mouse') return;
    drag.current = { y: e.clientY, top: listRef.current.scrollTop };
    moved.current = false;
    listRef.current.style.scrollSnapType = 'none';
    listRef.current.setPointerCapture(e.pointerId);
  }
  function onPointerMove(e) {
    if (!drag.current) return;
    const dy = e.clientY - drag.current.y;
    if (Math.abs(dy) > 3) moved.current = true;
    listRef.current.scrollTop = drag.current.top - dy;
  }
  function endDrag() {
    if (!drag.current) return;
    drag.current = null;
    const list = listRef.current;
    const i = idxNow();
    list.style.scrollSnapType = '';
    list.scrollTo({ top: i * ITEM_H, behavior: 'smooth' });
    setTimeout(commit, 260);
  }

  function onItemClick(i) {
    if (moved.current) return;
    listRef.current.scrollTo({ top: i * ITEM_H, behavior: 'smooth' });
  }

  return (
    <div className="wz-wheel">
      <div className="wz-wheel-band" />
      <div
        className="wz-wheel-list"
        ref={listRef}
        tabIndex={0}
        role="listbox"
        aria-label={label}
        onScroll={onScroll}
        onKeyDown={(e) => { touched.current = true; onKeyDown(e); }}
        onWheel={() => { touched.current = true; }}
        onTouchStart={() => { touched.current = true; primeFeedback(); }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
      >
        {norm.map((n, i) => (
          <div key={n.value} className="wz-wheel-item" role="option" aria-selected={n.value === String(value)} onClick={() => onItemClick(i)}>
            {n.label}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Datum + Kalender ─────────────────────────────────────────
function CalendarPopup({ value, onPick, onClose, optional }) {
  const today = todayIso();
  const start = value ? parseIso(value) : new Date();
  const [view, setView] = useState(new Date(start.getFullYear(), start.getMonth(), 1));

  const y = view.getFullYear();
  const m = view.getMonth();
  const offset = (new Date(y, m, 1).getDay() + 6) % 7; // Montag zuerst
  const cells = Array.from({ length: 42 }, (_, i) => new Date(y, m, 1 - offset + i));

  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape') { e.stopPropagation(); onClose(); } }
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [onClose]);

  return createPortal(
    <div className="wz-cal-back" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="wz-cal" role="dialog" aria-modal="true" aria-label="Datum wählen">
        <div className="wz-cal-head">
          <button type="button" onClick={() => setView(new Date(y, m - 1, 1))} aria-label="Vorheriger Monat">‹</button>
          <b>{MONTHS_FULL[m]} {y}</b>
          <button type="button" onClick={() => setView(new Date(y, m + 1, 1))} aria-label="Nächster Monat">›</button>
        </div>
        <div className="wz-cal-wd">{['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'].map((d) => <span key={d}>{d}</span>)}</div>
        <div className="wz-cal-grid">
          {cells.map((d) => {
            const iso = isoLocal(d);
            const cls = [d.getMonth() !== m && 'out', iso === today && 'today', iso === value && 'sel'].filter(Boolean).join(' ');
            return (
              <button key={iso} type="button" className={cls} onClick={() => onPick(iso)} aria-label={`${d.getDate()}. ${MONTHS_FULL[d.getMonth()]}`}>
                {d.getDate()}
              </button>
            );
          })}
        </div>
        <div className="wz-cal-foot">
          <button type="button" onClick={() => onPick(today)}>Heute</button>
          {optional ? <button type="button" onClick={() => onPick('')}>Entfernen</button> : <span />}
          <button type="button" onClick={onClose}>Schließen</button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

export function DateButton({ value, onChange, optional = false, placeholder = 'Datum wählen', label }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className="wz-datebtn" onClick={() => setOpen(true)} aria-label={label ? `${label}: ${value ? fmtDate(value) : placeholder}` : undefined}>
        <WzIconCal />
        {value ? <span>{fmtDate(value)}</span> : <span className="ph">{placeholder}</span>}
        {value && optional ? (
          <span
            className="x"
            role="button"
            tabIndex={0}
            aria-label="Datum entfernen"
            onClick={(e) => { e.stopPropagation(); onChange(''); }}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.stopPropagation(); onChange(''); } }}
          >×</span>
        ) : null}
      </button>
      {open && (
        <CalendarPopup
          value={value}
          optional={optional}
          onClose={() => setOpen(false)}
          onPick={(iso) => { onChange(iso); setOpen(false); }}
        />
      )}
    </>
  );
}

// ── Symbol-Dropdown ──────────────────────────────────────────
// children = das Namensfeld rechts neben dem Symbol-Button
export function IconDropdown({ icons, value, onChange, columns = 8, children }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    function outside(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false); }
    document.addEventListener('mousedown', outside);
    document.addEventListener('touchstart', outside);
    return () => { document.removeEventListener('mousedown', outside); document.removeEventListener('touchstart', outside); };
  }, [open]);

  return (
    <div className="wz-nm-wrap" ref={ref}>
      <div className="wz-nm-row">
        <button type="button" className="wz-icon-btn" aria-haspopup="true" aria-expanded={open} aria-label="Symbol wählen" onClick={() => setOpen((o) => !o)}>
          <span>{value}</span><span className="c" aria-hidden="true">▾</span>
        </button>
        {children}
      </div>
      {open && (
        <div className={`wz-icon-panel${columns === 6 ? ' c6' : ''}`}>
          {icons.map((ic) => (
            <button key={ic} type="button" className={value === ic ? 'on' : ''} aria-label={`Symbol ${ic}`} onClick={() => { onChange(ic); setOpen(false); }}>{ic}</button>
          ))}
        </div>
      )}
    </div>
  );
}
