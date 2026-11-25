# Nestua — Projektkontext für Claude Code

React + Vite PWA, Supabase-Backend (self-hosted auf Hetzner). Deutschsprachiges
Produkt, Codename teils noch "MyHome" (App heißt "Nestua", früher "Zuhause").

- App: https://appworkshopdb.github.io/MyHome/
- Repo: https://github.com/appworkshopdb/MyHome
- Supabase: self-hosted, Projektverzeichnis `/opt/nestua/staging/supabase-project/`
  (Postgres 17.6, Container `supabase-db`, Edge Functions in `supabase-edge-functions`)

Ausführliche Hintergrunddokus liegen im Claude-Projekt "Nestua" (nicht im
Repo): `HOSTING.md`, `SERVER-SETUP.md`, `Design-System.md`, `Gamification.md`,
`Geraete-Setup.md`, `Zugangsdaten.env.md`, `Projektkontext.md`. Bei Fragen zu
Infra/Deploy/Design-Tokens dort nachlesen statt zu raten — diese Datei hier
ist bewusst kurz und ersetzt sie nicht.

## Schreibperspektive

Alle Texte, die ich im Namen des Projekts schreibe (Content, Social-Media-Posts, Videos, Beschreibungen, Release-Notes, Store-Texte),
stehen IMMER in der Ich-Perspektive eines einzelnen Vibe Coders: "mein", "ich baue" — nie "wir"/"unser"/"unsere".
Nicht gemeint sind die Texte in der App selbst (UI): dort bleibt die bestehende Ansprache.

## Zeitangaben

Uhrzeiten immer in Berlin-Zeit (Europe/Berlin) angeben und einstellen, auch in Berichten, im Leitstand und bei Zeitplänen. UTC nur, wo ein System nichts anderes kann, dann mit Berlin-Zeit daneben (Winter UTC+1, Sommer UTC+2). Server-Uhr seit 17.11.2026 in Europe/Berlin (crontab von `nestua` also in Berlin-Zeit, Backup 03:30). pg_cron (`cron.timezone = GMT`) und die Docker-Container laufen weiter in UTC.

## Architektur-Grundregel

`core/` darf NICHT aus `modules/` importieren. Umgekehrt schon. Gemeinsame
Logik (z. B. `habitsStore.js`, `calendarData.js`) gehört nach `core/lib/`.

## Kritische, wiederholt aufgetretene Fehlerquellen

1. **Lokale Datums-Strings niemals mit `toISOString().split('T')[0]` bauen.**
   Das rechnet über UTC um und verschiebt Termine bei UTC+1/+2 (Berlin) auf
   den falschen Tag. Immer lokale Komponenten verwenden:
   ```js
   function toDateStr(d) {
     const y = d.getFullYear();
     const m = String(d.getMonth() + 1).padStart(2, '0');
     const day = String(d.getDate()).padStart(2, '0');
     return `${y}-${m}-${day}`;
   }
   ```
   Siehe `core/lib/habitsStore.js` (`todayStr`/`isDueOn`) als Referenz.

2. **Supabase Studio kann auf eine ANDERE/leere DB zeigen als die, die die
   Edge Functions tatsächlich nutzen.** Schema-Änderungen und Debugging nie
   nur über Studio verifizieren. Verlässlich ist ausschließlich direkter
   Zugriff auf dem Server:
   ```bash
   docker exec -it supabase-db psql -U postgres -d postgres -c "..."
   ```
   Vor jeder Annahme über den DB-Zustand (fehlende Spalte, Funktionssignatur
   etc.) live nachsehen, nicht `supabase/schema.sql` vertrauen — das Repo-Schema
   ist mehrfach gegenüber der echten DB veraltet bzw. unvollständig gewesen.

3. **PostgREST muss auf `v13.0.8` gepinnt sein** (ES256-JWT-Verifizierungsbug
   in neueren Versionen). Siehe HOSTING.md §13a. Nach jedem Stack-Rebuild
   (Staging wie Production) prüfen und ggf. erneut downgraden.
   Der Healthcheck von `rest` ist in `docker-compose.yml` bewusst mit
   `disable: true` abgeschaltet: v13.0.8 kennt `postgrest --ready` nicht (erst
   ab v14), und das Image hat weder Shell noch `curl`. Mit dem Standard-
   Healthcheck aus dem Supabase-Template würde der Container sonst dauerhaft
   "unhealthy" gemeldet. Beim Upgrade/Rebuild des Stacks nicht zurückändern.
   Prüfen, dass `docker inspect -f '{{json .State.Health}}' supabase-rest` `null`
   liefert.

