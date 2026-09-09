// core/components/GamificationBadges.jsx
// EINE Tippfläche in der TopBar-Pille (chrome-top-right): Vogel-Charakter +
// Level, dahinter kleiner Nest + Streak-Zahl. Öffnet GamificationSheet.
// Wird von ModuleTopBar.jsx als linke Tippfläche der gemeinsamen Pille
// gerendert (rechts davon, hinter einer Haarlinie, folgt der Profil-Button
// — beide zusammen bilden EIN Element, siehe ModuleTopBar.jsx).
//
// Reihenfolge bewusst Vogel↔Level, Nest↔Streak (Mockup-Vorgabe): der Vogel
// wächst mit dem Level (Charakter-Fortschritt), das Nest füllt sich mit
// der Serie (Tage in Folge) — nicht umgekehrt.

import { useState } from 'react';
import { useGamificationStore } from '../lib/gamificationStore.js';
import { IconBird, IconNest } from './GamificationIcons.jsx';
import GamificationSheet from './GamificationSheet.jsx';

export default function GamificationBadges() {
  const status = useGamificationStore();
  const [open, setOpen] = useState(false);

  if (!status.loaded) return null; // erst sichtbar sobald geladen

  return (
    <>
      <button
        className="gami-tapzone"
        onClick={() => setOpen(true)}
        aria-label={`Fortschritt öffnen — Level ${status.level}, Serie ${status.current_streak} Tage`}
      >
        <span className="gami-tapzone__item">
          <IconBird size={30} />
          <span className="gami-tapzone__label">Lv {status.level}</span>
        </span>
        <span className="gami-tapzone__item gami-tapzone__item--nest">
          <IconNest size={22} />
          <span className="gami-tapzone__label gami-tapzone__label--num">{status.current_streak}</span>
        </span>
      </button>

      {open && (
        <GamificationSheet
          status={status}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}
