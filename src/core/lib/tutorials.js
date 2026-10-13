// Inhalte der Modul-Touren (core/components/ModuleTutorial.jsx + TutorialStage.jsx).
// Jede Tour: ein paar Folien + EINE Mission, die das echte Anlege-Sheet des
// Bereichs öffnet (dieselben wie beim +-Knopf, siehe GlobalFab.jsx; bei
// Gewohnheiten die Vorlagen-Auswahl). Die Ids müssen zu
// supabase/tutorials_migration.sql passen (Bestandsnutzer = alles gesehen).
//
// slide.stage  → was die Bühne zeigt (TutorialStage.jsx):
//   tile    Bereichs-Symbol mit schwebenden Begriffen (chips)
//   plan    Beispiel-Tagesplan        nav     Navigation + Plus-Knopf
//   habit   Beispiel-Gewohnheit       options Liste mit Symbol/Titel/Zeile
// action.kind → welches Sheet ModuleTutorial öffnet:
//   todo | habit (Vorlagen) | finance | sport | shopping | nutrition
// action.mission → Vorschau der Aufgabe auf der letzten Folie:
//   rows | item | emoji | cards
// celebrate: false → keine Erfolgsseite (bei Ernährung öffnet das Modul gleich
//   selbst einen Dialog, eine Karte darüber würde stören).

const chips = (a, b, c) => [
  { text: a, style: { top: 84, left: 26, rot: -4 } },
  { text: b, style: { top: 150, right: 22, rot: 3 } },
  { text: c, style: { bottom: 118, left: 36, rot: 2 } },
];

