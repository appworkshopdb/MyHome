// Verbindet body_profile (goal, training_focus) mit den statischen
// Sport-Daten. Lebt bewusst hier und nicht in core/ — core kennt kein
// einzelnes Modul, siehe Projektkontext.md. Alle Funktionen sind rein
// (keine DB-Zugriffe), damit sie sowohl beim Vorschlags-Screen als auch
// beim manuellen Anlegen eines Workouts nutzbar sind.

import { TRAINING_TYPES } from './data/trainingTypes';
import { PLANS } from './data/plans';
import { EXERCISES } from './data/exercises';

// stimulus des Trainingstyps gegen training_focus der Person.
// 'beides' passt zu allem — sowohl "Person will beides" als auch
// "Typ ist für beides geeignet" (aktuell nutzen nur Personen 'beides').
function matchesFocus(typeStimulus, trainingFocus) {
  if (!trainingFocus || trainingFocus === 'beides') return true;
  if (trainingFocus === 'kraft') return typeStimulus === 'kraft';
  if (trainingFocus === 'ausdauer') return typeStimulus === 'ausdauer';
  return true;
}

// Sortierte, begründete Liste passender Trainingstypen für ein Profil.
// Rückgabe: [{ type, reason }], beste Übereinstimmung zuerst.
export function suggestTrainingTypes({ goal, training_focus } = {}) {
  const scored = TRAINING_TYPES.map((type) => {
    let score = 0;
    const reasons = [];

    if (goal && type.goals.includes(goal)) {
      score += 2;
      reasons.push(`passt zu deinem Ziel „${GOAL_LABELS[goal] ?? goal}"`);
    }
    if (matchesFocus(type.stimulus, training_focus)) {
      score += 1;
      if (training_focus && training_focus !== 'beides') {
        reasons.push(`entspricht deinem Trainingsfokus „${FOCUS_LABELS[training_focus] ?? training_focus}"`);
      }
    } else {
      score -= 3; // klarer Fokus-Konflikt (z.B. reiner Kraftfokus vs. Ausdauertyp) drückt deutlich nach unten
    }

    return { type, score, reason: reasons.join(', ') || 'allgemein passend' };
  });

  return scored
    .filter((s) => s.score > -3) // harte Fokus-Konflikte ganz raus, statt nur niedrig zu ranken
    .sort((a, b) => b.score - a.score)
    .map(({ type, reason }) => ({ type, reason }));
}

// Vorgefertigte Pläne, gefiltert/sortiert nach denselben Kriterien wie
// die Trainingstypen. Genutzt für die "Vorschläge"-Ansicht im Modul.
export function suggestPlans(profile) {
  const rankedTypes = suggestTrainingTypes(profile);
  const rank = new Map(rankedTypes.map(({ type }, i) => [type.key, i]));

  return PLANS
    .filter((plan) => rank.has(plan.type_key))
    .sort((a, b) => rank.get(a.type_key) - rank.get(b.type_key))
    .map((plan) => ({
      plan,
      reason: rankedTypes.find((r) => r.type.key === plan.type_key)?.reason ?? '',
    }));
}

// Übungsvorschläge für einen gewählten Trainingstyp beim Anlegen eines
// Workouts — filtert den (ggf. um eigene Übungen ergänzten) Katalog auf
// passenden stimulus + Muskelgruppen-Überschneidung.
export function suggestExercises(typeKey, exercisePool = EXERCISES) {
  const type = TRAINING_TYPES.find((t) => t.key === typeKey);
  if (!type) return exercisePool;

  return exercisePool
    .filter((ex) => ex.stimulus === type.stimulus)
    .sort((a, b) => {
      const aMatch = a.muscle_groups.some((g) => type.muscle_groups.includes(g));
      const bMatch = b.muscle_groups.some((g) => type.muscle_groups.includes(g));
      return Number(bMatch) - Number(aMatch);
    });
}

// Label-Übersetzungen für Begründungstexte. Bewusst hier lokal statt
// aus BodyProfileForm importiert — core-Komponenten sollen nicht von
// einem Modul importiert werden müssen, nur weil ein Label gebraucht wird.
const GOAL_LABELS = { abnehmen: 'Abnehmen', halten: 'Halten', zunehmen: 'Zunehmen', muskel: 'Muskelaufbau' };
const FOCUS_LABELS = { kraft: 'Kraft', ausdauer: 'Ausdauer', beides: 'Beides' };
