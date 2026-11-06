---
name: nestua-design-umbau
description: Eine bestehende Nestua-Seite oder einen Bereich ins neue Design (warme Basis, Modulfarbfamilien, design-v2) umbauen, mit Checkliste, Seitenmustern, Konventionen und dem aktuellen Stand, welche Seiten schon umgebaut sind. Nutzen bei "baue das ein", "zieh das neue Design nach", "mach die Unterseite X im neuen Design", "weiter mit den nächsten Seiten", und wenn unklar ist, was schon umgebaut ist.
---

# Nestua-Seite ins neue Design umbauen

**Reihenfolge:** Mockup (Skill `nestua-mockup`) → Nutzer bestätigt → hier umbauen → prüfen (Skill `nestua-visual-check`) → committen und auf `staging` pushen. Nie ohne Bestätigung umbauen, nie einen Pull Request ohne Aufforderung.

## Design-Werkstatt und Tokens

Das Design wird gerade vereinheitlicht: erst Interface Inventory (`npm run werkstatt`, Zahlen zu Schrift, Abstand, Ecken, Farben, Buttons), dann Skalen als Tokens, dann gemeinsame Bausteine, dann Seite für Seite umstellen. Neue Seiten nicht mit eigenen Pixelwerten bauen, sondern an die Skalen halten, sobald sie festgelegt sind (`CLAUDE.md`, Abschnitt Design-Werkstatt).

## Grundregeln

- **Nur Gestaltung ändern.** Daten, Logik, Texte, Verlinkungen, Bilder und Symbole bleiben. Ausnahme sind ausdrückliche Wünsche des Nutzers (zum Beispiel "Dauer entfernen").
- **Tokens statt Farben:** `var(--m-ac|tint|ink|deep|on|hero)` im Modul (App setzt `data-module` auf `<html>`), im Hub `.tone-<fin|food|sport|hab|shop|n>` (`--t-*`). Nie Hex in Komponenten. Kontraste prüfen (Text ≥ 4,5:1).
- **Farbe ist nie das einzige Zeichen**, Symbol und Name bleiben.
- **Fixed-Nav-Regel:** kein `transform`, `filter`, `perspective`, `will-change` auf Vorfahren von `.chrome-top` und `.bottom-nav`. Weichzeichnen (`filter`) nur auf kleinen Blättern (zum Beispiel Beträge), nie an Containern der Seite.
- **`core/` importiert nicht aus `modules/`.** Gemeinsames nach `core/lib/` oder `core/components/`; Regeln, die aus Modulen gebraucht werden, im Core duplizieren und kommentieren.
- **Einstellungen gehören dem Nutzer, nicht dem Gerät:** Spalte in `body_profile`, kein reines `localStorage` (siehe `CLAUDE.md`). Migrationen nur additiv.
- **Schlüssel nie umbenennen** (Katalog-`seed_id`, Cover-Motive, Badge-Keys).

## Wo das CSS hin muss

- Gemeinsames und Neues: `src/styles/design-v2.css` (wird zuletzt geladen und übersteuert `app-extra.css`). Klassen mit Präfix je Bereich (`.sd-` Sport-Tageskarte, `.sa-` Sport-Auswertung, `.dayplan-`, `.hubt-`).
- **Lazy geladene Modul-CSS** (`habits.css`, `nutrition.css`, …) wird später geladen und gewinnt bei gleicher Spezifität. Dort neue Regeln ans Ende, mit Wrapper-Klasse davor (`.hab-habits-view …`, `.lex-view …`).
- Auf Teile ohne eigene Klasse einen Wrapper setzen statt globale Klassen wie `.chip` oder `.card` zu ändern, sonst verändern sich andere Seiten mit.
- Neue Symbole als kleine React-Komponente mit Inline-SVG (`SportIcons.jsx`, `AreaIcons.jsx`). Bestehende `Icons.jsx`-Symbole haben teils **keine Größe**; im CSS die Größe setzen (`.klasse svg { width: 18px; height: 18px }`), sonst schrumpft das Symbol und der Knopf wirkt leer.

## Seitenmuster

1. **Listen mit Karten:** Alle Listen, Rezepte, Ampel, Einheiten, Pläne, Verträge, Meine Gewohnheiten, Häufig.
2. **Tag/Monat blättern:** Buchungen, Offene Posten, Mahlzeiten, Kalender (Hub und Sport), Aufgaben.
3. **Auswertung:** Finanzen, Sport, Gewohnheiten-Statistik, Wochen- und Monatsüberblick, Gewicht.
4. **Lesen und Nachschlagen:** Lexikon, Tipps.
5. **Einstellungen und Formulare:** Finanz-Einstellungen, Profil, Einstellungen-Menü, Anlege-Dialoge.
6. **Detailseite mit Artikeln:** Einkaufsliste (Artikel), Hub-Aufgaben.

