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

## Foto-Scans: Beleg (Finanzen) und Mahlzeit (Ernährung)

Kassenbon fotografieren → Betrag/Händler/Datum/Zahlungsart vorbefüllen; der
Nutzer bestätigt, gespeichert wird nichts automatisch (auch das Foto nicht).
Einstieg ist die Auswahl "Beleg scannen / Manuelle Eingabe" im `FinanceWizard`
(`core/components/EntrySheet.jsx`); nach einem Scan erscheinen alle Felder auf
einer Seite, die manuelle Eingabe behält die 3 Schritte.

- Frontend: `core/components/ReceiptScanChoice.jsx`, `core/lib/photoScan.js`
  (verkleinert auf 1600 px, POST/GET an die Function, `scanReceipt`/`scanMeal`).
- Edge Function `supabase/functions/scan-receipt/index.ts` ruft Claude Vision
  (Sonnet 5.5) und bedient beide Arten über das Feld `kind` (`receipt`|`meal`;
  der Name "scan-receipt" ist historisch). Env im `functions`-Service:
  `ANTHROPIC_API_KEY` (Pflicht), `RECEIPT_MODEL`, `MEAL_MODEL` (Default = RECEIPT_MODEL),
  `RECEIPT_MONTHLY_LIMIT` und `MEAL_MONTHLY_LIMIT` (je Default 30 Scans/Nutzer/Monat,
  Kalendermonat Europe/Berlin).
- Mahlzeit-Foto: Option "Mahlzeit scannen" im Ernährungs-FAB-Menü
  (`core/components/NutritionFabMenu.jsx`) → Ergebnis per window-Event
  `nutrition:meal-scanned` an `NutritionModule` → `MealScanModal.jsx`
  (geschätzte Bestandteile mit editierbaren Gramm, kcal-Spanne; reine Anzeige,
  noch kein Speichern). Bewusst KEINE Allergen-/Verträglichkeitsangaben. Es gibt
  kein Ernährungstagebuch, und Rezepte bestehen aus Zutaten der Lebensmittel-DB
  (`foodId`) — Bestandteile eines Fotos lassen sich daher nicht direkt als Rezept
  speichern.
- Scan-Animation: `core/components/ScanPreview.jsx` zeigt das aufgenommene Foto
  mit fahrender Scanleiste, bis die Antwort da ist (Beleg und Mahlzeit); läuft
  mindestens `MIN_SCAN_ANIMATION_MS` (photoScan.js). Reine Frontend-Änderung,
  respektiert `prefers-reduced-motion`.
- Kontingent: Tabelle `receipt_scans` (`supabase/receipt_scans_migration.sql`,
  Spalte `kind` je Art getrennt), nur per service_role erreichbar (RLS an, keine
  Policy). Zählt Scans, die Claude erreichen; technische Fehler werden
  freigegeben. `GET ?kind=…` auf die Function liefert das Restkontingent.
- Die Function wird NICHT über den Deploy-Workflow ausgerollt (der rsynct nur
  `dist/`): Datei von Hand nach `volumes/functions/scan-receipt/index.ts`
  kopieren. `.env` und `docker-compose.yml` gehören root (`sudo`). Neue
  Env-Variablen greifen erst nach `docker compose up -d --no-deps functions`
  (Neustart reicht nicht; `--no-deps` lässt PostgREST in Ruhe). Wegen der
  Reihenfolge: erst Migration einspielen (idempotent, auch für neue Spalten),
  dann Function ersetzen.
- Fehlerdiagnose: Die App zeigt Status/Ursache unter dem Scan-Button, das
  Function-Log (`docker logs supabase-edge-functions`) enthält pro Scan die
  Token-Zahlen. "could not find an appropriate entrypoint" = Function-Ordner
  fehlt auf dem Server.
- Kosten: Beleg ca. 0,7–0,8 Cent/Scan (gemessen), Mahlzeit ca. 1 Cent (geschätzt, ungemessen). Anthropic-Guthaben ist vorab
  bezahlt und verfällt ein Jahr nach Kauf; Auto-Aufladen bewusst aus.
- Production läuft noch ohne Scan (eigener Key, Compose, Function, Tabelle nötig).

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
