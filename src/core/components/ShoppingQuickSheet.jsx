import { useEffect, useState } from 'react';
import { saveItem, saveList, loadItems, loadTemplates, deleteList } from '../../modules/shopping/lib/shoData';
import { STORES, DAY_PARTS } from '../../modules/shopping/lib/data/stores';
import { ALL_SUGGESTIONS, UNIT_OPTIONS, getCategory } from '../../modules/shopping/lib/data/items';
import { notifyShoppingChanged } from '../lib/shoppingHandoff';
import SheetShell from './SheetShell';
import { IconEdit, IconTrash } from './Icons';
import { DateButton, IconDropdown, WizardFoot, WizardFrame, missingHint } from './wizard/WizardKit';

// „Neue Einkaufsliste“ — 3 Schritte im gemeinsamen Wizard-Rahmen
// (core/components/wizard/WizardKit.jsx). Der Plus-Knopf (globaler FAB) ist der einzige Weg,
// eine Liste anzulegen; auch die Einkaufs-Tour öffnet dieses Sheet.
//   Schritt 1: Auswahl "Aus Vorlage" oder "Manuelle Eingabe" (wie im Finanz-Wizard). "Aus Vorlage"
//              zeigt erst die Vorlagen; die gewählte füllt Schritt 2 und 3 vor.
//   Schritt 2: Symbol (Dropdown) + Name, Laden (Dropdown), Wann (Datum + Tageszeit)
//   Schritt 3: Artikel direkt hinzufügen (Eingabeleiste wie in der Liste);
//              erst "Speichern" legt Liste und Artikel an.

const ICONS = ['🛒','🥦','🥩','🍞','🧴','🏠','💊','🐾','🍷','👕','🔧','🎁'];

// Läden nach Gruppe sortiert für den <select>
const STORE_GROUPS = STORES.reduce((acc, s) => {
  (acc[s.group] ??= []).push(s.name);
  return acc;
}, {});

function IconTemplate() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="5" y="4" width="14" height="17" rx="2" />
      <path d="M9 4h6v3H9zM9 12h6M9 16h4" />
    </svg>
  );
}

