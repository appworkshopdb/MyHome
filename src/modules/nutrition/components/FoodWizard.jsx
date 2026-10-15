import { useMemo, useState } from 'react';
import SheetShell from '../../../core/components/SheetShell';
import { MoreButton, WheelPicker, WizardFoot, WizardFrame, missingHint } from '../../../core/components/wizard/WizardKit';
import { parseNum } from '../../../core/lib/wizardDates';
import { AMPEL_CATS, FOOD_ALLERGENS, FOOD_DIETS, FOOD_TAGS, TAG_COLORS } from '../lib/nutrition';

// Neues Lebensmittel — 3 Schritte im gemeinsamen Wizard-Rahmen (core/components/wizard/WizardKit.jsx),
// Felder in der bestehenden Optik der Ernährung (form-group, segmented, chip, card …).
//   Schritt 1: Name, Gruppe (Wechselregler), Kategorie (Ampel), Basis für die Mengenangabe
//   Schritt 2: Tabelle mit den 8 Nährwerten; "Weitere Angaben" (Ernährungsform, Allergene, Tags) klappt im Schritt auf
//   Schritt 3: Zusammenfassung zur Kontrolle → Speichern
// Bearbeiten bestehender Lebensmittel läuft weiter über FoodFormModal.

const UNITS = ['g', 'ml', 'Stück', 'Scheibe', 'EL'];
const UNIT_LABEL = { g: '100 g', ml: '100 ml', Stück: '1 Stück', Scheibe: '1 Scheibe', EL: '1 EL' };
const NEW_GROUP = '__new__';
const MACRO_FIELDS = [
  ['kcal', 'kcal', 'kcal'],
  ['protein', 'Protein (g)', 'g'],
  ['carbs', 'KH (g)', 'g'],
  ['sugar', 'Zucker (g)', 'g'],
  ['fat', 'Fett (g)', 'g'],
  ['satfat', 'ges. Fett (g)', 'g'],
  ['fiber', 'Ballaststoffe (g)', 'g'],
  ['salt', 'Salz (g)', 'g'],
];
const SUMMARY_ROWS = [
  ['kcal', 'Kalorien', 'kcal'], ['protein', 'Protein', 'g'], ['carbs', 'Kohlenhydrate', 'g'], ['sugar', 'Zucker', 'g'],
  ['fat', 'Fett', 'g'], ['satfat', 'Gesättigte Fette', 'g'], ['fiber', 'Ballaststoffe', 'g'], ['salt', 'Salz', 'g'],
];

