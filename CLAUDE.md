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

## Google-Kalender-Integration (Kurzüberblick)

Tabellen: `oauth_states` (CSRF-State, mit `expires_at`), `google_calendar_connections`
(1 Zeile/User, Vault-Secret-ID), `google_calendars` (Liste der Google-Kalender
des Users inkl. `color`, `summary`, `sync_enabled`), `calendar_events`
(vereinheitlichte Events-Tabelle, Google-Zeilen mit `source_module='google'`,
Unique-Constraint `calendar_events_google_uidx` auf
`(owner_id, google_calendar_id, google_event_id)`).

`google_calendars.sync_enabled` existiert bereits in der DB, wird aber vom
Frontend noch nicht genutzt — geplantes Feature: echtes Ein-/Ausblenden
einzelner Google-Kalender (wie in Googles eigener Kalenderliste), noch nicht
umgesetzt.

## Geheimnisse

Liegen in `Zugangsdaten.env.md` im Claude-Projekt — NIEMALS in dieses Repo
oder in Code-Kommentare übernehmen. Staging-Secrets galten zwischenzeitlich
als kompromittiert (waren in einem Chat sichtbar) und müssen vor echtem
Produktiveinsatz rotiert werden (siehe HOSTING.md).

## Deploy-Workflow

Branch-basiert: Arbeit auf `staging`, PR gegen `main`. (Der alte manuelle
GitHub-Upload-Workflow aus `Projektkontext.md` ist überholt.)

## Pflege dieser Datei

Kurz halten (Claude Code lädt diese Datei bei JEDER Session vollständig —
lang = Rauschen = schlechtere Befolgung). Ergänzen bei: wiederholten Fehlern,
neuen Architektur-/Infra-Entscheidungen, abgeschlossenen größeren Features.
Nicht jede Kleinigkeit rein — Details bleiben in den Projekt-Docs.
