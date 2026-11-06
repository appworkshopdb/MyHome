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
  (Katalog ~717 + eigene, `MAX_FOODS` 1000) kostet Eingabe-Tokens je Scan; die Function kürzt sie
  (ohne Gewürze/Süßungsmittel, kcal nur wo der Zustand zählt: `LIST_EXCLUDED_GROUPS`,
  `LIST_NO_KCAL_GROUPS`, ca. −25 % Zeichen), geschätzt 4–5k Tokens. Nach dem Ausrollen in
  `receipt_scans`/Function-Log messen (Abfrage am Ende der Migration). Kein Prompt Caching,
  kein günstigeres Modell (bewusst), Limit bleibt 90.
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

## Rezept → Einkaufsliste

Knopf "Einkaufsliste" im Rezept-Dialog (`RecipeDetailModal`) öffnet `core/components/RecipeToShoppingSheet.jsx`:
Portionen, Liste (vorgewählt: aktive Liste, sonst "Neue Liste") und Zutaten an-/abwählen. Rechenlogik rein in
`modules/shopping/lib/recipeImport.js` (Mengen umrechnen, Kategorie, Zusammenführen); Schreiben/Rückgängig in
`shoData.js` (`applyShoppingPlan`/`undoShoppingPlan`), keine Migration. Zutat steht schon OFFEN auf der Liste (gleicher
Name, verrechenbare Einheit, g/kg und ml/L) → Menge wird aufgestockt, sonst neue Zeile; abgehakte Artikel zählen nicht.
Herkunft steht im Feld `note` ("für Linsen-Curry" / "inkl. …"). Basis-Zutaten (Gruppe Gewürze, Salz/Öl/…, `isBasic`) sind
nicht vorgewählt. Der Hinweis mit "Rückgängig"/"Liste öffnen" (`ActionToast`) liegt im `NutritionModule`; die Übergabe an
das Einkaufsmodul (einmalige NEU-Markierung, gezielt Liste öffnen) läuft im Speicher über `core/lib/shoppingHandoff.js`.
Artikelansicht der Einkaufsliste (`ItemsView.jsx`, Styles am Ende von `design-v2.css`): Kopf-Karte mit Fortschritt und
"Einkauf abschließen", Zahlungen als schmale Karte, Kategorien als Karten, Menge als Chip, schwebende Eingabeleiste.
Löschen nur im Bearbeiten-Modus der Zeile (Tipp auf die Zeile). Der globale Plus-Knopf ist dort ausgeblendet
(`data-sho-items` am `<html>`, gesetzt von `ShoppingModule`). Einheiten "Zehe"/"Scheibe" gibt es auch in der
Einkaufsliste (`UNIT_OPTIONS`).
"Alle Listen" (`ListView.jsx`, Klassen `.sho-lseg`/`.sho-lrow*`/`.sho-lsheet*` in `design-v2.css`): oben `FocusCard` (Liste "Im Einkauf",
sonst nächster Termin, "Weiter einkaufen"), Filter Offen/Erledigt/Alle; in "Offen" nach Zeit gruppiert (Überfällig/Heute/Diese Woche/
Später/Ohne Datum), Zeile = Symbol, Name, Fortschritts-Ring, "•••". "•••" öffnet ein Sheet: Status (Wiederöffnen einer gebuchten Liste
storniert die Buchung), Fällig (Schnellwahl + Datum + Tageszeit), Name, Löschen (zweistufig). `saveList` schreibt beim Update nur
übergebene Felder (sonst löschte Umbenennen Symbol und Datum). Entwürfe: `design/mockup-alle-listen.html`.
Neue Liste NUR über den globalen Plus-Knopf (`ShoppingQuickSheet`, 3 Schritte): 1 Auswahl "Aus Vorlage"/"Manuelle Eingabe" (wie im
Finanz-Wizard; ohne Vorlagen ist die Karte ausgegraut; "Aus Vorlage" zeigt erst die Vorlagen, die gewählte füllt Schritt 2 und 3 vor,
Vorlagen lassen sich dort löschen), 2 Name/Symbol/Laden/Datum, 3 Artikel. Nach dem Speichern meldet der Wizard (liegt in core) per
`notifyShoppingChanged()` (`core/lib/shoppingHandoff.js`) window-Event, `ShoppingModule` lädt die Listen neu.
Abschluss (`CompleteListSheet.jsx`, Kopf-Knopf "Einkauf abschließen"): 1 "Alles gefunden?" (Tipp stellt "Noch offen"/"Im Warenkorb" um),
2 "Nicht gefunden" (nur wenn Artikel offen sind: ALLE gemeinsam auf eine andere Liste, eine neue Liste oder "Verwerfen" = löschen;
`planTransfer`/`transferHint` in `recipeImport.js` stocken auf wie beim Rezept-Import), 3 Bezahlung (mehrere Zahlungen; `ReceiptScanChoice` "Beleg scannen / Manuelle Eingabe" steht direkt im Schritt, ohne Galerie-Option
(`allowGallery={false}`); nach der ersten Zahlung nur noch zwei schmale Knöpfe (`compact`), "Gesamt" und Buchungsbezeichnung erst ab dann; ein Scan füllt Betrag, Zahlungsart, Laden und Notiz "Beleg vom …" nur VOR, gespeichert wird erst mit "Zahlung speichern";
das Scan-Kontingent ist dasselbe wie in Finanzen; Laden per `WheelPicker`; "Buchen & abschließen" bzw. "Ohne Buchung abschließen"; Schalter "Als Vorlage speichern" mit Namensfeld und
"Artikel ansehen" (Fenster, Eimer entfernt einen Artikel NUR aus der Vorlage; ohne Artikel keine Vorlage), speichert die gekauften
Artikel über `saveListAsTemplate(listId, name, icon, excludeIds)`, Fehler blockieren den Abschluss nicht; Buchungen landen immer in
"Sonstige Ausgaben", ein Hinweis erscheint nur bei offenen Zahlungsarten). Optik: offene Artikel getönt in Schritt 2, "Neue Liste" in
Modulfarbe, "Verwerfen" rot, "Gesamt" als eigene Karte (`.cl-*` in `design-v2.css`). Geschrieben wird erst am Ende, Reihenfolge:
Markierungen → Artikel übertragen/verwerfen → Vorlage → Zahlungen (`sho_payments`) → Buchung (Bar/Gutschein bezahlt, Rest offen,
vorhandene Buchung wird ersetzt) → Status "erledigt". Zahlungsbereich, "erledigte löschen" und "Als Vorlage speichern"
gibt es in der Liste selbst nicht mehr (`clearDoneItems` in `shoData.js` ist ungenutzt; Vorlagen entstehen im Abschluss und werden im
Anlege-Wizard über "Aus Vorlage" genutzt). `saveItem` schreibt beim Update nur
übergebene Felder (sonst würden Kategorie/Notiz beim Mengenändern gelöscht).

