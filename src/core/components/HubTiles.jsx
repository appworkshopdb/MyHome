// core/components/HubTiles.jsx
// Zwei Kacheln neben der Saldo-Karte im Hub: Gewohnheiten (heute) und Training
// (heute). Rein darstellend — Zahlen und Texte kommen aus den Hub-Daten, die
// Texte sind die der Modul-Übersichten ("Nichts fällig heute", "Alles
// erledigt", "n noch offen", "Serie: n Tage", "Nichts geplant", "Ruhetag").
import Ring from './Ring';
import AreaIcon from './AreaIcons';

export function HabitTile({ done, total, streak, onPress }) {
  const headline =
    total === 0 ? 'Nichts fällig heute'
    : total - done === 0 ? 'Alles erledigt 🎉'
    : `${total - done} noch offen`;
  return (
    <button className="hubt tone-hab" onClick={onPress}>
      <span className="hubt-chev" aria-hidden="true">›</span>
      <span className="hubt-eyebrow"><span className="hubt-badge"><AreaIcon id="habits" /></span>Gewohnh.</span>
      <span className="hubt-row">
        {total > 0 && <Ring size={50} stroke={5.5} value={done / total}><b>{done}/{total}</b></Ring>}
        <span className="hubt-text">
          <b>{headline}</b>
          <span>Serie: {streak} {streak === 1 ? 'Tag' : 'Tage'}</span>
        </span>
      </span>
    </button>
  );
}

// workout: erste Einheit des Tages (kein Ruhetag) oder null; rest: gibt es einen Ruhetag?
export function TrainingTile({ workout, rest, onPress }) {
  let title; let sub = null; let status = null;
  if (workout) {
    title = workout.title;
    status = workout.done ? 'Erledigt' : 'Geplant';
  } else if (rest) {
    title = 'Ruhetag';
  } else {
    title = 'Nichts geplant';
  }
  return (
    <button className="hubt tone-sport" onClick={onPress}>
      <span className="hubt-chev" aria-hidden="true">›</span>
      <span className="hubt-eyebrow"><span className="hubt-badge"><AreaIcon id="sport" /></span>Training</span>
      <span className="hubt-text">
        <b>{title}</b>
        {sub && <span>{sub}</span>}
      </span>
      {status && <span className="hubt-pill">{status}</span>}
    </button>
  );
}