4. **Vault-Wrapper-Funktionen für Google-Refresh-Tokens sind zwei getrennte
   RPCs**, nicht eine kombinierte:
   - `store_google_refresh_token(p_owner_id uuid, p_token text) returns uuid`
     — nur für NEUE Secrets
   - `update_google_refresh_token(p_secret_id uuid, p_token text) returns void`
     — zum Überschreiben bestehender Secrets
   Vor Änderungen an der Google-Calendar-Integration die echten Signaturen via
   `\df public.*google*` gegenprüfen, nicht vom Repo-Code ausgehen.

5. **Fixed-Nav-Regel (nicht verhandelbar):** Keine `transform`, `filter`,
   `perspective`, `will-change` o. ä. auf Vorfahren von `.chrome-top` /
   `.bottom-nav`. Das bricht `position: fixed` lautlos — häufigste, am
   schwersten zu findende Ursache für "Nav scrollt mit".

6. **Fonts sind self-hosted**, nicht über Google Fonts/index.html eingebunden
   (Design-System.md ist an dieser Stelle veraltet).

## Server-Betrieb (Staging, Hetzner)

- **Docker geht ohne sudo** (User `nestua` ist in der docker-Gruppe): `docker ps`,
  `docker logs`, `docker exec`, `docker rmi` funktionieren direkt.
- **sudo braucht ein Passwort** und geht nur in einem echten Terminal (Terminal-Panel
  der Desktop-App per `run_in_terminal`, der Nutzer tippt das Passwort). Ohne Passwort
  freigegeben ist nur `sudo systemctl reload caddy` (`/etc/sudoers.d/nestua-ops`,
  Vorlage `/opt/nestua/ops/reference/sudoers-nestua-ops`). Nicht mehr nötig für:
  `docker compose` (läuft über die docker-Gruppe, aus dem Projektordner, weil die
  `.env` `COMPOSE_FILE` relativ setzt) und `caddy validate`.
- **Rechte (seit 17.11.2026):** `/etc/caddy/Caddyfile` und `docker-compose.yml` gehören
  `root:nestua` mit `664` (ohne sudo änderbar), `.env` `root:nestua` mit `640`.
  Die Ordner `/etc/caddy` und `supabase-project/` gehören root: Sicherungen deshalb
  nach `/opt/nestua/ops/backups/<bereich>/` legen, nicht daneben.
- **Caddy-Änderungen:** Sicherung nach `ops/backups/caddy/`, Datei ändern,
  `caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile`, dann
  `sudo systemctl reload caddy` (nie restart), danach Referenzkopie
  `install -m 600 /etc/caddy/Caddyfile /opt/nestua/ops/reference/Caddyfile`.
- **Compose-Änderungen:** Sicherung nach `ops/backups/compose/`, Datei ändern, im
  Projektordner `docker compose config -q`, dann gezielt
  `docker compose up -d --no-deps <service>`, nie den ganzen Stack.
- **Leitplanken (seit 17.11.2026):** `.claude/settings.json` (Repo) und `~/.claude/settings.json`
  (Server, alle Ordner) sperren das Lesen von Geheimnis-Dateien, das Stoppen des ganzen Stacks,
  Volume-Löschen und Force-Push; sudo, Push, Compose-Start und `docker restart` fragen immer nach.
  Der Hook `.claude/hooks/guard-secrets.py` blockiert Befehle, die Schlüssel ausgeben würden
  (Tests: `python3 .claude/hooks/test_guard.py`). Er prüft Muster im Befehlstext, deshalb können
  auch Texte, die solche Befehle nur erwähnen, gesperrt werden: dann mit dem Editor statt per Shell ändern.
  Neue Sitzungen bekommen über `session-status.py` den Kurzstand aus dem Leitstand.
  Regeln nur ändern, wenn der Nutzer es will.
- **Edge Functions nur per `tools/deploy-functions.sh <name>`** ausrollen (Repo ist die Quelle;
  prüft Commit und Syntax, sichert, startet die Runtime neu, prüft danach). Vorher `--dry-run`.