Gemeinsame Bausteine, die schon da sind: `FocusCard` (Fokuskarte), `AreaList`/`AreaRow` (Kacheln), `Ring`, `Money` (Beträge ausblendbar), `EyeToggle`, `SportIcons`, `.sa-card`/`.sa-tile`/`.sa-medal` (Karten, Zahlenkacheln, Medaillen), `.lex-*` (Suche, Chips, Karten).

## Stand (zuletzt gepflegt: November 2026, bei Änderungen hier nachziehen)

Die Liste wird von Hand gepflegt und kann hinter dem Code zurückliegen (andere Sitzungen bauen parallel). **Vor Arbeitsbeginn `git log --oneline -30` lesen** und die betroffene Seite einmal im Testlauf ansehen. Die Zeilen mit "laut Commit" sind aus Commit-Titeln übernommen und nicht von mir geprüft.

**Hauptseiten**
- Fertig: Hub, Finanzen-, Ernährung-, Sport-, Gewohnheiten-, Einkauf-Startseite.
- Offen: Profil (`#/profile`), Einstellungen-Menü (Zahnrad).

**Unterseiten fertig**
- Sport · Kalender: nur die Tageskarte (der Monatskalender bleibt bewusst wie er ist).
- Sport · Auswertung und Gewicht (Kacheln, Medaillen, Gewichtsverlauf mit Farbe nach Ziel, Aktivität mit Monatsspalten).
- Gewohnheiten · Meine Gewohnheiten.
- Ernährung · Lexikon (inklusive behobenem Kategorie-Schlüssel).
- Gewohnheiten · Anlegen/Bearbeiten-Formular (laut Commit: Karten Grundlagen, Rhythmus, Ziel, Kategorien).
- Sport · Pläne mit Plan-Editor, Plan-Wizard (drei Stufen), Plan-Auswahl und aktivem Dauerplan; Einheiten-Galerie und erweiterter Katalog (laut Commits).
- Einkauf · Abschluss einer Liste (Zahlungsschritt mit Beleg-Scan, "Als Vorlage speichern") in neuer Optik (laut Commits).

**Entwurf vorhanden, vom Nutzer noch nicht bestätigt** (Mockup neu zeigen oder nachfragen):
- Finanzen · Buchungen (und Offene Posten): blaue Saldo-Karte, Kategorien als Kacheln mit Anteilsbalken.
- Einkauf · Alle Listen: aktive Liste als violette Karte, weitere Listen als Karten, "Aus Vorlage"-Kachel.
- Ernährung · Mahlzeiten: grüne Tageskarte, Einträge nach Mahlzeit gruppiert.

**Noch ohne Entwurf**
- Finanzen: Verträge, Auswertung, Einstellungen, Sparschwein-Sheet, Posten-Detail.
- Ernährung: Rezepte, Ampel, Tipps, Rezept-Dialog, Mahlzeit-Scan.
- Sport: Monats- und Wochenkalender (Einheiten-Galerie siehe oben, Zustand prüfen).
- Gewohnheiten: Statistik.
- Einkauf: Artikelliste einer Liste, Häufig.
- Hub-Unterseiten: Aufgaben, Kalender, Gewohnheiten heute, Statistiken (Woche und Monat).
- Alle Anlege-Dialoge, Profil, Menü.

Beträge ausblenden (`Money.jsx`) ist bisher nur im Hub eingebaut. Beim Umbau von Finanzen-Seiten dort mit anwenden.

## Checkliste vor dem Push

- [ ] Texte, Daten, Reihenfolge, Verlinkungen unverändert (außer Wünschen).
- [ ] Hell **und** Dunkel angesehen, auch bei 320 px (Skill `nestua-visual-check`, `W=320`).
- [ ] Keine Konsolenfehler; Klick-Wege (abhaken, öffnen, löschen) einmal im Testlauf durchgespielt.
- [ ] Keine festen Hex-Farben, kein `filter`/`transform` an Vorfahren der festen Leisten.
- [ ] `npx vite build` läuft durch.
- [ ] In `CLAUDE.md` nur ergänzen, was künftige Sitzungen wissen müssen (kurz). Stand oben in diesem Skill nachziehen.
- [ ] `dev.sh stop` ausgeführt, `.env.local` weg, `git status` sauber bis auf die gewollten Dateien.
- [ ] Commit-Nachricht mit den vorgeschriebenen Schlusszeilen, Push auf `staging`.

## Bekannte Fallen im Code

- Daten und Filter müssen dieselben Schlüssel benutzen (Lexikon hatte `vitamin` in den Daten und `vitamine` im Filter).
- Standardauswahl in Zeiträumen: immer die **aktuelle** Woche vorwählen, nicht die letzte des Jahres.
- Datum nie mit `toISOString().split('T')[0]` bauen (siehe `CLAUDE.md`).
- Kompakte Zeilen: Text, der ein Knopf-Symbol braucht, bekommt Platz über `min-width: 0` und `flex: 1`, sonst bricht er mitten im Wort.