## Wochen- und Monatsüberblick (Hub → Statistiken)

Im Hub steht unter dem Kalender EIN Bereich "Statistiken" → `core/Statistiken.jsx` (Auswahl
Wochenüberblick / Monatsüberblick). Eigene Core-Routen wie `profile`, damit die Pushes direkt
verlinken können: `#/statistiken`, `#/statistiken/woche`, `#/statistiken/monat`. Beide Überblicke
sind `core/PeriodReview.jsx` (`kind` = week | month, `‹ ›` blättert zurück). Rechnung rein in
`core/lib/periodStats.js`: Woche = Mo–So, eine Spalte je Tag; Monat = Kalendermonat, eine Spalte je
Kalenderwoche. Gewohnheiten rechnen wie die Statistik im Habits-Modul (Helfer in
`core/lib/habitStatsMath.js`, `habUtils.js`/`StatsView.jsx` importieren sie von dort; Vergleich mit
gleich vielen Tagen des Zeitraums davor), Training = erledigt von geplant (Ruhetage zählen nicht),
Ernährung = erfasste Tage aus `nut_meals`, Ø-kcal gegen Tagesziel, Protein-Ziel = ≥ 90 % des
Tagesziels (ohne vollständiges Körperprofil nur Tage). Der Gesamtring mittelt die Karten, die im
Zeitraum Daten haben.

