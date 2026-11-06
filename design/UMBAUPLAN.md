# Design-Umbauplan Nestua

Oberstes Ziel: **ideales, intuitives UI**. Einheitlich heißt dabei nicht gleichförmig: gleiche Dinge sehen gleich aus und verhalten sich gleich, jede Seite hat genau eine Hauptaufgabe.

Ablauf je Seite, immer gleich: **Ist-Stand ansehen → Mockup (Neu/Jetzt, Hell/Dunkel) → Nutzer bestätigt → Bau auf `staging` → Prüfung (Hell/Dunkel, 320 px) → Stand in `nestua-design-umbau` und hier nachziehen.** Nichts wird ohne bestätigtes Mockup gebaut.

## Leitlinien für intuitive Bedienung (gelten für jede Seite)

1. **Eine Hauptaktion je Seite**, visuell klar die stärkste (gefüllter Knopf in Modulfarbe); alles andere sekundär.
2. **Lesereihenfolge = Wichtigkeit**: Status/Zahl oben, Liste darunter, Verwaltung zuletzt.
3. **Tippflächen mindestens 48 px**, Abstände aus der Skala, Daumenzone unten für Aktionen.
4. **Gleiche Dinge, gleicher Baustein**: ein Button-Satz, ein Chip, eine Karte, eine Listenzeile, ein Sheet, ein Leerzustand.
5. **Farbe trägt nie allein Bedeutung** (Symbol + Text bleiben), Kontrast Text ≥ 4,5:1.
6. **Rückmeldung bei jeder Aktion** (Toast mit "Rückgängig" statt Rückfrage-Dialog, wo Löschen umkehrbar ist).
7. **Leere, Laden, Fehler** sind eigene Zustände und werden mit entworfen, nicht nachgereicht.
8. **Fachwörter und Beschriftungen vereinheitlichen** (gleiche Aktion heißt überall gleich: Speichern, Abbrechen, Löschen, Hinzufügen).
9. Keine neuen Pixelwerte oder Hex-Farben: nur Tokens (`design/tokens.json`).

## Phase 0 – Fundament (Stand: erledigt bzw. in Arbeit)

- [x] Interface Inventory, Tokens (Schrift 7, Abstand 7, Radius 5, Tippfläche, Schatten 3), `tokens.css` eingebunden (ohne optische Änderung).
- [ ] Nutzer setzt Status "Beschlossen".
- [ ] `design/DESIGN.md` (Regeln) + Skill `nestua-design-system` (nur Ablauf).
- [ ] Prüfskript `npm run design:check` (Hex, Schriftgrößen, Inline-Styles dürfen nur sinken) in `build-check.yml`.

## Phase 1 – Gemeinsame Bausteine (vor jeder Seitenumstellung)

Je Baustein: Definition auf Tokens, eine Mockup-Seite "Bausteine" (alle Zustände: normal, gedrückt, deaktiviert, Fokus, Fehler; Hell/Dunkel), dann einbauen und die 96 Button-Klassen darauf abbilden.

1. **Button** (primär, sekundär, Text, gefährlich; Größen M 48 / S 36; Symbol-Knopf)
2. **Chip / Filter-Pille** (auswählbar, mit Zähler)
3. **Karte** (flach, erhöht, hervorgehoben in Modulfarbe)
4. **Listenzeile** (Symbol, Titel, Nebentext, Wert, Pfeil, "•••")
5. **Formularfelder** (Text, Zahl, Auswahl, Datum, Schalter) mit einheitlichem Fehlertext
6. **Sheet / Dialog** (Kopf, Inhalt, feste Fußleiste mit Aktionen)
7. **Leerzustand, Ladezustand, Fehlerzustand**
8. **Toast / ActionToast**
9. **Kopfbereich der Seite** (Titel, Zurück, Aktion) und Abschnittsüberschrift

## Phase 2 – Quer-Themen (wirken auf alle Seiten, deshalb vor den Einzelseiten)

