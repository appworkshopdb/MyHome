// src/modules/shopping/components/ItemsView.jsx
// Artikel einer Einkaufsliste: hinzufügen, abhaken, löschen.

import { useState, useEffect, useCallback, useRef } from 'react';
import { IconPlus, IconTrash, IconCheck } from '../../../core/components/Icons.jsx';
import {
  loadItems, saveItem, toggleItemDone, deleteItem, clearDoneItems, resetAllItems,
  saveListAsTemplate,
} from '../lib/shoData.js';
import { fb } from '../../../core/lib/feedback';

// ─── Kategorie-Zuordnung ──────────────────────────────────────────────
const CATEGORY_MAP = {
  'Äpfel': 'Obst & Gemüse', 'Apfel': 'Obst & Gemüse', 'Bananen': 'Obst & Gemüse',
  'Banane': 'Obst & Gemüse', 'Orangen': 'Obst & Gemüse', 'Orange': 'Obst & Gemüse',
  'Zitronen': 'Obst & Gemüse', 'Zitrone': 'Obst & Gemüse', 'Erdbeeren': 'Obst & Gemüse',
  'Trauben': 'Obst & Gemüse', 'Weintrauben': 'Obst & Gemüse', 'Tomaten': 'Obst & Gemüse',
  'Tomate': 'Obst & Gemüse', 'Gurke': 'Obst & Gemüse', 'Gurken': 'Obst & Gemüse',
  'Paprika': 'Obst & Gemüse', 'Zwiebeln': 'Obst & Gemüse', 'Zwiebel': 'Obst & Gemüse',
  'Knoblauch': 'Obst & Gemüse', 'Kartoffeln': 'Obst & Gemüse', 'Kartoffel': 'Obst & Gemüse',
  'Möhren': 'Obst & Gemüse', 'Karotten': 'Obst & Gemüse', 'Brokkoli': 'Obst & Gemüse',
  'Blumenkohl': 'Obst & Gemüse', 'Spinat': 'Obst & Gemüse', 'Salat': 'Obst & Gemüse',
  'Kopfsalat': 'Obst & Gemüse', 'Rucola': 'Obst & Gemüse', 'Zucchini': 'Obst & Gemüse',
  'Aubergine': 'Obst & Gemüse', 'Pilze': 'Obst & Gemüse', 'Champignons': 'Obst & Gemüse',
  'Avocado': 'Obst & Gemüse', 'Avocados': 'Obst & Gemüse', 'Ingwer': 'Obst & Gemüse',
  'Lauch': 'Obst & Gemüse', 'Kohl': 'Obst & Gemüse', 'Rotkohl': 'Obst & Gemüse',
  'Weißkohl': 'Obst & Gemüse', 'Erbsen': 'Obst & Gemüse', 'Bohnen': 'Obst & Gemüse',
  'Mais': 'Obst & Gemüse', 'Kürbis': 'Obst & Gemüse', 'Radieschen': 'Obst & Gemüse',
  'Sellerie': 'Obst & Gemüse', 'Petersilie': 'Obst & Gemüse', 'Basilikum': 'Obst & Gemüse',
  'Kräuter': 'Obst & Gemüse', 'Schnittlauch': 'Obst & Gemüse', 'Dill': 'Obst & Gemüse',
  'Minze': 'Obst & Gemüse', 'Kiwi': 'Obst & Gemüse', 'Mango': 'Obst & Gemüse',
  'Ananas': 'Obst & Gemüse', 'Melone': 'Obst & Gemüse', 'Wassermelone': 'Obst & Gemüse',
  'Kirschen': 'Obst & Gemüse', 'Pfirsich': 'Obst & Gemüse', 'Nektarine': 'Obst & Gemüse',
  'Pflaumen': 'Obst & Gemüse', 'Birnen': 'Obst & Gemüse', 'Birne': 'Obst & Gemüse',
  'Milch': 'Milch & Eier', 'Butter': 'Milch & Eier', 'Margarine': 'Milch & Eier',
  'Käse': 'Milch & Eier', 'Gouda': 'Milch & Eier', 'Edamer': 'Milch & Eier',
  'Emmentaler': 'Milch & Eier', 'Mozzarella': 'Milch & Eier', 'Feta': 'Milch & Eier',
  'Quark': 'Milch & Eier', 'Joghurt': 'Milch & Eier', 'Naturjoghurt': 'Milch & Eier',
  'Frischkäse': 'Milch & Eier', 'Sahne': 'Milch & Eier', 'Schlagsahne': 'Milch & Eier',
  'Schmand': 'Milch & Eier', 'Crème fraîche': 'Milch & Eier', 'Eier': 'Milch & Eier',
  'Ei': 'Milch & Eier', 'Hüttenkäse': 'Milch & Eier', 'Skyr': 'Milch & Eier',
  'Kefir': 'Milch & Eier', 'Buttermilch': 'Milch & Eier', 'Kaffeesahne': 'Milch & Eier',
  'Kondensmilch': 'Milch & Eier', 'Parmesan': 'Milch & Eier',
  'Hackfleisch': 'Fleisch & Fisch', 'Hähnchen': 'Fleisch & Fisch',
  'Hähnchenbrustfilet': 'Fleisch & Fisch', 'Hähnchenbrust': 'Fleisch & Fisch',
  'Rindfleisch': 'Fleisch & Fisch', 'Schweinefleisch': 'Fleisch & Fisch',
  'Steak': 'Fleisch & Fisch', 'Schnitzel': 'Fleisch & Fisch',
  'Wurst': 'Fleisch & Fisch', 'Salami': 'Fleisch & Fisch', 'Schinken': 'Fleisch & Fisch',
  'Aufschnitt': 'Fleisch & Fisch', 'Bratwurst': 'Fleisch & Fisch',
  'Würstchen': 'Fleisch & Fisch', 'Lachs': 'Fleisch & Fisch',
  'Lachsfilet': 'Fleisch & Fisch', 'Forelle': 'Fleisch & Fisch',
  'Thunfisch': 'Fleisch & Fisch', 'Garnelen': 'Fleisch & Fisch',
  'Fischstäbchen': 'Fleisch & Fisch', 'Speck': 'Fleisch & Fisch',
  'Bacon': 'Fleisch & Fisch', 'Putenbrust': 'Fleisch & Fisch',
  'Brot': 'Brot & Backwaren', 'Brötchen': 'Brot & Backwaren',
  'Vollkornbrot': 'Brot & Backwaren', 'Toastbrot': 'Brot & Backwaren',
  'Toast': 'Brot & Backwaren', 'Croissant': 'Brot & Backwaren',
  'Croissants': 'Brot & Backwaren', 'Laugenstange': 'Brot & Backwaren',
  'Baguette': 'Brot & Backwaren', 'Ciabatta': 'Brot & Backwaren',
  'Mehl': 'Brot & Backwaren', 'Hefe': 'Brot & Backwaren',
  'Backpulver': 'Brot & Backwaren', 'Kuchen': 'Brot & Backwaren',
  'Tiefkühlpizza': 'Tiefkühl', 'Pizza': 'Tiefkühl', 'Pommes': 'Tiefkühl',
  'Tiefkühlgemüse': 'Tiefkühl', 'Tiefkühlerbsen': 'Tiefkühl',
  'Gefrorenes': 'Tiefkühl', 'Eis': 'Tiefkühl', 'Eiswürfel': 'Tiefkühl',
  'Fischfilet': 'Tiefkühl',
  'Wasser': 'Getränke', 'Mineralwasser': 'Getränke', 'Sprudel': 'Getränke',
  'Saft': 'Getränke', 'Orangensaft': 'Getränke', 'Apfelsaft': 'Getränke',
  'Cola': 'Getränke', 'Limonade': 'Getränke', 'Limo': 'Getränke',
  'Bier': 'Getränke', 'Wein': 'Getränke', 'Rotwein': 'Getränke',
  'Weißwein': 'Getränke', 'Sekt': 'Getränke', 'Kaffee': 'Getränke',
  'Tee': 'Getränke', 'Kakao': 'Getränke', 'Eistee': 'Getränke',
  'Energydrink': 'Getränke', 'Smoothie': 'Getränke',
  'Nudeln': 'Nudeln & Reis', 'Spaghetti': 'Nudeln & Reis', 'Penne': 'Nudeln & Reis',
  'Rigatoni': 'Nudeln & Reis', 'Fusilli': 'Nudeln & Reis', 'Reis': 'Nudeln & Reis',
  'Basmati': 'Nudeln & Reis', 'Jasminreis': 'Nudeln & Reis', 'Quinoa': 'Nudeln & Reis',
  'Couscous': 'Nudeln & Reis', 'Bulgur': 'Nudeln & Reis', 'Linsen': 'Nudeln & Reis',
  'Kichererbsen': 'Nudeln & Reis', 'Haferflocken': 'Nudeln & Reis',
  'Müsli': 'Nudeln & Reis', 'Grieß': 'Nudeln & Reis',
  'Tomaten (Dose)': 'Vorrat', 'Dosentomaten': 'Vorrat', 'Tomatensauce': 'Vorrat',
  'Passata': 'Vorrat', 'Tomatenmark': 'Vorrat', 'Brühe': 'Vorrat',
  'Gemüsebrühe': 'Vorrat', 'Hühnerbrühe': 'Vorrat', 'Rinderbrühe': 'Vorrat',
  'Dosensuppe': 'Vorrat', 'Bohnen (Dose)': 'Vorrat', 'Mais (Dose)': 'Vorrat',
  'Thunfisch (Dose)': 'Vorrat', 'Sardinen': 'Vorrat', 'Öl': 'Vorrat',
  'Olivenöl': 'Vorrat', 'Sonnenblumenöl': 'Vorrat', 'Essig': 'Vorrat',
  'Salz': 'Vorrat', 'Pfeffer': 'Vorrat', 'Zucker': 'Vorrat',
  'Honig': 'Vorrat', 'Marmelade': 'Vorrat', 'Nutella': 'Vorrat',
  'Erdnussbutter': 'Vorrat', 'Senf': 'Vorrat', 'Ketchup': 'Vorrat',
  'Mayonnaise': 'Vorrat', 'Mayo': 'Vorrat', 'Sojasoße': 'Vorrat',
  'Sojasauce': 'Vorrat', 'Currypaste': 'Vorrat', 'Kokosmilch': 'Vorrat',
  'Gewürze': 'Vorrat', 'Zimt': 'Vorrat', 'Paprikapulver': 'Vorrat',
  'Oregano': 'Vorrat', 'Thymian': 'Vorrat', 'Rosmarin': 'Vorrat',
  'Schokolade': 'Snacks & Süßes', 'Chips': 'Snacks & Süßes',
  'Kekse': 'Snacks & Süßes', 'Gummibärchen': 'Snacks & Süßes',
  'Nüsse': 'Snacks & Süßes', 'Mandeln': 'Snacks & Süßes',
  'Walnüsse': 'Snacks & Süßes', 'Cashews': 'Snacks & Süßes',
  'Popcorn': 'Snacks & Süßes', 'Müsliriegel': 'Snacks & Süßes',
  'Cracker': 'Snacks & Süßes', 'Salzstangen': 'Snacks & Süßes',
  'Bonbons': 'Snacks & Süßes', 'Fruchtgummi': 'Snacks & Süßes',
  'Shampoo': 'Drogerie', 'Duschgel': 'Drogerie', 'Seife': 'Drogerie',
  'Zahnpasta': 'Drogerie', 'Zahnbürste': 'Drogerie', 'Deodorant': 'Drogerie',
  'Rasierer': 'Drogerie', 'Rasierschaum': 'Drogerie', 'Wattepads': 'Drogerie',
  'Taschentücher': 'Drogerie', 'Toilettenpapier': 'Drogerie', 'Küchenrolle': 'Drogerie',
  'Spülmittel': 'Drogerie', 'Waschmittel': 'Drogerie', 'Weichspüler': 'Drogerie',
  'Reinigungsmittel': 'Drogerie', 'Müllbeutel': 'Drogerie', 'Alufolie': 'Drogerie',
  'Frischhaltefolie': 'Drogerie', 'Backpapier': 'Drogerie', 'Windeln': 'Drogerie',
  'Babynahrung': 'Drogerie', 'Waschlappen': 'Drogerie', 'Schwamm': 'Drogerie',
  'Kondome': 'Drogerie', 'Tampons': 'Drogerie', 'Binden': 'Drogerie',
  'Sonnencreme': 'Drogerie', 'Körperlotion': 'Drogerie', 'Feuchttücher': 'Drogerie',
};

