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