- **GitHub vom Server:** Push über den Deploy-Key `~/.ssh/github_myhome_deploy`
  (nur `appworkshopdb/MyHome`, Remote `git@github-myhome:appworkshopdb/MyHome.git`).
  Commits als `Claude <noreply@anthropic.com>`; der Server hat sonst keinen GitHub-Zugang.
- **Nach einem Neustart prüfen:** `docker ps`, `docker logs --tail 15 <service>`,
  `curl -s -o /dev/null -w '%{http_code}' https://api-staging.nestua.de/rest/v1/`
  (ohne Key erwartet: 401) und dass `supabase-envoy` keine 502/503 liefert.
- Der Gateway auf Staging ist `supabase-envoy` (Image `envoyproxy/envoy`), nicht
  Kong. `/opt/nestua/produktion/` enthält dagegen noch eine `kong.yml` und in
  der dortigen `docker-compose.yml` steht für `rest` noch `postgrest:v12.2.3`
  (nicht v13.0.8). Vor jeder Produktions-Änderung klären, ob diese Datei der
  echte Stand ist.

### Backup-Restore-Test

`/opt/nestua/ops/restore-test.sh` spielt das Tages-Backup
(`/opt/nestua/backups/nestua_db-postgres_<Datum>.dump.gpg`) in einen
Wegwerf-Container `postgres:17` ein (`--network none`) und vergleicht die
Zeilenzahlen von `fin_entries`, `nut_foods`, `spo_workouts` und
`analytics_events` mit `supabase-db`. Der Container wird am Ende entfernt.
Fehlermeldungen landen in `/opt/nestua/ops/restore-errors.txt`.

Erwartbare Fehler, die KEIN Datenverlust sind: `pg_cron`, `pg_net` und
`supabase_vault` fehlen in `postgres:17` (in `supabase/postgres` vorhanden).
Alle anderen Fehlerzeilen ernst nehmen. Das Skript ist bisher nur kopiert,
noch nicht regulär ausgeführt/automatisiert. Das Datum im Skript ist fest
eingetragen und muss pro Lauf angepasst werden.

## Einstellungen hängen am Nutzer, nicht am Gerät

Tracking-Einwilligung: `body_profile.analytics_consent` (+ `_at`, `_version`, Migration
`supabase/consent_migration.sql`; ohne Migration läuft die App lokal weiter). `lib/analytics.js` hält je Nutzer einen
Zwischenspeicher (`nestua_analytics_consent:<userId>`), gleicht beim Login mit dem Server ab (Server gewinnt; ein
alter gerätebezogener Wert wird einmalig dem ersten Login zugeschrieben). Banner erst nach dem Abgleich (`'pending'`).
Push: das Abo ist technisch Gerätesache; `lib/pushNotifications.js` merkt sich in `nestua_push_user`, FÜR WEN es hier
aktiviert wurde. Abmelden löscht nur die Zeile in `push_subscriptions` (`releasePushForLogout`), Login stellt sie für
denselben Nutzer wieder her (`restorePushForUser`, fragt nie nach); ein anderer Nutzer auf dem Gerät startet ohne Push.
Kategorie-Schalter liegen schon in `notification_prefs`. Neue Nutzer-Einstellung = Spalte/Tabelle, nie nur localStorage.

## Modul-Details (`docs/module/`)

Diese Abschnitte stehen nicht mehr hier, damit jede Sitzung schnell startet. **Vor Arbeit an einem Bereich die passende Datei lesen** und Änderungen dort pflegen.

| Bereich | Datei | Inhalt |
|---|---|---|
| Kalender | `docs/module/kalender.md` | Google-Kalender: Tabellen, Sync, geplantes Ein-/Ausblenden |
| Foto-Scans | `docs/module/foto-scans.md` | Beleg- und Mahlzeit-Scan, Function scan-receipt, Kontingente |
| Ernährung | `docs/module/ernaehrung.md` | Rezepte, Einkaufsliste, Lebensmittel-Katalog, Rezeptbilder, Rezeptliste |
| Statistiken | `docs/module/statistiken.md` | Wochen- und Monatsüberblick, Pushes dazu |
| Finanzen | `docs/module/finanzen.md` | Finanz-Auswertung, Teilzahlungen |
| Onboarding | `docs/module/onboarding.md` | Registrierung, Onboarding, Tutorials |
| Design und Hub | `docs/module/design-hub.md` | Farbfamilien, design-v2, Hub-Aufbau, Sport-Auswertung |
| Sport | `docs/module/sport.md` | aktiver Trainingsplan (Dauerplan) |
| Gewohnheiten | `docs/module/gewohnheiten.md` | zentraler Katalog, Kategorien, Ziele |

