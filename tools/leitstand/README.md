# Leitstand

Nur lesende Oberfläche für die Agenten, ihre Abhängigkeiten und offene Aufgaben (Konzept: Abschnitt 4a).

- `registry.json`: Knoten, Verbindungen und Prüfungen. Neue Agenten, Ressourcen oder Prüfungen hier eintragen.
- `scan.mjs`: führt die Prüfungen aus (Docker, Datenbank, Backup-Log, HTTP, Zertifikate, Dateien, crontab) und schreibt `www/data/leitstand.json`. Nur lesend, keine Abhängigkeiten (Node 22). Geheimnisse nur als „gesetzt/leer“.
- `www/`: statische Oberfläche "Brücke", lädt alle 15 Sekunden neu. Startseite = Agenten-Kern mit einer Karte je Agent (Status, letzter und nächster Lauf, Befunde, Aufbau), darunter Aufgaben und Systemprüfungen. Eine Karte klappt zur Agenten-Seite `#<kennung>` auf: Verknüpfungen als Fluss Auslöser → Agent → prüft/liest → schreibt/meldet, dazu letzter Lauf mit KI-Einschätzung, Steckbrief, Aufbau, Aufgaben.
- Agenten in `registry.json`: `flow` (Einträge mit `g` = in, prüft, liest, out und `node`, `check` oder `plan: true`), `channel` (Discord-Kanal), `runAt` (täglich, Berlin-Zeit), `report` (Präfix der Berichte in `/opt/nestua/ops/reports/`), `guard` (Knoten der Leitplanken). Der Scan hängt daraus `run` an (letzter Bericht, nächster Lauf, `overdue`, wenn ein geplanter Lauf ausblieb).
- `aufgaben.json`: optionales Feld `agent` ordnet einen Eintrag einer Agenten-Seite zu.
- Änderungen an `www/leitstand.js` oder `.css`: in `index.html` die Version (`?v=`) hochzählen, sonst zeigt der Browser die alte Datei.
- `deploy.sh`: kopiert alles nach `/opt/nestua/ops/leitstand/` und scannt einmal. `aufgaben.json` und `www/data/` dort bleiben erhalten.

Laufzeit auf dem Server: `/opt/nestua/ops/leitstand/` (Scan per Cron alle 5 Minuten als `nestua`), ausgeliefert von Caddy unter `leitstand.nestua.de` mit Basic Auth.
Aufgabenliste: `/opt/nestua/ops/leitstand/aufgaben.json` (pflegen die Sitzungen von Hand).

## Verbrauch pro Agent

`usage.mjs` (vom Scan aufgerufen) liest die Sitzungs-Transkripte von Claude Code (`~/.claude/projects/*/*.jsonl`) und sammelt je Sitzung
Kosten (`totalCostUSD`, Schätzung zu API-Listenpreisen), Tokens und Modell in `/opt/nestua/ops/leitstand/usage.json`. Die Datei bleibt erhalten,
auch wenn Claude Code Transkripte nach 30 Tagen löscht. Zuordnung über den Anfang des ersten Prompts (`Du bist der Agent "<Name>"`, bzw. `Unbeaufsichtigter Server-Check`);
alles andere zählt als „Du (interaktiv)“ oder „Sonstige Hilfsläufe“. Es wird kein Inhalt gespeichert. Neuer Agent: Name in `AGENTS` (usage.mjs) ergänzen.
Das Abo-Kontingent (5-Stunden-/Wochenlimit) ist von hier nicht lesbar, es steht unter claude.ai → Einstellungen → Nutzung.
`node tools/leitstand/usage.mjs` gibt eine Übersicht im Terminal aus.

### Kontingent-Balken und Verlaufsdiagramm

- **Bezugswert:** `/opt/nestua/ops/leitstand/budget.json` (je Zeitraum `heute`, `t7`, `t30`, in Dollar-Schätzung; `null` = nicht festgelegt, dann bleiben die Balken leer).
  Setzen: `node usage.mjs --referenz t7 <dollar>` oder kalibrieren: auf claude.ai → Einstellungen → Nutzung den Prozentwert ablesen und `node usage.mjs --kalibrieren t7 <prozent>`
  (Bezugswert = gemessene Kosten / Prozent). Anthropic veröffentlicht die Limits des Pro-Plans nicht in Dollar, deshalb ist der Wert immer eine eigene Schätzung.
  Genau genug nur, wenn im Zeitraum fast nur auf diesem Server gearbeitet wurde: Nutzung an anderen Geräten und in claude.ai zählt beim echten Kontingent mit, ist hier nicht sichtbar.
- **Balken:** Heute, 7 Tage, 30 Tage; Startseite gestapelt nach Agent (plus Du und Sonstige), Agenten-Seite nur der Anteil dieses Agenten. Über 100 % wird rot.
- **Diagramm:** Kosten je Tag, Startseite eine Linie je Agent, Agenten-Seite eine Linie. Umschalter Pro Tag / Summiert. Die Kosten einer Sitzung werden nach Token-Gewicht auf ihre Tage verteilt.
