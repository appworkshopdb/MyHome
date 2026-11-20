# Sport

Aus `CLAUDE.md` ausgelagert (17.11.2026). Vor Arbeit an diesem Bereich lesen; Änderungen hier pflegen, nicht in `CLAUDE.md`.

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

Feste Bilder je Einheit: `spo_workouts`/`spo_plan_items` tragen ihre Muskelgruppen selbst (`muscle_groups`,
Migration `supabase/spo_muscle_groups_migration.sql`, vor dem Ausrollen einspielen; die App läuft auch ohne
die Spalte und löst Bilder dann wie früher über Einheit/Titel/Typ auf). Details: `SPORT_CLAUDE_CONTEXT.md` §7.

App-Einheiten und eigene Einheiten (seit 20.11.2026): Einheit = Baustein (fest aus der App oder selbst angelegt),
Training = Einheit an einem Tag, Trainingsplan = Einheiten über Tage. Plus-Menü in zwei Gruppen (Im Kalender eintragen:
Training, Ruhetag; Neu anlegen: Trainingsplan, Eigene Einheit). Eigene Einheiten haben ein Symbol (16, `lib/sportSymbols.js`)
oder Muskeln und eine Kategorie (`type_key` `custom.*`); EIN Formular `OwnUnitForm`. Galerie speichert Muskel-Kombinationen
nur mit dem Schalter „Als eigene Einheit speichern“. Bearbeiten/Löschen im Bereich „Einheiten“ (App-Einheiten | Eigene).
Spalte `icon` in `spo_units`/`spo_workouts`/`spo_plan_items`: Migration `supabase/spo_unit_icon_migration.sql` vor dem
Ausrollen einspielen (die App läuft auch ohne). Details: `SPORT_CLAUDE_CONTEXT.md` §7.

Gewicht eintragen (`WeightTimeline.jsx`, Sport › Auswertung): Formular mit zwei gleich hohen Feldern (Beschriftung klein im Feld, Raster `.sa-wfields` bricht auf schmalen Geräten untereinander um), „Speichern“ in voller Breite an der Stelle von „+ Gewicht eintragen“, „Abbrechen“ als Text in der Kopfzeile (`.sa-wx`). Das Datum kommt aus `todayIso()` (lokal), nie aus `toISOString()`.
