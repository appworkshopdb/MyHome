// src/modules/shopping/components/ItemsView.jsx
// Artikel einer Einkaufsliste: hinzufügen, abhaken, bearbeiten/löschen. Der Abschluss
// (Zahlung, nicht gekaufte Artikel) liegt in CompleteListSheet.jsx.

import { useState, useEffect, useCallback, useRef } from 'react';
import { IconPlus, IconTrash, IconCheck } from '../../../core/components/Icons.jsx';
import {
  loadItems, saveItem, toggleItemDone, deleteItem, resetAllItems,
} from '../lib/shoData.js';
import { ALL_SUGGESTIONS, STORE_NAMES, UNIT_OPTIONS, getCategory } from '../lib/data/items.js';
import { takeFreshItems } from '../../../core/lib/shoppingHandoff.js';
import { fb } from '../../../core/lib/feedback';
import CompleteListSheet from './CompleteListSheet.jsx';

const CATEGORY_ORDER = [
  'Obst & Gemüse', 'Brot & Backwaren', 'Milch & Eier',
  'Fleisch & Fisch', 'Tiefkühl', 'Nudeln & Reis',
  'Vorrat', 'Getränke', 'Snacks & Süßes', 'Drogerie', 'Sonstiges',
];

function groupByCategory(items) {
  const groups = {};
  for (const item of items) {
    const cat = item.category || 'Sonstiges';
    if (!groups[cat]) groups[cat] = [];
    groups[cat].push(item);
  }
  const ordered = [];
  for (const cat of CATEGORY_ORDER) {
    if (groups[cat]) ordered.push({ cat, items: groups[cat] });
  }
  for (const cat of Object.keys(groups)) {
    if (!CATEGORY_ORDER.includes(cat)) ordered.push({ cat, items: groups[cat] });
  }
  return ordered;
}