export default function FoodWizard({ allGroups, onSave, onClose }) {
  const [step, setStep] = useState(1);
  const [name, setName] = useState('');
  const [group, setGroup] = useState(allGroups[0] ?? NEW_GROUP);
  const [groupNew, setGroupNew] = useState('');
  const [category, setCategory] = useState('erlaubt');
  const [unit, setUnit] = useState('g');
  const [vals, setVals] = useState({ kcal: '', protein: '', carbs: '', sugar: '', fat: '', satfat: '', fiber: '', salt: '' });
  const [showMore, setShowMore] = useState(false);
  const [diet, setDiet] = useState(null);
  const [allergens, setAllergens] = useState([]);
  const [tags, setTags] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const groupItems = useMemo(() => [...allGroups.map((g) => ({ value: g, label: g })), { value: NEW_GROUP, label: '+ Neue Gruppe …' }], [allGroups]);
  const groupName = group === NEW_GROUP ? groupNew.trim() : group;
  const nameOk = Boolean(name.trim()) && Boolean(groupName);
  const num = (k) => parseNum(vals[k]);

  // Plausibilität: kcal ≈ 4·Protein + 4·KH + 9·Fett
  const expected = 4 * num('protein') + 4 * num('carbs') + 9 * num('fat');
  const kcal = num('kcal');
  const off = expected > 0 && Math.abs(kcal - expected) / expected > 0.15;

  const toggle = (list, setList, v) => setList(list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);
  const ampel = AMPEL_CATS.find((c) => c.key === category);

  async function save() {
    setSaving(true); setError('');
    try {
      await onSave({
        name: name.trim(),
        group: groupName,
        category,
        unit,
        kcal: num('kcal'), protein: num('protein'), carbs: num('carbs'), sugar: num('sugar'),
        fat: num('fat'), satfat: num('satfat'), fiber: num('fiber'), salt: num('salt'),
        vitamins: [], minerals: [], micros_other: [],
        allergens, tags, diet,
      });
    } catch (e) {
      console.error('[food-wizard]', e);
      setError('Speichern fehlgeschlagen. Bitte erneut versuchen.');
      setSaving(false);
    }
  }

  let footer;
  if (step === 1) {
    footer = (
      <WizardFoot one hint={nameOk ? '' : missingHint([['Name', !name.trim()], ['Gruppe', !groupName]])}>
        <button type="button" className="btn btn-primary" disabled={!nameOk} onClick={() => setStep(2)}>Weiter</button>
      </WizardFoot>
    );
  } else if (step === 2) {
    footer = (
      <WizardFoot>
        <MoreButton open={showMore} onClick={() => setShowMore((o) => !o)} labelClosed="Weitere Angaben" labelOpen="Weniger Angaben" />
        <button type="button" className="btn btn-primary" onClick={() => setStep(3)}>Weiter</button>
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

  const subs = ['Schritt 1 von 3 · Basis', `Schritt 2 von 3 · Nährwerte pro ${UNIT_LABEL[unit]}`, 'Schritt 3 von 3 · Zusammenfassung'];

  return (
    <SheetShell onClose={onClose} wizard>
      <WizardFrame
        nut
        title={step === 3 ? 'Lebensmittel prüfen' : 'Neues Lebensmittel'}
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
              <label htmlFor="fw-name">Name</label>
              <input id="fw-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="z.B. Hähnchenbrust" autoComplete="off" autoFocus />
            </div>

            <div className="form-group">
              <label>Gruppe</label>
              <WheelPicker items={groupItems} value={group} onChange={setGroup} label="Gruppe" />
              {group === NEW_GROUP && (
                <input value={groupNew} onChange={(e) => setGroupNew(e.target.value)} placeholder="Name der neuen Gruppe" aria-label="Name der neuen Gruppe" style={{ marginTop: 6 }} autoComplete="off" />
              )}
            </div>

            <div className="form-group">
              <label>Kategorie</label>
              <div className="segmented cols-3">
                {AMPEL_CATS.map((c) => (
                  <button key={c.key} type="button" className={category === c.key ? 'active' : ''} onClick={() => setCategory(c.key)}>{c.label}</button>
                ))}
              </div>
            </div>

            <div className="form-group">
              <label>Basis für die Mengenangabe</label>
              <div className="segmented" style={{ gridTemplateColumns: 'repeat(5, 1fr)', gap: 6 }}>
                {UNITS.map((u) => (
                  <button key={u} type="button" className={unit === u ? 'active' : ''} style={{ padding: '10px 2px', fontSize: '0.68rem' }} onClick={() => setUnit(u)}>
                    {UNIT_LABEL[u]}
                  </button>
                ))}
              </div>
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <div className="card" style={{ margin: 0 }}>
              <div className="card-title">Nährwerte pro {UNIT_LABEL[unit]}</div>
              <div className="form-row" style={{ gridTemplateColumns: '1fr 1fr', rowGap: 10 }}>
                {MACRO_FIELDS.map(([key, label]) => (
                  <div className="form-group" key={key}>
                    <label htmlFor={`fw-${key}`}>{label}</label>
                    <input
                      id={`fw-${key}`}
                      type="text"
                      inputMode="decimal"
                      value={vals[key]}
                      placeholder="0"
                      onChange={(e) => setVals((v) => ({ ...v, [key]: e.target.value.replace(/[^\d.,]/g, '') }))}
                    />
                  </div>
                ))}
              </div>
            </div>
            {expected > 0 && (
              <div className={`wz-ncheck ${off ? 'warn' : 'ok'}`}>
                {off
                  ? `Bitte prüfen: Protein, KH und Fett ergeben ≈ ${Math.round(expected)} kcal, eingetragen sind ${Math.round(kcal)} kcal.`
                  : `✓ Passt: Protein, KH und Fett ergeben ≈ ${Math.round(expected)} kcal.`}
              </div>
            )}

            {showMore && (
              <>
                <div className="form-group">
                  <label>Ernährungsform</label>
                  <div className="segmented cols-3">
                    {FOOD_DIETS.map((d) => (
                      <button key={d.key} type="button" className={diet === d.key ? 'active' : ''} onClick={() => setDiet(d.key)}>{d.label}</button>
                    ))}
                  </div>
                </div>
                <div className="form-group">
                  <label>Allergene</label>
                  <div className="chip-row" style={{ flexWrap: 'wrap' }}>
                    {FOOD_ALLERGENS.map((a) => (
                      <button key={a} type="button" className={`chip ${allergens.includes(a) ? 'active' : ''}`} aria-pressed={allergens.includes(a)} onClick={() => toggle(allergens, setAllergens, a)}>{a}</button>
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
                      const on = tags.includes(t);
                      return (
                        <button key={t} type="button" className="chip" aria-pressed={on} style={on ? { background: TAG_COLORS[t], color: '#fff' } : {}} onClick={() => toggle(tags, setTags, t)}>{t}</button>
                      );
                    })}
                  </div>
                </div>
              </>
            )}
          </>
        )}

        {step === 3 && (
          <>
            <div className="wz-review">
              <div className="wz-rv-top">
                <b style={{ fontSize: 22 }}>{name.trim()}</b>
                <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>{groupName}</span>
              </div>
              <div className="wz-rv-row">
                <span>Kategorie</span>
                <span><span className="wz-ampel" style={{ background: ampel?.bg, color: ampel?.color }}>{ampel?.label}</span></span>
              </div>
              <div className="wz-rv-row"><span>Basis</span><span>{UNIT_LABEL[unit]}</span></div>
              <details className="wz-acc" open>
                <summary><span>Nährwerte pro {UNIT_LABEL[unit]}</span><i>▾</i></summary>
                {SUMMARY_ROWS.map(([key, label, u]) => (
                  <div className="wz-rv-row" key={key}><span>{label}</span><span>{String(num(key)).replace('.', ',')} {u}</span></div>
                ))}
              </details>
              <div className="wz-rv-row"><span>Ernährungsform</span><span>{FOOD_DIETS.find((d) => d.key === diet)?.label || '—'}</span></div>
              <div className="wz-rv-row"><span>Allergene</span><span>{allergens.length ? allergens.join(', ') : '—'}</span></div>
              <div className="wz-rv-row"><span>Tags</span><span>{tags.length ? tags.join(', ') : '—'}</span></div>
            </div>
            {error && <p className="wz-hint err" role="alert">{error}</p>}
          </>
        )}
      </WizardFrame>
    </SheetShell>
  );
}
