// src/core/lib/photoScan.js
// Foto-Scans: Foto verkleinern und an die Edge Function "scan-receipt"
// schicken. Dieselbe Function bedient zwei Arten (Feld `kind`):
//   'receipt'  Kassenbon → Betrag/Händler/Datum/Zahlungsart (Finanzen)
//   'meal'     Mahlzeit  → geschätzte Bestandteile und Nährwerte (Ernährung)
// Sie speichert nichts — das Ergebnis dient nur zum Vorbefüllen bzw. Anzeigen.
// Jede Art hat ihr eigenes Monatskontingent.

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

// Gemeinsamer Weg für alle Arten: verkleinern, senden, Fehler verständlich
// machen. what = Wort für die Fehlermeldung ("Beleg" / "Mahlzeit").
async function postScan(kind, what, session, file) {
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
      body: JSON.stringify({ kind, image, media_type: 'image/jpeg' }),
      signal: ctrl.signal,
    });
    // Text zuerst lesen: Gateway-Fehler (Function fehlt, Boot-Fehler) kommen
    // nicht immer als JSON und würden sonst spurlos hinter der Standardmeldung
    // verschwinden.
    // Der Body kann mitten im Lesen abbrechen (Worker-Absturz, Gateway-Reset):
    // Die Antwort ist dann angekommen, nur unvollständig. Das darf nicht als
    // "keine Verbindung" gemeldet werden — der Statuscode ist die wichtige Info.
    let text = '';
    let bodyError = '';
    try { text = await res.text(); } catch (e) { bodyError = e.message; }
    let data = null;
    try { data = JSON.parse(text); } catch { /* kein JSON */ }
    if (!res.ok) {
      const base  = data?.error || `${what} konnte nicht gelesen werden`;
      const extra = data?.detail || data?.msg || data?.message
        || (data ? '' : text || (bodyError ? `Antwort abgebrochen: ${bodyError}` : ''));
      // Status/Ursache nur zeigen, wenn die Function keine eigene, verständliche Meldung lieferte
      const showWhy = !data?.error || data?.detail;
      throw new Error(showWhy ? `${base} (${res.status}${extra ? ': ' + String(extra).slice(0, 140) : ''})` : base);
    }
    return data;
  } catch (err) {
    if (err.name === 'AbortError') throw new Error('Das Lesen hat zu lange gedauert – bitte nochmal versuchen');
    // fetch() wirft TypeError, wenn gar keine Antwort ankommt (Server/Container
    // down, Gateway bricht ab, Upload zu groß, CORS). Der Browser sagt nicht
    // welcher Fall — Meldung und Bildgröße helfen bei der Eingrenzung.
    if (err instanceof TypeError) {
      const kb = Math.round(image.length * 0.75 / 1024);
      throw new Error(`Keine Verbindung zum Server (${err.message}; Bild ${kb} KB; ${new URL(SUPABASE_URL).host})`);
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
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
  const data = await postScan('receipt', 'Beleg', session, file);
  if (!data?.receipt) throw new Error('Unerwartete Antwort vom Server');
  return data.receipt;
}

/**
 * Schätzt eine Mahlzeit aus einem Foto.
 * @returns {Promise<{is_meal:boolean,name:string|null,
 *   items:Array<{name:string,grams:number,kcal:number,protein:number,carbs:number,
 *                sugar:number,fat:number,satfat:number,fiber:number,salt:number}>,
 *   kcal_low:number|null,kcal_high:number|null,note:string|null}>}
 *   Werte pro Bestandteil gelten für die geschätzte Menge (grams), nicht pro 100 g.
 */
export async function scanMeal(session, file) {
  const data = await postScan('meal', 'Mahlzeit', session, file);
  if (!data?.meal) throw new Error('Unerwartete Antwort vom Server');
  return data.meal;
}

/**
 * Restkontingent des Monats für die Anzeige ("noch 27 von 30 Scans").
 * Kostet nichts und zählt nicht. Gibt bei jedem Problem null zurück (z. B.
 * Function noch ohne Kontingent-Unterstützung) — die Anzeige fehlt dann
 * einfach, der Scan selbst bleibt davon unberührt.
 * @param {'receipt'|'meal'} kind  Art des Scans (jede hat ein eigenes Kontingent)
 * @returns {Promise<{limit:number,used:number,remaining:number}|null>}
 */
export async function getScanQuota(session, kind = 'receipt') {
  try {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/scan-receipt?kind=${encodeURIComponent(kind)}`, {
      headers: { Authorization: `Bearer ${session.access_token}` },
    });
    if (!res.ok) return null;
    const data = await res.json();
    const q = data?.quota;
    return q && Number.isFinite(q.limit) && Number.isFinite(q.remaining) ? q : null;
  } catch {
    return null;
  }
}

// Scan-Animation (ScanPreview): Die Erkennung dauert meist ein paar Sekunden,
// kann aber auch sehr schnell sein. Damit die Animation nie nur aufblitzt, hält
// der Aufrufer sie nach der Antwort bis zu dieser Mindestdauer (ab Start) an.
export const MIN_SCAN_ANIMATION_MS = 2400;
export function holdScanAnimation(startedAt) {
  const rest = MIN_SCAN_ANIMATION_MS - (Date.now() - startedAt);
  return rest > 0 ? new Promise((resolve) => setTimeout(resolve, rest)) : Promise.resolve();
}

export const getReceiptQuota = (session) => getScanQuota(session, 'receipt');
export const getMealQuota    = (session) => getScanQuota(session, 'meal');

// "2026-10-03" → "03.10.2026" (reine String-Operation, siehe CLAUDE.md)
export function formatReceiptDate(ymd) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd || '');
  return m ? `${m[3]}.${m[2]}.${m[1]}` : '';
}
