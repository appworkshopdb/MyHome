import { resolveTypeLabel } from './typeLabel';

// Reine Funktionen (keine DB-Zugriffe), damit sie sowohl von der
// Auswertung als auch später von Badges/Hub genutzt werden können.
// Rechnen ausschließlich mit abgeschlossenen Einheiten — geplante
// Einheiten zählen bewusst nicht mit, sonst würde die Auswertung
// Vorhaben als Leistung ausweisen (dieselbe Logik wie im DB-Trigger,
// der measurements nur bei status='done' schreibt).

function isDone(w) {
  // is_rest explizit ausschließen: ein Ruhetag hat status='done' (siehe
  // applyPlan), ist aber keine absolvierte Einheit. Ohne diesen
  // Ausschluss würde jeder Ruhetag die Statistik als Training zählen.
  return w.status === 'done' && !w.is_rest;
}

const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

// Montag als Wochenstart (deutsche Konvention, getDay() liefert 0=So).
function startOfWeek(date) {
  const d = startOfDay(date);
  const weekday = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - weekday);
  return d;
}

export function computeStats(workouts) {
  const done = workouts.filter(isDone);
  const now = new Date();

  const thisWeekStart = startOfWeek(now);
  const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const inRange = (w, from) => new Date(w.occurred_on) >= from;

  const thisWeek = done.filter((w) => inRange(w, thisWeekStart));
  const thisMonth = done.filter((w) => inRange(w, thisMonthStart));

  const sumDuration = (list) => list.reduce((acc, w) => acc + (w.duration_min || 0), 0);

  // Verteilung nach Trainingstyp, absteigend — zeigt, ob das Training
  // einseitig ist (z.B. nur Push, nie Beine).
  const byType = new Map();
  for (const w of done) {
    const label = resolveTypeLabel(w.type_key) ?? 'Sonstiges';
    byType.set(label, (byType.get(label) || 0) + 1);
  }
  const typeDistribution = [...byType.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count);

  return {
    totalCount: done.length,
    totalDuration: sumDuration(done),
    weekCount: thisWeek.length,
    weekDuration: sumDuration(thisWeek),
    monthCount: thisMonth.length,
    monthDuration: sumDuration(thisMonth),
    typeDistribution,
    streakWeeks: computeStreakWeeks(done),
  };
}

// Konsistenz-Streak in Wochen: wie viele zusammenhängende Wochen (ab
// dieser oder letzter Woche rückwärts) mindestens eine abgeschlossene
// Einheit hatten. Bewusst wochenweise statt tageweise — ein Ruhetag darf
// eine Serie nicht zerstören (siehe Feature-Recherche: harte Tages-
// Streaks wirken feindselig und kosten Nutzer).
export function computeStreakWeeks(doneWorkouts) {
  if (doneWorkouts.length === 0) return 0;

  const weekKeys = new Set(
    doneWorkouts.map((w) => startOfWeek(new Date(w.occurred_on)).getTime())
  );

  const WEEK = 7 * 86400000;
  let cursor = startOfWeek(new Date()).getTime();

  // Läuft die aktuelle Woche noch ohne Training, zählt die Serie ab
  // letzter Woche weiter — sonst würde der Streak jeden Montag
  // fälschlich auf 0 fallen.
  if (!weekKeys.has(cursor)) cursor -= WEEK;

  let streak = 0;
  while (weekKeys.has(cursor)) {
    streak += 1;
    cursor -= WEEK;
  }
  return streak;
}

export function formatDuration(minutes) {
  if (!minutes) return '0 Min.';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m} Min.`;
  return m === 0 ? `${h} Std.` : `${h} Std. ${m} Min.`;
}
