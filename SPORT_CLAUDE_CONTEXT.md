# Nestua / Sport – Claude Context

> Stand: 23.09.2026 – Branch `staging`
>
> Zweck: Kompakter, aktueller Projektkontext für Claude/weitere Entwickler. Dieses Dokument beschreibt den tatsächlich vorhandenen Stand des Sport-Moduls. Nicht vorhandene Funktionen sind ausdrücklich als offen zu behandeln und nicht zu erfinden.

## 1. Modulstruktur

Das Sport-Modul liegt unter `src/modules/sport/` und wird zentral über `SportModule.jsx` gesteuert.

Aktuelle Hauptbereiche/Screens:

- Übersicht
- Kalender
- Einheiten
- Pläne
- Auswertung
- Gewicht

`SportModule.jsx` lädt beim Modulstart bzw. nach erfolgreichem Speichern über den globalen EntrySheet-FAB einmalig:

- `spo_workouts`
- `spo_units`
- `spo_plans` inklusive `spo_plan_items`
- Body Profile für Sportarten und Gewicht

Detail-Screens werden über `view` und `onNavigateView` geöffnet. `ModuleTopBar` ist die gemeinsame obere Navigation.

Wichtige Datei:
- `src/modules/sport/SportModule.jsx`

## 2. Architekturprinzipien

- Der Sport-Bereich hält Workouts, Einheiten-Bibliothek und Trainingsplan-Vorlagen im Modulzustand.
- Neue Einheiten/Pläne werden über den globalen FAB bzw. die dort angebundenen Sheets/Formulare angelegt.
- `SportModule` lädt nach erfolgreichem Speichern über `EntrySheetContext.version` neu.
- Zwischen Sport und anderen Modulen sollen keine versteckten CSS-Abhängigkeiten entstehen.
- Für gemeinsame App-UI werden vorhandene Core-Komponenten und semantische Design-Tokens verwendet.
- Aktueller Designstand ist verbindlich: **Design System „Kompakte Tiefe“**. Keine Rückkehr zu älteren/abweichenden Designvarianten ohne ausdrückliche Entscheidung.

## 3. Trainingseinheiten / Workouts

### Daten

Workouts liegen in `spo_workouts` und werden über `src/modules/sport/lib/spoData.js` gelesen/geschrieben.

`getWorkouts(session)`:
- nur eigener `owner_id`
- nur nicht gelöschte Zeilen (`deleted_at IS NULL`)
- sortiert nach `occurred_on` absteigend und anschließend `created_at` absteigend
- Standardlimit 500

`saveWorkout(session, workout)` schreibt per Upsert und setzt `owner_id` sowie Default-Status `done`.

`setWorkoutStatus(id, done)`:
- `done` => `status='done'` + `completed_at`
- nicht erledigt => `status='planned'` + `completed_at=null`

`deleteWorkout(id)` arbeitet als Soft Delete über `deleted_at`.

### WorkoutForm

Datei: `src/modules/sport/components/WorkoutForm.jsx`

Eine Einheit wird als Ganzes erfasst; es gibt keinen Satz-für-Satz-Log.

Unterstützte Modi:
- Geplant
- Erledigt
- Ruhetag

Ruhetag wird intern als `status='done'` + `is_rest=true` gespeichert.

Felder für normale Trainings:
- Datum
- Dauer in Minuten (0–1440)
- Status
- Trainingstyp optional
- Bezeichnung
- Notiz optional

Die Auswahl des Trainingstyps gruppiert vordefinierte Trainingstypen nach Kraft/Ausdauer/Beweglichkeit. Eigene Einheiten stehen als erste Gruppe zur Verfügung. Zusätzlich werden nur die im Profil gewählten Sportarten angeboten.

Eigene Einheit aus der Bibliothek wird intern mit `unit:<id>` markiert; beim Auswählen werden Titel und ggf. Dauer übernommen.

### Kalender / Verlauf

Datei: `src/modules/sport/components/VerlaufView.jsx`

Der frühere reine Verlauf ist zum Kalender-Screen geworden.

Es gibt:
- Monatsansicht
- Wochenansicht
- Kalendernavigation
- Auswahl eines Tages
- Tagesdetail
- Training abhaken
- Training bearbeiten/löschen
- Training für einen Tag planen
- Plan auswählen und anwenden

`referenceDate` steuert den sichtbaren Monat bzw. die sichtbare Woche. Beim Wechsel in die Monatsansicht wird der Referenztag auf den 1. des Monats normalisiert.

