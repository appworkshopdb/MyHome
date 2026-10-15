import { useState } from 'react';
import { saveItem, saveList } from '../../modules/shopping/lib/shoData';
import { STORES, DAY_PARTS } from '../../modules/shopping/lib/data/stores';
import { ALL_SUGGESTIONS, UNIT_OPTIONS, getCategory } from '../../modules/shopping/lib/data/items';
import SheetShell from './SheetShell';
import { DateButton, IconDropdown, WizardFoot, WizardFrame, missingHint } from './wizard/WizardKit';

// „Neue Einkaufsliste“ — 2 Schritte im gemeinsamen Wizard-Rahmen
// (core/components/wizard/WizardKit.jsx). Wird vom globalen FAB und von der
// Einkaufs-Tour genutzt.
//   Schritt 1: Symbol (Dropdown) + Name, Laden (Dropdown), Wann (Datum + Tageszeit)
//   Schritt 2: Artikel direkt hinzufügen (Eingabeleiste wie in der Liste);
//              erst "Speichern" legt Liste und Artikel an.

const ICONS = ['🛒','🥦','🥩','🍞','🧴','🏠','💊','🐾','🍷','👕','🔧','🎁'];

// Läden nach Gruppe sortiert für den <select> — gleiche Aufbereitung wie
// in ListView.jsx, damit beide Stellen exakt gleich aussehen.
const STORE_GROUPS = STORES.reduce((acc, s) => {
  (acc[s.group] ??= []).push(s.name);
  return acc;
}, {});

