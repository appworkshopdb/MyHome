# Leitstand

Lesende Oberfläche für die Agenten, ihre Abhängigkeiten und offene Aufgaben (Konzept: Abschnitt 4a), dazu ein Ein/Aus-Schalter je Agent (Abschnitt „Ein/Aus-Schalter“).

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
- **5-Stunden-Fenster** (`sitzung`): beginnt mit der ersten Nachricht und läuft 5 Stunden; rekonstruiert aus den Zeitstempeln aller Nachrichten auf diesem Server (`usage.mjs`, Feld `fenster`).
  Abweichung zu claude.ai: wenige Minuten (die erste Antwort kommt kurz nach der ersten Nachricht); Nutzung an anderen Geräten kann das echte Fenster früher beginnen lassen.
  Kalibrieren: `node usage.mjs --kalibrieren sitzung <prozent>` kurz nachdem du den Wert unter „Aktuelle Sitzung“ abgelesen hast.

## Ein/Aus-Schalter je Agent (seit 20.11.2026)

Jede Agentenkarte und jede Agentenseite hat einen Schalter. **Aus:** der Agent prüft nichts und startet nicht (der Cron-Eintrag bleibt, das Skript beendet sich als Erstes). **An:** es zählt der nächste Lauf im Plan, Versäumtes wird nicht nachgeholt; beim Prüfer gelten dafür alle PR- und staging-Stände aus der Pause als gesehen (`pruefer-cron.sh --seed`).

- `api.mjs`: Schnittstelle auf `127.0.0.1:8788` (`POST /api/agent {id, an}`, `GET /api/ping`, `GET /api/schalter`). Caddy reicht `/api/*` hinter dem Login des Leitstands durch. Geprüft werden Origin, Sec-Fetch-Site, der Header `X-Leitstand: 1` und die Kennung gegen `registry.json`.
- Zustand: Datei `/opt/nestua/ops/leitstand/aus/<id>` (vorhanden = aus) und `schalter.json` (Zeitpunkte `seit` und `ein`, Berlin-Zeit). `scan.mjs` übernimmt beides nach `leitstand.json` (`schalter`).
- `aus.sh <id>`: Exit 0, wenn ausgeschaltet. Steht am Anfang der fünf Cron-Skripte (`server-check-cron.sh`, `kontext-`, `pruefer-`, `datenschutz-`, `social-cron.sh`). `AGENT_FORCE=1` überspringt die Prüfung für einen Handlauf.
- `api-start.sh` startet die Schnittstelle (Cron alle 5 Minuten, die Sperre hält der Server selbst). `setup-api.sh` richtet Caddy-Block und Cron-Eintrag ein (`--dry-run` zeigt nur).
- Nicht abgeschaltet wird der GitHub-Check „Prüfer“ (läuft bei GitHub, nicht auf dem Server); der Server-Teil des Prüfers pausiert.

