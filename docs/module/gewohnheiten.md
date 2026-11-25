# Gewohnheiten

Aus `CLAUDE.md` ausgelagert (17.11.2026). Vor Arbeit an diesem Bereich lesen; Änderungen hier pflegen, nicht in `CLAUDE.md`.

## Gewohnheiten-Katalog

Alle Vorlagen stehen in `core/lib/habitCatalog.js` (27 Einträge, Kategorie + Häufigkeit + Ziel fest); die
Vorlagen-Auswahl (`HABIT_LIBRARY`, `HabitTemplateLibrary.jsx`) und die Tour (`HABIT_AREAS`) leiten sich daraus ab.
Neue Gewohnheiten (auch aus Vorlagen) gibt es NUR über den Plus-Knopf (`HabitQuickSheet`): Schritt 1 "Aus Vorlage" /
"Manuelle Eingabe"; Vorlage → direkt "Wann & wie oft" (Name, Symbol, Kategorie, Ziel-Art fest, nur Liter bzw. Uhrzeit
einstellbar), manuell → Name & Bereich → Wann & wie oft. Die Gewohnheitenseite selbst hat keinen Vorlagen-Knopf mehr.
EINE Kategorie pro Gewohnheit (9 feste, `HABIT_CATEGORIES`), Einheiten fest (`HABIT_UNITS`). Ziel-Arten: Ja/Nein,
Zähler (Einheit + Zielwert, Liter in 0,5-Schritten) und Uhrzeit (`hab_habits.goal_time`, Schritt 10/30 Min je Vorlage).
Abgehakt wird immer mit EINEM Tipp (setzt den vollen Zielwert); der Zähler ist nur das Ziel. Vorlagen-Gewohnheiten
erkennt die App am Namen (`catalogEntryByName`): im Formular sind Kategorie und Ziel-Art dann gesperrt, änderbar
bleiben Liter (Wasser) und die Uhrzeiten. Eigene Gewohnheiten sind frei. Statistik rechnet über `isDueHistoric`
(archivierte/pausierte zählen für ihre aktiven Tage; `stats_hidden` blendet gelöschte aus). Migrationen:
`hab_stats_hidden_migration.sql`, `hab_catalog_migration.sql` (vor dem Ausrollen einspielen, idempotent).

## Übersicht und Archiv

Die Übersicht (`OverviewSection.jsx`) hat unter "Bereiche" drei Kacheln: "Eigene" (`aktiv/gesamt aktiv`, Gesamt = aktiv + pausiert, ohne
Gelöschte; öffnet die Liste), "Statistik" und "Archiv" (Anzahl gelöschter Gewohnheiten, öffnet `#/habits/archiv` = `HabitArchiveView.jsx`).
Das Archiv enthält ALLE gelöschten Gewohnheiten (auch aus Vorlagen); Wiederherstellen und "Aus Statistik entfernen" (`stats_hidden`) gibt es
nur dort. Pausierte stehen in der Liste unter "Pausiert", nicht im Archiv. Die Liste selbst hat keinen Archiv- und keinen Vorlagen-Knopf mehr.
