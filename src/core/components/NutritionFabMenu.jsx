import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../lib/AuthContext';
import { scanMeal, getMealQuota } from '../lib/photoScan';
import SheetShell from './SheetShell';

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

export default function NutritionFabMenu({ onClose }) {
  const { session } = useAuth();
  const cameraRef  = useRef(null);
  const galleryRef = useRef(null);
  const [busy, setBusy]   = useState(false);
  const [error, setError] = useState('');
  const [quota, setQuota] = useState(null); // { limit, used, remaining } oder null (unbekannt)

  const loadQuota = () => getMealQuota(session).then(setQuota);
  useEffect(() => { if (session) loadQuota(); }, [session]); // eslint-disable-line react-hooks/exhaustive-deps
  const limitReached = quota !== null && quota.remaining <= 0;

  function choose(eventName) {
    window.dispatchEvent(new Event(eventName));
    onClose();
  }

  // Mahlzeit-Foto: Kamera/Galerie → Edge Function → Ergebnis per Event ans Modul.
  // Das Öffnen des Datei-Dialogs muss im selben Tap passieren (iOS), deshalb
  // klickt der Button direkt den versteckten Input.
  async function handleFile(e) {
    const file = e.target.files?.[0];
    e.target.value = ''; // gleiches Foto später erneut wählbar
    if (!file) return;
    setBusy(true);
    setError('');
    try {
      const meal = await scanMeal(session, file);
      if (!meal?.is_meal) {
        setError('Auf dem Foto ist kein Essen zu erkennen. Bitte nochmal versuchen.');
        return;
      }
      window.dispatchEvent(new CustomEvent('nutrition:meal-scanned', { detail: meal }));
      onClose();
    } catch (err) {
      console.error('[meal-scan]', err);
      setError(err.message || 'Mahlzeit konnte nicht gelesen werden');
    } finally {
      setBusy(false);
      loadQuota();
    }
  }

  return (
    <SheetShell onClose={onClose}>
      <div className="sheet-header">
        <span className="sheet-title">Was möchtest du anlegen?</span>
        <button className="sheet-cancel" onClick={onClose}>Abbrechen</button>
      </div>

      <div className="qsheet-body">
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
            {busy ? '📷 Mahlzeit wird analysiert…' : '📷 Mahlzeit scannen'}
          </button>
        </div>

        {!busy && !limitReached && (
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