// ─── Komponente ───────────────────────────────────────────────────────
export default function ItemsView({ list, onBack }) {
  const [items,            setItems]            = useState([]);
  const [fresh,            setFresh]            = useState({}); // id → 'new' | 'merged' (gerade aus einem Rezept dazugekommen)
  const [activeStore,      setActiveStore]      = useState('');
  const [selectedStore,    setSelectedStore]    = useState('');
  const [loading,          setLoading]          = useState(true);
  const [error,            setError]            = useState(null);
  const [input,            setInput]            = useState('');
  const [quantity,         setQuantity]         = useState('');
  const [unit,             setUnit]             = useState('');
  const [suggestions,      setSuggestions]      = useState([]);
  const [saving,           setSaving]           = useState(false);
  const inputRef    = useRef(null);
  const quantityRef = useRef(null);
  const addBtnRef   = useRef(null);
  const [flyAnim,   setFlyAnim] = useState(null);
  const [showComplete, setShowComplete] = useState(false); // Abschluss-Sheet

  const fetchItems = useCallback(async () => {
    try {
      const data = await loadItems(list.id);
      setItems(data);
      // Einmalig anzeigen, was gerade aus einem Rezept dazukam
      const marks = takeFreshItems(data.map((i) => i.id));
      if (Object.keys(marks).length > 0) setFresh((prev) => ({ ...prev, ...marks }));
    } catch (e) {
      setError('Artikel konnten nicht geladen werden.');
    }
  }, [list.id]);

  useEffect(() => {
    fetchItems().finally(() => setLoading(false));
  }, [fetchItems]);

  function handleInputChange(val) {
    setInput(val);
    if (val.trim().length < 1) { setSuggestions([]); return; }
    const lower = val.toLowerCase();
    const matches = ALL_SUGGESTIONS
      .filter((s) => s.toLowerCase().startsWith(lower))
      .slice(0, 6);
    setSuggestions(matches);
  }

  async function handleAdd(name) {
    const trimmed = (name || input).trim();
    if (!trimmed) return;

    // Flug-Animation
    if (addBtnRef.current) {
      const rect = addBtnRef.current.getBoundingClientRect();
      setFlyAnim({ x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 });
      setTimeout(() => setFlyAnim(null), 700);
    }

    setSaving(true);
    setError(null);
    try {
      await saveItem({
        list_id:         list.id,
        name:            trimmed,
        category:        getCategory(trimmed),
        quantity:        quantity.trim() ? parseFloat(quantity.replace(',', '.')) || null : null,
        unit:            unit.trim() || null,
        item_store_name: selectedStore || null,
      });
      await fetchItems();
      setInput('');
      setQuantity('');
      setUnit('');
      setSuggestions([]);
      inputRef.current?.focus();
      fb.itemAdd(); // NEU: Pop beim Hinzufügen
    } catch (e) {
      setError('Hinzufügen fehlgeschlagen.');
    } finally {
      setSaving(false);
    }
  }

  async function handleToggle(item) {
    try {
      await toggleItemDone(item.id, !item.done);
      const updatedItems = items.map((i) => i.id === item.id ? { ...i, done: !item.done } : i);
      setItems(updatedItems);

      if (!item.done) {
        // Prüfen ob nach diesem Toggle alle Artikel erledigt sind
        const offeneNachToggle = updatedItems.filter((i) => !i.done);
        if (offeneNachToggle.length === 0) {
          fb.itemAllDone(); // ziel_erreicht2.mp3 — alle abgehakt
        } else {
          fb.itemCheck();   // click2.mp3 — einzelner Artikel
        }
      }
    } catch (e) {
      setError('Konnte nicht aktualisiert werden.');
      await fetchItems();
    }
  }

  async function handleDelete(itemId) {
    try {
      await deleteItem(itemId);
      setItems((prev) => prev.filter((i) => i.id !== itemId));
    } catch (e) {
      setError('Löschen fehlgeschlagen.');
    }
  }

  async function handleEditItem(itemId, quantity, unit, storeName) {
    try {
      const qty = quantity.trim() ? parseFloat(quantity.replace(',', '.')) || null : null;
      const u   = unit.trim() || null;
      const sn  = (storeName !== undefined ? storeName.trim() : null) || null;
      await saveItem({ id: itemId, quantity: qty, unit: u, item_store_name: sn });
      setItems((prev) => prev.map((i) =>
        i.id === itemId ? { ...i, quantity: qty, unit: u, item_store_name: sn } : i
      ));
    } catch (e) {
      setError('Speichern fehlgeschlagen.');
    }
  }

  async function handleResetAll() {
    if (!window.confirm('Alle Artikel auf "nicht erledigt" zurücksetzen?')) return;
    try {
      await resetAllItems(list.id);
      setItems((prev) => prev.map((i) => ({ ...i, done: false })));
    } catch (e) {
      setError('Zurücksetzen fehlgeschlagen.');
    }
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter') { handleAdd(); setSuggestions([]); }
    if (e.key === 'Escape') { setSuggestions([]); }
  }

  function handleQtyKeyDown(e) {
    if (e.key === 'Enter') { inputRef.current?.focus(); }
  }

  if (loading) {
    return <div className="page-loading">Wird geladen …</div>;
  }

  const storeNames = [...new Set(items.map((i) => i.item_store_name || i.store_name).filter(Boolean))].sort();

  const visibleItems = activeStore
    ? items.filter((i) => (i.item_store_name || i.store_name) === activeStore)
    : items;
  const openItems  = visibleItems.filter((i) => !i.done);
  const doneItems  = visibleItems.filter((i) => i.done);
  const openGroups = groupByCategory(openItems);
  const allDoneCount = items.filter((i) => i.done).length;

  return (
    <div className="sho-items-wrap">
      {error && (
        <div className="toast toast-error" style={{ marginBottom: 12 }}>{error}</div>
      )}

      {/* Kopf: Listenname, Fortschritt, Einkauf abschließen — bewusst unabhängig vom
          Status-Zyklus in ListView. Öffnen/Bearbeiten einer Liste bleibt jederzeit
          möglich, unabhängig davon ob/wie sie abgeschlossen wird. */}
      <div className="sho-hd">
        <div className="sho-hd-row">
          <h1 className="sho-hd-title">{list.name}</h1>
          <span className="sho-hd-count"><b>{allDoneCount}</b> / {items.length}</span>
        </div>
        <div className="sho-hd-bar" aria-hidden="true">
          <i style={{ width: `${items.length ? Math.round((allDoneCount / items.length) * 100) : 0}%` }} />
        </div>
        <button className="btn sho-complete-btn" onClick={() => setShowComplete(true)}>
          Einkauf abschließen
        </button>
      </div>

      {/* Laden-Filter */}
      {storeNames.length > 0 && (
        <div className="sho-store-filter">
          <button
            className={`sho-store-pill ${activeStore === '' ? 'active' : ''}`}
            onClick={() => setActiveStore('')}
          >
            Alle
          </button>
          {storeNames.map((name) => (
            <button
              key={name}
              className={`sho-store-pill ${activeStore === name ? 'active' : ''}`}
              onClick={() => setActiveStore(activeStore === name ? '' : name)}
            >
              {name}
            </button>
          ))}
        </div>
      )}

      {/* Aktions-Leiste */}
      {items.length > 0 && (
        <div className="sho-action-row">
          {doneItems.length > 0 && openItems.length === 0 && (
            <button className="btn btn-secondary sho-action-btn" onClick={handleResetAll}>
              Alle zurücksetzen
            </button>
          )}
        </div>
      )}

      {/* Empty State */}
      {items.length === 0 && (
        <div className="sho-empty" style={{ paddingTop: 32 }}>
          <div className="sho-empty-icon">{list.icon || '🛒'}</div>
          <div className="sho-empty-title">Liste ist leer</div>
          <div className="sho-empty-text">
            Tippe unten einen Artikel ein und füge ihn zur Liste hinzu.
          </div>
        </div>
      )}

      {/* Offene Artikel — nach Kategorie */}
      {openGroups.map(({ cat, items: catItems }) => (
        <div key={cat} className="sho-category-group">
          {openGroups.length > 1 && (
            <div className="sho-category-label">{cat}</div>
          )}
          <div className="sho-items-list">
            {catItems.map((item) => (
              <ItemRow
                key={item.id}
                item={item}
                onToggle={handleToggle}
                onDelete={handleDelete}
                onEdit={handleEditItem}
                allStores={storeNames}
                mark={fresh[item.id]}
              />
            ))}
          </div>
        </div>
      ))}

      {/* Erledigte Artikel */}
      {doneItems.length > 0 && (
        <div className="sho-done-section">
          {openItems.length > 0 && (
            <div className="sho-category-label" style={{ marginTop: 20 }}>
              Erledigt ({doneItems.length})
            </div>
          )}
          <div className="sho-items-list">
            {doneItems.map((item) => (
              <ItemRow
                key={item.id}
                item={item}
                onToggle={handleToggle}
                onDelete={handleDelete}
                onEdit={handleEditItem}
                allStores={storeNames}
                mark={fresh[item.id]}
              />
            ))}
          </div>
        </div>
      )}

      {/* Autocomplete */}
      {suggestions.length > 0 && (
        <div className="sho-suggestions">
          {suggestions.map((s) => (
            <button
              key={s}
              className="sho-suggestion-item"
              onMouseDown={(e) => { e.preventDefault(); handleAdd(s); }}
            >
              {s}
              <span className="sho-suggestion-cat">{getCategory(s)}</span>
            </button>
          ))}
        </div>
      )}

      {/* Flug-Animation */}
      {flyAnim && <FlyParticle startX={flyAnim.x} startY={flyAnim.y} />}

      {/* Eingabe-Leiste */}
      <div className="sho-input-bar">
        <div className="sho-qty-row">
          <input
            ref={quantityRef}
            type="number"
            inputMode="decimal"
            placeholder="Menge"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            onKeyDown={handleQtyKeyDown}
            className="sho-qty-input"
            min="0"
            step="any"
          />
          <select
            value={unit}
            onChange={(e) => setUnit(e.target.value)}
            className="sho-unit-select sho-unit-select--sm"
          >
            <option value="">Einheit</option>
            {UNIT_OPTIONS.map((u) => <option key={u} value={u}>{u}</option>)}
          </select>
          <select
            value={selectedStore}
            onChange={(e) => setSelectedStore(e.target.value)}
            className="sho-unit-select sho-store-select"
          >
            <option value="">Laden (optional)</option>
            {storeNames.map((n) => <option key={n} value={n}>{n}</option>)}
            {storeNames.length > 0 && <option disabled>──────</option>}
            {STORE_NAMES.filter((n) => !storeNames.includes(n)).map((n) => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
        </div>

        <div className="sho-input-row">
          <input
            ref={inputRef}
            type="text"
            placeholder="Artikel hinzufügen …"
            value={input}
            onChange={(e) => handleInputChange(e.target.value)}
            onKeyDown={handleKeyDown}
            autoComplete="off"
            autoCapitalize="sentences"
            maxLength={80}
          />
          <button
            ref={addBtnRef}
            className="btn btn-primary"
            onClick={() => { handleAdd(); setSuggestions([]); }}
            disabled={saving || !input.trim()}
            style={{ minWidth: 44, padding: '9px 14px', flexShrink: 0 }}
          >
            <span style={{ display: 'flex', width: 18, height: 18 }}><IconPlus /></span>
          </button>
        </div>
      </div>

      {/* Abschluss: Prüfen, nicht gekaufte Artikel übertragen/verwerfen, Bezahlung */}
      {showComplete && (
        <CompleteListSheet
          list={list}
          items={items}
          onClose={() => setShowComplete(false)}
          onFinished={() => { setShowComplete(false); onBack(); }}
        />
      )}
    </div>
  );
}

// ─── Einzelne Artikel-Zeile ───────────────────────────────────────────
function ItemRow({ item, onToggle, onDelete, onEdit, allStores, mark }) {
  const [editing,   setEditing]   = useState(false);
  const [qty,       setQty]       = useState(item.quantity != null ? String(item.quantity) : '');
  const [unit,      setUnit]      = useState(item.unit || '');
  const [editStore, setEditStore] = useState(item.item_store_name || '');
  const qtyRef = useRef(null);

  function openEdit() {
    setQty(item.quantity != null ? String(item.quantity) : '');
    setUnit(item.unit || '');
    setEditStore(item.item_store_name || item.store_name || '');
    setEditing(true);
    setTimeout(() => qtyRef.current?.focus(), 50);
  }

  async function commitEdit() {
    setEditing(false);
    await onEdit(item.id, qty, unit, editStore);
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter') commitEdit();
    if (e.key === 'Escape') setEditing(false);
  }

  const metaLabel = item.quantity || item.unit
    ? (item.quantity && item.unit
        ? `${item.quantity} ${item.unit}`
        : item.quantity ?? item.unit)
    : null;
  const storeLabel = item.item_store_name || item.store_name;

  return (
    <div className={`sho-item-row ${item.done ? 'sho-item-done' : ''}${mark ? ' sho-item-fresh' : ''}${editing ? ' sho-item-editing' : ''}`}>
      <button
        className={`sho-item-check ${item.done ? 'done' : ''}`}
        onClick={() => { setEditing(false); onToggle(item); }}
        aria-label={item.done ? 'Als offen markieren' : 'Als erledigt markieren'}
      >
        {item.done && (
          <span style={{ width: 14, height: 14, display: 'flex' }}><IconCheck /></span>
        )}
      </button>

      {editing ? (
        <div className="sho-item-edit">
          <span className="sho-item-edit-name">{item.name}</span>
          <div className="sho-item-edit-fields">
            <input
              ref={qtyRef}
              type="number"
              inputMode="decimal"
              placeholder="Menge"
              value={qty}
              onChange={(e) => setQty(e.target.value)}
              onKeyDown={handleKeyDown}
              className="sho-qty-input"
              min="0"
              step="any"
            />
            <select
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
              onKeyDown={handleKeyDown}
              className="sho-unit-select sho-unit-select--sm"
            >
              <option value="">Einheit</option>
              {/* Eine ältere Einheit (z.B. "Pack"), die nicht mehr in der Liste steht, bleibt wählbar */}
              {unit && !UNIT_OPTIONS.includes(unit) && <option value={unit}>{unit}</option>}
              {UNIT_OPTIONS.map((u) => <option key={u} value={u}>{u}</option>)}
            </select>
            <select
              value={editStore}
              onChange={(e) => setEditStore(e.target.value)}
              className="sho-unit-select sho-unit-select--sm"
              style={{ flex: 1 }}
            >
              <option value="">Kein Laden</option>
              {allStores.map((n) => <option key={n} value={n}>{n}</option>)}
              {STORE_NAMES.filter((n) => !allStores.includes(n)).slice(0, 10).map((n) => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
          </div>
          {/* Löschen gibt es nur hier, nicht in jeder Zeile (Fehltipps) */}
          <div className="sho-item-edit-actions">
            <button type="button" className="sho-item-del" onClick={() => onDelete(item.id)}>
              <IconTrash size={15} /> Löschen
            </button>
            <button type="button" className="sho-item-cancel" onClick={() => setEditing(false)}>Abbrechen</button>
            <button type="button" className="btn btn-primary sho-item-ok" onClick={commitEdit}>OK</button>
          </div>
        </div>
      ) : (
        <>
          <div className="sho-item-body" onClick={openEdit}>
            <span className={`sho-item-name ${item.done ? 'done' : ''}`}>
              {item.name}
              {mark && <span className="sho-item-tag">{mark === 'new' ? 'NEU' : '+'}</span>}
            </span>
            {item.note && <span className="sho-item-note">{item.note}</span>}
            {(storeLabel || !metaLabel) && (
              <span className="sho-item-note">
                {!metaLabel && <span className="sho-item-meta--hint">Menge tippen …</span>}
                {!metaLabel && storeLabel ? ' · ' : ''}
                {storeLabel}
              </span>
            )}
          </div>
          {metaLabel && (
            <button type="button" className="sho-item-qty" onClick={openEdit} aria-label={`Menge ändern: ${metaLabel}`}>
              {metaLabel}
            </button>
          )}
        </>
      )}
    </div>
  );
}

// ─── Flug-Partikel Animation ──────────────────────────────────────────
function FlyParticle({ startX, startY }) {
  const targetX = window.innerWidth - 40;
  const targetY = window.innerHeight - 36;
  const dx = targetX - startX;
  const dy = targetY - startY;

  return (
    <div
      className="sho-fly-particle"
      style={{
        '--fly-start-x': `${startX}px`,
        '--fly-start-y': `${startY}px`,
        '--fly-dx': `${dx}px`,
        '--fly-dy': `${dy}px`,
      }}
    >
      🛒
    </div>
  );
}
