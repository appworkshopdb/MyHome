import { useMemo, useRef, useState } from 'react';
import Modal from '../../../core/components/Modal';
import { IconSearch } from '../../../core/components/Icons';
import { fmt, MEAL_TYPES } from '../lib/nutrition';
import { mealFromScan, defaultMealType, todayStr, isGramFood } from '../lib/meals';

const NUTRIENTS = ['kcal', 'protein', 'carbs', 'sugar', 'fat', 'satfat', 'fiber', 'salt'];

// Herkunft der Nährwerte je Bestandteil
const SRC_LABEL = { db: 'Datenbank', ai: 'KI-Schätzung', user: 'Hinzugefügt' };

// Bestandteil aus dem Scan. base = Menge und Nährwerte so, wie sie ankamen; geändert
// wird nur die Menge, die Nährwerte werden proportional umgerechnet.
// src: 'db' = Nährwerte aus der Lebensmittel-Datenbank (die Function hat die erkannte
// Zutat zugeordnet), 'ai' = KI-Schätzung (Zutat nicht in der Datenbank, oder ältere Function).
function itemFromScan(it, key) {
  const base = { grams: it.grams };
  for (const k of NUTRIENTS) base[k] = it[k] || 0;
  return { key, name: it.name, src: it.src === 'db' ? 'db' : 'ai', foodName: it.food_name || null, grams: String(it.grams), base };
}

// Vom Nutzer hinzugefügt: Nährwerte pro 100 g/ml aus der Datenbank, Start bei 100 g.
function itemFromFood(food, key) {
  const base = { grams: 100 };
  for (const k of NUTRIENTS) base[k] = Number(food[k]) || 0;
  return { key, name: food.name, src: 'user', foodName: null, grams: '100', base };
}