export default function ShoppingQuickSheet({ onClose, onSaved }) {
  const [step,        setStep]        = useState(1);
  const [name,        setName]        = useState('');
  const [icon,        setIcon]        = useState('🛒');
  const [dueDate,     setDueDate]     = useState('');
  const [dueTime,     setDueTime]     = useState(''); // Tageszeit-Wert, KEINE Uhrzeit — siehe DAY_PARTS
  const [store,       setStore]       = useState(''); // Ladenname oder '__custom'
  const [storeCustom, setStoreCustom] = useState('');
  const [saving,      setSaving]      = useState(false);
  const [error,       setError]       = useState('');

  // Artikel (Schritt 2)
  const [items,  setItems]  = useState([]);   // { name, quantity, unit, store }
  const [input,  setInput]  = useState('');
  const [qty,    setQty]    = useState('');
  const [unit,   setUnit]   = useState('');
  const [itemStore, setItemStore] = useState('');

  const storeName = store === '__custom' ? storeCustom.trim() : store;
  const nameOk = Boolean(name.trim());

  const suggestions = input.trim()
    ? ALL_SUGGESTIONS.filter((s) => s.toLowerCase().startsWith(input.trim().toLowerCase())).slice(0, 5)
    : [];

  function addItem(raw) {
    const n = (raw ?? input).trim();
    if (!n) return;
    const q = qty.trim() ? parseFloat(qty.replace(',', '.')) : null;
    setItems((prev) => [...prev, {
      name: n,
      quantity: Number.isNaN(q) ? null : q,
      unit: unit || null,
      store: itemStore || null,
    }]);
    setInput(''); setQty(''); setUnit('');
  }

  async function submit() {
    if (!nameOk) { setError('Bitte einen Namen eingeben'); setStep(1); return; }
    setSaving(true); setError('');
    try {
      const list = await saveList({
        name:         name.trim(),
        icon,
        due_date:     dueDate  || null,
        due_time:     dueTime  || null,
        store_name:   storeName || null,
        store_custom: store === '__custom' ? (storeCustom.trim() || null) : null,
      });
      // Artikel der Reihe nach anlegen (Reihenfolge = Eingabe)
      for (let i = 0; i < items.length; i += 1) {
        const it = items[i];
        // eslint-disable-next-line no-await-in-loop
        await saveItem({
          list_id:         list.id,
          name:            it.name,
          category:        getCategory(it.name),
          quantity:        it.quantity,
          unit:            it.unit,
          item_store_name: it.store,
          sort_order:      i,
        });
      }
      onSaved?.();
      onClose();
    } catch { setError('Speichern fehlgeschlagen'); }
    finally { setSaving(false); }
  }

  const footer = step === 1 ? (
    <WizardFoot one hint={nameOk ? '' : missingHint([['Name', true]])}>
      <button type="button" className="btn btn-primary" disabled={!nameOk} onClick={() => setStep(2)}>Weiter</button>
    </WizardFoot>
  ) : (
    <WizardFoot one>
      <button type="button" className="btn btn-primary" disabled={saving} onClick={submit}>
        {saving ? 'Wird gespeichert…' : 'Speichern'}
      </button>
    </WizardFoot>
  );

  return (
    <SheetShell onClose={onClose} wizard>
      <WizardFrame
        title={step === 1 ? 'Neue Einkaufsliste' : 'Artikel hinzufügen'}
        sub={step === 1 ? 'Schritt 1 von 2 · Liste' : 'Schritt 2 von 2 · direkt zur Liste'}
        step={step}
        total={2}
        stepKey={step}
        onBack={step === 2 ? () => setStep(1) : undefined}
        onClose={onClose}
        footer={step === 2 ? (
          <>
            <div className="wz-bar">
              {suggestions.length > 0 && (
                <div className="wz-sug">
                  {suggestions.map((s) => (
                    <button key={s} type="button" onMouseDown={(e) => { e.preventDefault(); addItem(s); }}>
                      {s}<small>{getCategory(s)}</small>
                    </button>
                  ))}
                </div>
              )}
              <div className="r1">
                <input className="wz-input" type="text" inputMode="decimal" placeholder="Menge" aria-label="Menge" value={qty} onChange={(e) => setQty(e.target.value)} />
                <select className="wz-input" aria-label="Einheit" value={unit} onChange={(e) => setUnit(e.target.value)}>
                  <option value="">Einheit</option>
                  {UNIT_OPTIONS.map((u) => <option key={u} value={u}>{u}</option>)}
                </select>
                <select className="wz-input" aria-label="Laden für diesen Artikel" value={itemStore} onChange={(e) => setItemStore(e.target.value)} style={{ flex: 1.1 }}>
                  <option value="">Laden (optional)</option>
                  {storeName && <option value={storeName}>{storeName}</option>}
                  {Object.values(STORE_GROUPS).flat().filter((n) => n !== storeName).map((n) => <option key={n} value={n}>{n}</option>)}
                </select>
              </div>
              <div className="r2">
                <input
                  className="wz-input"
                  type="text"
                  placeholder="Artikel hinzufügen …"
                  aria-label="Artikel"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addItem(); } }}
                  autoComplete="off"
                  autoCapitalize="sentences"
                  maxLength={80}
                />
                <button type="button" className="btn btn-primary" onClick={() => addItem()} disabled={!input.trim()} aria-label="Hinzufügen">＋</button>
              </div>
            </div>
            {footer}
          </>
        ) : footer}
      >
        {step === 1 && (
          <>
            <label className="wz-lbl" htmlFor="wz-shop-name">Symbol und Name</label>
            <IconDropdown icons={ICONS} value={icon} onChange={setIcon} columns={6}>
              <input
                id="wz-shop-name"
                className="wz-input hero"
                type="text"
                placeholder="z. B. Wocheneinkauf"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoFocus
                autoComplete="off"
                enterKeyHint="next"
                onKeyDown={(e) => e.key === 'Enter' && nameOk && setStep(2)}
              />
            </IconDropdown>

            {/* Laden — gruppierter Dropdown, identisch zu ListView.jsx */}
            <label className="wz-lbl" htmlFor="wz-shop-store">Laden</label>
            <select id="wz-shop-store" className="wz-input" value={store} onChange={(e) => setStore(e.target.value)}>
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
              <input className="wz-input" style={{ marginTop: 8 }} type="text" placeholder="Name des Ladens" aria-label="Name des Ladens" value={storeCustom} onChange={(e) => setStoreCustom(e.target.value)} maxLength={60} autoFocus />
            )}

            <div className="wz-lbl">Wann <span className="opt">optional</span></div>
            <div className="wz-two">
              <DateButton value={dueDate} onChange={setDueDate} optional placeholder="Datum" label="Fällig am" />
              <select className="wz-input" aria-label="Tageszeit" value={dueTime} onChange={(e) => setDueTime(e.target.value)}>
                <option value="">Tageszeit</option>
                {DAY_PARTS.map((d) => <option key={d.value} value={d.value}>{d.icon} {d.label}</option>)}
              </select>
            </div>
            {error && <p className="wz-hint err" role="alert">{error}</p>}
          </>
        )}

        {step === 2 && (
          <>
            <div className="wz-listpill">
              <span className="big">{icon}</span>
              <div>{name.trim()}<small>{storeName || 'Kein Laden'}</small></div>
            </div>
            {items.length === 0 ? (
              <div className="wz-empty">Noch keine Artikel. Du kannst auch jetzt speichern und später welche hinzufügen.</div>
            ) : (
              <div>
                {items.map((it, i) => (
                  <div className="wz-item" key={`${it.name}-${i}`}>
                    <i />
                    <b>{it.name}</b>
                    {(it.quantity != null || it.unit) && (
                      <span>{[it.quantity != null ? String(it.quantity).replace('.', ',') : '', it.unit].filter(Boolean).join(' ')}</span>
                    )}
                    <button type="button" aria-label={`${it.name} entfernen`} onClick={() => setItems((prev) => prev.filter((_, j) => j !== i))}>×</button>
                  </div>
                ))}
              </div>
            )}
            {error && <p className="wz-hint err" role="alert">{error}</p>}
          </>
        )}
      </WizardFrame>
    </SheetShell>
  );
}
