---
name: nestua-mockup
description: Entwürfe für Nestua-Seiten als veröffentlichte Mockup-Seite bauen, mit Phone-Rahmen, Umschalter Neu/Jetzt und Hell/Dunkel, echten App-Farben und Ist-Stand-Bildschirmfotos. Nutzen, wenn der Nutzer "Mockup", "Entwurf", "zeig mir wie das aussehen könnte", "Varianten" oder "baue mir 2 Ansichten" sagt, bevor etwas in die App gebaut wird. Auch für den Vergleich zweier Varianten (A/B).
---

# Nestua-Mockups

Mockups sind HTML-Seiten, die als Artifact veröffentlicht werden. Der Nutzer schaut sie auf dem Handy an und entscheidet danach. **Erst entscheiden lassen, dann in die App bauen.** Nichts davon geht ins Repo.

## Ablauf

1. **Echten Inhalt lesen.** Texte, Zahlen, Reihenfolge und Funktionen der Seite aus dem Code nehmen (Komponente und `*.css`). Ein Entwurf darf Daten, Logik, Texte, Verlinkungen und Symbole nicht ändern. Neues ist nur Gestaltung (Gruppierung, abgeleitete Balken). Erfundene Beispieldaten klar als Beispiel kennzeichnen.
2. **Ist-Stand fotografieren** mit dem Skill `nestua-visual-check`: `node shot.mjs <route> out.png light view` und `dark view`, mit `H=844`. Bei langen Seiten `full`. Prüfe auf "NaN" oder leere Felder: das ist fast immer ein falscher Spaltenname im Mock, nicht die App.
3. **Entwurf als Phone-Inhalt schreiben** (HTML-Schnipsel für `.ph`), mit den Bausteinklassen aus `assets/mockup.css`: `.tb` Kopfleiste, `.hero` Fokuskarte, `.card2`, `.tile`, `.chips`, `.seg4`, `.dock` (untere Leiste mit `.fab` und `.nav`). Modulfarbe über `data-mod` am `.ph` (`fin`, `food`, `sport`, `hab`, `shop`). Vorlage für Symbole: `assets/mockup.css` und die Pfade aus `src/modules/sport/components/SportIcons.jsx` und `src/core/components/AreaIcons.jsx`.
4. **Seite bauen:**
   ```
   python3 -I .claude/skills/nestua-mockup/assets/build.py $SCRATCH/entwurf.html \
     --titel "…" --einleitung "…" --phone $SCRATCH/phone.html \
     --jetzt a-l=hell.png a-d=dunkel.png --abweichungen "…"
   ```
   Für mehrere Phones (Variante A und B) die Abschnitte in `assets/shell.html` kopieren: je Phone ein `<section class="col">`, eigene Ids (`n-a`, `n-b`, `j-a`, `j-b`) und die `KEYS` im Skript anpassen.
5. **Einmal ansehen** (Playwright, `file://`, Google-Fonts-Anfrage blockieren: `page.route('**/fonts.googleapis.com/**', r => r.abort())`), Hell und Dunkel, Phone-Bereich scrollen (`element.scrollTop = …`) und mit `Read` ansehen. Dann Texte und Überläufe korrigieren und veröffentlichen. Kein zweiter Prüflauf nötig.
6. **Veröffentlichen** mit dem Artifact-Werkzeug (Icon `phone`, ein Satz als Beschreibung), danach dem Nutzer den Link geben.

## Antwort an den Nutzer (Aufbau)

Kurz und auf Deutsch, in dieser Reihenfolge: Link, was gewählt wurde und warum, was neu ist (3 bis 4 Punkte), **was gleich bleibt**, Auffälligkeiten (zum Beispiel Fehler im Ist-Stand), dann **eine** Frage, welche Variante gebaut werden soll. Ausdrücklich sagen, dass `staging` unverändert ist.

## Regeln für Entwürfe

- **Ruhe statt Farbe.** Die Modulfarbe sparsam einsetzen (Aktionen, Symbole, Auswahl). Große Flächen in der Modulfarbe nur für eine Fokuskarte. Der Nutzer hat große rote Flächen schon einmal als "zu rot" zurückgewiesen.
- **Schmal denken:** 390 px Breite, und der Inhalt muss auch bei 320 px passen (kein Text, der mitten im Wort bricht).
- **Dunkelmodus gleich sorgfältig** wie Hell. Nur Tokens, keine festen Farben für Text.
- **Zahlen und Texte der echten Seite verwenden**, Beispiele nur wo die Testdaten leer sind.
- **Varianten wirklich verschieden machen** (andere Struktur, nicht nur andere Farbe), meist zwei.
- **Eine Seite = ein Mockup**; pro Mockup-Seite zwei bis drei Phones, damit die Seite schnell lädt und sich gut vergleichen lässt.

## Stolperfallen

- **Nicht `str.replace('{{','{')` auf dem ganzen HTML.** Das zerstört `}}` in CSS-Blöcken (Media-Queries). `build.py` ersetzt nur Platzhalter. Beim eigenen Bauen den Style-Block zuletzt einsetzen.
- **`:where(.ph) button`** statt `.ph button` für Grundwerte, sonst übertrumpft die Spezifität die eigenen Knopfklassen und Text wird unsichtbar (weiße Schrift auf weißer Pille).
- **Lange Ist-Stand-Bilder** in `.jsc` legen (scrollbar), nicht als `object-fit: cover`.
- **Seite hat Theme-Tokens für die Seite selbst**, der Phone-Rahmen hat eigene (`.ph[data-th]`). Der Hell/Dunkel-Schalter der Seite betrifft nur die Phones.
- **Webhook-Limit:** nach dem Veröffentlichen kommt oft "wake subscription not registered (trigger_limit)". Das ist harmlos, der Link funktioniert.
- **Seitengröße:** Bilder mit `build.py` einbetten (WebP, 520 px), nicht als PNG.
