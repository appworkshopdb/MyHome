import { CATEGORY_ORDER, computeBadges } from '../lib/badges';
import SportIcon from './SportIcons';

// Erfolge als Medaillen: erreicht = gefüllt mit Haken, offen = Ring mit Fortschritt
// ("3/10" darunter) — sichtbar, wie nah man dran ist, statt eines reinen Schlosses.
const ICONS = {
  workouts_1: 'flag', workouts_5: 'dumbbell', workouts_10: 'bolt', workouts_25: 'flame', workouts_50: 'medal', workouts_100: 'trophy',
  streak_2: 'link', streak_4: 'calcheck', streak_8: 'repeat', streak_12: 'shield',
  variety_3: 'shapes', variety_5: 'compass',
  month_8: 'trend', month_12: 'mountain', month_20: 'rocket',
};
const R = 26;
const C = 2 * Math.PI * R;

function Medal({ badge }) {
  const pct = Math.min(1, badge.value / badge.target);
  return (
    <div className={`sa-medal${badge.earned ? ' on' : ''}`}>
      <div className="sa-medal-wrap">
        <svg className="sa-medal-ring" width="56" height="56" viewBox="0 0 56 56" aria-hidden="true">
          <circle className="sa-ring-track" cx="28" cy="28" r={R} fill="none" strokeWidth="3" />
          {!badge.earned && pct > 0 && (
            <circle className="sa-ring-arc" cx="28" cy="28" r={R} fill="none" strokeWidth="3" strokeLinecap="round"
              strokeDasharray={C} strokeDashoffset={C * (1 - pct)} />
          )}
        </svg>
        <span className="sa-medal-core"><SportIcon name={ICONS[badge.key] ?? 'medal'} size={24} stroke={1.9} /></span>
        {badge.earned && <span className="sa-medal-ck"><SportIcon name="check" size={14} stroke={2.6} /></span>}
      </div>
      <b>{badge.label}</b>
      <small>{badge.earned ? 'Erreicht' : `${Math.min(badge.value, badge.target)}/${badge.target}`}</small>
    </div>
  );
}

export default function BadgesCard({ workouts, stats }) {
  const badges = computeBadges(stats);
  const earnedCount = badges.filter((b) => b.earned).length;

  return (
    <div className="sa-card">
      <div className="sa-ch">Erfolge <span>{earnedCount}/{badges.length}</span></div>
      <div className="sa-prog"><i style={{ width: `${(earnedCount / badges.length) * 100}%` }} /></div>

      {CATEGORY_ORDER.map((category) => {
        const items = badges.filter((b) => b.category === category);
        return (
          <div key={category}>
            <div className="sa-cat">{category}</div>
            <div className="sa-medals">
              {items.map((b) => <Medal key={b.key} badge={b} />)}
            </div>
          </div>
        );
      })}
    </div>
  );
}
