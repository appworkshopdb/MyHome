---
name: nestua-backlog
description: Nestua-Backlog im Obsidian-Vault (privates Repo appworkshopdb/nestua-notes, lokal Ordner Nestua/) lesen und pflegen. IMMER nutzen, bevor an einem Feature, Bug, Design-Umbau, einer Struktur-/Klarheits-Frage (Aufbau, Zahlen, Abläufe) oder einer Sicherheitsfrage (RLS, Rechte, Secrets, Datenschutz) gearbeitet wird, bei Fragen zu den Zielen der Entwicklungsphase, und wenn der Nutzer beiläufig eine Idee, einen Bug, eine Auffälligkeit, einen Änderungswunsch oder ein Ziel nennt ("mir ist aufgefallen", "wir sollten", "Idee:", "merk dir", "das ist kaputt"). Auch bei "was steht an", "was ist offen", "wie ist der Stand" und nach Abschluss einer Aufgabe, um die passende Notiz zu aktualisieren.
---

# Nestua-Backlog (Obsidian-Vault)

Der Backlog liegt als Notizen im Ordner `Backlog/` des Vaults, einem privaten Git-Repo (`appworkshopdb/nestua-notes`, Branch `main`). Linear wird nicht mehr genutzt; die frühere Nummer steht in der Eigenschaft `linear` (z. B. `NES-12`). Die Google-Tabelle "Entwicklung/Ideen" ist nur noch Archiv.

## Zugriff (in dieser Reihenfolge)

Im Folgenden steht `VAULT` für den Vault-Pfad.

1. **Lokal:** Gibt es im Arbeitsverzeichnis (Repo-Ordner MyHome) den Ordner `Nestua/`, ist `VAULT` = `Nestua/`. Vor dem Lesen `git -C Nestua pull --rebase`, damit der Stand aktuell ist.
2. **Cloud (kein Ordner `Nestua/`):** Repo `appworkshopdb/nestua-notes` mit dem Tool `add_repo` einbinden (`access: push`) und einmal nach `/home/user/nestua-notes` klonen. `VAULT` = `/home/user/nestua-notes`. Ist es schon geklont, nur `git -C /home/user/nestua-notes pull --rebase`.
3. **Nicht erreichbar** (kein Ordner, Einbinden abgelehnt oder Fehler): in einem Satz sagen, dass der Backlog gerade nicht erreichbar ist, und normal weiterarbeiten. Nichts erfinden, keine Einträge aus dem Gedächtnis nennen.

Alle Pfade unten sind relativ zu `VAULT`. Git-Befehle immer mit `git -C <VAULT>`; der Vault ist ein eigenes Repo, nicht das App-Repo.

## Nach jeder Änderung im Vault

Jede Änderung (neue Notiz, Status, Verlauf, Index) sofort sichern, auch wenn Laptop, PC und Cloud-Sessions gleichzeitig arbeiten:

1. `git -C <VAULT> add -A`
2. `git -C <VAULT> commit -m "Backlog: <Kurzbeschreibung>"` (kurz, deutsch, z. B. "Backlog: Idee Urlaubsplaner angelegt")
3. `git -C <VAULT> pull --rebase`
4. `git -C <VAULT> push origin main`

Wird der Push abgelehnt, einmal `pull --rebase` und `push` wiederholen. Bei einem Rebase-Konflikt nichts überschreiben und nichts erzwingen (kein `--force`): `git rebase --abort`, dem Nutzer den Konflikt in einem Satz nennen.

## Aufbau der Notizen

Eine Notiz je Eintrag in `Backlog/<Titel>.md`. Kopfbereich (frontmatter):

```
---
bereich: Finanzen
art: Bug
status: todo
projekt: Klarheit & Struktur
---
```

- **bereich** (genau einer): Hub, Gewohnheiten, Finanzen, Sport, Ernährung, Einkauf, Generelles.
- **art**: Bug, Feature, Improvement, Idee.
- **status**: backlog = Idee/Prototyp, todo = offen, in-progress = in Arbeit, in-review = prüfen, done = erledigt.
- **projekt** (optional) = Ziele der Entwicklungsphase: `Sicherheit`, `Klarheit & Struktur`, `Intuitives einheitliches Design`. `Play Store später` ist das oberste Ziel, aber NICHT die aktuelle Phase: nichts davon vorziehen.
- Optional: `kategorie` (nur bei Generelles: Neue Module, Features, Monetarisierung, Notifications, Aufbau, Rechtliches), `prio`, `tags` (z. B. `sicherheit`, `play-store`), `linear` (frühere Nummer).

