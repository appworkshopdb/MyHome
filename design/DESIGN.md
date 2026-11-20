# Nestua Design-Regeln

Eine Stelle für alle Gestaltungsregeln der App. Gilt für Menschen, für Claude-Sitzungen und für den Prüfer (Regel-Check und Design-Review vor dem Merge).
Zusammengeführt am 20.11.2026 aus `design/UMBAUPLAN.md`, `design/tokens.json`, `docs/module/design-hub.md`, dem Skill `nestua-design-umbau` und `CLAUDE.md`.
Bei Widersprüchen gilt diese Datei; die Quellen verweisen hierher.

## Status

| Teil | Status |
|---|---|
| Leitlinien, Designrichtung, harte Regeln (Abschnitte 2, 3, 6) | gelebt und in vielen Seiten umgesetzt |
| Token-Skalen (Abschnitt 4) | **Vorschlag** (`tokens.json`: "status": "Vorschlag"), eingebunden über `design/tokens.css`, in der App bisher kaum genutzt |
| Beschluss des Umbauplans durch den Nutzer | **offen** |
| Design-Ratsche im Regel-Check (Abschnitt 7) | aktiv seit 20.11.2026 |

## 1. Ablauf

Ist-Stand ansehen → Mockup (Skill `nestua-mockup`, Hell und Dunkel) → **Nutzer bestätigt** → Bau auf `staging` → Prüfung (Hell, Dunkel, 320 px, Skill `nestua-visual-check`) → Stand im Skill `nestua-design-umbau` nachziehen.
Nichts wird ohne bestätigtes Mockup gebaut. Nur Gestaltung ändern: Daten, Logik, Texte, Verlinkungen, Bilder und Symbole bleiben, außer der Nutzer wünscht es ausdrücklich.

## 2. Leitlinien (jede Seite)

1. **Eine Hauptaktion je Seite**, klar die stärkste (gefüllter Knopf in Modulfarbe); alles andere sekundär.
2. **Lesereihenfolge = Wichtigkeit:** Status oder Zahl oben, Liste darunter, Verwaltung zuletzt.
3. **Tippflächen mindestens 48 px**, Abstände aus der Skala, Aktionen in der Daumenzone unten.
4. **Gleiche Dinge, gleicher Baustein:** ein Button-Satz, ein Chip, eine Karte, eine Listenzeile, ein Sheet, ein Leerzustand.
5. **Farbe trägt nie allein Bedeutung** (Symbol und Name bleiben), Textkontrast mindestens 4,5:1.
6. **Rückmeldung bei jeder Aktion** (Toast mit "Rückgängig" statt Rückfrage, wo Löschen umkehrbar ist).
7. **Leer, Laden, Fehler** sind eigene Zustände und werden mit entworfen.
8. **Einheitliche Wörter:** gleiche Aktion heißt überall gleich (Speichern, Abbrechen, Löschen, Hinzufügen).
9. **Keine neuen Pixelwerte oder Hex-Farben**, nur Tokens (Abschnitt 4).
10. **Weniger Text, schärfere Formen, dünnere Linien** (Abschnitt 3).

## 3. Designrichtung

- **Schärfer:** kleinere Eckenradien, klare Kanten statt weicher Blasen. Pillen nur für Chips, Status und Werte.
- **Dünner:** Haarlinien (1 px, ruhiger Ton) statt dicker Rahmen; Flächen eher durch Tönung trennen. **Karte = Tönung oder Haarlinie, nie beides.** Schatten sparsam (`--sh-sm`).
- **Weniger Text:** Titel 1 bis 2 Wörter, keine erklärenden Sätze unter Überschriften; Nebentext nur mit Informationswert (Datum, Anzahl, Ort); Knöpfe ein Verb oder Verb + Objekt; Leerzustand eine Zeile + eine Aktion; Hilfetexte nur bei Fehlern oder wirklich unklaren Eingaben.
- **Zahl zuerst:** Kennzahlen groß und fett (`number`/`display`), Beschriftung klein darunter.
- **Seitentypen:** Modul-Startseite = Kopfkarte mit einer Hauptzahl in Modulfarbe, darunter Kacheln (Symbol + ein Wort), darunter Liste. Liste = Symbol links, Titel + Nebentext, Wert rechts als Pille, oben Filter-Chips mit dünnem Rand. Auswertung = Karte je Aussage, dünne Kurven, schlanke Balken, knappe Legende. Formular/Sheet = ein Gedanke pro Schritt, Hauptknopf unten fest. Seitenkopf = Zurück/Profil links, Titel mittig, Suche oder Aktion rechts. Navigation unten = Symbole mit sehr kurzem Label, aktive Seite in Modulfarbe.
- **Warme Basis** plus **eine Farbfamilie je Modul**: Finanzen Blau, Ernährung Grün, Sport Koralle, Gewohnheiten Gold, Einkauf Violett; Hub-Funktionen neutral. Modulfarbe sparsam (Aktionen, Symbole, Auswahl), große Flächen nur für eine Fokuskarte.

## 4. Tokens (Vorschlag, `design/tokens.json` → `design/tokens.css`)

