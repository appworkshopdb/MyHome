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
  `nutrition:meal-scanned` an `NutritionModule` → `MealScanModal.jsx` (geschätzte
  Bestandteile mit editierbaren Gramm, kcal-Spanne, "Mahlzeit speichern").
  Bewusst KEINE Allergen-/Verträglichkeitsangaben; Fotos werden nie gespeichert.
- Mahlzeiten-Verlauf (Bereich "Mahlzeiten", `MealsView.jsx`): Tabelle `nut_meals`
  (`supabase/nut_meals_migration.sql`), nur eigene Zeilen (RLS), kein Haushalt-
  Sharing. Einträge sind MOMENTAUFNAHMEN (Nährwerte kopiert, kein Verweis auf
  Rezept/Lebensmittel); Quellen: Foto-Schätzung (`is_estimate`, überall mit "≈"
  gekennzeichnet) und eigenes Rezept × Portionen (exakt, `LogRecipeModal.jsx`,
  auch per Button "Gegessen eintragen" im Rezept-Dialog). Tageskarte zeigt
  gegessen vs. Tagesziel (`computeBody` in `core/lib/bodyCalc.js`, braucht
  ausgefülltes Körperprofil). Datum `eaten_on` immer lokal bauen (`lib/meals.js`).
- Mahlzeit-Scan nutzt die Lebensmittel-DB: Das Modul trägt seine g/ml-Lebensmittel in
  `core/lib/scanFoods.js` ein, `scanMeal` schickt sie als `foods` (Name + Nährwerte pro
  100 g) mit. Die Function lässt die KI erkannte Bestandteile per `food_ref` (Listen-
  Nummer) + `db_grams` (Gewicht im Zustand des DB-Eintrags, z. B. trocken statt gekocht)
  zuordnen und setzt die Nährwerte selbst aus der Liste ein (`cleanMealFoods`, Bestandteil
  `src: 'db'`); nur Zutaten ohne Treffer schätzt die KI (`src: 'ai'`), Spanne als Prozent.
  Ohne `foods` läuft die alte Variante unverändert. `MealScanModal`: Menge ändern,
  Bestandteil entfernen, Zutat aus der DB hinzufügen (`src: 'user'`, zählt exakt).
  Kein Env-/Migrations-Schritt, nur die Function-Datei ersetzen. Kosten: die Liste
  (Katalog ~717 + eigene, `MAX_FOODS` 1000) kostet geschätzt 6–7k Eingabe-Tokens je Scan
  (nach dem Ausrollen in `receipt_scans`/Function-Log messen, Abfrage am Ende der Migration).
- Tagesplan (Hub, `DayPlan.jsx`): Block "Ernährung" zwischen Training und Aufgaben
  (ohne Haken, zählt nicht bei "x / y erledigt"): offene kcal/Makros vs. Tagesziel,
  vier Mahlzeit-Marker. Daten über `core/lib/nutritionDay.js` (eigene Abfrage auf
  `nut_meals` + `computeBody`; Typen dort dupliziert, weil core nicht aus modules
  importieren darf). Block → `#/nutrition/mahlzeiten`, "Ernährung ›" → Modul.
  Fehler beim Laden blenden nur den Block aus.
- Morgen-Push "Tagesplan" (Kategorie `daily_plan`, 06:00 Europe/Berlin, Function `send-notifications`):
  fasst Termine/Training/Aufgaben/Gewohnheiten/fällige Zahlungen zusammen; Regeln dupliziert aus
  `core/lib/dayPlan.js`. Function muss von Hand nach `volumes/functions/` kopiert werden. Test:
  `?test_owner=<uuid>&test_category=daily_plan`.
- Mahlzeit-Typen: vier (`MEAL_TYPES` in `lib/nutrition.js`: fruehstueck, mittag,
  abend, snack) — gelten für Rezepte UND Mahlzeiten. Alte Rezept-Kategorien
  (frueh/haupt/suppen/desserts/snacks/backen/getraenke) übersetzt
  `normalizeRecipeCategory` beim Lesen; Daten-Migration:
  `supabase/nut_recipe_categories_migration.sql` (legt gesperrte Sicherung an).
- Kontingent: Tabelle `receipt_scans` (`supabase/receipt_scans_migration.sql`,
  Spalte `kind` je Art getrennt), nur per service_role erreichbar (RLS an, keine
  Policy). Zählt Scans, die Claude erreichen; technische Fehler werden
  freigegeben. `GET ?kind=…` auf die Function liefert das Restkontingent. Pro Scan
  stehen dort auch Modell, Tokens und `cost_usd` (Kostenkontrolle pro Nutzer, in
  der App nicht sichtbar; Abfrage am Ende der Migrationsdatei).
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
- Kosten (Sonnet 5.5, gemessen): Beleg ca. 0,7–0,8 Cent/Scan, Mahlzeit ca. 1,3 Cent
  (3.989 In / 469 Out Tokens). Anthropic-Guthaben ist vorab
  bezahlt und verfällt ein Jahr nach Kauf; Auto-Aufladen bewusst aus.
- Production läuft noch ohne Scan (eigener Key, Compose, Function, Tabelle nötig).

## Lebensmittel-Katalog (Ernährung)

Alle Lebensmittel stehen in EINER Tabelle, `nut_foods` (Migration
`supabase/nutrition_catalog_migration.sql`); `foods.js` gibt es nicht mehr.
`owner_id IS NULL` = globaler Katalog (für alle angemeldeten Nutzer lesbar, nur per
Migration beschreibbar, `seed_id` = stabile Zahlen-Id), `owner_id` gesetzt = eigenes
Lebensmittel oder persönlicher Override eines Katalogeintrags (`override_of` = `seed_id`).
Rezepte zeigen per `foodId` auf `seed_id` (Katalog) bzw. die uuid (eigene) — `seed_id`s
nie ändern oder wiederverwenden. Neue Katalogeinträge: weitere Migration mit
`seed_id` ab 718 (318–717 vergeben, `supabase/nutrition_catalog_expansion_migration.sql`),
`ON CONFLICT (seed_id) WHERE owner_id IS NULL DO NOTHING`. Entfernte Katalogeinträge nur
per `deleted_at` ausblenden, nie hart löschen. Konvention bei Milchprodukten & Co.: zu
jeder normalen Variante gibt es eine "… light"-Variante (Ampel eine Stufe besser).
`glutenfrei`/`laktosefrei` sind abgeleitet (Allergen "Gluten"/"Milch"), nie von Hand.
`nutData.getFoods()` lädt alles und hält je Nutzer einen Offline-Cache im localStorage.

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
