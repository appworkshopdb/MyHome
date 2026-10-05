import { useRef, useState } from 'react';
import { useAuth } from '../lib/AuthContext';
import { useUi } from '../lib/UiContext';
import { scanReceipt } from '../lib/receiptScan';

// Zwei Wege zum Foto: Kamera direkt (capture) oder vorhandenes Bild aus
// Galerie/Dateien. Letzteres braucht man auch am Desktop, wo es keine Kamera
// im Datei-Dialog gibt. onResult bekommt das geprüfte Ergebnis der Function.
export default function ReceiptScanButton({ onResult, disabled }) {
  const { session }   = useAuth();
  const { showToast } = useUi();
  const cameraRef  = useRef(null);
  const galleryRef = useRef(null);
  const [busy, setBusy] = useState(false);

  async function handleFile(e) {
    const file = e.target.files?.[0];
    e.target.value = ''; // gleiches Foto später erneut wählbar
    if (!file) return;
    setBusy(true);
    try {
      const receipt = await scanReceipt(session, file);
      onResult(receipt);
    } catch (err) {
      showToast(err.message || 'Beleg konnte nicht gelesen werden', 3200);
    } finally {
      setBusy(false);
    }
  }

  return (
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
  );
}
