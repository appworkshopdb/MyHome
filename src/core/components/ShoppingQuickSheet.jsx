import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { saveList } from '../../modules/shopping/lib/shoData';
import { STORES, DAY_PARTS } from '../../modules/shopping/lib/data/stores';
import { ModuleIcon } from './ModuleIcons';

// „Neue Einkaufsliste“ — Vollseite mit Vorschaukarte (Variante B der Mockups):
// oben die Liste, wie sie später aussieht, darunter Icon, Name, Laden und Zeit.
// Wird vom globalen FAB und von der Einkaufs-Tour genutzt. Rendert per Portal
// an <body> (Fixed-Nav-Regel: kein transform-Vorfahr).

const ICONS = ['🛒','🥦','🥩','🍞','🧴','🏠','💊','🐾','🍷','👕','🔧','🎁'];

// Läden nach Gruppe sortiert für den <select> — gleiche Aufbereitung wie
// in ListView.jsx, damit beide Stellen exakt gleich aussehen.
const STORE_GROUPS = STORES.reduce((acc, s) => {
  (acc[s.group] ??= []).push(s.name);
  return acc;
}, {});

function formatDay(iso) {
  const d = new Date(`${iso}T00:00:00`);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('de-DE', { day: 'numeric', month: 'short' });
}

export default function ShoppingQuickSheet({ onClose, onSaved }) {
  const [name,        setName]        = useState('');
  const [icon,        setIcon]        = useState('🛒');
  const [dueDate,     setDueDate]     = useState('');
  const [dueTime,     setDueTime]     = useState(''); // Tageszeit-Wert, KEINE Uhrzeit — siehe DAY_PARTS
  const [store,       setStore]       = useState(''); // Ladenname oder '__custom'
  const [storeCustom, setStoreCustom] = useState('');
  const [saving,      setSaving]      = useState(false);
  const [error,       setError]       = useState('');

  // Hintergrund nicht mitscrollen lassen, solange die Vollseite offen ist
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, []);

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

  const storeLabel = store === '__custom' ? storeCustom.trim() : store;
  const part = DAY_PARTS.find((d) => d.value === dueTime);
  const meta = [storeLabel || 'Kein Laden', dueDate && formatDay(dueDate), part && part.label.toLowerCase()].filter(Boolean).join(' · ');

  return createPortal(
    <div className="ax-page" role="dialog" aria-modal="true" aria-label="Neue Einkaufsliste">
      <div className="ax-in">
        <div className="ax-top">
          <div className="tut-pill"><i><ModuleIcon id="shopping" size={17} strokeWidth={2} /></i>Einkauf</div>
          <button type="button" className="ax-cancel" onClick={onClose}>Abbrechen</button>
        </div>

        <div className="ax-scroll">
          <h1 className="ax-title">Neue Einkaufsliste</h1>

          <div className="ax-preview">
            <div className="big">{icon}</div>
            <div><strong>{name.trim() || 'Deine Liste'}</strong><span>{meta}</span></div>
          </div>

          <div>
            <span className="ax-label">Icon</span>
            <div className="ax-emos">
              {ICONS.map((ic) => (
                <button key={ic} type="button" aria-label={`Icon ${ic}`} aria-pressed={icon === ic} className={`ax-emo${icon === ic ? ' on' : ''}`} onClick={() => setIcon(ic)}>{ic}</button>
              ))}
            </div>
          </div>

          <div className="ax-field">
            <label htmlFor="ax-name">Name</label>
            <input id="ax-name" className="ax-input" type="text" placeholder="z. B. Wocheneinkauf"
              value={name} onChange={(e) => setName(e.target.value)}
              autoFocus onKeyDown={(e) => e.key === 'Enter' && submit()} />
          </div>

          {/* Laden — gruppierter Dropdown, identisch zu ListView.jsx */}
          <div className="ax-field">
            <label htmlFor="ax-store">Laden</label>
            <select id="ax-store" className="ax-select" value={store} onChange={(e) => setStore(e.target.value)}>
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
              <input className="ax-input" style={{ marginTop: 8 }} type="text" placeholder="Name des Ladens"
                aria-label="Name des Ladens" value={storeCustom} onChange={(e) => setStoreCustom(e.target.value)} maxLength={60} autoFocus />
            )}
          </div>

          {/* Datum + Tageszeit */}
          <div>
            <span className="ax-label">Wann? <span>optional</span></span>
            <div className="ax-row2">
              <input className="ax-input" type="date" aria-label="Fällig am" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
              <select className="ax-select" aria-label="Tageszeit" value={dueTime} onChange={(e) => setDueTime(e.target.value)}>
                <option value="">Tageszeit</option>
                {DAY_PARTS.map((d) => (
                  <option key={d.value} value={d.value}>{d.icon} {d.label}</option>
                ))}
              </select>
            </div>
          </div>

          {error && <div className="ax-error" role="alert">{error}</div>}
        </div>

        <div className="ax-nav">
          <button type="button" className="btn btn-primary" disabled={saving || !name.trim()} onClick={submit}>
            {saving ? 'Wird gespeichert…' : 'Liste anlegen'}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
