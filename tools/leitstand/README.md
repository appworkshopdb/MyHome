# Leitstand

Nur lesende Oberfläche für die Agenten, ihre Abhängigkeiten und offene Aufgaben (Konzept: Abschnitt 4a).

- `registry.json`: Knoten, Verbindungen und Prüfungen. Neue Agenten, Ressourcen oder Prüfungen hier eintragen.
- `scan.mjs`: führt die Prüfungen aus (Docker, Datenbank, Backup-Log, HTTP, Zertifikate, Dateien, crontab) und schreibt `www/data/leitstand.json`. Nur lesend, keine Abhängigkeiten (Node 22). Geheimnisse nur als „gesetzt/leer“.
- `www/`: statische Oberfläche (Fläche mit Kern, Orbits, Glas-Panels), lädt alle 15 Sekunden neu.
- `deploy.sh`: kopiert alles nach `/opt/nestua/ops/leitstand/` und scannt einmal. `aufgaben.json` und `www/data/` dort bleiben erhalten.

Laufzeit auf dem Server: `/opt/nestua/ops/leitstand/` (Scan per Cron alle 5 Minuten als `nestua`), ausgeliefert von Caddy unter `leitstand.nestua.de` mit Basic Auth.
Aufgabenliste: `/opt/nestua/ops/leitstand/aufgaben.json` (pflegen die Sitzungen von Hand).
