import { useState } from 'react';
import { saveList } from '../../modules/shopping/lib/shoData';

const ICONS = ['🛒','🥦','🥩','🍞','🧴','🏠','💊','🐾','🍷','👕','🔧','🎁'];
const TODAY  = () => new Date().toISOString().slice(0, 10);

export default function ShoppingQuickSheet({ onClose, onSaved }) {
  const [name,        setName]        = useState('');
  const [icon,        setIcon]        = useState('🛒');
  const [dueDate,     setDueDate]     = useState('');
  const [dueTime,     setDueTime]     = useState('');
  const [store,       setStore]       = useState('');
  const [saving,      setSaving]      = useState(false);
  const [error,       setError]       = useState('');

  async function submit() {
    if (!name.trim()) { setError('Bitte einen Namen eingeben'); return; }
    setSaving(true); setError('');
    try {
      await saveList({
        name:       name.trim(),
        icon,
        due_date:   dueDate  || null,
        due_time:   dueTime  || null,
        store_name: store.trim() || null,
      });
      onSaved?.();
      onClose();
    } catch { setError('Speichern fehlgeschlagen'); }
    finally { setSaving(false); }
  }

  return (
    <div className="sheet-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="sheet">
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

          {/* Laden */}
          <input className="qsheet-input" type="text"
            placeholder="Geschäft (optional)"
            value={store} onChange={(e) => setStore(e.target.value)} />

          {/* Datum + Uhrzeit */}
          <div className="qsheet-row-half">
            <div>
              <div className="qsheet-label">Fällig am (optional)</div>
              <input className="qsheet-input" type="date"
                value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            </div>
            <div>
              <div className="qsheet-label">Uhrzeit (optional)</div>
              <input className="qsheet-input" type="time"
                value={dueTime} onChange={(e) => setDueTime(e.target.value)} />
            </div>
          </div>

          {error && <div className="qsheet-error">{error}</div>}

          <button className="sheet-save" disabled={saving || !name.trim()} onClick={submit}>
            {saving ? 'Wird gespeichert…' : 'Liste anlegen'}
          </button>
        </div>
      </div>
    </div>
  );
}
