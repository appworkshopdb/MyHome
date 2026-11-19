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