export const TUTORIALS = {
  hub: {
    name: 'Hub',
    icon: 'hub',
    slides: [
      { title: 'Das ist dein Hub', text: 'Hier läuft alles zusammen: dein Tagesplan, Termine, Aufgaben und der Einstieg in jeden Bereich.', stage: { kind: 'tile', chips: chips('Tagesplan', 'Termine', 'Aufgaben') } },
      { title: 'Heute im Blick', text: 'Training, Gewohnheiten, fällige Zahlungen und Aufgaben stehen in einem Plan. Alles, was du abhakst, bringt deinem Vogel Punkte.', stage: { kind: 'plan' } },
      { title: 'Schnell zu allem', text: 'Unten wechselst du zwischen Hub und Bereichen. Der Plus-Knopf legt je nach Bereich etwas Neues an, Auswertungen findest du unter „Statistiken“.', stage: { kind: 'nav' } },
    ],
    action: {
      kind: 'todo', label: 'Erste Aufgabe anlegen',
      hint: 'Zum Beispiel „Wäsche waschen“. Das dauert keine zehn Sekunden.',
      mission: { kind: 'rows', rows: [{ title: 'Wäsche waschen', sub: 'Aufgabe · heute' }] },
    },
    success: 'Deine erste Aufgabe steht im Plan. Hake sie ab, und dein Vogel freut sich über die ersten Punkte.',
  },
  habits: {
    name: 'Gewohnheiten',
    icon: 'habits',
    slides: [
      { title: 'Kleine Schritte, große Wirkung', text: 'Gewohnheiten sind Dinge, die du regelmäßig tun willst: Wasser trinken, spazieren gehen, lesen.', stage: { kind: 'tile', chips: chips('Wasser trinken', 'Spazieren gehen', 'Lesen') } },
      { title: 'So funktioniert es', text: 'Du legst eine Gewohnheit mit Rhythmus an und hakst sie ab. Deine Serie wächst, die Statistik zeigt deinen Fortschritt und dein Vogel bekommt Punkte.', stage: { kind: 'habit' } },
    ],
    action: {
      kind: 'habit', label: 'Vorlagen auswählen',
      hint: 'Such dir drei Vorlagen aus. Der erste Schritt ist der wichtigste.',
      mission: {
        kind: 'rows', note: '3 Vorlagen auswählen, fertig',
        rows: [{ title: 'Wasser trinken', sub: 'Täglich' }, { title: 'Spazieren gehen', sub: 'Täglich' }, { title: 'Lesen', sub: 'Täglich' }],
      },
    },
    success: 'Deine ersten Gewohnheiten laufen. Ab heute kannst du sie abhaken.',
  },
  nutrition: {
    name: 'Ernährung',
    icon: 'nutrition',
    slides: [
      { title: 'Wissen, was du isst', text: 'Rezepte, eine Lebensmittel-Datenbank mit Ampel und ein Verlauf deiner Mahlzeiten gegen dein Tagesziel.', stage: { kind: 'tile', chips: chips('Rezepte', 'Lebensmittel-Ampel', 'Mahlzeiten') } },
      {
        title: 'Drei Wege zum Eintrag',
        text: 'Du legst ein eigenes Rezept an, scannst eine Mahlzeit per Foto (die Nährwerte werden geschätzt) oder trägst ein Rezept als gegessen ein.',
        stage: {
          kind: 'options',
          items: [
            { icon: 'book', title: 'Eigenes Rezept', sub: 'Zutaten wählen, Nährwerte rechnet die App' },
            { icon: 'camera', title: 'Mahlzeit scannen', sub: 'Foto machen, Nährwerte werden geschätzt' },
            { icon: 'clipcheck', title: 'Rezept eintragen', sub: 'Als gegessen verbuchen, zählt zum Tagesziel' },
          ],
        },
      },
    ],
    action: {
      kind: 'nutrition', label: 'Jetzt ausprobieren',
      hint: 'Such dir den Weg aus, der dir am nächsten liegt. Für den Anfang reicht ein Foto.',
      mission: { kind: 'cards', cards: [{ icon: 'book', title: 'Rezept anlegen' }, { icon: 'camera', title: 'Mahlzeit scannen' }] },
    },
    celebrate: false,
  },
  finance: {
    name: 'Finanzen',
    icon: 'finance',
    slides: [
      { title: 'Dein Geld im Griff', text: 'Trag Ausgaben und Einnahmen in Sekunden ein. Die App rechnet daraus Saldo, Kategorien und offene Posten.', stage: { kind: 'tile', chips: chips('Saldo', 'Kategorien', 'Offene Posten') } },
      {
        title: 'Mehr als Buchungen',
        text: 'Fixkosten wie Miete oder Abos legst du einmal unter „Verträge“ an, Kassenbons scannst du per Foto, alte Daten importierst du in den Einstellungen.',
        stage: {
          kind: 'options',
          items: [
            { icon: 'repeat', title: 'Verträge', sub: 'Miete, Handy, Abos: einmal anlegen' },
            { icon: 'camera', title: 'Beleg scannen', sub: 'Kassenbon fotografieren' },
            { icon: 'upload', title: 'Import', sub: 'Alte Daten in den Einstellungen übernehmen' },
          ],
        },
      },
    ],
    action: {
      kind: 'finance', label: 'Erste Ausgabe eintragen',
      hint: 'Betrag und Name reichen, den Rest kannst du später ergänzen. Fünf Sekunden, und die erste Buchung steht.',
      mission: { kind: 'item', icon: 'finance', title: 'Einkauf', sub: 'Ausgabe · heute', trailing: '– €' },
    },
    success: 'Deine erste Buchung ist drin. Der Saldo rechnet sich jetzt von selbst.',
  },
  sport: {
    name: 'Sport',
    icon: 'sport',
    slides: [
      { title: 'Training planen und abhaken', text: 'Plane Einheiten, hake sie ab und behalte Gewicht und Verlauf im Blick. Trainingsfokus und Sportarten kommen aus deinem Profil.', stage: { kind: 'tile', chips: chips('Einheiten', 'Gewicht', 'Verlauf') } },
    ],
    action: {
      kind: 'sport', label: 'Erste Einheit anlegen',
      hint: 'Einheiten sind deine Bausteine, zum Beispiel „Legday“. Daraus baust du später Trainingspläne.',
      mission: { kind: 'item', icon: 'sport', title: 'Legday', sub: 'Einheit · 45 Min', trailing: 'Vorlage' },
    },
    success: 'Deine erste Einheit liegt in deiner Bibliothek. Daraus baust du jetzt einen Trainingsplan.',
  },
  shopping: {
    name: 'Einkauf',
    icon: 'shopping',
    slides: [
      { title: 'Einkaufen ohne Zettel', text: 'Sammle Artikel in deiner Liste und hake sie beim Einkaufen ab.', stage: { kind: 'tile', chips: chips('Milch', 'Brot', 'Äpfel') } },
    ],
    action: {
      kind: 'shopping', label: 'Erste Liste anlegen',
      hint: 'Zum Beispiel „Wocheneinkauf“. Die Artikel fügst du danach in der Liste hinzu.',
      mission: { kind: 'emoji', emoji: '🛒', title: 'Wocheneinkauf', sub: 'Einkaufsliste' },
    },
    success: 'Deine erste Liste steht. Jetzt kommen die Artikel rein.',
  },
};

// Route (activeModule aus App.jsx) → Tutorial-Id. null = Hub; Profil und
// Statistiken haben keine Tour.
export function tutorialIdFor(activeModule) {
  if (activeModule === null) return 'hub';
  return TUTORIALS[activeModule] ? activeModule : null;
}
