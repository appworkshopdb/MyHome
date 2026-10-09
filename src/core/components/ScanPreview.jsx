import { useEffect, useState } from 'react';

// Zeigt das gerade aufgenommene Foto, während die Erkennung läuft: Eine
// Scanleiste fährt über das Bild, dazu Eck-Markierungen wie bei einem Sucher
// und ein Statustext, der durch `steps` weiterläuft. Gedacht für Beleg- und
// Mahlzeit-Scan (Finanz-Wizard bzw. Ernährungs-Menü).
//
// src    Objekt-URL des Fotos (URL.createObjectURL) — Aufräumen macht der Aufrufer
// steps  Statustexte; der letzte bleibt stehen, bis das Ergebnis da ist
export default function ScanPreview({ src, steps }) {
  const [step, setStep] = useState(0);

  useEffect(() => {
    setStep(0);
    if (!steps || steps.length < 2) return undefined;
    const id = setInterval(() => setStep((s) => Math.min(s + 1, steps.length - 1)), 1500);
    return () => clearInterval(id);
  }, [steps]);

  return (
    <div className="scan-preview" role="status" aria-live="polite">
      <div className="scan-frame">
        <img className="scan-img" src={src} alt="" />
        <div className="scan-tint" />
        <div className="scan-bar" />
        <span className="scan-corner scan-corner-tl" />
        <span className="scan-corner scan-corner-tr" />
        <span className="scan-corner scan-corner-bl" />
        <span className="scan-corner scan-corner-br" />
      </div>
      <div className="scan-label">{steps?.[step] || 'Foto wird gelesen…'}</div>
    </div>
  );
}
