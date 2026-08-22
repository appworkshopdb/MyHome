// modules/shopping/components/ItemsView.jsx
// Artikel einer Einkaufsliste: hinzufügen, abhaken, löschen.
// Punkte 5 (Kern) + 6 (Kategorien) + 8 (Mengen) der Prio-Liste.

import { useState, useEffect, useCallback, useRef } from 'react';
import { IconPlus, IconTrash, IconCheck } from '../../../core/components/Icons.jsx';
import {
  loadItems, saveItem, toggleItemDone, deleteItem, clearDoneItems, resetAllItems,
  saveListAsTemplate,
} from '../lib/shoData.js';

// ─── Kategorie-Zuordnung (statisch, kein DB-Overhead) ─────────────────
// Deutsche Produktnamen → Kategorie. Wird für Autocomplete + Gruppierung genutzt.
const CATEGORY_MAP = {
  // Obst & Gemüse
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

  // Milchprodukte & Eier
  'Milch': 'Milch & Eier', 'Butter': 'Milch & Eier', 'Margarine': 'Milch & Eier',
  'Käse': 'Milch & Eier', 'Gouda': 'Milch & Eier', 'Edamer': 'Milch & Eier',
  'Emmentaler': 'Milch & Eier', 'Mozzarella': 'Milch & Eier', 'Feta': 'Milch & Eier',
  'Quark': 'Milch & Eier', 'Joghurt': 'Milch & Eier', 'Naturjoghurt': 'Milch & Eier',
  'Frischkäse': 'Milch & Eier', 'Sahne': 'Milch & Eier', 'Schlagsahne': 'Milch & Eier',
  'Schmand': 'Milch & Eier', 'Crème fraîche': 'Milch & Eier', 'Eier': 'Milch & Eier',
  'Ei': 'Milch & Eier', 'Hüttenkäse': 'Milch & Eier', 'Skyr': 'Milch & Eier',
  'Kefir': 'Milch & Eier', 'Buttermilch': 'Milch & Eier', 'Kaffeesahne': 'Milch & Eier',
  'Kondensmilch': 'Milch & Eier', 'Parmesan': 'Milch & Eier',

  // Fleisch & Fisch
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

  // Brot & Backwaren
  'Brot': 'Brot & Backwaren', 'Brötchen': 'Brot & Backwaren',
  'Vollkornbrot': 'Brot & Backwaren', 'Toastbrot': 'Brot & Backwaren',
  'Toast': 'Brot & Backwaren', 'Croissant': 'Brot & Backwaren',
  'Croissants': 'Brot & Backwaren', 'Laugenstange': 'Brot & Backwaren',
  'Baguette': 'Brot & Backwaren', 'Ciabatta': 'Brot & Backwaren',
  'Mehl': 'Brot & Backwaren', 'Hefe': 'Brot & Backwaren',
  'Backpulver': 'Brot & Backwaren', 'Kuchen': 'Brot & Backwaren',

  // Tiefkühl
  'Tiefkühlpizza': 'Tiefkühl', 'Pizza': 'Tiefkühl', 'Pommes': 'Tiefkühl',
  'Tiefkühlgemüse': 'Tiefkühl', 'Tiefkühlerbsen': 'Tiefkühl',
  'Gefrorenes': 'Tiefkühl', 'Eis': 'Tiefkühl', 'Eiswürfel': 'Tiefkühl',
  'Fischfilet': 'Tiefkühl',

  // Getränke
  'Wasser': 'Getränke', 'Mineralwasser': 'Getränke', 'Sprudel': 'Getränke',
  'Saft': 'Getränke', 'Orangensaft': 'Getränke', 'Apfelsaft': 'Getränke',
  'Cola': 'Getränke', 'Limonade': 'Getränke', 'Limo': 'Getränke',
  'Bier': 'Getränke', 'Wein': 'Getränke', 'Rotwein': 'Getränke',
  'Weißwein': 'Getränke', 'Sekt': 'Getränke', 'Kaffee': 'Getränke',
  'Tee': 'Getränke', 'Kakao': 'Getränke', 'Eistee': 'Getränke',
  'Energydrink': 'Getränke', 'Smoothie': 'Getränke',

  // Nudeln, Reis & Körner
  'Nudeln': 'Nudeln & Reis', 'Spaghetti': 'Nudeln & Reis', 'Penne': 'Nudeln & Reis',
  'Rigatoni': 'Nudeln & Reis', 'Fusilli': 'Nudeln & Reis', 'Reis': 'Nudeln & Reis',
  'Basmati': 'Nudeln & Reis', 'Jasminreis': 'Nudeln & Reis', 'Quinoa': 'Nudeln & Reis',
  'Couscous': 'Nudeln & Reis', 'Bulgur': 'Nudeln & Reis', 'Linsen': 'Nudeln & Reis',
  'Kichererbsen': 'Nudeln & Reis', 'Haferflocken': 'Nudeln & Reis',
  'Müsli': 'Nudeln & Reis', 'Grieß': 'Nudeln & Reis',

  // Konserven & Vorrat
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

  // Snacks & Süßes
  'Schokolade': 'Snacks & Süßes', 'Chips': 'Snacks & Süßes',
  'Kekse': 'Snacks & Süßes', 'Gummibärchen': 'Snacks & Süßes',
  'Nüsse': 'Snacks & Süßes', 'Mandeln': 'Snacks & Süßes',
  'Walnüsse': 'Snacks & Süßes', 'Cashews': 'Snacks & Süßes',
  'Popcorn': 'Snacks & Süßes', 'Müsliriegel': 'Snacks & Süßes',
  'Cracker': 'Snacks & Süßes', 'Salzstangen': 'Snacks & Süßes',
  'Bonbons': 'Snacks & Süßes', 'Fruchtgummi': 'Snacks & Süßes',

  // Drogerie & Haushalt
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

// Alle bekannten Produktnamen als Autocomplete-Liste
const ALL_SUGGESTIONS = Object.keys(CATEGORY_MAP).sort((a, b) => a.localeCompare(b, 'de'));

// Kategorie-Reihenfolge im Laden
const CATEGORY_ORDER = [
  'Obst & Gemüse', 'Brot & Backwaren', 'Milch & Eier',
  'Fleisch & Fisch', 'Tiefkühl', 'Nudeln & Reis',
  'Vorrat', 'Getränke', 'Snacks & Süßes', 'Drogerie', 'Sonstiges',
];

function getCategory(name) {
  if (!name) return 'Sonstiges';
  const exact = CATEGORY_MAP[name.trim()];
  if (exact) return exact;
  // Teilstring-Suche (case-insensitiv)
  const lower = name.toLowerCase();
  const found = Object.entries(CATEGORY_MAP).find(([k]) => k.toLowerCase() === lower);
  return found ? found[1] : 'Sonstiges';
}

// Artikel nach Kategorie gruppieren, Reihenfolge nach CATEGORY_ORDER
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
  // Kategorien die nicht in CATEGORY_ORDER sind, ans Ende
  for (const cat of Object.keys(groups)) {
    if (!CATEGORY_ORDER.includes(cat)) ordered.push({ cat, items: groups[cat] });
  }
  return ordered;
}