| Gruppe | Variablen | Werte |
|---|---|---|
| Schrift | `--fs-caption`, `--fs-meta`, `--fs-small`, `--fs-body`, `--fs-title`, `--fs-number`, `--fs-display` (je mit `--fw-*`, `--lh-*`) | 11 / 12 / 14 / 16 / 20 / 24 / 32 px |
| Abstand | `--sp-1` … `--sp-7` | 4 / 8 / 12 / 16 / 24 / 32 / 48 px |
| Radius | `--rad-sm`, `--rad-md`, `--rad-lg`, `--rad-xl`, `--rad-hero` | 6 / 8 / 12 / 16 / 20 px; Pillen 999px |
| Größen | `--hit-min`, `--ctl-h`, `--ctl-h-sm`, `--bd-hair` | 48 / 48 / 36 / 1 px |
| Schatten | `--sh-sm`, `--sh-md`, `--sh-lg` | Hell und Dunkel getrennt |

**Farben** kommen nur aus Variablen: im Modul `var(--m-ac|tint|ink|deep|on|hero|pill)` (die App setzt `data-module` auf `<html>`), im Hub die Klasse `.tone-<fin|food|sport|hab|shop|n>` mit `--t-*`, sonst die Familien `--mod-<familie>-*` und die Rollen aus `themes.css`. Feste Farbwerte stehen nur in `src/styles/base.css` und `src/styles/themes.css`. Neue Farbe = neues Token dort, nie Hex in Komponenten. `deep` = Text auf hellem Grund (AA), `ac`/`on` = Füllung und Schrift darauf.
Ältere Variablen (`--space-*`, `--r-*`, `.t-*`) bleiben bis zur Umstellung gültig; für **neuen** Code die Variablen oben nehmen.

## 5. Bausteine und Ort des CSS

- Vorhanden: `FocusCard`, `AreaList`/`AreaRow` (Kacheln), `Ring`, `Money` (Beträge ausblendbar), `EyeToggle`, `SportIcons`, `AreaIcons`, `HubTiles`, `.sa-card`/`.sa-tile`/`.sa-medal`, `.lex-*`. Erst prüfen, ob es den Baustein gibt, dann neu bauen.
- Neues und Gemeinsames nach `src/styles/design-v2.css` (zuletzt geladen), Klassen mit Bereichspräfix (`.sd-`, `.sa-`, `.dayplan-`, `.hubt-`). In lazy geladenen Modul-CSS-Dateien neue Regeln ans Ende, mit Wrapper-Klasse davor. Keine globalen Klassen wie `.chip`/`.card` umbauen, sonst ändern sich andere Seiten mit.
- Symbole als kleine React-Komponente mit Inline-SVG; Größe im CSS setzen.

## 6. Harte Regeln (Fehler, wenn verletzt)

- **Fixed-Nav:** kein `transform`, `filter`, `perspective`, `will-change`, `backdrop-filter` auf Vorfahren von `.chrome-top` und `.bottom-nav` (bricht `position: fixed`). Weichzeichnen nur auf kleinen Blättern.
- **`core/` importiert nicht aus `modules/`.**
- **Schriften self-hosted**, keine Google Fonts.
- **Einstellungen gehören dem Nutzer:** Spalte in `body_profile`, kein reines `localStorage`.
- **Schlüssel nie umbenennen** (Katalog-`seed_id`, Cover-Motive, Badge-Keys).
- **Dunkelmodus und 320 px** werden bei jeder Seite mitgeprüft.

## 7. Prüfung vor dem Merge

**Regel-Check (ohne KI, GitHub-Workflow "Prüfer", Pflicht-Check):** `tools/pruefer/regeln.mjs` prüft neben der Fehlerliste aus `CLAUDE.md` die **Design-Ratsche**: Neue Hex-Farben (außerhalb `base.css`/`themes.css`), feste Schriftgrößen in px, feste Eckenradien in px und neue Inline-Styles werden gegen entfernte gezählt. **Unterm Strich mehr = Fehler** (blockiert den Merge), weniger = gut. Verschobener Code hebt sich auf.
Ausnahmen: Kommentar `pruefer:ok <Grund>` am Zeilenende (z. B. berechnete Breite in %) oder `tools/pruefer/ausnahmen.txt`. Lokal: `npm run pruefer`.

**Design-Review (KI, Prüfer-Agent auf dem Server, nur Empfehlung):** läuft bei PRs, die UI-Dateien ändern, und prüft anhand dieser Datei, was ein Skript nicht sieht:
- eine Hauptaktion, Lesereihenfolge, Seitentyp passend (Abschnitte 2 und 3)
- Text: kürzer möglich? Knopf = Verb? gleiche Wörter wie sonst?
- vorhandener Baustein statt Neubau, CSS am richtigen Ort, Wrapper statt globaler Klasse (Abschnitt 5)
- Tokens statt fester Werte auch dort, wo die Ratsche nichts zählt (Abstände, Schatten, Gewichte)
- Leer-, Lade- und Fehlerzustand vorhanden; 48-px-Tippflächen; Farbe nicht allein; Dunkelmodus-Variablen benutzt
- Bezug zu einem bestätigten Mockup (`design/mockup-*.html` oder Hinweis im Commit)

Das Review sieht nur Code und Diff, keine Bildschirmfotos. Optische Prüfung bleibt beim Skill `nestua-visual-check`.

## 8. Offen

- Umbauplan und Token-Werte vom Nutzer beschließen lassen (danach Status in Abschnitt 4 ändern).
- Ratsche in Phase 4 auf Zielwerte schärfen (Hex 0, Inline-Styles unter einer Grenze, höchstens 7 Schriftgrößen).
- Optional: Bildschirmfotos im GitHub-Lauf, damit das Design-Review auch sieht.