## Skills (`.claude/skills/`)

`nestua-visual-check` (App mit Testdaten starten, Screenshots Hell/Dunkel, Textsuche), `nestua-mockup` (Entwürfe als Mockup-Seite
bauen), `nestua-design-umbau` (Seite ins neue Design bringen, mit Checkliste und Stand, welche Seiten schon umgebaut sind),
`nestua-backlog` (Backlog im Obsidian-Vault), `nestua-server-check` (Server prüfen: `/opt/nestua/ops/server-check.sh`,
Bericht in `/opt/nestua/ops/reports/`, Befunde mit Beleg erklären, nur nach OK ändern).

**Backlog = Obsidian-Vault im privaten Repo `appworkshopdb/nestua-notes`** (lokal im Ordner `Nestua/`, dort Ordner `Backlog/`, dazu `Entscheidungen/`,
`Architektur/`, `Ideen/`, `Betrieb/`). Der Ordner steht in `.gitignore` und ist nie Teil dieses Repos. Linear wird nicht mehr genutzt.
Vor jeder Feature-, Bug-, Design- oder Sicherheitsarbeit den Skill `nestua-backlog` nutzen: offene Notizen zum Bereich prüfen, beiläufig genannte
Ideen/Bugs als neue Notiz anlegen, nach der Arbeit im Verlauf vermerken (`done` nur nach Bestätigung des Nutzers). Lokale Sessions lesen den Ordner
`Nestua/` direkt, Cloud-Sessions binden das Repo mit `add_repo` ein (access push). Änderungen im Vault werden committet und nach `main` gepusht.
Bereiche wie im alten Sheet (Hub, Gewohnheiten, Finanzen, Sport, Ernährung, Einkauf, Generelles). Ziele der Entwicklungsphase (Projekt):
Sicherheit, Klarheit & Struktur, Intuitives einheitliches Design; "Play Store später" ist das oberste, aber noch nicht aktuelle Ziel.
Keine Geheimnisse und keine Nutzerdaten in Notizen. Das Sheet "Entwicklung/Ideen" ist nur noch Archiv der erledigten Einträge.

## Datenbank-Sicherheit (Stand 2026-11-05, auf Staging UND Prod eingespielt)

Live geprüft: alle `public`-Tabellen haben RLS, Policies prüfen `auth.uid() = owner_id`, alle `SECURITY DEFINER`-Funktionen
haben festen `search_path`. Härtung: `supabase/security_hardening_migration.sql` — `anon` hat KEINE Rechte auf `public` (Standard-
rechte für neue Tabellen von `postgres` ebenfalls entzogen), `households`/`household_members` sind für Clients nur lesbar (Haushalte
legt man per Service-Role/psql an; die App schreibt dort nie), `nut_foods`/`nut_recipes` setzen `household_id` nur für Mitglieder,
Trigger-/Aufräum-Funktionen (`log_body_weight`, `handle_new_user`, `cleanup_old_oauth_states`) sind nicht per RPC aufrufbar.
Regeln für neue Tabellen/Funktionen: RLS an + Policy auf `authenticated`; Funktionen mit `revoke execute … from public, anon, authenticated`
und nur bei Bedarf gezielt freigeben (EXECUTE kommt sonst über PUBLIC). Nach JEDER neuen Tabelle auf dem Server prüfen (muss 0 bleiben,
Tabellen anderer DB-Benutzer als `postgres` bekommen Standardrechte für `anon` zurück):
`select count(*) from information_schema.role_table_grants where table_schema='public' and grantee='anon';`
Ein Dauer-SSH-Zugang für Claude ist bewusst nicht eingerichtet (Staging und Prod teilen ein Backend); Prüfabfragen laufen von Hand per `docker exec`.

## Design-Werkstatt (`tools/werkstatt/`)

