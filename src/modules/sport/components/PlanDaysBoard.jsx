import RestBadge from './RestBadge';
import UnitVisual from './UnitVisual';
import { daysSummary, emptyDay, restDay } from '../lib/planDays';

// Die Tage eines Plans als Kachelraster mit Detailfeld, gemeinsam für den
// Plan-Wizard und den Plan-Editor. Ein Tipp wählt den Tag; darunter wird er
// bearbeitet (Einheit wählen, Ruhetag, früher/später, entfernen). Die Länge des
// Plans ergibt sich aus den Tagen, "+ Tag" hängt einen an.
// onChoose öffnet die Einheiten-Auswahl für den gewählten Tag.

export function DayVisual({ day, size }) {
  if (day.is_rest) return <RestBadge size={size + 10} />;
  const visual = <UnitVisual tags={day.muscle_groups ?? []} icon={day.icon} size={size} max={2} />;
  const hasVisual = (day.muscle_groups ?? []).length > 0 || day.icon;
  return hasVisual ? visual : <span className="pe-empty" style={{ width: size, height: size }} aria-hidden="true">?</span>;
}

// Eine Kachel; ohne onSelect (Prüf-Ansicht) ist sie nur Anzeige.
export function DayTile({ day, index, selected, onSelect }) {
  const cls = `pe-tile${day.is_rest ? ' is-rest' : ''}${selected ? ' is-sel' : ''}`;
  const inner = (
    <>
      <span className="pe-n">Tag {index + 1}</span>
      <span className="pe-vis"><DayVisual day={day} size={30} /></span>
      <b>{day.is_rest ? 'Ruhetag' : (day.title || 'Einheit wählen')}</b>
    </>
  );
  return onSelect
    ? <button type="button" className={cls} aria-pressed={selected} onClick={onSelect}>{inner}</button>
    : <div className={cls}>{inner}</div>;
}

export default function PlanDaysBoard({ days, setDays, sel, setSel, onChoose }) {
  const cur = days[sel] ?? days[0];

  function patchDay(index, next) {
    setDays((list) => list.map((d, i) => (i === index ? next : d)));
  }
  function addDay() {
    setDays((list) => [...list, emptyDay()]);
    setSel(days.length);
  }
  function removeDay() {
    if (days.length === 1) return;
    setDays((list) => list.filter((_, i) => i !== sel));
    setSel(Math.max(0, sel - 1));
  }
  function moveDay(delta) {
    const target = sel + delta;
    if (target < 0 || target >= days.length) return;
    setDays((list) => {
      const next = [...list];
      [next[sel], next[target]] = [next[target], next[sel]];
      return next;
    });
    setSel(target);
  }

  return (
    <>
      <div className="pe-head">
        <span>Ablauf</span>
        <span>{daysSummary(days)}</span>
      </div>

      <div className="pe-grid" role="group" aria-label="Tage des Plans">
        {days.map((d, i) => <DayTile key={i} day={d} index={i} selected={i === sel} onSelect={() => setSel(i)} />)}
        <button type="button" className="pe-tile pe-add" onClick={addDay}>
          <span className="pe-plus" aria-hidden="true">+</span>
          <b>Tag</b>
        </button>
      </div>

      <div className="pe-panel">
        <div className="pe-panel-h">
          <DayVisual day={cur} size={40} />
          <div>
            <small>Tag {sel + 1} von {days.length}</small>
            <b>{cur.is_rest ? 'Ruhetag' : (cur.title || 'Noch keine Einheit')}</b>
          </div>
        </div>

        {!cur.is_rest && (
          <button type="button" className={`btn ${cur.title ? 'btn-secondary' : 'btn-primary'} pe-choose`} onClick={onChoose}>
            {cur.title ? 'Einheit ändern' : 'Einheit wählen'}
          </button>
        )}

        <label className="pe-toggle" htmlFor="pe-rest">
          <span>Ruhetag</span>
          <input id="pe-rest" type="checkbox" role="switch" checked={cur.is_rest} onChange={(e) => patchDay(sel, e.target.checked ? restDay() : emptyDay())} />
        </label>

        <div className="pe-move">
          <button type="button" className="btn btn-secondary" onClick={() => moveDay(-1)} disabled={sel === 0}>← Früher</button>
          <button type="button" className="btn btn-secondary" onClick={() => moveDay(1)} disabled={sel === days.length - 1}>Später →</button>
          <button type="button" className="btn btn-secondary pe-trash" onClick={removeDay} disabled={days.length === 1} aria-label="Tag entfernen">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M5 7h14M10 7V4h4v3M7 7l1 13h8l1-13" />
            </svg>
          </button>
        </div>
      </div>
    </>
  );
}
