// core/components/GamificationSheet.jsx
// Detail-Sheet für Level + Streak — öffnet sich via Tap auf die TopBar-Badges.
// Entwurf "B": Entwicklungsweg über alle 14 Stufen (wischbar), darunter
// Detail zur gewählten Stufe, Fortschrittsleiste und Kennzahlen.
// Nutzt SheetShell.jsx (Portal, wegwischbar) — exakt wie alle anderen Sheets.

import { useEffect, useRef, useState } from 'react';
import SheetShell from './SheetShell.jsx';
import Bird from './birds/Bird';
import { SPECIES, SPECIES_KEYS, STAGE_NAMES, STAGE_BLURB } from './birds/birdArt';
import { calcLevelProgress, LEVEL_THRESHOLDS } from '../lib/gamificationData.js';
import { setBirdSpecies } from '../lib/gamificationStore.js';

export default function GamificationSheet({ status, onClose }) {
  const {
    points_total   = 0,
    current_streak = 0,
    longest_streak = 0,
    bird_species   = 'robin',
  } = status ?? {};
  const species = bird_species || 'robin';

  const prog   = calcLevelProgress(points_total);
  const level  = prog.level;
  const barPct = Math.round((prog.progress ?? 0) * 100);
  const [sel, setSel] = useState(level);
  const pathRef = useRef(null);

  // Aktuelle Stufe beim Öffnen in die Mitte der Reihe holen
  useEffect(() => {
    const el = pathRef.current?.querySelector('.gs-stage.now');
    if (el) pathRef.current.scrollLeft = el.offsetLeft - pathRef.current.clientWidth / 2 + el.clientWidth / 2;
  }, []);

  const state = (i) => (i < level ? 'done' : i === level ? 'now' : 'locked');
  const selState = state(sel);
  const railPct = Math.min(100, ((level - 1 + (prog.progress ?? 0)) / 13) * 100);

  return (
    <SheetShell onClose={onClose} labelledBy="gami-sheet-title">
      <div className="gami-sheet">
        <h2 id="gami-sheet-title" className="t-title gami-sheet__title">Dein Fortschritt</h2>

        {/* Gesamtweg */}
        <div>
          <div className="gs-rail"><i style={{ width: `${railPct}%` }} /></div>
          <div className="gs-rail-meta"><span>Ei</span><span>Stufe {level} von 14</span><span>Unsterblich</span></div>
        </div>

        {/* Stufenreihe */}
        <div className="gs-path" ref={pathRef}>
          {STAGE_NAMES.slice(1).map((name, idx) => {
            const i = idx + 1;
            const st = state(i);
            return (
              <button
                key={i}
                className={`gs-stage ${st}${i === sel ? ' sel' : ''}`}
                onClick={() => setSel(i)}
                aria-label={`Stufe ${i}, ${name}`}
                aria-pressed={i === sel}
              >
                <span className="gs-stage-art"><Bird species={species} stage={i} head size={74} animated={false} /></span>
                <span className="gs-stage-n">Stufe {i}</span>
                <span className="gs-stage-t">{name}</span>
              </button>
            );
          })}
        </div>

        {/* Detail zur gewählten Stufe */}
        <div className="gs-detail">
          <div className="gs-detail-art"><Bird species={species} stage={sel} head size={104} animated={sel === level} /></div>
          <div>
            <h3 className="gs-detail-title">{STAGE_NAMES[sel]}</h3>
            <p className="gs-detail-text">{STAGE_BLURB[sel]}</p>
            <span className={`gs-state ${selState}`}>
              {selState === 'done' ? 'Erreicht' : selState === 'now' ? 'Aktuelle Stufe' : `Ab ${LEVEL_THRESHOLDS[sel - 1].toLocaleString('de-DE')} Punkten`}
            </span>
          </div>
        </div>

        {/* Fortschritt zur nächsten Stufe */}
        <div>
          <div className="gs-xp-track" role="progressbar" aria-valuenow={barPct} aria-valuemin={0} aria-valuemax={100} aria-label={`${barPct} % zum nächsten Level`}>
            <div className="gs-xp-fill" style={{ width: `${barPct}%` }} />
          </div>
          <div className="gs-xp-meta">
            {prog.next
              ? <><span>{prog.current} / {prog.needed} XP</span><span>Level {prog.next}</span></>
              : <span>Höchste Stufe erreicht</span>}
          </div>
        </div>

        <div className="gs-tiles">
          <div className="gs-tile"><div className="gs-tile-k">Punkte gesamt</div><div className="gs-tile-v">{points_total.toLocaleString('de-DE')}</div></div>
          <div className="gs-tile">
            <div className="gs-tile-k">Tagesstreak</div>
            <div className="gs-tile-v">{current_streak} <small>{current_streak === 1 ? 'Tag' : 'Tage'} · Rekord {longest_streak}</small></div>
          </div>
        </div>

        <p className="t-meta gami-sheet__footer">
          Ein Tag gilt als aktiv, wenn du mindestens eine Gewohnheit abhakst,
          ein To-do erledigst, trainierst oder eine Einkaufsliste abschließt.
        </p>

        {/* Vogelart wechseln */}
        <div className="gs-species">
          <span className="gs-species-label">Dein Vogel</span>
          <div className="segmented cols-2">
            {SPECIES_KEYS.map((k) => (
              <button key={k} className={species === k ? 'active' : ''} onClick={() => setBirdSpecies(k)}>{SPECIES[k].name}</button>
            ))}
          </div>
        </div>
      </div>
    </SheetShell>
  );
}