// Ergebnis des Mahlzeit-Fotos (Edge Function scan-receipt, kind "meal").
// Bestandteile, die die KI einem Lebensmittel der Datenbank zuordnen konnte, tragen
// deren Nährwerte; nur für unbekannte Zutaten schätzt die KI. Der Nutzer kann die
// Mengen ändern, Bestandteile entfernen und Lebensmittel aus der Datenbank
// hinzufügen. Ändert er die Gramm, werden die Nährwerte dieses Bestandteils
// proportional umgerechnet. Die Kalorienspanne gilt nur für die geschätzten
// Bestandteile (Menge unsicher); selbst hinzugefügte zählen exakt.
//
// "Mahlzeit speichern" legt den Eintrag mit den (ggf. korrigierten) Werten in den
// Verlauf (Bereich "Mahlzeiten") — als Momentaufnahme mit Kennzeichnung "Schätzung".
//
// Bewusst keine Allergen-/Verträglichkeitsangaben: Das lässt sich aus einem
// Foto nicht seriös sagen.
export default function MealScanModal({ meal, foods = [], onSaveMeal, onClose }) {
  const keySeq = useRef(0);
  const nextKey = () => ++keySeq.current;
  const [items, setItems] = useState(() => meal.items.map((it) => itemFromScan(it, nextKey())));
  const [mealType, setMealType] = useState(() => defaultMealType());
  const [eatenOn, setEatenOn]   = useState(() => todayStr());
  const [saving, setSaving]     = useState(false);
  const [adding, setAdding]     = useState(false);
  const [query, setQuery]       = useState('');

  const gramFoods = useMemo(() => foods.filter(isGramFood), [foods]);
  const results = useMemo(() => {
    const tokens = query.toLowerCase().split(/\s+/).filter(Boolean);
    if (!tokens.length) return [];
    return gramFoods.filter((f) => tokens.every((t) => f.name.toLowerCase().includes(t))).slice(0, 8);
  }, [gramFoods, query]);

  const scaled = useMemo(() => items.map((it) => {
    const g = parseFloat(String(it.grams).replace(',', '.'));
    const valid = Number.isFinite(g) && g >= 0;
    const factor = it.base.grams > 0 && valid ? g / it.base.grams : 0;
    const out = { key: it.key, name: it.name, src: it.src, grams: valid ? g : 0 };
    for (const k of NUTRIENTS) out[k] = it.base[k] * factor;
    return out;
  }), [items]);

  const total = useMemo(() => {
    const t = { grams: 0, exactKcal: 0 };
    for (const k of NUTRIENTS) t[k] = 0;
    for (const it of scaled) {
      t.grams += it.grams;
      for (const k of NUTRIENTS) t[k] += it[k];
      if (it.src === 'user') t.exactKcal += it.kcal;
    }
    return t;
  }, [scaled]);

  // Spanne: relative Unter-/Obergrenze der Function (bezogen auf die Summe beim Öffnen),
  // angewendet auf den geschätzten Teil. Selbst hinzugefügte Bestandteile zählen exakt.
  const baseKcal = meal.items.reduce((s, i) => s + i.kcal, 0);
  const lowRatio  = baseKcal > 0 ? (meal.kcal_low  ?? baseKcal) / baseKcal : 1;
  const highRatio = baseKcal > 0 ? (meal.kcal_high ?? baseKcal) / baseKcal : 1;
  const uncertain = total.kcal - total.exactKcal;
  const low  = Math.round(total.exactKcal + uncertain * lowRatio);
  const high = Math.round(total.exactKcal + uncertain * highRatio);
  const kcal = Math.round(total.kcal);
  const hasRange = high - low >= 20;
  const anyEstimate = items.some((i) => i.src !== 'user');
  // Das Modell hängt der Notiz gelegentlich eine verirrte schließende Klammer an
  const note = (meal.note || '').replace(/\s*[\]}]+$/, '').trim();

  function setGrams(key, value) {
    setItems((prev) => prev.map((it) => (it.key === key ? { ...it, grams: value } : it)));
  }
  function removeItem(key) {
    setItems((prev) => prev.filter((it) => it.key !== key));
  }
  function addFood(food) {
    setItems((prev) => [...prev, itemFromFood(food, nextKey())]);
    setAdding(false);
    setQuery('');
  }

  async function save() {
    if (saving || total.grams <= 0 || !eatenOn) return;
    setSaving(true);
    try {
      await onSaveMeal(mealFromScan(
        { name: meal.name, items: scaled.filter((it) => it.grams > 0), kcalLow: low, kcalHigh: high, isEstimate: anyEstimate },
        { mealType, eatenOn },
      ));
    } catch (err) {
      console.error('[meal-save]', err);
      setSaving(false); // Fehlermeldung zeigt der Aufrufer; Dialog bleibt offen
    }
  }

  return (
    <Modal title={meal.name || 'Mahlzeit'} onClose={onClose}>
      <div className="result-grid">
        <div className="result-tile" style={{ gridColumn: '1 / -1' }}>
          <div className="label">{anyEstimate ? 'Geschätzt gesamt' : 'Gesamt'}</div>
          <div className="value">
            {hasRange ? `≈ ${low}–${high}` : `${anyEstimate ? '≈ ' : ''}${kcal}`}<span>kcal</span>
          </div>
          {hasRange && <div className="note">Mittelwert der Bestandteile: {kcal} kcal</div>}
        </div>
        <div className="result-tile"><div className="label">Eiweiß</div><div className="value">{fmt(total.protein)}<span>g</span></div></div>
        <div className="result-tile">
          <div className="label">Kohlenhydrate</div>
          <div className="value">{fmt(total.carbs)}<span>g</span></div>
          <div className="note">davon Zucker {fmt(total.sugar)} g</div>
        </div>
        <div className="result-tile">
          <div className="label">Fett</div>
          <div className="value">{fmt(total.fat)}<span>g</span></div>
          <div className="note">davon gesättigt {fmt(total.satfat)} g</div>
        </div>
        <div className="result-tile">
          <div className="label">Ballaststoffe</div>
          <div className="value">{fmt(total.fiber)}<span>g</span></div>
          <div className="note">Salz {fmt(total.salt)} g</div>
        </div>
      </div>

      <div>
        <div className="card-title" style={{ marginBottom: 8 }}>Erkannte Bestandteile</div>
        <div className="card" style={{ margin: 0, padding: 0 }}>
          {items.length === 0 && <div className="meal-hint" style={{ padding: 14, margin: 0 }}>Keine Bestandteile — füge ein Lebensmittel hinzu.</div>}
          {items.map((it, idx) => (
            <div key={it.key} className="meal-item" style={{ borderBottom: idx < items.length - 1 ? '1px solid var(--border)' : 'none' }}>
              <div className="meal-item-main">
                <span className="meal-item-name">{it.name}</span>
                <span className="meal-item-kcal">
                  {Math.round(scaled[idx].kcal)} kcal
                  <span className={`meal-item-src is-${it.src}`}>
                    {SRC_LABEL[it.src]}{it.src === 'db' && it.foodName && it.foodName.toLowerCase() !== it.name.toLowerCase() ? `: ${it.foodName}` : ''}
                  </span>
                </span>
              </div>
              <label className="meal-item-grams">
                <input
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="5"
                  value={it.grams}
                  onChange={(e) => setGrams(it.key, e.target.value)}
                  aria-label={`Menge ${it.name} in Gramm`}
                />
                <span>g</span>
              </label>
              <button type="button" className="meal-item-remove" onClick={() => removeItem(it.key)} aria-label={`${it.name} entfernen`}>×</button>
            </div>
          ))}
        </div>

        {gramFoods.length > 0 && !adding && (
          <button type="button" className="btn btn-secondary meal-add-btn" onClick={() => setAdding(true)}>＋ Zutat hinzufügen</button>
        )}
        {adding && (
          <div className="meal-add">
            <div className="search-box" style={{ position: 'relative' }}>
              <input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Lebensmittel suchen…"
                aria-label="Lebensmittel suchen"
              />
              <span style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }}><IconSearch /></span>
            </div>
            {query.trim() && results.length === 0 && (
              <div className="meal-hint">Nichts gefunden. Lege das Lebensmittel zuerst im Bereich „Lebensmittel“ an.</div>
            )}
            {results.length > 0 && (
              <div className="card" style={{ margin: '8px 0 0', padding: 0 }}>
                {results.map((f, idx) => (
                  <button
                    key={f.id}
                    type="button"
                    className="meal-pick-row"
                    style={{ borderBottom: idx < results.length - 1 ? '1px solid var(--border)' : 'none' }}
                    onClick={() => addFood(f)}
                  >
                    <span className="meal-pick-name">{f.name}</span>
                    <span className="meal-item-kcal">{Math.round(f.kcal)} kcal pro 100 {f.unit}</span>
                  </button>
                ))}
              </div>
            )}
            <button type="button" className="btn btn-secondary meal-add-btn" onClick={() => { setAdding(false); setQuery(''); }}>Abbrechen</button>
          </div>
        )}

        <div className="meal-hint">
          Die Mengen sind geschätzt — passe sie an, wenn du es besser weißt. „Datenbank“: Nährwerte aus deinen Lebensmitteln;
          „KI-Schätzung“: Zutat nicht in der Datenbank.
        </div>
      </div>

      {note && <div className="meal-hint">Unsicher: {note}</div>}

      <div className="meal-disclaimer">
        Grobe Schätzung aus dem Foto. Portionsgröße, Öl und Soßen sind schwer zu erkennen, die
        tatsächlichen Werte können deutlich abweichen. Keine Angaben zu Allergenen oder Verträglichkeit.
      </div>

      <div className="form-group">
        <label>Mahlzeit</label>
        <div className="segmented cols-4">
          {MEAL_TYPES.map((t) => (
            <button key={t.key} type="button" className={mealType === t.key ? 'active' : ''} onClick={() => setMealType(t.key)}>
              <div>{t.emoji}</div>
              <div>{t.label}</div>
            </button>
          ))}
        </div>
      </div>

      <div className="form-group">
        <label>Datum</label>
        <input type="date" value={eatenOn} onChange={(e) => setEatenOn(e.target.value)} />
      </div>

      <div style={{ display: 'flex', gap: 8 }}>
        <button className="btn btn-primary" disabled={saving || total.grams <= 0 || !eatenOn} onClick={save}>
          {saving ? 'Speichert…' : 'Mahlzeit speichern'}
        </button>
        <button className="btn btn-secondary" onClick={onClose}>Schließen</button>
      </div>
    </Modal>
  );
}
