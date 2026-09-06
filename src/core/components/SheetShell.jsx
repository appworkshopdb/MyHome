import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

// Gemeinsame Hülle für ALLE Bottom-Sheets (Erfassen-Wizards, Tages-Details …).
//
// Zwei Gründe, warum das eine eigene Komponente ist:
//
// 1. PORTAL. Das Sheet wird per createPortal direkt an <body> gehängt, nicht
//    dorthin, wo es im JSX steht. `position: fixed` bezieht sich sonst auf den
//    nächsten Vorfahren mit transform/filter/will-change — dann scrollt das
//    "fixierte" Sheet mit dem Inhalt mit (siehe Design-System.md, gleiche Falle
//    wie bei den Navs). Am <body> kann das nicht mehr passieren.
//
// 2. WISCHEN. Nach unten ziehen schließt das Sheet. Unter der Schwelle federt
//    es zurück.
//
// Der Inhalt kommt als children — Header/Body/Buttons bleiben in den einzelnen
// Sheets, die kennen ihre Felder selbst.

const CLOSE_DISTANCE = 110; // px, ab hier schließt das Sheet beim Loslassen

export default function SheetShell({ onClose, children, labelledBy }) {
  const [dragY, setDragY]     = useState(0);
  const [closing, setClosing] = useState(false);
  const startY  = useRef(null);
  const bodyRef = useRef(null);

  // Hintergrund nicht mitscrollen lassen, solange das Sheet offen ist
  useEffect(() => {
    const vorher = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = vorher; };
  }, []);

  // Escape schließt
  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape') schliessen(); }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  function schliessen() {
    setClosing(true);
    // kurz die Ausblend-Animation laufen lassen, dann erst unmounten
    setTimeout(onClose, 180);
  }

  function onTouchStart(e) {
    // Nur ziehen, wenn der Inhalt schon ganz oben ist — sonst will der
    // Nutzer im Sheet scrollen, nicht das Sheet wegwischen.
    if (bodyRef.current && bodyRef.current.scrollTop > 0) return;
    startY.current = e.touches[0].clientY;
  }

  function onTouchMove(e) {
    if (startY.current === null) return;
    const dy = e.touches[0].clientY - startY.current;
    if (dy > 0) setDragY(dy);
  }

  function onTouchEnd() {
    if (startY.current === null) return;
    startY.current = null;
    if (dragY > CLOSE_DISTANCE) schliessen();
    else setDragY(0);
  }

  const sheet = (
    <div
      className={`sheet-overlay ${closing ? 'is-closing' : ''}`}
      onClick={(e) => e.target === e.currentTarget && schliessen()}
    >
      <div
        className={`sheet ${closing ? 'is-closing' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        style={dragY ? { transform: `translateY(${dragY}px)`, transition: 'none' } : undefined}
      >
        {/* Griff — hier (und am Kopfbereich) wird gezogen */}
        <div
          className="sheet-grab"
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
        >
          <span className="sheet-grab-bar" />
        </div>

        <div
          className="sheet-scroll"
          ref={bodyRef}
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
        >
          {children}
        </div>
      </div>
    </div>
  );

  return createPortal(sheet, document.body);
}
