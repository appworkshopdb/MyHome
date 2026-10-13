// core/components/TutorialStage.jsx
// Die Bühne einer Tour-Seite: je nach Folie ein Bereichs-Symbol mit Begriffen,
// ein Beispiel-Plan, die Navigation, eine Beispiel-Gewohnheit, eine Optionsliste
// oder die Mission (Vorschau der ersten Aufgabe). Reine Darstellung, die Daten
// kommen aus lib/tutorials.js. Das Beispiel-Material ist bewusst fest.

import { ModuleIcon, UiIcon } from './ModuleIcons';

const CONFETTI = [
  { w: 11, h: 11, c: 'var(--warm)', l: 44, t: 54, r: 20 }, { w: 8, h: 15, c: 'var(--data-2)', l: 110, t: 34, r: -30 },
  { w: 13, h: 8, c: '#F2C94C', right: 62, t: 48, r: 40 }, { w: 9, h: 9, c: 'var(--action-primary)', right: 34, t: 130, r: 12 },
  { w: 8, h: 14, c: 'var(--warm)', l: 30, t: 170, r: -20 }, { w: 12, h: 8, c: 'var(--data-3)', right: 80, t: 210, r: -12 },
];

function Chip({ text, style: s, warm }) {
  const { rot = 0, ...pos } = s || {};
  return <span className={`tut-chip${warm ? ' warm' : ''}${s ? '' : ' flow'}`} style={s ? { ...pos, transform: `rotate(${rot}deg)` } : undefined}>{text}</span>;
}

function Row({ title, sub, on, trailing }) {
  return (
    <div className="tut-row">
      <i className={`tut-cb${on ? ' on' : ''}`} />
      <div>{title}<small>{sub}</small></div>
      {trailing && <em>{trailing}</em>}
    </div>
  );
}

// Folien-Bühne
export function SlideStage({ stage, moduleIcon }) {
  switch (stage.kind) {
    case 'plan':
      return (
        <>
          <div className="tut-card" style={{ transform: 'rotate(-1.5deg)' }}>
            <div className="tut-head">Dein Tagesplan<span>1 / 4 erledigt</span></div>
            <div className="tut-bar"><i style={{ width: '25%' }} /></div>
            <Row title="Krafttraining" sub="Training · 45 Min" />
            <Row title="Wasser trinken" sub="Gewohnheit" on />
            <Row title="Miete" sub="Zahlung · heute fällig" />
            <Row title="Wäsche waschen" sub="Aufgabe" />
          </div>
          <Chip warm text="+5 Punkte" style={{ right: 20, top: 92, rot: 4 }} />
        </>
      );
    case 'nav':
      return (
        <>
          <div className="tut-card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px' }}>
            <div><div style={{ fontWeight: 800, fontSize: '0.95rem' }}>Statistiken</div><div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)' }}>Wochen- und Monatsüberblick</div></div>
            <span style={{ fontWeight: 800, fontSize: 22, color: 'var(--data-2)' }}>›</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, alignSelf: 'flex-end', marginRight: 20 }}>
            <Chip text="Der Plus-Knopf legt Neues an" />
            <div className="tut-fab"><UiIcon name="plus" size={28} strokeWidth={2.4} /></div>
          </div>
          <div className="tut-nav">
            {['hub', 'habits', 'finance', 'sport', 'nutrition', 'shopping'].map((id) => (
              <i key={id} className={id === 'hub' ? 'on' : ''}><ModuleIcon id={id} size={22} /></i>
            ))}
          </div>
          <Chip text="Unten wechselst du zwischen den Bereichen" />
        </>
      );
    case 'habit':
      return (
        <>
          <div className="tut-card" style={{ transform: 'rotate(-1.5deg)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
              <div className="tut-ico"><ModuleIcon id="habits" size={22} /></div>
              <div style={{ flex: 1, fontWeight: 800, fontSize: '1rem' }}>Wasser trinken<small style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-muted)' }}>jeden Tag</small></div>
            </div>
            <div className="tut-days">
              {['Mo', 'Di', 'Mi', 'Do', 'Fr'].map((d) => <div key={d}><i className="on" />{d}</div>)}
              <div><i className="today" />Sa</div>
              <div><i />So</div>
            </div>
            <div style={{ marginTop: 14, paddingTop: 12, borderTop: '1px solid var(--surface-page)', fontSize: '0.9rem', fontWeight: 800 }}>5 Tage in Folge</div>
          </div>
          <Chip warm text="Serie wächst" style={{ right: 20, top: 92, rot: 4 }} />
        </>
      );
    case 'options':
      return (
        <div className="tut-stack">
          {stage.items.map((it) => (
            <div key={it.title} className="tut-opt">
              <div className="tut-ico"><UiIcon name={it.icon} /></div>
              <div>{it.title}<small>{it.sub}</small></div>
            </div>
          ))}
        </div>
      );
    default: // tile
      return (
        <>
          <div className="tut-tile"><ModuleIcon id={moduleIcon} size={76} strokeWidth={1.7} /></div>
          {stage.chips.map((c) => <Chip key={c.text} text={c.text} style={c.style} />)}
          <i className="tut-spark" style={{ width: 10, height: 10, background: 'var(--warm)', left: 60, top: 230 }} />
          <i className="tut-spark" style={{ width: 7, height: 7, background: 'var(--data-2)', right: 70, top: 90 }} />
        </>
      );
  }
}

// Mission-Bühne: Vorschau der Aufgabe + Plus-Knopf
export function MissionStage({ mission }) {
  let preview = null;
  if (mission.kind === 'rows') {
    preview = (
      <div className="tut-card ghost" style={{ padding: '6px 18px' }}>
        {mission.rows.map((r) => <Row key={r.title} title={r.title} sub={r.sub} />)}
      </div>
    );
  } else if (mission.kind === 'item') {
    preview = (
      <div className="tut-card ghost" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div className="tut-ico soft"><ModuleIcon id={mission.icon} size={22} /></div>
        <div style={{ flex: 1, fontWeight: 800 }}>{mission.title}<small style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-muted)' }}>{mission.sub}</small></div>
        <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--text-muted)' }}>{mission.trailing}</span>
      </div>
    );
  } else if (mission.kind === 'emoji') {
    preview = (
      <div className="tut-card ghost" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div className="tut-emo">{mission.emoji}</div>
        <div style={{ flex: 1, fontWeight: 800 }}>{mission.title}<small style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-muted)' }}>{mission.sub}</small></div>
      </div>
    );
  } else if (mission.kind === 'cards') {
    preview = (
      <div className="tut-cards">
        {mission.cards.map((c) => (
          <div key={c.title} className="tut-card ghost"><div className="tut-ico"><UiIcon name={c.icon} size={26} /></div>{c.title}</div>
        ))}
      </div>
    );
  }
  return (
    <>
      <span className="tut-mission">Deine erste Mission</span>
      {preview}
      {mission.note && <Chip text={mission.note} />}
      <div className="tut-fab"><UiIcon name="plus" size={28} strokeWidth={2.4} /></div>
    </>
  );
}

// Erfolgs-Bühne: Konfetti + Haken
export function SuccessStage() {
  return (
    <>
      <div className="tut-conf">
        {CONFETTI.map((c, i) => (
          <i key={i} style={{ width: c.w, height: c.h, background: c.c, left: c.l, right: c.right, top: c.t, transform: `rotate(${c.r}deg)` }} />
        ))}
      </div>
      <div className="tut-tile warm"><UiIcon name="check" size={70} strokeWidth={2.4} /></div>
    </>
  );
}
