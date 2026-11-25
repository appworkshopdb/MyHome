import { useState } from 'react';
import UnitVisual from './UnitVisual';
import MusclePicker from './MusclePicker';
import SportSymbol from './SportSymbol';
import { muscleLabel, resolveUnitVisual } from '../lib/planMuscles';
import { OWN_CATEGORIES, SYMBOL_CATEGORY, SYMBOL_KEYS, SYMBOL_LABELS, categoryOfType } from '../lib/sportSymbols';

// Eigene Einheit anlegen oder bearbeiten — EIN Formular für alle Stellen (Plus-Menü
// "Eigene Einheit", Galerie "Eigene" › "Neue Einheit", Bereich "Einheiten").
// Bild = ein Symbol (Sportarten, Aktivitäten) ODER Muskeln (Krafttraining); die
// Kategorie (Kraft, Ausdauer, Mobility, Sport) zählt für die Auswertung und wird
// aus dem Symbol vorgeschlagen. Der Name folgt bei Muskeln der Auswahl ("Brust & Beine"),
// bis man ihn selbst ändert. onSave(draft) darf werfen, dann bleibt das Formular offen.
//   draft = { title, icon, muscle_groups, type_key }
export default function OwnUnitForm({ initial, onSave, onCancel, saveLabel = 'Speichern', cancelLabel = 'Abbrechen', onDelete }) {
  const start = initial ? resolveUnitVisual(initial) : { tags: [], icon: '' };
  const startCat = initial ? categoryOfType(initial.type_key, start.tags.length > 0) : 'sport';

  const [mode, setMode] = useState(start.tags.length ? 'muskeln' : 'symbol');
  const [muscles, setMuscles] = useState(start.tags);
  const [symbol, setSymbol] = useState(start.tags.length ? '' : (start.icon || ''));
  const [cat, setCat] = useState(startCat);
  const [catTouched, setCatTouched] = useState(Boolean(initial));
  const [name, setName] = useState(initial?.title ?? '');
  const [nameTouched, setNameTouched] = useState(Boolean(initial?.title));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const autoName = mode === 'muskeln' ? muscles.map(muscleLabel).join(' & ') : '';
  const shown = nameTouched ? name : (autoName || name);
  const category = OWN_CATEGORIES.find((c) => c.key === cat) ?? OWN_CATEGORIES[3];
  const preview = mode === 'muskeln' ? { tags: muscles, icon: '' } : { tags: [], icon: symbol || 'stern' };

  function chooseMode(next) {
    setMode(next); setError('');
    if (!catTouched) setCat(next === 'muskeln' ? 'kraft' : (SYMBOL_CATEGORY[symbol] ?? 'sport'));
  }
  function chooseSymbol(key) {
    setSymbol(key); setError('');
    if (!catTouched) setCat(SYMBOL_CATEGORY[key] ?? 'sport');
  }

  async function save() {
    if (!shown.trim()) return setError('Bitte einen Namen eingeben.');
    if (mode === 'symbol' && !symbol) return setError('Bitte ein Symbol wählen.');
    if (mode === 'muskeln' && muscles.length === 0) return setError('Bitte mindestens einen Muskel wählen.');
    // Unveränderte Kategorie einer älteren Einheit: ihren Typ behalten (z. B. 'sport.boxen')
    const typeKey = initial && cat === startCat && initial.type_key ? initial.type_key : category.type_key;
    setBusy(true); setError('');
    try {
      await onSave({
        title: shown.trim(),
        icon: mode === 'symbol' ? symbol : null,
        muscle_groups: mode === 'muskeln' ? muscles : [],
        type_key: typeKey,
      });
    } catch { setError('Speichern fehlgeschlagen.'); setBusy(false); }
  }

  async function remove() {
    setBusy(true); setError('');
    try { await onDelete(); }
    catch { setError('Löschen fehlgeschlagen.'); setBusy(false); }
  }

  return (
    <div className="up ou">
      <div className="ou-prev">
        <UnitVisual tags={preview.tags} icon={preview.icon} size={48} max={3} />
        <div>
          <small>Eigene Einheit · {category.label}</small>
          <b>{shown.trim() || 'Neue Einheit'}</b>
        </div>
      </div>

      <label className="ou-lbl" htmlFor="ou-name">Name</label>
      <input id="ou-name" className="ou-in" type="text" value={shown} onChange={(e) => { setName(e.target.value); setNameTouched(true); setError(''); }} placeholder="z. B. Klettern, Oberkörper leicht" autoComplete="off" />

      <div className="ou-lbl">Bild</div>
      <div className="up-seg" role="tablist" aria-label="Bild">
        <button type="button" role="tab" aria-selected={mode === 'symbol'} className={mode === 'symbol' ? 'is-on' : ''} onClick={() => chooseMode('symbol')}>Symbol</button>
        <button type="button" role="tab" aria-selected={mode === 'muskeln'} className={mode === 'muskeln' ? 'is-on' : ''} onClick={() => chooseMode('muskeln')}>Muskeln</button>
      </div>
      <p className="ou-hint">{mode === 'symbol' ? 'Für Sportarten und Aktivitäten ohne bestimmte Muskeln.' : 'Für Krafttraining: die Muskelbilder werden zum Bild der Einheit.'}</p>

      {mode === 'symbol' ? (
        <div className="ou-syms" role="radiogroup" aria-label="Symbol">
          {SYMBOL_KEYS.map((key) => (
            <button key={key} type="button" role="radio" aria-checked={symbol === key} className={symbol === key ? 'is-on' : ''} onClick={() => chooseSymbol(key)}>
              <SportSymbol name={key} size={24} />
              <span>{SYMBOL_LABELS[key]}</span>
            </button>
          ))}
        </div>
      ) : (
        <MusclePicker value={muscles} onChange={(v) => { setMuscles(v); setError(''); }} />
      )}

      <div className="ou-lbl">Kategorie</div>
      <div className="ou-chips" role="radiogroup" aria-label="Kategorie">
        {OWN_CATEGORIES.map((c) => (
          <button key={c.key} type="button" role="radio" aria-checked={cat === c.key} className={cat === c.key ? 'is-on' : ''} onClick={() => { setCat(c.key); setCatTouched(true); }}>{c.label}</button>
        ))}
      </div>
      <p className="ou-hint">Bestimmt, wo die Einheit in der Auswertung zählt.</p>

      {onDelete && (
        <button type="button" className="up-delete" onClick={remove} disabled={busy}>Diese Einheit löschen</button>
      )}
      {error && <p className="up-error" role="alert">{error}</p>}
      <div className="up-foot up-foot--two">
        <button type="button" className="btn btn-secondary" onClick={onCancel} disabled={busy}>{cancelLabel}</button>
        <button type="button" className="btn btn-primary" onClick={save} disabled={busy}>{busy ? 'Speichert…' : saveLabel}</button>
      </div>
    </div>
  );
}