`selectedDate` startet auf heute.

## 4. Einheiten-Bibliothek

Dateien:
- `src/modules/sport/components/EinheitenView.jsx`
- `src/modules/sport/components/EinheitenListShared.jsx`
- `src/modules/sport/lib/spoData.js`

Eigene wiederverwendbare Trainingseinheiten liegen in `spo_units`.

`spo_units` enthält konzeptionell:
- Titel
- `type_key`
- `duration_min`
- `muscle_groups`
- Owner / Soft Delete

`saveUnit()` speichert diese Werte per Upsert.

Es gibt außerdem vordefinierte Einheiten im Frontend:
- `src/modules/sport/lib/data/predefinedUnits.js`

Vordefinierte Einheiten sind keine DB-Zeilen und stehen allen Nutzern direkt zur Verfügung. Eigene Einheiten kommen aus `spo_units`.

Muskelgruppen-/Körperdarstellungen werden über die vorhandene gemeinsame Vorschau (`MusclePreview`) dargestellt.

## 5. Trainingsarten und Sportarten

Trainingstypen:
- `src/modules/sport/lib/data/trainingTypes.js`

Die Typen haben stabile Keys und werden nicht umbenannt. Sie enthalten u.a. Gruppierung und Trainingsstimulus (`kraft`, `ausdauer`, `mobilitaet`).

Sportarten werden über die Core-Daten (`src/core/lib/sportsData.js`) eingebunden. Sportarten werden in Workouts über `type_key` mit Präfix `sport.` repräsentiert, damit kein zusätzliches Feld in `spo_workouts` benötigt wird.

`src/modules/sport/lib/typeLabel.js` ist die zentrale Stelle zur Auflösung eines `type_key` in ein Label und unterscheidet Trainingstypen und Sportarten.

## 6. Trainingspläne – aktuelles Konzept

Ein Trainingsplan ist eine **mehrtägige Vorlage** und besteht aus mehreren Tagen. Er ist nicht dasselbe wie eine einzelne Einheit.

DB-Konzept:
- `spo_plans` = Plan-Kopf
- `spo_plan_items` = einzelne Tage des Plans

Vorgefertigte statische Planvorschläge liegen dagegen in:
- `src/modules/sport/lib/data/plans.js`

Sie sind nicht als globale DB-Zeilen in `spo_plans` gedacht. Wird ein Vorschlag übernommen/angepasst, entsteht ein eigener Plan.

### PlanEditor

Datei: `src/modules/sport/components/PlanEditor.jsx`

Beim Bearbeiten eines bestehenden Plans werden die vorhandenen Tage aus `initialPlan.items` in den Editor übernommen.

Wichtig:
- Bereits angelegte Einheiten müssen beim Öffnen des Editors **vorausgewählt** erscheinen.
- Dafür existiert `_selectedUnitKey`.
- Persönliche Einheiten verwenden ihre DB-ID.
- Vordefinierte Einheiten verwenden ihren `pre.*` Key.
- Die Auswahl wird über `selectedUnitKey()` aufgelöst.

Der Planeditor enthält:
- Planname
- optionale Notiz
- Tage
- Speichern/Abbrechen

### PlanDaysEditor

Datei: `src/modules/sport/components/PlanDaysEditor.jsx`

Jeder Tag ist entweder:
- Trainingstag mit ausgewählter Einheit
- Ruhetag

Pro Tag gibt es:
- Tag-Nummer
- Hoch-/Runter-Sortierung
- Löschen
- Auswahl einer Einheit

Buttons:
- `+ Trainingstag`
- `+ Ruhetag`

Die Dauer-Eingabe wurde aus der sichtbaren Plan-Bearbeitungsansicht entfernt, weil sie dort nicht benötigt wird. Die bestehende Dauer kann intern weiterhin aus der Einheit übernommen/gespeichert werden.

## 7. Planübersicht – aktueller UI-Stand

Datei: `src/modules/sport/components/PlaeneView.jsx`

Die eigenen Pläne werden als Karten dargestellt.

Aktuelles Muster:

```text
Name
7 Tage - 5 Einheiten

Mo.   Di.   Mi.   Do.   Fr.
Bild  Bild  Bild  Bild  Bild

Eintragen   Bearbeiten   X
```