Danach `# Titel`, dann die Beschreibung in kurzen Sätzen, am Ende optional `## Agent notes` (technische Details: Dateien, Abfragen, Logs) und `## Verlauf` (ein Eintrag je Arbeitsschritt).

`Backlog/Index.md` ist die Übersicht (Tabellen nach Status, dazu Liste nach Projekt). Wird eine Notiz angelegt oder ändert sich ihr Status oder Projekt, den Eintrag dort nachpflegen (richtiger Statusabschnitt, Zählung in der Überschrift). Erledigte Einträge in einen Abschnitt "Erledigt" am Ende verschieben.

## Vor der Arbeit

1. Aufgabe dem Bereich zuordnen und offene Notizen suchen, erledigte ausblenden:
   - Nach Bereich: `grep -l "^bereich: Finanzen" Backlog/*.md`
   - Nach Stichwort: `grep -ril "Stichwort" Backlog/`
   - Nach Status oder Projekt: `grep -l "^status: todo" Backlog/*.md`, `grep -l "^projekt: Sicherheit" Backlog/*.md`
   - Nach alter Nummer: `grep -l "^linear: NES-12" Backlog/*.md`
   - Passende Notizen lesen (`Backlog/Index.md` ist nie ein Treffer).
2. Passt eine Notiz, nenne sie in EINER Zeile (`Löschen laufender Posten erzeugt Dopplungen`) und arbeite danach. Nicht ausufern, nicht den ganzen Backlog aufzählen.
3. Widerspricht die Aufgabe einer offenen Notiz oder dem Ziel der Phase (Sicherheit, Klarheit, Struktur, einheitliches Design), kurz darauf hinweisen.
4. Setze `status: in-progress`, sobald die Arbeit daran wirklich beginnt.

## Beiläufige Ideen und Bugs eintragen

Nennt der Nutzer etwas, das nicht Teil der aktuellen Aufgabe ist:

1. Erst per `grep -ril` prüfen, ob es das schon gibt. Dann den Verlauf der vorhandenen Notiz ergänzen, nicht doppelt anlegen.
2. Sonst `Backlog/<Titel>.md` anlegen: kurzer deutscher Titel (ohne `: " ? / \ * < > |`), Kopfbereich wie oben, `status: backlog` für Ideen und Prototypen, `status: todo` für Bugs und klare Aufgaben. Dann `Backlog/Index.md` nachpflegen.
3. Vault sichern (siehe oben).
4. Einen Satz an den Nutzer: welche Notiz angelegt wurde. Nicht danach fragen, außer der Bereich ist unklar.
5. Aufgabe des Nutzers nicht dafür unterbrechen.

## Nach der Arbeit

- Im `## Verlauf` der Notiz einen Eintrag mit Datum, Commit-Hash und Branch ergänzen (z. B. "2026-11-06: auf staging gepusht (abc1234), Build grün, nicht auf dem Gerät geprüft").
- Status: `in-review`, wenn der Nutzer noch testen muss; `done` nur, wenn der Nutzer es bestätigt hat. Nie selbst auf `done` setzen, weil der Build grün ist.
- Fand sich bei der Arbeit ein Folgeproblem, als neue Notiz anlegen und im Verlauf mit `[[Titel]]` verlinken.
- Vault sichern (siehe oben).

## Regeln

- **Keine Geheimnisse, Schlüssel, Passwörter oder echten Nutzerdaten** in Notizen (siehe CLAUDE.md, Abschnitt "Geheimnisse"). Der Vault ist privat, aber nicht der Ort dafür.
- Beschreibungen für Menschen: kurze Sätze, immer derselbe Begriff für dieselbe Sache.
- Bestehende Werte für `bereich`, `art`, `status` und `projekt` nur verwenden, keine neuen erfinden, ohne den Nutzer zu fragen.
- Nur im Vault schreiben, nie im App-Repo mischen: Der Ordner `Nestua/` steht in `.gitignore` und wird nie mit der App committet.
