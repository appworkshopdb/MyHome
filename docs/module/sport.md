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
die Spalte und löst Bilder dann wie früher über Einheit/Titel/Typ auf). Eigene Kombinationen entstehen im
Galerie „Einheit wählen“ (Kraft › Muskeln, Mehrfachwahl aller Muskeln). Details: `SPORT_CLAUDE_CONTEXT.md` §7.