Pushes (Function `send-notifications`, von Hand nach `volumes/functions/` kopieren):
`weekly_recap` Montag 07:00 (Vorwoche → `#/statistiken/woche`) und `monthly_recap` am 1. um 09:00
(Vormonat → `#/statistiken/monat`). Beide nur, wenn im Zeitraum etwas erfasst wurde, und OHNE
Anrechnung aufs Tageslimit von 2 (sonst würden sie Finanzen/Aufgaben an Montagen und Monatsersten
verdrängen); Throttle 6 bzw. 25 Tage. Toggles "Wochenüberblick"/"Monatsüberblick" im Menü
(`AppMenu.jsx`, Standard an). Test: `?test_owner=<uuid>&test_category=weekly_recap` bzw.
`monthly_recap` (rechnet mit der letzten vollen Woche/dem letzten vollen Monat).

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

## Rezeptbilder (Ernährung)

Keine Fotos: 30 flächige Illustrationen (inkl. gemischte Gerichte: Teller mit Hähnchen/Steak/
Fisch, gemischter Teller, Auflauf, Pfannengericht, Power Bowl) in `modules/nutrition/lib/recipeCovers.jsx`
(Zeichenfläche 200×85, Farben der App; dunkelblaue Teile nutzen die Klassen `cv-ink`/
`cv-soft`, weil `var()` als SVG-Attribut nicht greift). `nut_recipes.cover` = `motiv` oder
`motiv:farbton` (`supabase/nut_recipe_cover_migration.sql`), `NULL` = automatisch über
Rezeptname bzw. Mahlzeit-Typ (`resolveCover`: Gericht-Wörter wie Suppe/Auflauf schlagen Zutaten, Eiweiß +
weitere Zutat → Teller-Motiv; Wörter mit Leerzeichen-Präfix wie ' eis', sonst trifft "Reis"). Neues Motiv: Eintrag in `COVER_MOTIFS`
(bestehende Keys nie umbenennen, sonst fallen gespeicherte Rezepte auf "automatisch").

## Rezeptliste (Ernährung)

Suche + Filter + Sortierung in `RezepteView` über `modules/nutrition/lib/recipeFilter.js`
(reine Funktionen); Mahlzeit-Chips + Suchfeld stehen oben, alle weiteren Filter und die
Sortierung im Bottom-Sheet `RecipeFilterSheet` (Knopf im Suchfeld, gewählte Filter als Chips). Gespeichert ist nur die Mahlzeit (`category`); Ernährungsform (aus
`food.diet`/Gruppe der Zutaten), Nährwert-Filter (pro Portion), Gerichtart (aus dem
Rezeptbild) und die Suche (Name > Zutaten > Tags/Notiz, Umlaut-unabhängig, alle Wörter
müssen passen) werden abgeleitet. Rezept-Dialog: Portionsrechner rechnet Zutatenmengen und
Nährwerte nur in der Ansicht um (`servings` = Portionen, für die die Mengen angelegt sind).
Tab "Vorlagen" zeigt zuerst Kategorien (`TemplateCategories.jsx`, Regeln in `lib/templateCategories.js`: 4 Mahlzeiten + Schnell & einfach
(≤ 4 Zutaten), Süßes, Sportlich (≥ 30 g Eiweiß), Vegetarisch & vegan, Meal Prep, Leicht (< 300 kcal), Fisch & Meer, Low Carb; alles aus
den Rezeptdaten abgeleitet, ein Rezept kann in mehreren stehen). Tipp öffnet die Liste (Zurück-Pfeil, Suche/Filter/Sortierung wie sonst,
auf die Kategorie begrenzt); Suche oder Filter in der Übersicht zeigen direkt die Gesamtliste. Karte: zwei Infokästchen rechts (Portionen, Zutaten).

## Finanz-Auswertung (Dashboard)

`SummaryView.jsx` + `components/report/` + `lib/analytics.js` (reine Rechenlogik,
Sparschwein-Regeln wie Übersicht/Buchungen). Zehn Bereiche, je ein-/ausblend-,
einklapp- und sortierbar; Ansicht + Filter liegen pro Nutzer in `fin_report_prefs`
(Migration `supabase/fin_report_prefs_migration.sql`, per `docker exec ... psql`
einspielen — ohne Tabelle speichert die App nur lokal). Jeder Bereich nennt in
`SECTIONS` (sections.jsx), welche globalen Filter er beachtet.

