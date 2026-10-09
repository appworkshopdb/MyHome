import { useMemo, useState } from 'react';
import Modal from '../../../core/components/Modal';
import { fmt } from '../lib/nutrition';

const NUTRIENTS = ['kcal', 'protein', 'carbs', 'sugar', 'fat', 'satfat', 'fiber', 'salt'];

// Ergebnis des Mahlzeit-Fotos (Edge Function scan-receipt, kind "meal").
// Die Werte je Bestandteil gelten für die geschätzte Menge. Ändert der Nutzer
// die Gramm, werden die Nährwerte dieses Bestandteils proportional umgerechnet
// und die Kalorienspanne im selben Verhältnis mitgeführt.
//
// Bewusst keine Allergen-/Verträglichkeitsangaben: Das lässt sich aus einem
// Foto nicht seriös sagen.
export default function MealScanModal({ meal, onSaveAsFood, onClose }) {
  const [grams, setGrams] = useState(() => meal.items.map((i) => String(i.grams)));

  const scaled = useMemo(() => meal.items.map((it, idx) => {
    const g = parseFloat(String(grams[idx]).replace(',', '.'));
    const factor = it.grams > 0 && Number.isFinite(g) && g >= 0 ? g / it.grams : 0;
    const out = { name: it.name, grams: Number.isFinite(g) && g >= 0 ? g : 0 };
    for (const k of NUTRIENTS) out[k] = it[k] * factor;
    return out;
  }), [meal.items, grams]);

  const total = useMemo(() => {
    const t = { grams: 0 };
    for (const k of NUTRIENTS) t[k] = 0;
    for (const it of scaled) {
      t.grams += it.grams;
      for (const k of NUTRIENTS) t[k] += it[k];
    }
    return t;
  }, [scaled]);

  // Spanne mit derselben Skalierung wie die Summe (Original-Summe = Basis)
  const baseKcal = meal.items.reduce((s, i) => s + i.kcal, 0);
  const ratio = baseKcal > 0 ? total.kcal / baseKcal : 1;
  const low  = Math.round((meal.kcal_low  ?? baseKcal) * ratio);
  const high = Math.round((meal.kcal_high ?? baseKcal) * ratio);
  const kcal = Math.round(total.kcal);
  const hasRange = high - low >= 20;

  function saveAsFood() {
    if (total.grams <= 0) return;
    const per100 = (v) => Math.round((v * 100) / total.grams * 10) / 10;
    onSaveAsFood({
      name: `${meal.name || 'Mahlzeit'} (geschätzt)`,
      group: '',
      category: 'erlaubt',
      unit: 'g', // Werte gelten pro 100 g
      kcal: Math.round((total.kcal * 100) / total.grams),
      protein: per100(total.protein), carbs: per100(total.carbs), sugar: per100(total.sugar),
      fat: per100(total.fat), satfat: per100(total.satfat), fiber: per100(total.fiber),
      salt: Math.round((total.salt * 100) / total.grams * 100) / 100,
    });
  }

  return (
    <Modal title={meal.name || 'Mahlzeit'} onClose={onClose}>
      <div className="result-grid">
        <div className="result-tile" style={{ gridColumn: '1 / -1' }}>
          <div className="label">Geschätzt gesamt</div>
          <div className="value">
            {hasRange ? `≈ ${low}–${high}` : `≈ ${kcal}`}<span>kcal</span>
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
          {meal.items.map((it, idx) => (
            <div key={idx} className="meal-item" style={{ borderBottom: idx < meal.items.length - 1 ? '1px solid var(--border)' : 'none' }}>
              <div className="meal-item-main">
                <span className="meal-item-name">{it.name}</span>
                <span className="meal-item-kcal">{Math.round(scaled[idx].kcal)} kcal</span>
              </div>
              <label className="meal-item-grams">
                <input
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="5"
                  value={grams[idx]}
                  onChange={(e) => setGrams((prev) => prev.map((v, i) => (i === idx ? e.target.value : v)))}
                  aria-label={`Menge ${it.name} in Gramm`}
                />
                <span>g</span>
              </label>
            </div>
          ))}
        </div>
        <div className="meal-hint">Die Mengen sind geschätzt — passe sie an, wenn du es besser weißt.</div>
      </div>

      {meal.note && <div className="meal-hint">Unsicher: {meal.note}</div>}

      <div className="meal-disclaimer">
        Grobe Schätzung aus dem Foto. Portionsgröße, Öl und Soßen sind schwer zu erkennen, die
        tatsächlichen Werte können deutlich abweichen. Keine Angaben zu Allergenen oder Verträglichkeit.
      </div>

      <div style={{ display: 'flex', gap: 8 }}>
        <button className="btn btn-primary" disabled={total.grams <= 0} onClick={saveAsFood}>Als Lebensmittel speichern</button>
        <button className="btn btn-secondary" onClick={onClose}>Schließen</button>
      </div>
    </Modal>
  );
}