- **Schrift**: 68 Größen auf 7 Stufen abbilden (`.t-*`-Rollen auf `--fs-*`).
- **Abstände und Radien**: padding/gap/Radius auf Skala runden.
- **Farben**: 32 lose Hex-Werte auf Variablen; Rollen-Tokens vervollständigen.
- **Schatten**: 49 auf 3.
- **Inline-Styles**: 534 Stellen; die häufigsten Muster in Klassen überführen.
- **Dunkelmodus**: jede Seite beim Umbau in beiden Modi prüfen.
- **Beträge ausblenden** (`Money.jsx`) in allen Finanz-Seiten anwenden.

## Phase 3 – Seiten (Reihenfolge nach Nutzung und Lücke)

Pro Zeile ein Mockup-Paket (alle Zustände), dann Bau. Reihenfolge von oben nach unten.

| # | Bereich | Seiten | Hauptaufgabe der Seite | Besondere Lücken |
|---|---|---|---|---|
| 1 | Anlegen (global) | alle Plus-Dialoge (`GlobalFab`, Finanz-Wizard, Aufgabe, Termin, Einkauf, Ernährung) | In ≤ 3 Schritten erfassen | uneinheitliche Schrittleisten, Knopf-Beschriftungen, Pflichtfelder |
| 2 | Finanzen | Buchungen + Offene Posten (Entwurf vorhanden), Posten-Detail, Auswertung, Verträge, Sparschwein, Einstellungen | Überblick: wie viel ist da, was ist offen | Entwurf noch ohne Bestätigung; viele Inline-Styles |
| 3 | Einkauf | Alle Listen (Entwurf vorhanden), Artikelliste, Häufig | Einkaufen ohne Nachdenken | Artikelliste und Häufig noch ohne Entwurf |
| 4 | Ernährung | Mahlzeiten (Entwurf vorhanden), Rezepte, Rezept-Dialog, Ampel, Tipps, Mahlzeit-Scan | Heute essen eintragen und Ziel sehen | Rezept-Dialog sehr voll, Ampel/Tipps alt |
| 5 | Sport | Monats-/Wochenkalender, Einheiten-Detail | Heute trainieren | Kalender bewusst unverändert, nur angleichen |
| 6 | Gewohnheiten | Statistik | Trend erkennen | alt |
| 7 | Hub-Unterseiten | Aufgaben, Kalender, Gewohnheiten heute, Statistiken Woche/Monat | Tag im Griff haben | uneinheitlich zu Hub |
| 8 | Konto | Profil, Einstellungen-Menü, Login/Onboarding-Reste | Einstellungen finden und ändern | Profil und Menü noch alt |

## Phase 4 – Abschluss und Absicherung

- Prüfskript auf "Zielwerte" schärfen (Hex 0, Inline-Styles unter Grenze, Schriftgrößen ≤ 7).
- Alte Variablen (`--space-*`, `--r-*`, alte `.t-*`) entfernen, wenn niemand sie mehr nutzt.
- Barrierefreiheit: Kontrast-Stichprobe, Fokusreihenfolge, Schriftgröße-Skalierung (Systemeinstellung 130 %).
- Doku-Seite der Werkstatt füllen (Bausteine, Regeln, Beispiele).
- Werkstatt-Seite "Werkstatt" (Klick auf Element in der echten App, Eigenschaften anpassen).

## Aufwand (Schätzung)

- Phase 1: 2–3 Sitzungen (Mockup "Bausteine", Einbau).
- Phase 2: läuft größtenteils mit Phase 3 mit, je Seite eine Welle.
- Phase 3: je Zeile 1–2 Sitzungen (Mockups + Bau + Prüfung), zusammen etwa 10–14 Sitzungen.
- Eine Sitzung = ein 5-Stunden-Fenster mit Mockups; reiner Bau ist günstiger als Mockup plus Bau.

## Risiken

- **Gemeinsames Backend**: CSS-Umbauten ändern nur das Aussehen und sind sicher; Datenänderungen sind nicht Teil des Plans.
- **Fixed-Nav-Regel** (keine `transform`/`filter` an Vorfahren von `.chrome-top`/`.bottom-nav`).
- **Parallele Sitzungen** ändern Seiten: vor jeder Seite `git log --oneline -30` lesen.
- **Zu große Sprünge**: Seiten einzeln pushen, jede für sich prüfbar und zurückdrehbar.