Teilzahlungen: Logik zentral in `core/lib/paymentParts.js` (`openAmount`, `entryParts`, `setPartsPaid`). Bar/Gutschein/Sparschwein gelten sofort als bezahlt; "offen" ist nur die Summe der unbezahlten Teilzahlungen (`payments[].paid`, jsonb, keine Migration). Zeilen-`paid` = alles bezahlt und maßgeblich, wenn `true`. "Offener Posten" = `isOpenExpense` (Ausgabe, keine Sparschwein-Einzahlung "Ersparnisse", Restbetrag > 0) — dieselbe Regel in Hub, Finanzen-Listen/Zählern und `send-notifications` (dupliziert), sonst weichen Anzahl/Summe ab. Finanz-Schreibzugriffe (`finData`) verwerfen den Hub-Cache (`core/lib/hubCache.js`, Version im Schlüssel bei Strukturänderung erhöhen); der Saldo bleibt unverändert (alle Ausgaben abgezogen).

Buchungen (`MonthsView`): Tipp auf einen Posten öffnet `EntryDetailSheet` (Status offen/bezahlt
per Tipp, Details, Löschen); "Bearbeiten" macht dieselbe Ansicht an Ort und Stelle änderbar (Entwurf, Speichern/Abbrechen).
`saveEntry` übernimmt ein ausdrücklich übergebenes `paid`; nur ohne Angabe wird es aus den
Zahlungsarten abgeleitet (Bar/Gutschein/Sparschwein = sofort bezahlt).

## Registrierung, Onboarding und Modul-Tutorials

Konto erstellen → Bestätigungsmail (GoTrue-SMTP, Resend; Port 587, 465 ist bei Hetzner
gesperrt) → Link führt zurück in die App (`rawAuth.consumeAuthRedirect` fängt die Tokens im
Hash ab, bevor das Hash-Routing sie sieht) → `ProfileWizard` (Gate in `App.jsx` über
`body_profile.onboarding_completed_at`) → Hub. Die Wizard-Leiste hat 6 Schritte, Schritt 1
(E-Mail) gilt beim Start schon als erledigt; das Ei (`EggFill`) füllt sich je Schritt
(20/40/60/80 %), in der Vogelwahl ist es weg, am Ende das echte Vogel-Ei. Ernährung/Allergene
sind freiwillig. Die Vogelart wird erst am Ende festgeschrieben (`setBirdSpecies`, endgültig).
Anmelden/Registrieren/„Passwort vergessen“ = `Login.jsx` (Navy-Kopf `AuthHero.jsx` + weißes Sheet,
Styles `.lg-*` in `onboarding.css`); Recovery-Link → `rawAuth.consumeAuthRedirect` (`type=recovery`) →
`AuthContext.recovery` → `App.jsx` zeigt `ResetPassword.jsx`. Datenschutz-Link auf `public/datenschutz.html`;
Nutzungsbedingungen gibt es noch nicht. Deutsche Mail-Vorlagen: `public/mail/*.html`, Server-Setup
(GoTrue-Env, `sudo`) in `supabase/mail_templates.md` — von Hand auf dem Server einzutragen.
Adressen `support@`/`technik@`/`no-reply@nestua.de` (App-Absender `no-reply@`, Name „Nestua“, siehe `SMTP_ADMIN_EMAIL`/`SMTP_SENDER_NAME` in der Server-`.env`; alle drei als ImprovMX-Alias): DNS liegt bei INWX; Empfang per ImprovMX (kostenlose
Weiterleitung an das Projekt-Gmail, MX `mx1/mx2.improvmx.com`, SPF `include:spf.improvmx.com include:spf.resend.com`),
Antworten aus Gmail per „Senden als“ über `smtp.resend.com:465` (Benutzer `resend`, eigener API-Schlüssel). Kein
Mailbox.org nötig; Absender-Logo (Google-Konto/Gravatar/BIMI) erst nach fertigem App-Logo.
Der alte `WelcomeWizard` bleibt nur für Bestandsnutzer ohne Vogel. Styles: `styles/onboarding.css`
(Wizard, Bestätigungsseite, Touren, Anlege-Seiten; nur semantische Tokens, Akzent `--warm`).

