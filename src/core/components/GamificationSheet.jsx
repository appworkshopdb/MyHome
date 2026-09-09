// core/components/GamificationSheet.jsx
// Detail-Sheet für Streak + Level — öffnet sich via Tap auf die TopBar-Badges.
// Nutzt SheetShell.jsx (Portal, wegwischbar) — exakt wie alle anderen Sheets.

import SheetShell from './SheetShell.jsx';
import { calcLevelProgress } from '../lib/gamificationData.js';
import { IconBird, IconNest } from './GamificationIcons.jsx';

// Level-Name (ggf. später mit Vogel-Entwicklungs-Stufen verknüpfen)
const LEVEL_NAMES = [
  '', // kein Level 0
  'Ei',          // 1
  'Küken',       // 2
  'Nestling',    // 3
  'Ästling',     // 4
  'Jungvogel',   // 5
  'Flügge',      // 6
  'Freiflieger', // 7
  'Zugvogel',    // 8
  'Nachtfalke',  // 9
  'Adler',       // 10
  'Kondor',      // 11
  'Phönix',      // 12
  'Legendär',    // 13
  'Unsterblich', // 14
];

export default function GamificationSheet({ status, onClose }) {
  const {
    points_total   = 0,
    current_streak = 0,
    longest_streak = 0,
  } = status ?? {};

  const prog      = calcLevelProgress(points_total);
  const levelName = LEVEL_NAMES[prog.level] ?? `Level ${prog.level}`;
  const barPct    = Math.round((prog.progress ?? 0) * 100);

  return (
    <SheetShell onClose={onClose} labelledBy="gami-sheet-title">
      <div className="gami-sheet">

        {/* Header */}
        <h2 id="gami-sheet-title" className="t-title gami-sheet__title">
          Dein Fortschritt
        </h2>

        {/* Level-Block */}
        <div className="gami-sheet__card">
          <div className="gami-sheet__card-label">
            <IconNest size={16} />
            <span className="t-card-title">Level</span>
          </div>
          <div className="gami-sheet__level-row">
            <span className="t-display gami-sheet__level-num">{prog.level}</span>
            <span className="t-body gami-sheet__level-name">{levelName}</span>
          </div>

          {/* Fortschrittsbalken */}
          <div className="gami-sheet__bar-track" role="progressbar"
            aria-valuenow={barPct} aria-valuemin={0} aria-valuemax={100}
            aria-label={`${barPct} % zum nächsten Level`}
          >
            <div
              className="gami-sheet__bar-fill"
              style={{ width: `${barPct}%` }}
            />
          </div>
          <div className="gami-sheet__bar-meta t-meta">
            {prog.next
              ? <><span>{prog.current} / {prog.needed} XP</span><span>Level {prog.next}</span></>
              : <span>Maximales Level erreicht 🎉</span>
            }
          </div>

          <div className="gami-sheet__points t-meta">
            Gesamt: <strong className="t-value">{points_total.toLocaleString('de-DE')}</strong> Punkte
          </div>
        </div>

        {/* Streak-Block */}
        <div className="gami-sheet__card">
          <div className="gami-sheet__card-label">
            <IconBird size={16} />
            <span className="t-card-title">Tagesstreak</span>
          </div>
          <div className="gami-sheet__streak-row">
            <span className="t-display gami-sheet__streak-num">{current_streak}</span>
            <span className="t-body gami-sheet__streak-label">
              {current_streak === 1 ? 'Tag in Folge' : 'Tage in Folge'}
            </span>
          </div>
          <p className="t-meta gami-sheet__streak-hint">
            Längster Streak: <strong>{longest_streak}</strong> {longest_streak === 1 ? 'Tag' : 'Tage'}
          </p>
        </div>

        {/* Erklärung "aktiver Tag" */}
        <p className="t-meta gami-sheet__footer">
          Ein Tag gilt als aktiv, wenn du mindestens eine Gewohnheit abhakst,
          ein To-do erledigst, trainierst oder eine Einkaufsliste abschließt.
        </p>

      </div>
    </SheetShell>
  );
}