Die Trainingseinheiten werden:
- nicht mehr als lange Liste „Tag X – Name“ angezeigt
- nebeneinander dargestellt
- nach `day_index` sortiert
- mit Kürzeln `Mo.`, `Di.`, `Mi.`, `Do.`, `Fr.`, `Sa.`, `So.` beschriftet
- nur für Trainingstage angezeigt
- Ruhetage werden in dieser kompakten Bildzeile bewusst weggelassen, weil es dafür keine Muskelbilder gibt

Die Darstellung nutzt `MusclePreview` aus `EinheitenListShared` und löst die Muskelgruppen in dieser Reihenfolge auf:
1. `item.muscle_groups`, falls vorhanden
2. zugehörige persönliche Einheit über `unit_id`
3. vordefinierte Einheit anhand des Titels

Wichtig: `spo_plan_items` besitzt **keine** `muscle_groups`-Spalte. Deshalb darf `muscle_groups` nicht beim DB-Insert in `spo_plan_items` geschrieben werden.

## 8. Plan-Speicherung – wichtiger aktueller Stand

Datei: `src/modules/sport/lib/spoData.js`

`savePlan()`:
1. lädt bei bestehendem Plan die vorhandenen aktiven `spo_plan_items`
2. upsertet den Plan-Kopf (`spo_plans`)
3. vergleicht vorhandene und neue Items
4. wenn nur Name/Notiz geändert wurden, werden die Plan-Tage **nicht** angefasst
5. wenn sich die Tage ändern, werden bestehende Items gelöscht und anschließend neu angelegt

Der Vergleich berücksichtigt:
- `day_index`
- `unit_id`
- `title`
- `type_key`
- `duration_min`
- `is_rest`
- `notes`

Der frühere Fehler mit `muscle_groups` wurde behoben. Nicht wieder einführen.

## 9. Plan anwenden

`applyPlan(session, plan, startDate)` in `spoData.js`:
- nimmt den gewählten Starttag
- verschiebt jeden Plan-Tag um dessen `day_index`
- erzeugt daraus `spo_workouts`
- Trainingstage erhalten `status='planned'`
- Ruhetage werden mit `is_rest=true` und `status='done'` angelegt
- `plan_id` und `plan_day_index` werden am Workout gespeichert

Die Anzahl der erzeugten Einträge wird zurückgegeben.

## 10. Planvorschläge

Datei: `PlanSuggestions` (von `PlaeneView` eingebunden).

Vorgefertigte Vorschläge werden statisch über `src/modules/sport/lib/data/plans.js` beschrieben. Die Matching-/Auswahllogik liegt in `src/modules/sport/lib/matching.js`.

Vorschläge können aus dem Pläne-Bereich gestartet werden. Das Formular lebt technisch im Kalender-Screen; `SportModule.openForm()` navigiert deshalb beim Start eines Vorschlags zum Kalenderformular.

## 11. Auswertung / Statistik

Dateien u.a.:
- `src/modules/sport/components/AuswertungView.jsx`
- `src/modules/sport/lib/stats.js`
- `src/modules/sport/components/ActivityHeatmap.jsx`
- `src/modules/sport/components/BadgesCard.jsx`

Es gibt bereits Auswertungs-/Aktivitätslogik und Badges. `stats.js` enthält die vorhandenen Statistik-Helfer. Die Heatmap visualisiert Aktivität.

Bei zukünftigen Erweiterungen vorhandene Statistik-Helfer wiederverwenden statt parallele Berechnungen einzuführen.

## 12. Gewicht

`WeightTimeline.jsx` ist der Gewichtsbereich im Sport-Modul. Das Gewicht stammt aus dem Body-Profile-Kontext; `SportModule` lädt das Profil ohnehin für die Sportarten und verwendet das Gewicht auch für die Sportübersicht.

## 13. Badges / Feedback

`src/modules/sport/lib/badges.js` enthält Badge-Logik.

`SportModule` nutzt `feedback` (`fb`) für relevante Ereignisse, z.B. abgeschlossenes Workout, Ruhetag und Fehler.

## 14. Navigation / Zustände

`SportModule` hält drei wichtige Unterzustände:
- `formInitial` – Workout-Formular
- `editingPlan` – Plan-Editor
- `applyingPlan` – Plan-Anwenden-Dialog

`handleBack()` schließt zuerst einen offenen Unterzustand und verlässt erst danach den jeweiligen Detailbereich. Beim Verlassen werden Unterzustände zurückgesetzt.

Das verhindert, dass ein späterer Aufruf von „Pläne“ versehentlich einen alten Editor wieder öffnet.

