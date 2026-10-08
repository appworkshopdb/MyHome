import { useRef, useState } from 'react';
import { useAuth } from '../lib/AuthContext';
import { scanReceipt } from '../lib/receiptScan';

// Zwei Wege zum Foto: Kamera direkt (capture) oder vorhandenes Bild aus
// Galerie/Dateien. Letzteres braucht man auch am Desktop, wo es keine Kamera
// im Datei-Dialog gibt. onResult bekommt das geprüfte Ergebnis der Function.
export default function ReceiptScanButton({ onResult, disabled }) {
  const { session }   = useAuth();
  const cameraRef  = useRef(null);
  const galleryRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function handleFile(e) {
    const file = e.target.files?.[0];
    e.target.value = ''; // gleiches Foto später erneut wählbar
    if (!file) return;
    setBusy(true);
    setError('');
    try {
      const receipt = await scanReceipt(session, file);
      onResult(receipt);
    } catch (err) {
      // Inline statt Toast: Der Toast ist einzeilig (nowrap) und würde lange
      // Fehlerdetails abschneiden.
      console.error('[receipt-scan]', err);
      setError(err.message || 'Beleg konnte nicht gelesen werden');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="wiz-scan-wrap">
    <div className="wiz-scan">
      <button
        type="button"
        className="btn btn-secondary wiz-scan-btn"
        disabled={busy || disabled}
        onClick={() => cameraRef.current?.click()}
      >
        {busy ? 'Beleg wird gelesen…' : '📷 Beleg scannen'}
      </button>
      {!busy && (
        <button
          type="button"
          className="wiz-scan-alt"
          disabled={disabled}
          onClick={() => galleryRef.current?.click()}
        >
          Foto auswählen
        </button>
      )}
      <input ref={cameraRef}  type="file" accept="image/*" capture="environment" hidden onChange={handleFile} />
      <input ref={galleryRef} type="file" accept="image/*" hidden onChange={handleFile} />
    </div>
    {error && <div className="wiz-scan-error t-meta" role="alert">{error}</div>}
    </div>
  );
}
