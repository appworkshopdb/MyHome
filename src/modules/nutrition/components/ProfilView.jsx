import { useEffect, useMemo, useState } from 'react';
import { IconUserRound } from '../../../core/components/Icons';
import BodyProfileForm from '../../../core/components/BodyProfileForm';
import GoalsSection from '../../../core/components/GoalsSection';
import { computeBody } from '../lib/nutrition';

const DIET = [
  { key: 'alles', label: 'Alles' }, { key: 'vegetarisch', label: 'Vegetarisch' },
  { key: 'vegan', label: 'Vegan' }, { key: 'glutenfrei', label: 'Glutenfrei' },
];
const GOAL_NOTE = { abnehmen: '−500 kcal', zunehmen: '+500 kcal', muskel: '+250 kcal', halten: 'Erhalt' };

export default function ProfilView({ profile, onSaveProfile, email }) {
  const [local, setLocal] = useState(profile);
  useEffect(() => setLocal(profile), [profile]);

  const body = useMemo(() => computeBody(local), [local.age, local.height, local.weight, local.gender, local.activity, local.goal]);

  function set(key, value) {
    const next = { ...local, [key]: value };
    setLocal(next);
    onSaveProfile(next);
  }

  return (
    <>
      <div className="card" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ borderRadius: '50%', border: '2.5px solid var(--success)', padding: 2 }}>
          <div style={{ borderRadius: '50%', background: 'var(--bg-input)', padding: 10, display: 'flex' }}>
            <IconUserRound />
          </div>
        </div>
        <div>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Angemeldet als</div>
          <div style={{ fontWeight: 700 }}>{email}</div>
        </div>
      </div>

      <BodyProfileForm value={local} onChange={(next) => { setLocal(next); onSaveProfile(next); }} />

      <div className="form-group" style={{ marginBottom: 20 }}>
        <label>Ernährungsform</label>
        <div className="segmented cols-4">
          {DIET.map((d) => (
            <button key={d.key} className={local.diet === d.key ? 'active' : ''} onClick={() => set('diet', d.key)}>{d.label}</button>
          ))}
        </div>
      </div>

      {body && (
        <>
          <div className="card-title">Dein Ergebnis</div>
          <div className="result-grid">
            <div className="result-tile"><div className="label">BMI</div><div className="value">{body.bmi}</div><div className="note">{body.bmiCat}</div></div>
            <div className="result-tile"><div className="label">Grundumsatz</div><div className="value">{body.bmr}<span>kcal</span></div><div className="note">BMR (Mifflin-St Jeor)</div></div>
            <div className="result-tile"><div className="label">Tagesbedarf</div><div className="value">{body.tdee}<span>kcal</span></div><div className="note">TDEE</div></div>
            <div className="result-tile"><div className="label">Kalorienziel</div><div className="value">{body.target}<span>kcal</span></div><div className="note">{GOAL_NOTE[local.goal] || ''}</div></div>
            <div className="result-tile"><div className="label">Proteinziel</div><div className="value">{body.protein}<span>g</span></div><div className="note">täglich</div></div>
            <div className="result-tile"><div className="label">Wasserbedarf</div><div className="value">{body.water}<span>L</span></div><div className="note">täglich</div></div>
          </div>
        </>
      )}

      <GoalsSection sourceModule="nutrition" />
    </>
  );
}
