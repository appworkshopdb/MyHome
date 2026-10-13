// Inhalte der Modul-Tutorials (core/components/ModuleTutorial.jsx).
// Jedes Tutorial: ein paar Folien + EINE Interaktion, die das echte Anlege-
// Sheet des Bereichs öffnet (dieselben wie beim +-Knopf, siehe GlobalFab.jsx).
// Die Ids müssen zu supabase/tutorials_migration.sql passen (Bestandsnutzer).
//
// action.kind → welches Sheet ModuleTutorial öffnet:
//   todo | habit | finance | sport | shopping | nutrition
// celebrate: false → keine Erfolgskarte (bei Ernährung öffnet das Modul gleich
//   selbst einen Dialog, eine Karte darüber würde stören).

export const TUTORIALS = {
  hub: {
    slides: [
      { title: 'Das ist dein Hub', text: 'Hier läuft alles zusammen: dein Tagesplan, Termine, Aufgaben und der Einstieg in jeden Bereich.' },
      { title: 'Heute im Blick', text: 'Training, Gewohnheiten, fällige Zahlungen und Aufgaben stehen in einem Plan. Alles, was du abhakst, bringt deinem Vogel Punkte.' },
      { title: 'Schnell zu allem', text: 'Unten wechselst du zwischen Hub und Bereichen. Der Plus-Knopf legt je nach Bereich etwas Neues an, Auswertungen findest du unter „Statistiken“.' },
    ],
    action: { kind: 'todo', label: 'Erste Aufgabe anlegen', hint: 'Zum Beispiel „Wäsche waschen“. Es dauert nur einen Moment.' },
    success: 'Deine erste Aufgabe steht im Plan. Abhaken bringt Punkte.',
  },
  habits: {
    slides: [
      { title: 'Kleine Schritte, große Wirkung', text: 'Gewohnheiten sind Dinge, die du regelmäßig tun willst: Wasser trinken, spazieren gehen, lesen.' },
      { title: 'So funktioniert es', text: 'Du legst eine Gewohnheit mit Rhythmus an und hakst sie ab. Deine Serie wächst, die Statistik zeigt deinen Fortschritt und dein Vogel bekommt Punkte.' },
    ],
    action: { kind: 'habit', label: 'Erste Gewohnheit anlegen', hint: 'Fang mit einer einzigen an, mehr braucht es zum Start nicht.' },
    success: 'Deine erste Gewohnheit läuft. Ab heute kannst du sie abhaken.',
  },
  nutrition: {
    slides: [
      { title: 'Wissen, was du isst', text: 'Rezepte, eine Lebensmittel-Datenbank mit Ampel und ein Verlauf deiner Mahlzeiten gegen dein Tagesziel.' },
      { title: 'Drei Wege zum Eintrag', text: 'Du legst ein eigenes Rezept an, scannst eine Mahlzeit per Foto (die Nährwerte werden geschätzt) oder trägst ein Rezept als gegessen ein.' },
    ],
    action: { kind: 'nutrition', label: 'Rezept anlegen oder Mahlzeit scannen', hint: 'Such dir den Weg aus, der dir am nächsten liegt.' },
    celebrate: false,
  },
  finance: {
    slides: [
      { title: 'Dein Geld im Griff', text: 'Trag Ausgaben und Einnahmen in Sekunden ein. Die App rechnet daraus Saldo, Kategorien und offene Posten.' },
      { title: 'Mehr als Buchungen', text: 'Fixkosten wie Miete oder Abos legst du einmal unter „Verträge“ an, Kassenbons scannst du per Foto, alte Daten importierst du in den Einstellungen.' },
    ],
    action: { kind: 'finance', label: 'Erste Ausgabe eintragen', hint: 'Betrag und Name reichen, den Rest kannst du später ergänzen.' },
    success: 'Deine erste Buchung ist drin. Der Saldo rechnet sich jetzt von selbst.',
  },
  sport: {
    slides: [
      { title: 'Training planen und abhaken', text: 'Plane Einheiten, hake sie ab und behalte Gewicht und Verlauf im Blick. Trainingsfokus und Sportarten kommen aus deinem Profil.' },
    ],
    action: { kind: 'sport', label: 'Erste Einheit anlegen', hint: 'Eine geplante Einheit erscheint auch im Tagesplan im Hub.' },
    success: 'Deine erste Einheit ist angelegt. Im Hub taucht sie im Tagesplan auf.',
  },
  shopping: {
    slides: [
      { title: 'Einkaufen ohne Zettel', text: 'Sammle Artikel in deiner Liste und hake sie beim Einkaufen ab.' },
    ],
    action: { kind: 'shopping', label: 'Ersten Artikel hinzufügen', hint: 'Zum Beispiel Milch, Brot oder was heute fehlt.' },
    success: 'Der erste Artikel steht auf der Liste.',
  },
};

// Route (activeModule aus App.jsx) → Tutorial-Id. null = Hub; Profil und
// Statistiken haben kein Tutorial.
export function tutorialIdFor(activeModule) {
  if (activeModule === null) return 'hub';
  return TUTORIALS[activeModule] ? activeModule : null;
}