## 15. Aktuelle UX-Entscheidungen aus den letzten Umbauten

Diese Punkte sind als aktueller Stand zu erhalten:

### Pläne
- Trainingseinheiten in der Planübersicht als kleine runde Muskelbilder nebeneinander
- Reihenfolge nach Plan-Tagen
- Tageskürzel oberhalb des jeweiligen Bildes
- Ruhetage in dieser Bildreihe auslassen
- Buttons „Eintragen“, „Bearbeiten“, „X“ beibehalten
- Bearbeiten eines bestehenden Plans zeigt die tatsächlich gespeicherten Einheiten wieder vorausgewählt
- keine Dauer-Eingabe im Planeditor

### Design
- aktuelles Design-System ist „Kompakte Tiefe"
- semantische Tokens statt eigener hart codierter Farben
- Raised-Flächen/Karten mit bestehenden Radius- und Schatten-Tokens
- Touch-Ziele mindestens ca. 44px
- bestehende Core-UI nicht durch modulfremde CSS-Abhängigkeiten ersetzen

## 16. Bekannte technische Stolpersteine

1. **`spo_plan_items.muscle_groups` existiert nicht.** Muskelgruppen kommen aus der Einheit bzw. aus den vordefinierten Daten.
2. Plan-Name/Notiz-Änderungen sollen nicht unnötig Plan-Items löschen und neu anlegen.
3. `unit_id` kann bei vordefinierten Einheiten `null` sein; deren Auswahl wird über `_selectedUnitKey` bzw. `pre.*` identifiziert.
4. Ein Ruhetag ist ein eigener Plan-Tag, aber in der kompakten Planübersicht wird dafür kein Bild gerendert.
5. Trainingstypen und Sportarten teilen sich `spo_workouts.type_key`; Sportarten verwenden `sport.<key>`.
6. Beim Ändern der Sport-Navigation keine alten Scroll-/Anchor-Lösungen wieder einführen: „Starten“ aus einem Plan navigiert direkt zum Kalenderformular.
7. Nach erfolgreichem globalem FAB-Speichern wird der Sport-Modulzustand über `EntrySheetContext.version` neu geladen.

## 17. Relevante Dateien – Schnellübersicht

```text
src/modules/sport/
├── SportModule.jsx
├── components/
│   ├── OverviewSection.jsx
│   ├── VerlaufView.jsx
│   ├── WorkoutCalendar.jsx
│   ├── WorkoutWeekView.jsx
│   ├── WorkoutForm.jsx
│   ├── DayDetail.jsx
│   ├── CalendarHeader.jsx
│   ├── CalendarLegend.jsx
│   ├── EinheitenView.jsx
│   ├── EinheitenListShared.jsx
│   ├── PlaeneView.jsx
│   ├── PlanEditor.jsx
│   ├── PlanDaysEditor.jsx
│   ├── PlanSuggestions.jsx
│   ├── PlanPicker.jsx
│   ├── ApplyPlanDialog.jsx
│   ├── AuswertungView.jsx
│   ├── ActivityHeatmap.jsx
│   ├── BadgesCard.jsx
│   └── WeightTimeline.jsx
└── lib/
    ├── spoData.js
    ├── stats.js
    ├── badges.js
    ├── matching.js
    ├── typeLabel.js
    ├── requiredFields.js
    ├── dateRange.js
    ├── dayVisualState.js
    └── data/
        ├── exercises.js
        ├── muscleGroups.js
        ├── plans.js
        ├── predefinedUnits.js
        └── trainingTypes.js
```

## 18. Entwicklungsregel für Claude

Vor Änderungen am Sport-Modul immer zuerst den aktuellen Stand auf `staging` prüfen. Bestehende Datenmodell-Entscheidungen und UX-Entscheidungen aus diesem Dokument nicht ohne Grund zurückbauen.

Bei Änderungen an Plänen insbesondere zuerst `PlanEditor.jsx`, `PlanDaysEditor.jsx`, `PlaeneView.jsx` und `spoData.js` gemeinsam betrachten.

Bei Änderungen an Workout-/Kalenderlogik mindestens `SportModule.jsx`, `VerlaufView.jsx`, `WorkoutForm.jsx` und `spoData.js` gemeinsam betrachten.

Neue Funktionen sollen sich in die bestehende Core-Architektur und den aktuellen Designstand „Kompakte Tiefe“ einfügen.
