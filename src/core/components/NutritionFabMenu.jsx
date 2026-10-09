import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../lib/AuthContext';
import { scanMeal, getMealQuota, holdScanAnimation } from '../lib/photoScan';
import SheetShell from './SheetShell';
import ScanPreview from './ScanPreview';

// Ernährung hat drei Anlege-Wege (Rezept, Lebensmittel, Mahlzeit per Foto), die
// in modules/nutrition/ mit eigenen Dialogen leben (RecipeEditorModal,
// FoodFormModal, MealScanModal). core/ darf nicht direkt aus modules/
// importieren — deshalb feuert die Auswahl hier ein window-Event, genau wie
// sport:data-changed, nur in die andere Richtung. NutritionModule.jsx hört zu
// und öffnet den passenden Dialog selbst.
const OPTIONS = [
  { event: 'nutrition:new-recipe', icon: '📖', label: 'Neues Rezept' },
  { event: 'nutrition:new-food',   icon: '🥗', label: 'Neues Lebensmittel' },
];

const SCAN_STEPS = ['Mahlzeit wird analysiert…', 'Bestandteile werden erkannt…', 'Nährwerte werden geschätzt…'];

export default function NutritionFabMenu({ onClose }) {
  const { session } = useAuth();
  const cameraRef  = useRef(null);
  const galleryRef = useRef(null);
  const mountedRef = useRef(true);
  const [busy, setBusy]       = useState(false);
  const [preview, setPreview] = useState(null); // Objekt-URL des aufgenommenen Fotos
  const [error, setError]     = useState('');
  const [quota, setQuota]     = useState(null); // { limit, used, remaining } oder null (unbekannt)

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const loadQuota = () => getMealQuota(session).then(setQuota);
  useEffect(() => { if (session) loadQuota(); }, [session]); // eslint-disable-line react-hooks/exhaustive-deps
  const limitReached = quota !== null && quota.remaining <= 0;

  function choose(eventName) {
    window.dispatchEvent(new Event(eventName));
    onClose();
  }

  // Mahlzeit-Foto: Kamera/Galerie → Edge Function → Ergebnis per Event ans Modul.
  // Das Öffnen des Datei-Dialogs muss im selben Tap passieren (iOS), deshalb
  // klickt der Button direkt den versteckten Input. Währenddessen läuft die
  // Scan-Animation über dem Foto. Wurde das Menü inzwischen geschlossen, wird
  // das Ergebnis verworfen (der Scan zählt trotzdem gegen das Kontingent).
  async function handleFile(e) {
    const file = e.target.files?.[0];
    e.target.value = ''; // gleiches Foto später erneut wählbar
    if (!file) return;
    const url = URL.createObjectURL(file);
    setPreview(url);
    setBusy(true);
    setError('');
    const started = Date.now();
    try {
      const meal = await scanMeal(session, file);
      await holdScanAnimation(started); // Animation nie nur aufblitzen lassen
      if (!mountedRef.current) return;
      if (!meal?.is_meal) {
        setError('Auf dem Foto ist kein Essen zu erkennen. Bitte nochmal versuchen.');
        return;
      }
      window.dispatchEvent(new CustomEvent('nutrition:meal-scanned', { detail: meal }));
      onClose();
    } catch (err) {
      console.error('[meal-scan]', err);
      if (mountedRef.current) setError(err.message || 'Mahlzeit konnte nicht gelesen werden');
    } finally {
      URL.revokeObjectURL(url);
      if (mountedRef.current) {
        setBusy(false);
        setPreview(null);
        loadQuota();
      }
    }
  }

  return (
    <SheetShell onClose={onClose}>
      <div className="sheet-header">
        <span className="sheet-title">{preview ? 'Mahlzeit wird gescannt' : 'Was möchtest du anlegen?'}</span>
        <button className="sheet-cancel" onClick={onClose}>Abbrechen</button>
      </div>

      <div className="qsheet-body">
        {preview ? (
          <ScanPreview src={preview} steps={SCAN_STEPS} />
        ) : (
          <>
            <div className="qsheet-mode-grid">
              {OPTIONS.map((o) => (
                <button
                  key={o.event}
                  className="qsheet-mode-btn"
                  disabled={busy}
                  onClick={() => choose(o.event)}
                >
                  {o.icon} {o.label}
                </button>
              ))}
              <button
                className="qsheet-mode-btn"
                style={{ gridColumn: '1 / -1' }}
                disabled={busy || limitReached}
                onClick={() => cameraRef.current?.click()}
              >
                📷 Mahlzeit scannen
              </button>
            </div>

            {!limitReached && (
              <button type="button" className="wiz-scan-alt" style={{ alignSelf: 'center' }} onClick={() => galleryRef.current?.click()}>
                Mahlzeit-Foto aus der Galerie wählen
              </button>
            )}
            {quota && (
              <div className="wiz-scan-quota t-meta">
                {limitReached
                  ? `Monatslimit von ${quota.limit} Mahlzeit-Scans erreicht.`
                  : `Noch ${quota.remaining} von ${quota.limit} Mahlzeit-Scans in diesem Monat`}
              </div>
            )}
          </>
        )}

        {/* Limit-Fehler nicht doppelt zeigen: der Hinweis oben sagt dasselbe */}
        {error && !(limitReached && error.startsWith('Monatslimit')) && (
          <div className="wiz-scan-error t-meta" role="alert">{error}</div>
        )}

        <input ref={cameraRef}  type="file" accept="image/*" capture="environment" hidden onChange={handleFile} />
        <input ref={galleryRef} type="file" accept="image/*" hidden onChange={handleFile} />
      </div>
    </SheetShell>
  );
}
