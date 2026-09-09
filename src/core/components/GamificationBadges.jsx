// core/components/GamificationBadges.jsx
// Zwei Badges für die ModuleTopBar: Streak (Vogel + Zahl) und Level (Nest + Zahl).
// Tap auf einen der Badges öffnet GamificationSheet.
//
// Wird in ModuleTopBar.jsx direkt rechts vom Mitte-Titel, links vom Avatar eingebunden.

import { useState } from 'react';
import { useGamificationStore } from '../lib/gamificationStore.js';
import { IconBird, IconNest } from './GamificationIcons.jsx';
import GamificationSheet from './GamificationSheet.jsx';

export default function GamificationBadges() {
  const status     = useGamificationStore();
  const [open, setOpen] = useState(false);

  if (!status.loaded) return null; // erst sichtbar sobald geladen

  return (
    <>
      <div className="gami-badges" aria-label="Gamification-Status">
        {/* Streak-Badge */}
        <button
          className="gami-badge"
          onClick={() => setOpen(true)}
          aria-label={`Streak: ${status.current_streak} Tage`}
        >
          <IconBird size={17} />
          <span className="gami-badge__num t-meta">{status.current_streak}</span>
        </button>

        {/* Level-Badge */}
        <button
          className="gami-badge"
          onClick={() => setOpen(true)}
          aria-label={`Level ${status.level}`}
        >
          <IconNest size={17} />
          <span className="gami-badge__num t-meta">{status.level}</span>
        </button>
      </div>

      {open && (
        <GamificationSheet
          status={status}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}
