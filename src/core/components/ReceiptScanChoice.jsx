import { useRef, useState } from 'react';
import { useAuth } from '../lib/AuthContext';
import { scanReceipt } from '../lib/receiptScan';
import { IconEdit } from './Icons';

// Einstieg des Finanz-Wizards: "Beleg scannen" oder "Manuelle Eingabe".
// Der Scan-Button öffnet direkt die Kamera (capture) — das Öffnen des
// Datei-Dialogs muss im selben Tap passieren, sonst blockt iOS es.
// "Foto auswählen" nimmt ein vorhandenes Bild (auch für den Desktop-Test).
// Bei Erfolg ruft die Komponente onScanned(receipt); Fehler und
// "kein Kassenbon" bleiben hier stehen, damit man es erneut versuchen oder
// auf manuell wechseln kann.
function IconCamera() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
      <circle cx="12" cy="13" r="4" />
    </svg>
  );
}

export default function ReceiptScanChoice({ onScanned, onManual }) {
  const { session } = useAuth();
  const cameraRef  = useRef(null);
  const galleryRef = useRef(null);
  const [busy, setBusy]   = useState(false);
  const [error, setError] = useState('');

  async function handleFile(e) {
    const file = e.target.files?.[0];
    e.target.value = ''; // gleiches Foto später erneut wählbar
    if (!file) return;
    setBusy(true);
    setError('');
    try {
      const receipt = await scanReceipt(session, file);
      if (!receipt?.is_receipt) {
        setError('Das sieht nicht nach einem Kassenbon aus. Bitte nochmal versuchen oder manuell eingeben.');
      } else {
        onScanned(receipt);
      }
    } catch (err) {
      console.error('[receipt-scan]', err);
      setError(err.message || 'Beleg konnte nicht gelesen werden');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="wiz-mode-wrap">
      <div className="wiz-mode-grid">
        <button
          type="button"
          className="wiz-mode"
          disabled={busy}
          onClick={() => cameraRef.current?.click()}
        >
          <span className="wiz-mode-icon"><IconCamera /></span>
          <span className="wiz-mode-title">{busy ? 'Beleg wird gelesen…' : 'Beleg scannen'}</span>
          <span className="wiz-mode-sub">Foto vom Kassenbon</span>
        </button>

        <button
          type="button"
          className="wiz-mode"
          disabled={busy}
          onClick={onManual}
        >
          <span className="wiz-mode-icon"><IconEdit /></span>
          <span className="wiz-mode-title">Manuelle Eingabe</span>
          <span className="wiz-mode-sub">Selbst eintragen</span>
        </button>
      </div>

      {!busy && (
        <button type="button" className="wiz-scan-alt" onClick={() => galleryRef.current?.click()}>
          Foto aus der Galerie wählen
        </button>
      )}
      {error && <div className="wiz-scan-error t-meta" role="alert">{error}</div>}

      <input ref={cameraRef}  type="file" accept="image/*" capture="environment" hidden onChange={handleFile} />
      <input ref={galleryRef} type="file" accept="image/*" hidden onChange={handleFile} />
    </div>
  );
}
