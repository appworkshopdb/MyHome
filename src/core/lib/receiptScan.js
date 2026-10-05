// src/core/lib/receiptScan.js
// Kassenbon-Scan: Foto verkleinern und an die Edge Function "scan-receipt"
// schicken. Die Function liest Betrag/Händler/Datum per Claude Vision und
// speichert nichts — das Ergebnis dient nur zum Vorbefüllen eines Formulars.

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

// Lange Kante in Pixeln. Bons sind schmal und hoch; 1600 px lassen kleine
// Schrift lesbar und halten Upload (~200–500 KB) und API-Kosten niedrig.
const MAX_EDGE = 1600;
const JPEG_QUALITY = 0.82;
const TIMEOUT_MS = 45000;

async function loadBitmap(file) {
  // imageOrientation respektiert die EXIF-Drehung (Handy-Fotos im Hochformat).
  if (typeof createImageBitmap === 'function') {
    try { return await createImageBitmap(file, { imageOrientation: 'from-image' }); }
    catch { /* Fallback unten */ }
  }
  const url = URL.createObjectURL(file);
  try {
    return await new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('Bild konnte nicht geladen werden'));
      img.src = url;
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}

// → Base64 (ohne "data:"-Präfix) eines auf MAX_EDGE verkleinerten JPEGs
export async function prepareReceiptImage(file) {
  const bmp = await loadBitmap(file);
  const w = bmp.width || bmp.naturalWidth;
  const h = bmp.height || bmp.naturalHeight;
  const scale = Math.min(1, MAX_EDGE / Math.max(w, h));
  const canvas = document.createElement('canvas');
  canvas.width  = Math.max(1, Math.round(w * scale));
  canvas.height = Math.max(1, Math.round(h * scale));
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#fff'; // PNG mit Transparenz → weißer statt schwarzer Grund
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(bmp, 0, 0, canvas.width, canvas.height);
  bmp.close?.();

  const blob = await new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Bild konnte nicht verkleinert werden'))), 'image/jpeg', JPEG_QUALITY));

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload  = () => resolve(String(reader.result).split(',')[1]);
    reader.onerror = () => reject(new Error('Bild konnte nicht gelesen werden'));
    reader.readAsDataURL(blob);
  });
}

/**
 * Liest einen Kassenbon.
 * @param {object} session  Supabase-Session (access_token)
 * @param {File}   file     Foto aus <input type="file">
 * @returns {Promise<{is_receipt:boolean,total:number|null,merchant:string|null,
 *                    date:string|null,payment_method:string}>}
 *   date ist ein "YYYY-MM-DD"-String (kein Date-Objekt, keine UTC-Umrechnung).
 */
export async function scanReceipt(session, file) {
  const image = await prepareReceiptImage(file);

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/scan-receipt`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ image, media_type: 'image/jpeg' }),
      signal: ctrl.signal,
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) throw new Error(data?.error || 'Beleg konnte nicht gelesen werden');
    return data.receipt;
  } catch (err) {
    if (err.name === 'AbortError') throw new Error('Das Lesen hat zu lange gedauert – bitte nochmal versuchen');
    if (err instanceof TypeError) throw new Error('Keine Verbindung zum Server');
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

// "2026-10-03" → "03.10.2026" (reine String-Operation, siehe CLAUDE.md)
export function formatReceiptDate(ymd) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd || '');
  return m ? `${m[3]}.${m[2]}.${m[1]}` : '';
}
