import { useState } from 'react';
import Modal from '../../../core/components/Modal';
import { AMPEL_CATS, FOOD_DIETS, FOOD_ALLERGENS, FOOD_TAGS, TAG_COLORS } from '../lib/nutrition';

const UNITS = ['g', 'ml', 'Stück', 'Scheibe', 'EL'];
const UNIT_LABEL = { g: '100 g', ml: '100 ml', Stück: '1 Stück', Scheibe: '1 Scheibe', EL: '1 EL' };
const MACRO_FIELDS = [
  ['kcal', 'kcal', 0],
  ['protein', 'Protein (g)', 1],
  ['carbs', 'KH (g)', 1],
  ['sugar', 'Zucker (g)', 1],
  ['fat', 'Fett (g)', 1],
  ['satfat', 'ges. Fett (g)', 1],
  ['fiber', 'Ballaststoffe (g)', 1],
  ['salt', 'Salz (g)', 2],
];

const EMPTY = {
  name: '', group: '', category: 'erlaubt', unit: 'g',
  kcal: 0, protein: 0, carbs: 0, sugar: 0, fat: 0, satfat: 0, fiber: 0, salt: 0,
  vitamins: [], minerals: [], micros_other: [], allergens: [], tags: [], diet: null,
};

export default function FoodFormModal({ food, allGroups, onSave, onClose }) {
  const [form, setForm] = useState(() => (food ? { ...EMPTY, ...food } : { ...EMPTY }));
  const set = (key, value) => setForm((f) => ({ ...f, [key]: value }));
  const toggle = (key, value) => setForm((f) => {
    const list = f[key] || [];
    return { ...f, [key]: list.includes(value) ? list.filter((v) => v !== value) : [...list, value] };
  });
  const canSave = form.name.trim() && form.group.trim();

  function save() {
    if (!canSave) return;
    onSave({
      ...form,
      name: form.name.trim(),
      group: form.group.trim(),
      kcal: +form.kcal || 0, protein: +form.protein || 0, carbs: +form.carbs || 0,
      sugar: +form.sugar || 0, fat: +form.fat || 0, satfat: +form.satfat || 0,
      fiber: +form.fiber || 0, salt: +form.salt || 0,
    });
  }

  return (
    <Modal title={food ? 'Lebensmittel bearbeiten' : 'Neues Lebensmittel'} onClose={onClose}>
      <div className="form-group">
        <label>Name</label>
        <input value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="z.B. Hähnchenbrust" />
      </div>

      <div className="form-group">
        <label>Gruppe</label>
        <input
          list="nut-group-list"
          value={form.group}
          onChange={(e) => set('group', e.target.value)}
          placeholder="z.B. Fleisch & Geflügel"
        />
        <datalist id="nut-group-list">
          {allGroups.map((g) => <option key={g} value={g} />)}
        </datalist>
      </div>

      <div className="form-group">
        <label>Kategorie</label>
        <div className="segmented cols-3">
          {AMPEL_CATS.map((c) => (
            <button
              key={c.key}
              type="button"
              className={form.category === c.key ? 'active' : ''}
              onClick={() => set('category', c.key)}
            >
              {c.label}
            </button>
          ))}
        </div>
      </div>

      <div className="form-group">
        <label>Basis</label>
        <div className="segmented cols-4">
          {UNITS.map((u) => (
            <button key={u} type="button" className={form.unit === u ? 'active' : ''} onClick={() => set('unit', u)}>
              {UNIT_LABEL[u]}
            </button>
          ))}
        </div>
      </div>

      <div className="card" style={{ margin: 0 }}>
        <div className="card-title">Nährwerte pro {UNIT_LABEL[form.unit] || form.unit}</div>
        <div className="form-row" style={{ gridTemplateColumns: '1fr 1fr', rowGap: 10 }}>
          {MACRO_FIELDS.map(([key, label]) => (
            <div className="form-group" key={key}>
              <label>{label}</label>
              <input
                type="number" min="0" step="0.1"
                value={form[key]}
                onChange={(e) => set(key, e.target.value)}
              />
            </div>
          ))}
        </div>
      </div>

      <div className="form-group">
        <label>Ernährungsform</label>
        <div className="segmented cols-3">
          {FOOD_DIETS.map((d) => (
            <button
              key={d.key}
              type="button"
              className={form.diet === d.key ? 'active' : ''}
              onClick={() => set('diet', d.key)}
            >
              {d.label}
            </button>
          ))}
        </div>
      </div>

      <div className="form-group">
        <label>Allergene</label>
        <div className="chip-row" style={{ flexWrap: 'wrap' }}>
          {FOOD_ALLERGENS.map((a) => (
            <button
              key={a}
              type="button"
              className={`chip ${(form.allergens || []).includes(a) ? 'active' : ''}`}
              onClick={() => toggle('allergens', a)}
            >
              {a}
            </button>
          ))}
        </div>
        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 6 }}>
          Glutenfrei und Laktosefrei ergeben sich aus „Gluten“ und „Milch“.
        </div>
      </div>

      <div className="form-group">
        <label>Tags</label>
        <div className="chip-row" style={{ flexWrap: 'wrap' }}>
          {FOOD_TAGS.map((t) => {
            const on = (form.tags || []).includes(t);
            return (
              <button
                key={t}
                type="button"
                className="chip"
                style={on ? { background: TAG_COLORS[t], color: '#fff' } : {}}
                onClick={() => toggle('tags', t)}
              >
                {t}
              </button>
            );
          })}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8 }}>
        <button className="btn btn-primary" disabled={!canSave} onClick={save}>Speichern</button>
        <button className="btn btn-secondary" onClick={onClose}>Abbrechen</button>
      </div>
    </Modal>
  );
}
