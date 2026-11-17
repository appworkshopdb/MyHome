# Gewohnheiten

Aus `CLAUDE.md` ausgelagert (17.11.2026). Vor Arbeit an diesem Bereich lesen; Änderungen hier pflegen, nicht in `CLAUDE.md`.

## Gewohnheiten-Katalog

Alle Vorlagen stehen in `core/lib/habitCatalog.js` (27 Einträge, Kategorie + Häufigkeit + Ziel fest); die
Vorlagen-Auswahl (`HABIT_LIBRARY`, `HabitTemplateLibrary.jsx`) und die Tour (`HABIT_AREAS`) leiten sich daraus ab.
EINE Kategorie pro Gewohnheit (9 feste, `HABIT_CATEGORIES`), Einheiten fest (`HABIT_UNITS`). Ziel-Arten: Ja/Nein,
Zähler (Einheit + Zielwert, Liter in 0,5-Schritten) und Uhrzeit (`hab_habits.goal_time`, Schritt 10/30 Min je Vorlage).
Abgehakt wird immer mit EINEM Tipp (setzt den vollen Zielwert); der Zähler ist nur das Ziel. Vorlagen-Gewohnheiten
erkennt die App am Namen (`catalogEntryByName`): im Formular sind Kategorie und Ziel-Art dann gesperrt, änderbar
bleiben Liter (Wasser) und die Uhrzeiten. Eigene Gewohnheiten sind frei. Statistik rechnet über `isDueHistoric`
(archivierte/pausierte zählen für ihre aktiven Tage; `stats_hidden` blendet gelöschte aus). Migrationen:
`hab_stats_hidden_migration.sql`, `hab_catalog_migration.sql` (vor dem Ausrollen einspielen, idempotent).
