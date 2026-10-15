import { useMemo, useState } from 'react';
import SheetShell from '../../../core/components/SheetShell';
import { IconClose, IconPlus, IconSearch } from '../../../core/components/Icons';
import {
  MoreButton, VStepper, WheelPicker, WizardFoot, WizardFrame, missingHint,
} from '../../../core/components/wizard/WizardKit';
import { parseNum } from '../../../core/lib/wizardDates';
import {
  CUSTOM_TAGS, GOAL_TAGS, MEAL_TYPES, basis, computeNutrition, fmt, fmtAmount,
} from '../lib/nutrition';
import {
  COVER_MOTIFS, COVER_TONES, CoverArt, formatCover, parseCover, resolveCover,
} from '../lib/recipeCovers';

// Neues Rezept — 3 Schritte im gemeinsamen Wizard-Rahmen (core/components/wizard/WizardKit.jsx),
// Felder und Karten in der bestehenden Optik der Ernährung (form-group, chip, card, result-tile …).
//   Schritt 1: Name, Portionen + Kategorie, Bild
//   Schritt 2: Zutaten mit Live-Nährwerten; "Weitere Angaben" (Ziel, Tags, Notiz) klappt im Schritt auf
//   Schritt 3: Zusammenfassung zur Kontrolle → Speichern
// Bearbeiten bestehender Rezepte läuft weiter über RecipeEditorModal.

const UNIT_SHORT = { ml: 'ml', Scheibe: 'Sch', Stück: 'Stk', Zehe: 'Zehe', EL: 'EL' };
const DEFAULT_AMOUNT = { ml: 200, Stück: 1, Scheibe: 1, Zehe: 1, EL: 1 };
const GOAL_ITEMS = ['Kein Ziel', ...GOAL_TAGS];

const NUTRIENTS = [
  ['kcal', 'Kalorien', 'kcal'],
  ['protein', 'Protein', 'g'],
  ['carbs', 'Kohlenhydrate', 'g'],
  ['sugar', 'Zucker', 'g'],
  ['fat', 'Fett', 'g'],
  ['satfat', 'Gesättigte Fette', 'g'],
  ['fiber', 'Ballaststoffe', 'g'],
  ['salt', 'Salz', 'g'],
];
const TILES = [
  ['kcal', 'kcal', ''], ['protein', 'Protein', 'g'], ['carbs', 'KH', 'g'], ['sugar', 'Zucker', 'g'],
  ['fat', 'Fett', 'g'], ['satfat', 'ges. Fett', 'g'], ['fiber', 'Ballaststoffe', 'g'], ['salt', 'Salz', 'g'],
];
const show = (key, v) => (key === 'kcal' ? String(Math.round(v)) : fmt(v, key === 'salt' ? 2 : 1).replace('.', ','));

