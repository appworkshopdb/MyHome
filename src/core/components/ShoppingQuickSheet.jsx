import { useState } from 'react';
import { saveList } from '../../modules/shopping/lib/shoData';
import { STORES, DAY_PARTS } from '../../modules/shopping/lib/data/stores';
import SheetShell from './SheetShell';

const ICONS = ['🛒','🥦','🥩','🍞','🧴','🏠','💊','🐾','🍷','👕','🔧','🎁'];

// Läden nach Gruppe sortiert für den <select> — gleiche Aufbereitung wie
// in ListView.jsx, damit beide Stellen exakt gleich aussehen.
const STORE_GROUPS = STORES.reduce((acc, s) => {
  (acc[s.group] ??= []).push(s.name);
  return acc;
}, {});

export default function ShoppingQuickSheet({ onClose, onSaved }) {
  const [name,        setName]        = useState('');
  const [icon,        setIcon]        = useState('🛒');
  const [dueDate,     setDueDate]     = useState('');
  const [dueTime,     setDueTime]     = useState(''); // Tageszeit-Wert, KEINE Uhrzeit — siehe DAY_PARTS
  const [store,       setStore]       = useState(''); // Ladenname oder '__custom'
  const [storeCustom, setStoreCustom] = useState('');
  const [saving,      setSaving]      = useState(false);
  const [error,       setError]       = useState('');

  async function submit() {
    if (!name.trim()) { setError('Bitte einen Namen eingeben'); return; }
    setSaving(true); setError('');
    try {
      const storeName = store === '__custom' ? storeCustom.trim() : store || null;
      await saveList({
        name:         name.trim(),
        icon,
        due_date:     dueDate  || null,
        due_time:     dueTime  || null,
        store_name:   storeName || null,
        store_custom: store === '__custom' ? (storeCustom.trim() || null) : null,
      });
      onSaved?.();
      onClose();
    } catch { setError('Speichern fehlgeschlagen'); }
    finally { setSaving(false); }
  }

  return (
    <SheetShell onClose={onClose}>
        <div className="sheet-header">
          <span className="sheet-title">Neue Einkaufsliste</span>
          <button className="sheet-cancel" onClick={onClose}>Abbrechen</button>
        </div>

        <div className="qsheet-body">
          {/* Icon */}
          <div className="qsheet-icon-grid qsheet-icon-grid--sm">
            {ICONS.map((ic) => (
              <button key={ic} className={`qsheet-icon-btn ${icon === ic ? 'active' : ''}`}
                onClick={() => setIcon(ic)}>{ic}</button>
            ))}
          </div>

          {/* Name */}
          <input className="qsheet-input qsheet-input--lg" type="text"
            placeholder="Name der Liste (z.B. Wocheneinkauf)"
            value={name} onChange={(e) => setName(e.target.value)}
            autoFocus onKeyDown={(e) => e.key === 'Enter' && submit()} />

          {/* Laden — gruppierter Dropdown, identisch zu ListView.jsx */}
          <div className="qsheet-label">Laden</div>
          <select className="qsheet-input" value={store} onChange={(e) => setStore(e.target.value)}>
            <option value="">Kein Laden / Egal</option>
            {Object.entries(STORE_GROUPS).map(([group, names]) => (
              <optgroup key={group} label={group}>
                {names.map((n) => <option key={n} value={n}>{n}</option>)}
              </optgroup>
            ))}
            <optgroup label="Eigener Laden">
              <option value="__custom">+ Eigener Laden …</option>
            </optgroup>
          </select>
          {store === '__custom' && (
            <input className="qsheet-input" type="text" placeholder="Name des Ladens"
              value={storeCustom} onChange={(e) => setStoreCustom(e.target.value)}
              maxLength={60} autoFocus />
          )}

          {/* Datum + Tageszeit */}
          <div className="qsheet-row-half">
            <div>
              <div className="qsheet-label">Fällig am (optional)</div>
              <input className="qsheet-input" type="date"
                value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            </div>
            <div>
              <div className="qsheet-label">Tageszeit (optional)</div>
              <select className="qsheet-input" value={dueTime} onChange={(e) => setDueTime(e.target.value)}>
                <option value="">Optional</option>
                {DAY_PARTS.map((d) => (
                  <option key={d.value} value={d.value}>{d.icon} {d.label}</option>
                ))}
              </select>
            </div>
          </div>

          {error && <div className="qsheet-error">{error}</div>}

          <button className="sheet-save" disabled={saving || !name.trim()} onClick={submit}>
            {saving ? 'Wird gespeichert…' : 'Liste anlegen'}
          </button>
        </div>
      </SheetShell>
    
  );
}