Jeder Bereich (Hub + 5 Module) hat beim ersten Besuch eine Tour: `core/components/ModuleTutorial.jsx`
(einmal in `App.jsx`), Bühnen in `TutorialStage.jsx`, Inhalte rein als Daten in `core/lib/tutorials.js`
(Folien + Mission + Erfolgstext). Die Mission öffnet das echte Anlege-Sheet (dieselben wie im
`GlobalFab`); bei Gewohnheiten die Vorlagen-Auswahl `HabitTemplatePicker` (Vorlagen in
`lib/habitTemplates.js`, max. 3). Anlege-Seiten im Tour-Design: `ShoppingQuickSheet` (Vollseite mit
Vorschaukarte), `NutritionFabMenu` (gruppiert). Gesehen-Zustand: `body_profile.tutorials_done`
(Migrationen `onboarding_migration.sql`, `tutorials_migration.sql`; Bestandsnutzer vorab „gesehen“).
Neues Modul = Eintrag in `tutorials.js` + Id in der Migration. Bereichs-Symbole zentral in
`ModuleIcons.jsx` (auch Bottom-Nav). Der Hub zeigt keinen Leerzustand mehr.

## Einstellungen hängen am Nutzer, nicht am Gerät

Tracking-Einwilligung: `body_profile.analytics_consent` (+ `_at`, `_version`, Migration
`supabase/consent_migration.sql`; ohne Migration läuft die App lokal weiter). `lib/analytics.js` hält je Nutzer einen
Zwischenspeicher (`nestua_analytics_consent:<userId>`), gleicht beim Login mit dem Server ab (Server gewinnt; ein
alter gerätebezogener Wert wird einmalig dem ersten Login zugeschrieben). Banner erst nach dem Abgleich (`'pending'`).
Push: das Abo ist technisch Gerätesache; `lib/pushNotifications.js` merkt sich in `nestua_push_user`, FÜR WEN es hier
aktiviert wurde. Abmelden löscht nur die Zeile in `push_subscriptions` (`releasePushForLogout`), Login stellt sie für
denselben Nutzer wieder her (`restorePushForUser`, fragt nie nach); ein anderer Nutzer auf dem Gerät startet ohne Push.
Kategorie-Schalter liegen schon in `notification_prefs`. Neue Nutzer-Einstellung = Spalte/Tabelle, nie nur localStorage.

## Farbsystem und Hub-Layout (Front-End)

Warme Basis (`--raw-sand-*`, warmes Dunkelblau als Text; Dunkelmodus warm, `themes.css`) plus
EINE Farbfamilie je Modul: Finanzen Blau, Ernährung Grün, Sport Koralle, Gewohnheiten Gold,
Einkauf Violett; Hub-Funktionen (Termine, Aufgaben, Kalender) neutral (`--mod-n-*`). Tokens je
Familie in `base.css`/`themes.css`: `--mod-<fin|food|sport|hab|shop>-` + `tint|ink|ac|on|deep|hero|hero-ink|pill`
(`deep` = Text auf hellem Grund, AA; `ac`/`on` = Füllung + Schrift darauf). `App.jsx` setzt
`data-module` auf `<html>`, solange ein Modul offen ist; dann mappt `base.css` `--m-*` und die
Aktionsfarbe (`--action-primary`) auf die Familie, Nav-Pille/Plus-Knopf nutzen `--m-ac`/`--m-on`.
Einzelne Kacheln außerhalb eines Moduls (Hub) bekommen die Familie per Klasse `.tone-<familie>` (`--t-*`).
Neue Familie/Farbe nur als Token ergänzen, nie als Hex in Komponenten; Farbe ist nie das einzige
Zeichen (Symbol + Name bleiben). Kontraste vor Änderungen nachrechnen (Text ≥ 4,5:1).

