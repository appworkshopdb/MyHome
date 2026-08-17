// Konsistenz-Badges — bewusst NICHT an Gewichten/Wiederholungen
// gekoppelt (die gibt es hier nicht, siehe "Einheit als Ganzes"), nur
// an Häufigkeit, Serie und Abwechslung. Genau das war die Empfehlung
// aus der Feature-Recherche: Fortschritt über Konsistenz zeigen statt
// über Datentiefe, die es in diesem Modul nicht gibt.
//
// Jedes Badge hat ein target und eine getValue-Funktion, die aus den
// bereits vorhandenen computeStats()-Werten liest — keine eigene
// Datenabfrage, keine neue Tabelle.

export const CATEGORY_ORDER = ['Umfang', 'Konsistenz', 'Vielfalt', 'Bestleistung'];

export const BADGES = [
  // Umfang — reine Häufigkeit, unabhängig von Regelmäßigkeit
  { key: 'workouts_1', category: 'Umfang', label: 'Erste Einheit', target: 1, getValue: (s) => s.totalCount },
  { key: 'workouts_5', category: 'Umfang', label: '5 Einheiten', target: 5, getValue: (s) => s.totalCount },
  { key: 'workouts_10', category: 'Umfang', label: '10 Einheiten', target: 10, getValue: (s) => s.totalCount },
  { key: 'workouts_25', category: 'Umfang', label: '25 Einheiten', target: 25, getValue: (s) => s.totalCount },
  { key: 'workouts_50', category: 'Umfang', label: '50 Einheiten', target: 50, getValue: (s) => s.totalCount },
  { key: 'workouts_100', category: 'Umfang', label: '100 Einheiten', target: 100, getValue: (s) => s.totalCount },

  // Konsistenz — wochenweise Serie, siehe stats.js computeStreakWeeks
  { key: 'streak_2', category: 'Konsistenz', label: '2 Wochen Serie', target: 2, getValue: (s) => s.streakWeeks },
  { key: 'streak_4', category: 'Konsistenz', label: '4 Wochen Serie', target: 4, getValue: (s) => s.streakWeeks },
  { key: 'streak_8', category: 'Konsistenz', label: '8 Wochen Serie', target: 8, getValue: (s) => s.streakWeeks },
  { key: 'streak_12', category: 'Konsistenz', label: '12 Wochen Serie', target: 12, getValue: (s) => s.streakWeeks },

  // Vielfalt — Anzahl unterschiedlicher Trainingstypen/Sportarten,
  // die je genutzt wurden (typeDistribution.length aus stats.js)
  { key: 'variety_3', category: 'Vielfalt', label: '3 Trainingsarten', target: 3, getValue: (s) => s.typeDistribution.length },
  { key: 'variety_5', category: 'Vielfalt', label: '5 Trainingsarten', target: 5, getValue: (s) => s.typeDistribution.length },

  // Bestleistung — meiste Einheiten in einem einzelnen Kalendermonat
  { key: 'month_8', category: 'Bestleistung', label: '8 in einem Monat', target: 8, getValue: (s) => s.bestMonthCount },
  { key: 'month_12', category: 'Bestleistung', label: '12 in einem Monat', target: 12, getValue: (s) => s.bestMonthCount },
  { key: 'month_20', category: 'Bestleistung', label: '20 in einem Monat', target: 20, getValue: (s) => s.bestMonthCount },
];

// Reine Funktion: nimmt das Ergebnis von computeStats() und gibt jedes
// Badge mit aktuellem Wert und erreicht/nicht-erreicht zurück.
export function computeBadges(stats) {
  return BADGES.map((b) => {
    const value = b.getValue(stats);
    return { ...b, value, earned: value >= b.target };
  });
}