const ALL_SUGGESTIONS = Object.keys(CATEGORY_MAP).sort((a, b) => a.localeCompare(b, 'de'));

const CATEGORY_ORDER = [
  'Obst & Gemüse', 'Brot & Backwaren', 'Milch & Eier',
  'Fleisch & Fisch', 'Tiefkühl', 'Nudeln & Reis',
  'Vorrat', 'Getränke', 'Snacks & Süßes', 'Drogerie', 'Sonstiges',
];

function getCategory(name) {
  if (!name) return 'Sonstiges';
  const exact = CATEGORY_MAP[name.trim()];
  if (exact) return exact;
  const lower = name.toLowerCase();
  const found = Object.entries(CATEGORY_MAP).find(([k]) => k.toLowerCase() === lower);
  return found ? found[1] : 'Sonstiges';
}

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

const STORE_NAMES = [
  'Aldi Nord','Aldi Süd','Lidl','Penny','Netto Marken-Discount','Netto (Edeka)','Norma',
  'REWE','Edeka','Tegut','Hit','Kaufland','Globus',
  "Denn's Biomarkt",'Alnatura','Basic',
  'dm','Rossmann','Müller',
  'Wochenmarkt','Metzger','Bäcker','Asia-Shop','Online-Lieferung',
];

// ─── Komponente ───────────────────────────────────────────────────────
export default function ItemsView({ list, onBack }) {
  const [items,            setItems]            = useState([]);
  const [activeStore,      setActiveStore]      = useState('');
  const [selectedStore,    setSelectedStore]    = useState('');
  const [loading,          setLoading]          = useState(true);
  const [error,            setError]            = useState(null);
  const [input,            setInput]            = useState('');
  const [quantity,         setQuantity]         = useState('');
  const [unit,             setUnit]             = useState('');
  const [suggestions,      setSuggestions]      = useState([]);
  const [saving,           setSaving]           = useState(false);
  const [showTemplateForm, setShowTemplateForm] = useState(false);
  const [templateName,     setTemplateName]     = useState('');
  const [savingTemplate,   setSavingTemplate]   = useState(false);
  const [templateSaved,    setTemplateSaved]    = useState(false);
  const inputRef    = useRef(null);
  const quantityRef = useRef(null);
  const addBtnRef   = useRef(null);
  const [flyAnim,   setFlyAnim] = useState(null);

  const fetchItems = useCallback(async () => {
    try {
      const data = await loadItems(list.id);
      setItems(data);
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
      setItems((prev) =>
        prev.map((i) => i.id === item.id ? { ...i, done: !item.done } : i)
      );
      if (!item.done) fb.itemCheck(); // NEU: Tick beim Abhaken (nur beim Erledigen)
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

  async function handleClearDone() {
    try {
      await clearDoneItems(list.id);
      setItems((prev) => prev.filter((i) => !i.done));
    } catch (e) {
      setError('Bereinigen fehlgeschlagen.');
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

  async function handleSaveTemplate() {
    const name = templateName.trim() || list.name;
    setSavingTemplate(true);
    setError(null);
    try {
      await saveListAsTemplate(list.id, name);
      setShowTemplateForm(false);
      setTemplateName('');
      setTemplateSaved(true);
      setTimeout(() => setTemplateSaved(false), 3000);
    } catch (e) {
      setError('Vorlage konnte nicht gespeichert werden.');
    } finally {
      setSavingTemplate(false);
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

  return (
    <div className="sho-items-wrap">
      {error && (
        <div className="toast toast-error" style={{ marginBottom: 12 }}>{error}</div>
      )}

      {templateSaved && (
        <div className="sho-msg-success">✓ Vorlage gespeichert</div>
      )}

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
          {doneItems.length > 0 && (
            <button className="btn btn-secondary sho-action-btn" onClick={handleClearDone}>
              {doneItems.length} erledigte löschen
            </button>
          )}
          {doneItems.length > 0 && openItems.length === 0 && (
            <button className="btn btn-secondary sho-action-btn" onClick={handleResetAll}>
              Alle zurücksetzen
            </button>
          )}
          {!showTemplateForm && (
            <button
              className="btn btn-secondary sho-action-btn"
              onClick={() => { setShowTemplateForm(true); setTemplateName(list.name); }}
            >
              Als Vorlage speichern
            </button>
          )}
        </div>
      )}

      {/* Vorlage-Formular */}
      {showTemplateForm && (
        <div className="sho-new-list-form" style={{ marginBottom: 12 }}>
          <input
            type="text"
            placeholder="Name der Vorlage"
            value={templateName}
            onChange={(e) => setTemplateName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleSaveTemplate(); if (e.key === 'Escape') setShowTemplateForm(false); }}
            autoFocus
          />
          <div className="sho-new-list-actions">
            <button className="btn btn-secondary" onClick={() => setShowTemplateForm(false)}>
              Abbrechen
            </button>
            <button
              className="btn btn-primary"
              onClick={handleSaveTemplate}
              disabled={savingTemplate}
            >
              {savingTemplate ? 'Speichern …' : 'Speichern'}
            </button>
          </div>
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
            <option value="Stück">Stück</option>
            <option value="g">g</option>
            <option value="kg">kg</option>
            <option value="ml">ml</option>
            <option value="L">Liter</option>
            <option value="Packung">Packung</option>
            <option value="Pack">Pack</option>
            <option value="Karton">Karton</option>
            <option value="Kasten">Kasten</option>
            <option value="Flasche">Flasche</option>
            <option value="Dose">Dose</option>
            <option value="Becher">Becher</option>
            <option value="Bund">Bund</option>
            <option value="EL">EL</option>
            <option value="TL">TL</option>
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
    </div>
  );
}

// ─── Einzelne Artikel-Zeile ───────────────────────────────────────────
function ItemRow({ item, onToggle, onDelete, onEdit, allStores, onAssign }) {
  const [editing,   setEditing]   = useState(false);
  const [qty,       setQty]       = useState(item.quantity != null ? String(item.quantity) : '');
  const [unit,      setUnit]      = useState(item.unit || '');
  const [editStore, setEditStore] = useState(item.item_store_name || '');
  const [showStore, setShowStore] = useState(false);
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

  return (
    <div className={`sho-item-row ${item.done ? 'sho-item-done' : ''}`}>
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
              <option value="Stück">Stück</option>
              <option value="g">g</option>
              <option value="kg">kg</option>
              <option value="ml">ml</option>
              <option value="L">Liter</option>
              <option value="Packung">Packung</option>
              <option value="Pack">Pack</option>
              <option value="Karton">Karton</option>
              <option value="Kasten">Kasten</option>
              <option value="Flasche">Flasche</option>
              <option value="Dose">Dose</option>
              <option value="Becher">Becher</option>
              <option value="Bund">Bund</option>
              <option value="EL">EL</option>
              <option value="TL">TL</option>
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
            <button
              className="btn btn-primary"
              onClick={commitEdit}
              style={{ minHeight: 36, padding: '4px 12px', flexShrink: 0 }}
            >
              OK
            </button>
          </div>
        </div>
      ) : (
        <div className="sho-item-body" onClick={openEdit}>
          <span className={`sho-item-name ${item.done ? 'done' : ''}`}>
            {item.name}
          </span>
          <span className="sho-item-meta" style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
            {metaLabel && (
              <span className="sho-item-meta--qty">{metaLabel}</span>
            )}
            {!metaLabel && (
              <span className="sho-item-meta--hint">Menge tippen …</span>
            )}
            {(item.item_store_name || item.store_name) && (
              <span className="sho-item-store-label">{item.item_store_name || item.store_name}</span>
            )}
          </span>
        </div>
      )}

      {!editing && (
        <div style={{ position: 'relative', flexShrink: 0 }}>
          <button
            className="sho-item-store-btn"
            onClick={(e) => { e.stopPropagation(); setShowStore((v) => !v); }}
            title="Laden zuweisen"
          >
            🏪
          </button>
          {showStore && (
            <div className="sho-item-store-dropdown">
              <button
                className={`sho-item-store-opt ${!(item.item_store_name || item.store_name) ? 'active' : ''}`}
                onClick={() => { onAssign(item.id, null); setShowStore(false); }}
              >
                Kein Laden
              </button>
              {allStores.map((name) => (
                <button
                  key={name}
                  className={`sho-item-store-opt ${(item.item_store_name || item.store_name) === name ? 'active' : ''}`}
                  onClick={() => { onAssign(item.id, name); setShowStore(false); }}
                >
                  {name}
                </button>
              ))}
              {STORE_NAMES.filter((n) => !allStores.includes(n)).slice(0, 8).map((name) => (
                <button
                  key={name}
                  className="sho-item-store-opt"
                  onClick={() => { onAssign(item.id, name); setShowStore(false); }}
                >
                  {name}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {!editing && (
        <button
          className="btn-icon sho-item-delete"
          onClick={() => onDelete(item.id)}
          aria-label="Artikel löschen"
        >
          <IconTrash size={15} />
        </button>
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
