# Foto-Scans

Aus `CLAUDE.md` ausgelagert (17.11.2026). Vor Arbeit an diesem Bereich lesen; Änderungen hier pflegen, nicht in `CLAUDE.md`.

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
  (Katalog ~717 + eigene, `MAX_FOODS` 1000) kostet Eingabe-Tokens je Scan; die Function kürzt sie
  (ohne Gewürze/Süßungsmittel, kcal nur wo der Zustand zählt: `LIST_EXCLUDED_GROUPS`,
  `LIST_NO_KCAL_GROUPS`, ca. −25 % Zeichen), geschätzt 4–5k Tokens. Nach dem Ausrollen in
  `receipt_scans`/Function-Log messen (Abfrage am Ende der Migration). Kein Prompt Caching,
  kein günstigeres Modell (bewusst), Limit bleibt 90.
- Tagesplan (Hub, `DayPlan.jsx`): Block "Ernährung" zwischen Training und Aufgaben
  (ohne Haken, zählt nicht bei "x / y erledigt"): offene kcal/Makros vs. Tagesziel,
  vier Mahlzeit-Marker. Daten über `core/lib/nutritionDay.js` (eigene Abfrage auf
  `nut_meals` + `computeBody`; Typen dort dupliziert, weil core nicht aus modules
  importieren darf). "Ernährung ›" → Modul. Mit Tagesziel zeigt der Block `MacroDial.jsx` (Ring in der Mitte, links Eiweiß + Kohlenh.,
  rechts Fett + Kcal, je ein antippbarer Wert, Einzelauswahl nur lokal: Ring + Mitte zeigen dann diesen Wert, sonst Ø in %,
  Flug-Animation per Web Animations API, mit "Bewegung reduzieren" aus; unter ~270 px Breite Ring oben, Werte 2 × 2). Ring und
  Mahlzeit-Marker → `#/nutrition/mahlzeiten` (die Werte selbst öffnen nichts). Ohne Ziel wie bisher Textzeile + Hinweis.
  Styles `.dp-dial*`/`.dp-tile*` in `design-v2.css`; Entwurf: Claude Design "Makro-Zähler".
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