Die neue Optik steht in `styles/design-v2.css` (zuletzt geladene Datei; übersteuert `app-extra.css`),
Bausteine: `FocusCard` (Verlauf der Familie, optional `family`), `AreaList variant="tiles"` +
`AreaRow icon/featured` (Bereiche als Kacheln, Symbole in `AreaIcons.jsx`), `Ring.jsx`, `HubTiles.jsx`.
Hub-Reihenfolge: Tagesplan (mit "Als Nächstes" = erstes offenes Training), Saldo + Gewohnheiten +
Training, Ernährung (`NutritionBlock`, in den Modulen `variant="hero"`), Aufgaben, Kalender/Statistiken.
Logik, Texte, Links und Daten sind dieselben wie vorher; die Ernährung steht nicht mehr IM Tagesplan.

Hub-Details: Der Tagesplan zeigt den Fortschritt als Linienbalken unter der Überschrift, Termine stehen in einer
eigenen kleinen Liste über der übrigen. Das Auge in der Saldo-Karte blendet Beträge aus (`core/lib/privacyStore.js`,
`components/Money.jsx` zeigt statt des Betrags einen weichgezeichneten Platzhalter, der echte Wert steckt dann nicht im DOM; je Nutzer in `body_profile.hide_amounts`, Migration `supabase/hide_amounts_migration.sql`, ohne sie nur lokal).
Die Saldo-Karte zeigt unter Ein/Aus auch "Spar" (Sparschwein-Stand, `core/lib/savingsBalance.js`, Regeln aus `finance.js` dupliziert). Bisher nur im Hub angewendet (Saldo-Karte, Zahlungen im Tagesplan), Module folgen. Kacheln tragen ihre Überschrift
innerhalb der Karte (auch "Aufgaben"); "+ Mahlzeit eintragen" gibt es nur noch in der Ernährungs-Hero-Karte. Im Hub gibt es keinen Plus-Knopf (`GlobalFab`), Aufgaben legt der Knopf "Neue Aufgabe" in der Aufgaben-Karte an.

Sport zeigt und fragt KEINE Dauer mehr (weder Einheiten, Hub, Auswertung noch Anlegen-Dialoge); die Spalten `duration_min`
bleiben in der DB und werden nur durchgereicht, nichts anzeigen oder neu abfragen. Auswertung (`AuswertungView`, `BadgesCard`,
`SportIcons.jsx`, Klassen `.sa-*` in `design-v2.css`): Zahlen auf ruhigen Kacheln, Erfolge als Medaillen mit Symbol je Badge-Schlüssel. Aktivität = 12 Monatsspalten mit Wochenzellen, vorgewählt ist immer die aktuelle Woche.

## Sport: aktiver Trainingsplan (Dauerplan)

Ein Plan wird in „Pläne“ aktiviert und füllt den Kalender selbst auf (28 Tage im Voraus, nie
rückwirkend), bis er gewechselt/geändert/beendet wird; ein Plan ist freiwillig. Logik in
`core/lib/sportPlanSync.js` (Hub und Sport rufen `syncActivePlan` auf), Tabelle `spo_active_plan`
+ Spalte `spo_workouts.auto_planned` (`supabase/spo_active_plan_migration.sql`, per `docker exec ... psql`
einspielen, VOR dem Ausrollen der App; vorher `\d spo_workouts` live prüfen, für `spo_*` gibt es im Repo
keine Migration). Einheiten bleiben echte `spo_workouts`-Zeilen, damit Hub, Überblicke, Auswertung
und Push unverändert rechnen. Eigene Einträge haben Vorrang vor der Plan-Zeile (wird ausgeblendet,
beim Löschen des eigenen Eintrags kommt sie zurück); Wechseln/Ändern/Beenden gelten nur ab heute.
Details: `SPORT_CLAUDE_CONTEXT.md` §9.

## Skills (`.claude/skills/`)

`nestua-visual-check` (App mit Testdaten starten, Screenshots Hell/Dunkel, Textsuche), `nestua-mockup` (Entwürfe als Mockup-Seite
bauen), `nestua-design-umbau` (Seite ins neue Design bringen, mit Checkliste und Stand, welche Seiten schon umgebaut sind),
`nestua-backlog` (Backlog im Obsidian-Vault).

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
Die App importiert `tokens.css` NOCH NICHT (bestehende `--space-*`/`--r-*`/`.t-*` bleiben bis zur Umstellung); Farb-Abweichungen stehen nur in der JSON.

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