export default function ShoppingQuickSheet({ onClose, onSaved }) {
  const [step,        setStep]        = useState(1);
  const [pickTmpl,    setPickTmpl]    = useState(false); // Schritt 1: Vorlagenliste statt Auswahl
  const [templates,   setTemplates]   = useState(null);  // null = lädt
  const [tmplBusy,    setTmplBusy]    = useState(null);  // Id der Vorlage, die gerade geladen wird
  const [name,        setName]        = useState('');
  const [icon,        setIcon]        = useState('🛒');
  const [dueDate,     setDueDate]     = useState('');
  const [dueTime,     setDueTime]     = useState(''); // Tageszeit-Wert, KEINE Uhrzeit — siehe DAY_PARTS
  const [store,       setStore]       = useState(''); // Ladenname oder '__custom'
  const [storeCustom, setStoreCustom] = useState('');
  const [saving,      setSaving]      = useState(false);
  const [error,       setError]       = useState('');

  // Artikel (Schritt 3)
  const [items,  setItems]  = useState([]);   // { name, quantity, unit, store, note, category }
  const [input,  setInput]  = useState('');
  const [qty,    setQty]    = useState('');
  const [unit,   setUnit]   = useState('');
  const [itemStore, setItemStore] = useState('');

  const storeName = store === '__custom' ? storeCustom.trim() : store;
  const nameOk = Boolean(name.trim());

  // Vorlagen beim Öffnen laden: ohne Vorlage ist die Karte "Aus Vorlage" ausgegraut
  useEffect(() => {
    let alive = true;
    loadTemplates()
      .then((t) => { if (alive) setTemplates(t); })
      .catch(() => { if (alive) setTemplates([]); });
    return () => { alive = false; };
  }, []);

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

  // Vorlage wählen: Name, Symbol und Artikel übernehmen, weiter zu Schritt 2 (alles noch änderbar)
  async function useTemplate(tmpl) {
    setTmplBusy(tmpl.id); setError('');
    try {
      const tItems = await loadItems(tmpl.id);
      setName(tmpl.name.replace(' (Vorlage)', '').trim());
      setIcon(tmpl.icon && tmpl.icon !== '📋' ? tmpl.icon : '🛒');
      setItems(tItems.map((i) => ({
        name: i.name, quantity: i.quantity ?? null, unit: i.unit ?? null,
        store: i.item_store_name ?? null, note: i.note ?? null, category: i.category ?? null,
      })));
      setPickTmpl(false);
      setStep(2);
    } catch { setError('Vorlage konnte nicht geladen werden'); }
    finally { setTmplBusy(null); }
  }

  async function removeTemplate(e, tmpl) {
    e.stopPropagation();
    if (!window.confirm(`Vorlage „${tmpl.name}“ löschen?`)) return;
    try {
      await deleteList(tmpl.id);
      setTemplates((prev) => prev.filter((t) => t.id !== tmpl.id));
    } catch { setError('Löschen fehlgeschlagen'); }
  }

  async function submit() {
    if (!nameOk) { setError('Bitte einen Namen eingeben'); setStep(2); return; }
    setSaving(true); setError('');
    try {
      const list = await saveList({
        name:         name.trim(),
        icon,
        due_date:     dueDate  || null,
        due_time:     dueTime  || null,
      });
      // Artikel der Reihe nach anlegen (Reihenfolge = Eingabe)
      for (let i = 0; i < items.length; i += 1) {
        const it = items[i];
        // eslint-disable-next-line no-await-in-loop
        await saveItem({
          list_id:         list.id,
          name:            it.name,
          category:        it.category || getCategory(it.name),
          quantity:        it.quantity,
          unit:            it.unit,
          note:            it.note ?? null,
          // Laden der Liste (Schritt 2) gilt als Vorgabe für Artikel ohne eigenen Laden
          item_store_name: it.store || storeName || null,
          sort_order:      i,
        });
      }
      notifyShoppingChanged(); // Listenseite lädt neu (der Wizard liegt außerhalb des Einkaufsmoduls)
      onSaved?.();
      onClose();
    } catch { setError('Speichern fehlgeschlagen'); }
    finally { setSaving(false); }
  }

  let footer;
  if (step === 1) footer = undefined;
  else if (step === 2) {
    footer = (
      <WizardFoot one hint={nameOk ? '' : missingHint([['Name', true]])}>
        <button type="button" className="btn btn-primary" disabled={!nameOk} onClick={() => setStep(3)}>Weiter</button>
      </WizardFoot>
    );
  } else {
    footer = (
      <WizardFoot one>
        <button type="button" className="btn btn-primary" disabled={saving} onClick={submit}>
          {saving ? 'Wird gespeichert…' : 'Speichern'}
        </button>
      </WizardFoot>
    );
  }

  const title = step === 1 ? (pickTmpl ? 'Vorlage wählen' : 'Neue Einkaufsliste') : step === 2 ? 'Neue Einkaufsliste' : 'Artikel hinzufügen';
  const sub = step === 1 ? (pickTmpl ? 'Schritt 1 von 3 · Vorlage' : 'Schritt 1 von 3 · Wie möchtest du anlegen?')
    : step === 2 ? 'Schritt 2 von 3 · Liste' : 'Schritt 3 von 3 · direkt zur Liste';
  const onBack = step === 1 ? (pickTmpl ? () => setPickTmpl(false) : undefined) : () => setStep(step - 1);

  return (
    <SheetShell onClose={onClose} wizard>
      <WizardFrame
        title={title}
        sub={sub}
        step={step}
        total={3}
        stepKey={`${step}${pickTmpl ? 't' : ''}`}
        onBack={onBack}
        onClose={onClose}
        footer={step === 3 ? (
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
        {step === 1 && !pickTmpl && (
          <div className="wiz-mode-wrap">
            <div className="wiz-mode-grid">
              <button
                type="button"
                className="wiz-mode"
                disabled={templates === null || templates.length === 0}
                onClick={() => setPickTmpl(true)}
              >
                <span className="wiz-mode-icon"><IconTemplate /></span>
                <span className="wiz-mode-title">Aus Vorlage</span>
                <span className="wiz-mode-sub">
                  {templates === null ? 'Wird geladen …' : templates.length === 0 ? 'Noch keine Vorlagen' : `${templates.length} ${templates.length === 1 ? 'Vorlage' : 'Vorlagen'}`}
                </span>
              </button>
              <button type="button" className="wiz-mode" onClick={() => setStep(2)}>
                <span className="wiz-mode-icon"><IconEdit /></span>
                <span className="wiz-mode-title">Manuelle Eingabe</span>
                <span className="wiz-mode-sub">Selbst anlegen</span>
              </button>
            </div>
            {error && <p className="wz-hint err" role="alert">{error}</p>}
          </div>
        )}

        {step === 1 && pickTmpl && (
          <>
            <div className="wz-tmpls">
              {(templates || []).map((t) => (
                <div key={t.id} className="wz-tmpl">
                  <button type="button" className="wz-tmpl-main" disabled={tmplBusy === t.id} onClick={() => useTemplate(t)}>
                    <span className="wz-tmpl-ic">{t.icon || '📋'}</span>
                    <span className="wz-tmpl-t"><b>{t.name}</b><small>{tmplBusy === t.id ? 'Wird geladen …' : 'Artikel übernehmen und anpassen'}</small></span>
                  </button>
                  <button type="button" className="wz-tmpl-del" onClick={(e) => removeTemplate(e, t)} aria-label={`Vorlage ${t.name} löschen`}><IconTrash size={16} /></button>
                </div>
              ))}
              {templates && templates.length === 0 && <div className="wz-empty">Keine Vorlagen vorhanden.</div>}
            </div>
            {error && <p className="wz-hint err" role="alert">{error}</p>}
          </>
        )}

        {step === 2 && (
          <>
            <label className="wz-lbl" htmlFor="wz-shop-name">Symbol und Name</label>
            <IconDropdown icons={ICONS.includes(icon) ? ICONS : [icon, ...ICONS]} value={icon} onChange={setIcon} columns={6}>
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
                onKeyDown={(e) => e.key === 'Enter' && nameOk && setStep(3)}
              />
            </IconDropdown>

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

        {step === 3 && (
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