export default function RecipeWizard({ foods, foodsById, onSave, onSaveFood, onClose }) {
  const [step, setStep] = useState(1);
  const [name, setName] = useState('');
  const [servings, setServings] = useState(2);
  const [category, setCategory] = useState('mittag');
  const [cover, setCover] = useState(null);
  const [ingredients, setIngredients] = useState([]); // { foodId, amount (Text) }
  const [query, setQuery] = useState('');
  const [showMore, setShowMore] = useState(false);
  const [goal, setGoal] = useState('Kein Ziel');
  const [tags, setTags] = useState([]);
  const [extraTags, setExtraTags] = useState([]);
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  // Neues Lebensmittel direkt aus dem Rezept
  const [nfOpen, setNfOpen] = useState(false);
  const [nf, setNf] = useState({ kcal: '', protein: '', carbs: '', fat: '' });
  const [nfSaving, setNfSaving] = useState(false);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return foods.filter((f) => f.name.toLowerCase().includes(q)).slice(0, 8);
  }, [foods, query]);

  const calcIngs = useMemo(() => ingredients.map((i) => ({ foodId: i.foodId, amount: parseNum(i.amount) })), [ingredients]);
  const calc = useMemo(() => computeNutrition(calcIngs, foodsById), [calcIngs, foodsById]);
  const por = Math.max(1, servings);

  const chosen = parseCover(cover);
  const resolved = resolveCover({ name, category, cover });

  // Vorschläge aus den Nährwerten pro Portion
  const suggested = useMemo(() => {
    const out = [];
    if (calc.kcal <= 0) return out;
    if (calc.protein / por >= 20) out.push('Proteinreich');
    if (calc.carbs / por <= 25) out.push('Low Carb');
    if (calc.fat / por <= 10) out.push('Fettarm');
    if (calc.kcal / por <= 350) out.push('Kalorienarm');
    return out;
  }, [calc, por]);
  const allTags = useMemo(() => {
    const base = [...CUSTOM_TAGS, ...extraTags];
    return [...base.filter((t) => suggested.includes(t)), ...base.filter((t) => !suggested.includes(t))];
  }, [suggested, extraTags]);

  function addIngredient(food) {
    setIngredients((prev) => [...prev, { foodId: food.id, amount: String(DEFAULT_AMOUNT[food.unit] || 100) }]);
    setQuery('');
  }

  async function createFood() {
    const n = query.trim();
    if (!n || !onSaveFood) return;
    setNfSaving(true);
    try {
      const saved = await onSaveFood({
        name: n.charAt(0).toUpperCase() + n.slice(1),
        group: 'Eigene Lebensmittel', category: 'okay', unit: 'g',
        kcal: parseNum(nf.kcal), protein: parseNum(nf.protein), carbs: parseNum(nf.carbs), fat: parseNum(nf.fat),
        sugar: 0, satfat: 0, fiber: 0, salt: 0, allergens: [], tags: [], diet: null,
      });
      if (saved?.id != null) setIngredients((prev) => [...prev, { foodId: saved.id, amount: '100' }]);
      setQuery(''); setNfOpen(false); setNf({ kcal: '', protein: '', carbs: '', fat: '' });
    } catch {
      setError('Lebensmittel konnte nicht angelegt werden.');
    } finally {
      setNfSaving(false);
    }
  }

  function addTag(raw) {
    const v = raw.trim();
    if (!v) return;
    if (![...CUSTOM_TAGS, ...extraTags].includes(v)) setExtraTags((p) => [...p, v]);
    setTags((p) => (p.includes(v) ? p : [...p, v]));
  }

  async function save() {
    setSaving(true); setError('');
    try {
      await onSave({
        name: name.trim(),
        servings: por,
        category,
        cover,
        ingredients: calcIngs.map((i) => ({ foodId: i.foodId, amount: i.amount })),
        note: note.trim(),
        customTags: tags,
        goalTags: goal === 'Kein Ziel' ? [] : [goal],
      });
    } catch (e) {
      console.error('[recipe-wizard]', e);
      setError('Speichern fehlgeschlagen. Bitte erneut versuchen.');
      setSaving(false);
    }
  }

  const nameOk = Boolean(name.trim());
  const ingOk = ingredients.length > 0;
  const catLabel = MEAL_TYPES.find((c) => c.key === category);

  let footer;
  if (step === 1) {
    footer = (
      <WizardFoot one hint={nameOk ? '' : missingHint([['Name', true]])}>
        <button type="button" className="btn btn-primary" disabled={!nameOk} onClick={() => setStep(2)}>Weiter</button>
      </WizardFoot>
    );
  } else if (step === 2) {
    footer = (
      <WizardFoot hint={ingOk ? '' : missingHint([['Zutat', true]])}>
        <MoreButton open={showMore} onClick={() => setShowMore((o) => !o)} labelClosed="Weitere Angaben" labelOpen="Weniger Angaben" />
        <button type="button" className="btn btn-primary" disabled={!ingOk} onClick={() => setStep(3)}>Weiter</button>
      </WizardFoot>
    );
  } else {
    footer = (
      <WizardFoot>
        <button type="button" className="btn btn-secondary" disabled={saving} onClick={() => setStep(2)}>Ändern</button>
        <button type="button" className="btn btn-primary" disabled={saving} onClick={save}>{saving ? 'Speichert…' : 'Speichern'}</button>
      </WizardFoot>
    );
  }

  const subs = ['Schritt 1 von 3 · Basis', 'Schritt 2 von 3 · Zutaten', 'Schritt 3 von 3 · Zusammenfassung'];

  return (
    <SheetShell onClose={onClose} wizard>
      <WizardFrame
        nut
        title={step === 3 ? 'Rezept prüfen' : 'Neues Rezept'}
        sub={subs[step - 1]}
        step={step}
        total={3}
        stepKey={step}
        onBack={step > 1 ? () => setStep(step - 1) : undefined}
        onClose={onClose}
        footer={footer}
      >
        {step === 1 && (
          <>
            <div className="form-group">
              <label htmlFor="rw-name">Name</label>
              <input id="rw-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Rezeptname" autoComplete="off" autoFocus />
            </div>

            <div className="wz-two" style={{ gridTemplateColumns: '.8fr 1.2fr' }}>
              <div className="form-group">
                <label>Portionen</label>
                <VStepper value={servings} onChange={setServings} min={1} max={50} label="Portionen" />
              </div>
              <div className="form-group">
                <label htmlFor="rw-cat">Kategorie</label>
                <select id="rw-cat" value={category} onChange={(e) => setCategory(e.target.value)}>
                  {MEAL_TYPES.map((c) => <option key={c.key} value={c.key}>{c.emoji} {c.label}</option>)}
                </select>
                <div className="nut-hint">Die Zutatenmengen gelten für diese Anzahl Portionen.</div>
              </div>
            </div>

            <div className="form-group">
              <label>Bild</label>
              <CoverArt motif={resolved.motif} tone={resolved.tone} className="cover-picker-preview" fit="meet" />
              <div className="cover-grid">
                <button type="button" className={`cover-option${!chosen ? ' active' : ''}`} onClick={() => setCover(null)}>
                  <span className="recipe-cover rc-tone-grau" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 800, color: 'var(--text-secondary)' }}>Auto</span>
                  <span className="name">Automatisch</span>
                </button>
                {COVER_MOTIFS.map((m) => (
                  <button
                    key={m.key}
                    type="button"
                    className={`cover-option${chosen?.motif.key === m.key ? ' active' : ''}`}
                    onClick={() => setCover(formatCover(m.key, chosen ? chosen.tone : m.tone))}
                    aria-label={m.label}
                  >
                    <CoverArt motif={m} tone={chosen ? chosen.tone : m.tone} />
                    <span className="name">{m.label}</span>
                  </button>
                ))}
              </div>
              <div className="cover-tones" role="group" aria-label="Hintergrundfarbe">
                {COVER_TONES.map((t) => (
                  <button
                    key={t.key}
                    type="button"
                    className={`cover-tone recipe-cover rc-tone-${t.key}${resolved.tone === t.key ? ' active' : ''}`}
                    aria-label={t.label}
                    onClick={() => setCover(formatCover(resolved.motif.key, t.key))}
                  />
                ))}
              </div>
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <div className="form-group">
              <label>Zutaten ({ingredients.length})</label>
              <div className="nut-search" style={{ marginBottom: 6 }}>
                <IconSearch />
                <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Lebensmittel suchen…" aria-label="Lebensmittel suchen" autoComplete="off" />
              </div>
              {results.length > 0 && (
                <div className="card" style={{ margin: '0 0 10px', padding: 0 }}>
                  {results.map((f) => (
                    <div key={f.id} className="ing-pick-row">
                      <div className="ing-pick-info">
                        <span className="ing-pick-name">{f.name}</span>
                        <span className="ing-pick-kcal">{f.kcal} kcal/{basis(f.unit)}</span>
                      </div>
                      <button type="button" className="ing-add" aria-label={`${f.name} hinzufügen`} onClick={() => addIngredient(f)}>
                        <IconPlus />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              {query.trim() && results.length === 0 && onSaveFood && (
                <div className="card" style={{ margin: '0 0 10px' }}>
                  <div className="wz-newfood">
                    <div style={{ fontSize: 13 }}><b>„{query.trim()}"</b> ist nicht in deiner Datenbank.</div>
                    {!nfOpen ? (
                      <button type="button" className="btn btn-secondary" onClick={() => setNfOpen(true)}>Neu anlegen, ohne das Rezept zu verlassen</button>
                    ) : (
                      <>
                        <div className="form-row">
                          <div className="form-group"><label>kcal pro 100 g</label><input inputMode="decimal" value={nf.kcal} onChange={(e) => setNf({ ...nf, kcal: e.target.value })} placeholder="0" /></div>
                          <div className="form-group"><label>Protein (g)</label><input inputMode="decimal" value={nf.protein} onChange={(e) => setNf({ ...nf, protein: e.target.value })} placeholder="0" /></div>
                        </div>
                        <div className="form-row">
                          <div className="form-group"><label>KH (g)</label><input inputMode="decimal" value={nf.carbs} onChange={(e) => setNf({ ...nf, carbs: e.target.value })} placeholder="0" /></div>
                          <div className="form-group"><label>Fett (g)</label><input inputMode="decimal" value={nf.fat} onChange={(e) => setNf({ ...nf, fat: e.target.value })} placeholder="0" /></div>
                        </div>
                        <button type="button" className="btn btn-primary" disabled={nfSaving} onClick={createFood}>
                          {nfSaving ? 'Wird angelegt…' : 'Anlegen und zum Rezept hinzufügen'}
                        </button>
                      </>
                    )}
                  </div>
                </div>
              )}
              {ingredients.length === 0 ? (
                <div className="empty-state" style={{ padding: 20 }}>Zutaten oben suchen und hinzufügen</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {ingredients.map((ing, idx) => {
                    const food = foodsById[ing.foodId];
                    if (!food) return null;
                    return (
                      <div className="ingredient-row" key={idx}>
                        <span className="food-name">{food.name}</span>
                        <input
                          type="text" inputMode="decimal"
                          value={ing.amount}
                          aria-label={`Menge ${food.name}`}
                          onChange={(e) => setIngredients((prev) => prev.map((x, i) => (i === idx ? { ...x, amount: e.target.value.replace(/[^\d.,]/g, '') } : x)))}
                        />
                        <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', width: 32 }}>{UNIT_SHORT[food.unit] || 'g'}</span>
                        <button type="button" className="btn-icon" aria-label={`${food.name} entfernen`} onClick={() => setIngredients((prev) => prev.filter((_, i) => i !== idx))}><IconClose /></button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {ingredients.length > 0 && (
              <div className="card" style={{ margin: 0 }}>
                <div className="card-title">Nährwerte gesamt ({por} Port.)</div>
                <div className="result-grid" style={{ marginBottom: 6 }}>
                  {TILES.map(([key, label, unit]) => (
                    <div className="result-tile" key={key} style={{ padding: '9px 12px' }}>
                      <div className="label">{label}</div>
                      <div className="value" style={{ fontSize: '1.15rem' }}>{show(key, calc[key])}{unit && <span>{unit}</span>}</div>
                    </div>
                  ))}
                </div>
                <div className="nut-hint">
                  Pro Portion: {Math.round(calc.kcal / por)} kcal · {fmt(calc.protein / por)} g Eiweiß · {fmt(calc.carbs / por)} g KH · {fmt(calc.fat / por)} g Fett
                </div>
              </div>
            )}

            {showMore && (
              <>
                <div className="form-group">
                  <label>Ziel</label>
                  <WheelPicker items={GOAL_ITEMS} value={goal} onChange={setGoal} label="Ziel" />
                </div>
                <div className="form-group">
                  <label>Tags</label>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {allTags.map((t) => {
                      const on = tags.includes(t);
                      return (
                        <button
                          key={t}
                          type="button"
                          className={`chip${suggested.includes(t) && !on ? ' wz-tag-sug' : ''}`}
                          aria-pressed={on}
                          style={on ? { background: 'var(--accent)', color: 'var(--on-accent)' } : undefined}
                          onClick={() => setTags((p) => (p.includes(t) ? p.filter((x) => x !== t) : [...p, t]))}
                        >
                          {t}
                        </button>
                      );
                    })}
                  </div>
                  {suggested.length > 0 && <div className="nut-hint">Umrandet = Vorschlag aus den Nährwerten dieses Rezepts.</div>}
                  <input
                    placeholder="+ eigener Tag (Enter)"
                    style={{ marginTop: 6 }}
                    onKeyDown={(e) => {
                      if ((e.key === 'Enter' || e.key === ',') && e.target.value.trim()) {
                        e.preventDefault();
                        addTag(e.target.value);
                        e.target.value = '';
                      }
                    }}
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="rw-note">Notiz</label>
                  <textarea id="rw-note" rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Zubereitungshinweise, Variationen…" />
                </div>
              </>
            )}
            {error && <p className="wz-hint err" role="alert">{error}</p>}
          </>
        )}

        {step === 3 && (
          <>
            <CoverArt motif={resolved.motif} tone={resolved.tone} className="wz-sumcover" fit="meet" />
            <div className="wz-review">
              <div className="wz-rv-top">
                <b style={{ fontSize: 22 }}>{name.trim()}</b>
                <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>{catLabel ? `${catLabel.emoji} ${catLabel.label}` : ''}</span>
              </div>
              <div className="wz-rv-row"><span>Portionen</span><span>{por}</span></div>
              <details className="wz-acc" open>
                <summary><span>Zutaten ({ingredients.length})</span><i>▾</i></summary>
                {ingredients.map((ing, idx) => {
                  const food = foodsById[ing.foodId];
                  if (!food) return null;
                  return (
                    <div className="wz-rv-row" key={idx}>
                      <span>{food.name}</span>
                      <span>{fmtAmount(parseNum(ing.amount), food.unit)} {UNIT_SHORT[food.unit] || 'g'}</span>
                    </div>
                  );
                })}
              </details>
              <details className="wz-acc" open>
                <summary><span>Pro Portion</span><i>▾</i></summary>
                {NUTRIENTS.map(([key, label, unit]) => (
                  <div className="wz-rv-row" key={key}><span>{label}</span><span>{show(key, calc[key] / por)} {unit}</span></div>
                ))}
              </details>
              <div className="wz-rv-row"><span>Ziel</span><span>{goal === 'Kein Ziel' ? '—' : goal}</span></div>
              <div className="wz-rv-row"><span>Tags</span><span>{tags.length ? tags.join(', ') : '—'}</span></div>
              <div className="wz-rv-row"><span>Notiz</span><span>{note.trim() || '—'}</span></div>
            </div>
            {error && <p className="wz-hint err" role="alert">{error}</p>}
          </>
        )}
      </WizardFrame>
    </SheetShell>
  );
}
