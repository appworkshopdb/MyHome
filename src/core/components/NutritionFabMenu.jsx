import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../lib/AuthContext';
import { scanMeal, getMealQuota, holdScanAnimation } from '../lib/photoScan';
import SheetShell from './SheetShell';
import ScanPreview from './ScanPreview';
import { UiIcon } from './ModuleIcons';

// Ernährung hat vier Anlege-Wege (Rezept, Lebensmittel, Mahlzeit per Foto,
// Rezept als gegessene Mahlzeit), die in modules/nutrition/ mit eigenen Dialogen
// leben (RecipeEditorModal, FoodFormModal, MealScanModal, LogRecipeModal). core/ darf nicht direkt aus modules/
// importieren — deshalb feuert die Auswahl hier ein window-Event, genau wie
// sport:data-changed, nur in die andere Richtung. NutritionModule.jsx hört zu
// und öffnet den passenden Dialog selbst.
// Gruppiert: „Heute gegessen“ (Erfassen) und „Deine Sammlung“ (Anlegen).
const GROUPS = [
  { label: 'Heute gegessen', rows: [
    { scan: true, icon: 'camera', title: 'Mahlzeit scannen', sub: 'Foto machen, Nährwerte werden geschätzt' },
    { event: 'nutrition:log-meal', icon: 'clipcheck', title: 'Rezept eintragen', sub: 'Als gegessen verbuchen, zählt zum Tagesziel' },
  ] },
  { label: 'Deine Sammlung', soft: true, rows: [
    { event: 'nutrition:new-recipe', icon: 'book', title: 'Neues Rezept', sub: 'Zutaten wählen, Nährwerte rechnet die App' },
    { event: 'nutrition:new-food', icon: 'leaf', title: 'Neues Lebensmittel', sub: 'Eigener Eintrag für die Datenbank' },
  ] },
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
            <div className="ax-menu">
              {GROUPS.map((g) => (
                <div key={g.label}>
                  <div className="ax-sec">{g.label}</div>
                  {g.rows.map((r) => (
                    <button
                      key={r.title}
                      type="button"
                      className="ax-menurow"
                      disabled={busy || (r.scan && limitReached)}
                      onClick={() => (r.scan ? cameraRef.current?.click() : choose(r.event))}
                    >
                      <span className={`ax-ico${g.soft ? ' soft' : ''}`}><UiIcon name={r.icon} /></span>
                      <span>{r.title}<small>{r.sub}</small></span>
                      <span className="chev" aria-hidden="true">›</span>
                    </button>
                  ))}
                </div>
              ))}
            </div>

            {!limitReached && (
              <button type="button" className="ax-link" onClick={() => galleryRef.current?.click()}>
                Mahlzeit-Foto aus der Galerie wählen
              </button>
            )}
            {quota && (
              <div className="ax-quota">
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
