import { useState } from 'react';
import UnitVisual from './UnitVisual';
import MusclePicker from './MusclePicker';
import { muscleLabel } from '../lib/planMuscles';

// Eigene Einheit aus gewählten Muskeln: Anlegen (Galerie, "Eigene Einheit
// zusammenstellen") und Bearbeiten ("Eigene Einheiten verwalten"). Der Name folgt
// der Auswahl ("Brust + Beine"), solange man ihn nicht selbst ändert; beim
// Bearbeiten bleibt der vorhandene Name stehen. Die Bilder ergeben sich aus den
// Muskeln. onSave(draft) darf einen Fehler werfen, dann bleibt das Formular offen.
export default function OwnUnitForm({ initial, onSave, onCancel, saveLabel = 'Speichern und wählen', cancelLabel = 'Zurück', onDelete }) {
  const [muscles, setMuscles] = useState(initial?.muscle_groups ?? []);
  const [name, setName] = useState(initial?.title ?? '');
  const [touched, setTouched] = useState(Boolean(initial?.title));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const shown = touched ? name : muscles.map(muscleLabel).join(' + ');

  async function save() {
    if (muscles.length === 0) return setError('Bitte mindestens einen Muskel wählen.');
    if (!shown.trim()) return setError('Bitte einen Namen eingeben.');
    setBusy(true); setError('');
    try { await onSave({ title: shown.trim(), muscle_groups: muscles }); }
    catch { setError('Speichern fehlgeschlagen.'); setBusy(false); }
  }

  async function remove() {
    setBusy(true); setError('');
    try { await onDelete(); }
    catch { setError('Löschen fehlgeschlagen.'); setBusy(false); }
  }

  return (
    <div className="up">
      <div className="up-own-h">
        <UnitVisual tags={muscles} size={44} max={3} />
        <div>
          <small>Eigene Einheit</small>
          <b>{shown.trim() || 'Muskeln wählen'}</b>
        </div>
      </div>
      <div className="form-group" style={{ margin: 0 }}>
        <label htmlFor="up-own-name">Name</label>
        <input id="up-own-name" type="text" value={shown} onChange={(e) => { setName(e.target.value); setTouched(true); }} placeholder="z. B. Brust + Beine" autoComplete="off" />
      </div>
      <MusclePicker value={muscles} onChange={setMuscles} />
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
