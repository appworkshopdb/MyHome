---
name: nestua-backlog
description: Nestua-Backlog in Linear (Team "Nestua", Kürzel NES) lesen und pflegen. IMMER nutzen, bevor an einem Feature, Bug, Design-Umbau oder einer Sicherheitsfrage gearbeitet wird, und wenn der Nutzer beiläufig eine Idee, einen Bug, eine Auffälligkeit, einen Änderungswunsch oder ein Ziel nennt ("mir ist aufgefallen", "wir sollten", "Idee:", "merk dir", "das ist kaputt"). Auch bei "was steht an", "was ist offen", "wie ist der Stand" und nach Abschluss einer Aufgabe, um das passende Issue zu aktualisieren.
---

# Nestua-Backlog (Linear)

Der Backlog liegt in Linear, Team **Nestua** (`NES`). Die frühere Tabelle "Entwicklung/Ideen" (Google Sheets) ist nur noch Archiv der erledigten Einträge. Werkzeuge: `mcp__Linear__list_issues`, `get_issue`, `save_issue`, `save_comment`, `list_issue_labels`. Ist der Linear-Konnektor nicht geladen oder liefert Fehler: kurz sagen und normal weiterarbeiten, nichts erfinden.

## Aufbau

- **Bereich** (Label-Gruppe, genau eines je Issue, wie im Sheet): Hub, Gewohnheiten, Finanzen, Sport, Ernährung, Einkauf, Generelles.
- **Kategorie** (nur bei Generelles): Neue Module, Features, Monetarisierung, Notifications, Aufbau, Rechtliches.
- **Art**: Bug, Feature, Improvement, Idee, dazu Sicherheit und Play Store als Zusatz.
- **Projekte = Ziele der Entwicklungsphase**: "Sicherheit", "Klarheit & Struktur", "Intuitives, einheitliches Design". "Play Store (später)" ist das oberste Ziel, aber NICHT die aktuelle Phase: nichts davon vorziehen.
- **Status**: Backlog = Idee/Prototyp, Todo = offen, In Progress = in Arbeit, In Review = prüfen, Done = erledigt.

## Vor der Arbeit

1. Aufgabe dem Bereich zuordnen und offene Issues suchen: `list_issues` mit `team: "Nestua"`, `label: "<Bereich>"` und `query: "<Stichwort>"`; erledigte und abgebrochene ausblenden. Bei Sicherheits- oder Struktur-/Design-Aufgaben zusätzlich nach `project` filtern.
2. Passt ein Issue, nenne es in EINER Zeile (`NES-12 Löschen laufender Posten erzeugt Dopplungen`) und arbeite danach. Nicht ausufern, nicht den ganzen Backlog aufzählen.
3. Widerspricht die Aufgabe einem offenen Issue oder dem Ziel der Phase (Sicherheit, Klarheit, Struktur, einheitliches Design), kurz darauf hinweisen.
4. Setze das Issue auf **In Progress**, sobald die Arbeit daran wirklich beginnt.

## Beiläufige Ideen und Bugs eintragen

Nennt der Nutzer etwas, das nicht Teil der aktuellen Aufgabe ist:

1. Erst `list_issues` mit `query` prüfen, ob es das schon gibt. Dann kommentieren (`save_comment`), nicht doppelt anlegen.
2. Sonst mit `save_issue` anlegen: `team: "Nestua"`, kurzer deutscher Titel, Beschreibung in kurzen Sätzen, Labels = ein Bereich + eine Art (bei Generelles zusätzlich eine Kategorie), Status **Backlog** für Ideen, **Todo** für Bugs und klare Aufgaben.
3. Einen Satz an den Nutzer: welches Issue angelegt wurde. Nicht danach fragen, außer der Bereich ist unklar.
4. Aufgabe des Nutzers nicht dafür unterbrechen.

## Nach der Arbeit

- Issue per `save_comment` mit Commit-Hash und Branch kommentieren (z. B. "auf staging gepusht, Build grün, nicht auf dem Gerät geprüft").
- Status: **In Review**, wenn der Nutzer noch testen muss; **Done** nur, wenn der Nutzer es bestätigt hat. Nie selbst auf Done setzen, weil der Build grün ist.
- Fand sich bei der Arbeit ein Folgeproblem, als neues Issue anlegen und im Kommentar verlinken.

## Regeln

- **Keine Geheimnisse, Schlüssel, Passwörter oder echten Nutzerdaten** in Issues oder Kommentare (siehe CLAUDE.md, Abschnitt "Geheimnisse").
- Beschreibungen für Menschen: kurze Sätze, immer derselbe Begriff für dieselbe Sache. Technische Details (Dateien, Abfragen, Logs) in einen eingeklappten Abschnitt am Ende:
  ```
  +++ Agent notes
  Details …
  +++
  ```
- Bestehende Labels, Projekte und Status nur verwenden, keine neuen anlegen, ohne den Nutzer zu fragen.
- Die Issues `NES-1` bis `NES-4` sind die Willkommens-Aufgaben von Linear und gehören nicht zum Backlog.