// ─── Komponente ───────────────────────────────────────────────────────
export default function ItemsView({ list, onBack }) {
  const [items,            setItems]            = useState([]);
  const [loading,          setLoading]          = useState(true);
  const [error,            setError]            = useState(null);
  const [input,            setInput]            = useState('');
  const [quantity,         setQuantity]         = useState('');
  const [unit,             setUnit]             = useState('');
  const [showQty,          setShowQty]          = useState(false);
  const [suggestions,      setSuggestions]      = useState([]);
  const [saving,           setSaving]           = useState(false);
  const [showTemplateForm, setShowTemplateForm] = useState(false);
  const [templateName,     setTemplateName]     = useState('');
  const [savingTemplate,   setSavingTemplate]   = useState(false);
  const [templateSaved,    setTemplateSaved]    = useState(false);
  const inputRef    = useRef(null);
  const quantityRef = useRef(null);

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

  // Autocomplete
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
    setSaving(true);
    setError(null);
    try {
      await saveItem({
        list_id:  list.id,
        name:     trimmed,
        category: getCategory(trimmed),
        quantity: quantity.trim() ? parseFloat(quantity.replace(',', '.')) || null : null,
        unit:     unit.trim() || null,
      });
      await fetchItems();
      setInput('');
      setQuantity('');
      setUnit('');
      setSuggestions([]);
      inputRef.current?.focus();
    } catch (e) {
      setError('Hinzufügen fehlgeschlagen.');
    } finally {
      setSaving(false);
    }
  }

  async function handleToggle(item) {
    try {
      await toggleItemDone(item.id, !item.done);
      // Optimistisch lokal updaten — schneller als fetch
      setItems((prev) =>
        prev.map((i) => i.id === item.id ? { ...i, done: !item.done } : i)
      );
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
    if (e.key === 'Escape') { setSuggestions([]); setShowQty(false); }
  }

  function handleQtyKeyDown(e) {
    if (e.key === 'Enter') { handleAdd(); }
  }

  if (loading) {
    return <div className="page-loading">Wird geladen …</div>;
  }

  const openItems = items.filter((i) => !i.done);
  const doneItems = items.filter((i) => i.done);
  const openGroups = groupByCategory(openItems);

  return (
    <div className="sho-items-wrap">
      {error && (
        <div className="toast toast-error" style={{ marginBottom: 12 }}>{error}</div>
      )}

      {/* Erfolgs-Meldung Vorlage */}
      {templateSaved && (
        <div className="sho-msg-success">✓ Vorlage gespeichert</div>
      )}

      {/* Aktions-Leiste oben */}
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
          {/* Als Vorlage speichern */}
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

      {/* Offene Artikel — nach Kategorie gruppiert */}
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
              />
            ))}
          </div>
        </div>
      ))}

      {/* Erledigte Artikel — ohne Kategorie-Gruppierung, gedimmt */}
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
              />
            ))}
          </div>
        </div>
      )}

      {/* Autocomplete-Vorschläge */}
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

      {/* Eingabe-Leiste (sticky über Bottom-Nav) */}
      <div className="sho-input-bar">

        {/* Mengen-Zeile — nur wenn showQty aktiv */}
        {showQty && (
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
              className="sho-unit-select"
            >
              <option value="">Einheit</option>
              <option value="Stück">Stück</option>
              <option value="g">g</option>
              <option value="kg">kg</option>
              <option value="ml">ml</option>
              <option value="L">Liter</option>
              <option value="Packung">Packung</option>
              <option value="Flasche">Flasche</option>
              <option value="Dose">Dose</option>
              <option value="Becher">Becher</option>
              <option value="Bund">Bund</option>
              <option value="EL">EL</option>
              <option value="TL">TL</option>
            </select>
          </div>
        )}

        {/* Haupt-Eingabezeile */}
        <div className="sho-input-row">
          {/* Mengen-Toggle */}
          <button
            className={`sho-qty-toggle ${showQty ? 'active' : ''}`}
            onClick={() => {
              setShowQty((v) => !v);
              if (!showQty) setTimeout(() => quantityRef.current?.focus(), 50);
            }}
            title="Menge angeben"
            aria-label="Menge angeben"
          >
            #
          </button>

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
function ItemRow({ item, onToggle, onDelete }) {
  return (
    <div className={`sho-item-row ${item.done ? 'sho-item-done' : ''}`}>
      <button
        className={`sho-item-check ${item.done ? 'done' : ''}`}
        onClick={() => onToggle(item)}
        aria-label={item.done ? 'Als offen markieren' : 'Als erledigt markieren'}
      >
        {item.done && (
          <span style={{ width: 14, height: 14, display: 'flex' }}><IconCheck /></span>
        )}
      </button>

      <div className="sho-item-body" onClick={() => onToggle(item)}>
        <span className={`sho-item-name ${item.done ? 'done' : ''}`}>
          {item.name}
        </span>
        {(item.quantity || item.unit) && (
          <span className="sho-item-meta">
            {item.quantity && item.unit
              ? `${item.quantity} ${item.unit}`
              : item.quantity || item.unit}
          </span>
        )}
      </div>

      <button
        className="btn-icon sho-item-delete"
        onClick={() => onDelete(item.id)}
        aria-label="Artikel löschen"
      >
        <IconTrash size={15} />
      </button>
    </div>
  );
}