Entwicklungswerkzeug zum Vereinheitlichen des Designs (Interface Inventory und Design Tokens fertig; Werkstatt und Doku folgen). Eigene Vite-Konfiguration,
startet mit `npm run werkstatt` (Port 5180, zählt vorher das CSS neu: `tools/werkstatt/scan.mjs` → `generated/inventory.json`, nicht im Git).
Der App-Build kennt den Ordner nicht; `build-check.yml` schlägt fehl, falls "Design-Werkstatt" in `dist/` auftaucht. Nie auf GitHub Pages
oder in die APK. Ziel: gemeinsame Tokens (Schrift, Abstände, Ecken) und einheitliche Bausteine, dann Seite für Seite umstellen.
Tokens: `design/tokens.json` (Quelle, aktuell "Vorschlag": 7 Schriftstufen `--fs-caption…display` mit `--fw-`/`--lh-`, Abstände `--sp-1…7` im 4er-Raster, Ecken `--rad-sm…hero`, Tippfläche `--hit-min` 48) und daraus
erzeugtes `design/tokens.css`. Die Seite "Design Tokens" bearbeitet sie live und speichert über eine lokale Schnittstelle des Werkstatt-Servers (`/api/tokens`, nur Entwicklungsserver).
Die App importiert `tokens.css` (`src/main.jsx`, vor `base.css`; zusätzlich 3 Schatten `--sh-sm|md|lg`), nutzt die Variablen aber noch nicht (bestehende `--space-*`/`--r-*`/`.t-*` bleiben bis zur Umstellung); Farb-Abweichungen stehen nur in der JSON. Plan und Designrichtung (schärfer, dünnere Linien, wenig Text): `design/UMBAUPLAN.md`.
**Regelwerk: `design/DESIGN.md`** (seit 20.11.2026, auf Wunsch des Nutzers vor der Token-Abnahme angelegt; Token-Werte darin als Vorschlag markiert). Bei Widersprüchen gilt DESIGN.md.
Prüfung vor dem Merge: Design-Ratsche im Regel-Check (`tools/pruefer/regeln.mjs`, lokal `npm run pruefer`): neue Hex-Farben außerhalb `base.css`/`themes.css`, feste Schriftgrößen, Radien und Inline-Styles werden gegen entfernte gezählt, unterm Strich mehr = Fehler; Bestand vor `tools/pruefer/design-seit.txt` zählt nicht; Ausnahme mit `pruefer:ok <Grund>`. Dazu ein Design-Review des Prüfer-Agenten bei UI-Änderungen (nur Empfehlung).
Reihenfolge (beschlossen): 1 Nutzer nimmt die Token-Werte in der Werkstatt ab, 2 Skill `nestua-design-system` (nur Ablauf, keine Zahlen; Werte stehen allein in `tokens.json`), 3 gemeinsame Bausteine, dann Seite für Seite umstellen. Ratsche in Phase 4 auf Zielwerte schärfen.

## Geheimnisse

Liegen in `Zugangsdaten.env.md` im Claude-Projekt — NIEMALS in dieses Repo
oder in Code-Kommentare übernehmen. Staging-Secrets galten zwischenzeitlich
als kompromittiert (waren in einem Chat sichtbar) und müssen vor echtem
Produktiveinsatz rotiert werden (siehe HOSTING.md).

## Deploy-Workflow

Branch-basiert: Arbeit auf `staging`, PR gegen `main`. (Der alte manuelle
GitHub-Upload-Workflow aus `Projektkontext.md` ist überholt.)

**Staging und Produktion (`main`) teilen EIN Backend** (Hetzner, `api-staging.nestua.de`):
beide Workflows bauen mit den `STAGING_VITE_SUPABASE_*`-Secrets, damit der Datenstand
überall gleich ist. Die frühere Supabase-Cloud-Datenbank (`ioznvkxuetrn…supabase.co`) ist
stillgelegt. Folge: Migrationen wirken sofort auch für die (ältere) `main`-App — nur
ADDITIV ändern (neue Spalte/Tabelle), nichts umbenennen/löschen, bis `main` nachgezogen hat.
Zugriffsschlüssel für die App ist der ES256-fähige `ANON_KEY` aus der Server-`.env`, NICHT
der im Studio unter "Legacy API keys" gezeigte HS256-Schlüssel und nicht `sb_publishable_…`
(sonst 401 `PGRST301`).

## Pflege dieser Datei

Kurz halten (Claude Code lädt diese Datei bei JEDER Session vollständig —
lang = Rauschen = schlechtere Befolgung). Ergänzen bei: wiederholten Fehlern,
neuen Architektur-/Infra-Entscheidungen, abgeschlossenen größeren Features.
Nicht jede Kleinigkeit rein — Details bleiben in den Projekt-Docs.
