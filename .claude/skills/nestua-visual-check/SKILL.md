---
name: nestua-visual-check
description: Die Nestua-App lokal mit erfundenen Testdaten starten und per Playwright prüfen, also Screenshots in Hell und Dunkel bei Handybreite, Klicktests, Konsolenfehler und Textsuche über mehrere Seiten. Immer nutzen, wenn eine Oberflächenänderung (CSS, Komponenten, Layout) gebaut wurde und angesehen werden soll, wenn ein Ist-Stand für ein Mockup gebraucht wird oder wenn geprüft werden soll, dass irgendwo ein Text nicht mehr vorkommt. Auch bei "sieh dir das mal an", "mach einen Screenshot" und "teste das".
---

# Nestua visuell prüfen

Der Aufbau startet die echte App (Vite) gegen ein **gemocktes Supabase** mit erfundenen Daten. Es fließt nichts an die echte Datenbank, und es sind keine Zugangsdaten nötig. Die Uhr steht fest auf **27.10.2026 11:50 Berlin**, damit Bilder reproduzierbar sind.

Alle Skripte liegen in `.claude/skills/nestua-visual-check/scripts/`.

## Ablauf

1. **Server starten:** `bash .claude/skills/nestua-visual-check/scripts/dev.sh start`
   Das schreibt `.env.local` (Test-URL und Test-Schlüssel) und wartet, bis die App auf `http://127.0.0.1:5173` antwortet.
2. **Prüfen** (aus dem Ordner `scripts/`):
   - Screenshot: `node shot.mjs /sport/auswertung out.png dark view`
     - Argumente: Route, Ausgabedatei, `light` oder `dark`, `view` (nur sichtbarer Bereich) oder `full` (ganze Seite).
     - `H=844` für Handyhöhe, `W=320` für schmale Geräte (Standard 390 × 1900).
     - Die Ausgabe nennt Konsolenfehler (`FEHLER`) und Tabellen, die der Mock nicht kennt (`UNBEKANNT`).
   - Text über mehrere Seiten: `node texts.mjs "\d+ Min" / /sport /sport/kalender`
   - Farb-Tokens (für Mockups): `node tokens.mjs`
   - Eigene Abläufe (Klicken, Warten, Element fotografieren): ein kurzes Skript nach dem Muster unten schreiben.
3. **Bild ansehen:** den Screenshot mit dem Read-Werkzeug öffnen. Bei langen Seiten mit Pillow zuschneiden oder Hell/Dunkel nebeneinanderlegen (`python3 -I`).
4. **Server stoppen und aufräumen:** `bash .claude/skills/nestua-visual-check/scripts/dev.sh stop`
   Das beendet den Server über die gemerkte Prozess-ID und löscht `.env.local`. Vor jedem Commit prüfen, dass `.env.local` nicht mehr da ist (steht auch in `.gitignore`).

## Muster für eigene Abläufe

```js
import { launch, BASE } from './lib.mjs';
import { newPage } from './mock.mjs';
const b = await launch();
const { page, errs } = await newPage(b, { dark: false, height: 1400 });
await page.goto(`${BASE}/#/finance/buchungen`);
await page.waitForSelector('.chip');           // auf ein echtes Element der Seite warten
await page.click('.chip');                          // klicken
await page.locator('.sa-card').first().screenshot({ path: 'karte.png' });   // ein Element fotografieren
console.log(errs.filter((e) => !/validateDOMNesting/.test(e)));
await b.close();
```

## Stolperfallen (alle schon passiert)

- **Nie `pkill -f vite …` oder `kill $(pgrep -f …)` im selben Befehl wie der Start.** Das Muster trifft die eigene Shell, der Befehl endet mit Exit 144 und nichts wird aufgeräumt. `dev.sh stop` benutzen.
- **`.env.local` nie committen.** Immer `dev.sh stop` vor `git add`.
- **Mock-Spaltennamen müssen echt sein.** Ein falscher Name (zum Beispiel `weight_kg` statt `weight`) ergibt im Ist-Stand "NaN kg". Spalten im Code nachlesen (`select(...)`), nicht raten.
- **Der Mock speichert nichts.** Schreibzugriffe werden nur quittiert, ein Neuladen zeigt wieder die Ausgangsdaten. Zum Prüfen von "abhaken und zurück" die Klicks in einem Lauf machen und im selben Lauf auslesen.
- **Neue Tabelle fehlt?** `UNBEKANNT` in der Ausgabe zeigt es. In `mock.mjs` unter `TABLES` ergänzen (Feldnamen aus dem Code).
- **Feste Uhr:** `page.clock.setFixedTime` ist gesetzt, der Hub zeigt also immer "Dienstag, 27. Oktober". Zeitabhängige Dinge (aktuelle Woche, Monatsüberblick) beziehen sich darauf.
- **Hell/Dunkel:** kommt aus `colorScheme` und `localStorage.mode`. Beides setzt `newPage({ dark })`.
- **Parallele Läufe** funktionieren (`&` und `wait`), jeder Lauf bekommt seinen eigenen Browser.
- **Die Schrift wird lokal geladen** (self-hosted), Screenshots zeigen also die echte Nunito.
- Bilder sind in 2-facher Pixeldichte (390 px Breite ergibt 780 px im Bild).

## Wann nicht

Für Fragen zur echten Datenbank oder zum echten Serverzustand ist das nichts. Dort gilt `CLAUDE.md` (Abschnitt "Kritische Fehlerquellen", Punkt 2).
