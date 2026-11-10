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

### Plan-Tage und Einheiten-Auswahl (Editor und Wizard)

Die Tage eines Plans bearbeitet `PlanDaysBoard.jsx` (Kachelraster + Detailfeld), gemeinsam für den Plan-Editor (`PlanEditor.jsx`) und den Plan-Wizard (`core/components/SportQuickSheet.jsx`: p1 Name, p2 Trainingstage, `p2pick` Einheit wählen, p3 Prüfen). Die Länge eines Plans wird nicht vorab festgelegt, sie ergibt sich aus den Tagen (neuer Plan startet mit einem leeren Tag, „+ Tag“ hängt einen an). Ein Tag ist ein Ruhetag oder eine Einheit; „Einheit wählen/ändern“ öffnet die Galerie `UnitPicker.jsx` (im Wizard als eigener Screen, im Editor als Sheet): Suche (umlautunabhängig, über alle Kategorien), Reiter Kraft · Ausdauer · Beweglichkeit · Sport · Eigene, bei Kraft die Unterkategorien Splits · Muskeln · Kombinationen, darunter die Einheiten als Karten mit ihren Bildern; ein Tipp wählt, „Auswählen“ übernimmt. Die ehemalige `PlanDaysEditor.jsx` (Zeilenliste mit ↑ ↓ ×, native Auswahlbox) gibt es nicht mehr.

Der Katalog (`lib/unitCatalog.js`, `buildCatalog`) vereint vier Quellen: die vordefinierten Einheiten (`data/predefinedUnits.js`: 6 Splits, 5 Einzelmuskeln, 12 Kombinationen, 8 Ausdauer, 4 Beweglichkeit/Erholung, alle mit Typ), die im Profil gewählten Sportarten (`sport.<key>`, `core/lib/sportsData.js`), die eigenen Einheiten (`spo_units`) und damit zusammen die Kategorien split/muskel/kombi/aus/beweg/sport/eigen. Ausdauer, Beweglichkeit und Sportarten haben noch keine Muskelbilder: `icon` (Emoji) ist ein Platzhalter bis zu festen Bildern je Einheit (`UnitVisual.jsx`, `resolvePlanIcon`). Plan-Tage speichern `unit_id` (nur eigene Einheiten), `title`, `type_key` und die Muskelgruppen (s. §7). Titel vordefinierter Einheiten trotzdem nie ändern: ältere Zeilen finden Bild und Icon als Rückfall noch über den Titel. Hilfsfunktionen für die Tage: `lib/planDays.js`.

## 7. Planübersicht und Plan-Editor – aktueller UI-Stand

Datei: `src/modules/sport/components/PlaeneView.jsx` (+ `PlanSheets.jsx`, `PlanEditor.jsx`, `RestBadge.jsx`, `lib/planMuscles.js`).

**Muskelbilder gibt es nur an drei Stellen:** in der Karte oben (nur für die Einheit des Tages, bis zu 3 Muskeln + „+N“ über `MusclePreview`; an einem Ruhetag das gezeichnete Ruhetag-Symbol `RestBadge`, Zzz), in den aufgeklappten Plänen („Deine Pläne“, rechts je Tageszeile) und im Plan-Editor. Die Zeile „Vorschläge für dich“ und die zugeklappten Pläne zeigen keine Bilder.

Die Karte oben hat drei Stufen (`PlaeneView.jsx`):
1. **Kein Plan ausgewählt** (`PlanEmpty`, gestrichelt): „Plan auswählen“ öffnet `PickPlanSheet` (Pläne als Auswahl, „Neuen Plan anlegen“, „Weiter“), danach `ActivatePlanSheet` (Start Heute/Montag/Datum). „Neuer Plan“ öffnet den Editor (`onEditPlan({})`). Ohne Pläne nur „Neuer Plan“. Ein Plan ist freiwillig.
2. **Plan ausstehend** (`spo_active_plan.start_date` in der Zukunft) und
3. **Plan aktiv**: dieselbe Heute-Karte (`PlanHero`, Klassen `.pl-hero*`), gleicher Aufbau: „Aktiver Plan“ bzw. Plakette „Noch nicht aktiv“ | „Tag x von N“, Einheit mit Bildern, Fortschritt (Segmente, ab 11 Tagen ein Balken), die nächsten zwei Tage als Text, zwei Statuszeilen („Plan · seit dd.mm.“ / „bis auf weiteres“ bzw. „Plan · startet Mo 09.11.“ / „in 5 Tagen · bis auf weiteres“), Bearbeiten/Beenden. Ausstehend zeigt Tag 1 und die zwei danach, die Segmente sind leer. Gezeigt wird die Einheit des PLANS, nicht der Kalenderzeile (ein eigener Eintrag ändert die Karte nicht).

**Deine Pläne** (`PlanRow`, `<details>`): nur Pläne, die nicht oben stehen. Zugeklappt: Name, „7 Tage · 5 Einheiten · 2 Ruhetage“, Ablaufzeile als Text. Aufgeklappt: Zeitleiste (Klassen `.pl-tl*`): Tagesnummer als Punkt (Training gefüllt, Ruhetag hohl gestrichelt), Titel + Muskeln als Text, rechts die Bilder bzw. das Ruhetag-Symbol, darunter Aktivieren / Bearbeiten / „⋯“ (öffnet „Plan löschen?“, gelöscht wird nicht mehr direkt). **Vorschläge für dich** (`PlanSuggestions`) unverändert.

Der Tag im Plan heißt „Tag 1 … Tag N“, Pläne sind nicht an Wochentage gebunden (früher stand „Mo., Di.“ über den Bildern).

**Plan-Editor** (`PlanEditor.jsx`, Klassen `.pe-*`): Name (Notiz hinter „+ Notiz hinzufügen“), darunter der Plan als Kachelraster (4 Spalten, je Tag Bilder der Muskeln, Ruhetage gestreift, „+ Tag“-Kachel). Ein Tipp wählt den Tag; das Feld darunter bearbeitet ihn: Einheit (Name einmal, Typ nur wenn er sich unterscheidet), Schalter „Ruhetag“, „← Früher“ / „Später →“, Entfernen (mindestens ein Tag bleibt). Bei einem aktiven Plan steht oben „Aktiv · Änderungen gelten ab heute“, das Speichern fragt dann über `EditPlanConfirmSheet` nach. `onSave(plan, items)` ist unverändert. Die Muskelgruppen eines Tages löst `resolvePlanMuscleGroups` auf (Reihenfolge s. u.); Die Einheit wählt man in der Galerie `UnitPicker` (s. o.).

**Feste Bilder je Einheit:** `spo_plan_items.muscle_groups` und `spo_workouts.muscle_groups` (Migration `supabase/spo_muscle_groups_migration.sql`, `text[]`, Schlüssel aus `muscleGroups.js`) tragen die Muskelgruppen selbst. Gesetzt werden sie beim Speichern: Plan-Tage aus der gewählten Einheit (`itemsFromDays`), Kalender-Einheiten aus dem Trainingstyp (`spoData.saveWorkout` → `muscleGroupsForType`) oder ausdrücklich (gewählte eigene Einheit im `WorkoutForm`, Dauerplan-Zeilen kopieren sie vom Plan-Tag, `buildPlanRows`). Ruhetage haben keine. Fehlt die Spalte noch (Migration nicht eingespielt) oder ist sie leer (ältere Zeilen), löst `planMuscles.js` weiter auf, in dieser Reihenfolge: 1. `row.muscle_groups`, 2. persönliche Einheit über `unit_id`, 3. vordefinierte Einheit über den Titel, 4. vordefinierte Einheit über den Typ (jeder Typ gehört zu genau einer). Ohne Muskeln steht das Platzhalter-Symbol (`resolvePlanIcon`, über Titel/Typ, Sportarten 🏅). `spoData.saveWorkout`/`savePlan` und `sportPlanSync` wiederholen den Schreibvorgang ohne die Spalte, wenn sie fehlt (Fehler 42703/PGRST204). Angezeigt werden die Bilder in Heute-Karte und Plan-Liste (Pläne), Editor, Wizard, Galerie, im Tagesdetail (rechts je Einheit) und in der Fokuskarte der Sport-Übersicht (`UnitVisual`, `resolveUnitVisual`). Das Rot in den Muskelbildern ist in die Bilddateien eingebrannt.

**Eigene Einheiten** entstehen in der Galerie über die Muskel-Mehrfachwahl (s. u.) und lassen sich unter „Eigene Einheiten verwalten“ bearbeiten (`OwnUnitForm`, Muskelwahl `MusclePicker.jsx`; Name folgt der Auswahl „Brust + Beine“, bis man ihn ändert; `spoData.createOwnUnit`/`saveUnit` legen eine `spo_units`-Zeile an).

**Einzelne Einheit eintragen (ohne Plan):** Plus-Knopf „Neue Einheit“ (`core/components/SportQuickSheet.jsx`) und Kalender-Formular (`WorkoutForm.jsx`) nutzen dieselbe Galerie wie der Plan-Wizard: Der FAB-Wizard „Neue Einheit“ ist EINE Seite (Einheit, Name, Datum, „Mehr Details“ = Status, „Speichern“; keine Prüfen-Seite mehr): Feld „Einheit wählen“ (`UnitSelectCard`) → `UnitPicker` (Screen `e1pick`, ohne Schrittleiste), die alte Typ-Liste (Kraft/Ausdauer/Beweglichkeit) und „Aus Vorlage übernehmen“ gibt es nicht mehr, eigene Einheiten stehen in der Galerie. Die gewählte Galerie-Einheit liefert Typ (`type_key`, bei eigenen „sonstiges“), Namen und `muscle_groups` (werden mit gespeichert → feste Bilder im Kalender). „Eigene Einheiten verwalten“ ist eine Liste mit Bildern (`.ep-row`), Bearbeiten/Neu über `OwnUnitForm`; `saveUnit` behält beim Bearbeiten `type_key`/`duration_min` und überschreibt `muscle_groups` nur bei ausdrücklicher Angabe.

**Muskeln in der Galerie:** `UnitPicker` Kraft › Muskeln zeigt ALLE Muskeln direkt als Mehrfachauswahl (Haken): oben die 6 Muskelgruppen (`MUSCLE_GROUPS`), darunter die 24 Einzelmuskeln vorne/hinten (`muscleSinglesByRegion`). Die Auswahl ergibt eine Kombination („Brust + Bizeps“, Name aus `muscleLabel`, Vorschau über dem Knopf). „Auswählen“ nimmt eine vorhandene Einheit mit exakt denselben Muskeln (kein Duplikat), sonst legt `onCreateOwn` eine eigene Einheit an (steht danach unter „Eigene“). Gilt überall, wo die Galerie benutzt wird (FAB-Wizard, Kalender-Formular, Plan-Wizard/-Editor). „Eigene Einheit zusammenstellen“ gibt es in der Galerie nicht mehr; das Muskelformular (`OwnUnitForm`/`MusclePicker`) bleibt nur in „Eigene Einheiten verwalten“ (Bearbeiten, Löschen, Neu).

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

`muscle_groups` wird nur geschrieben, wenn die Spalte existiert (siehe §7, Wiederholung ohne Spalte); der frühere Absturz ohne Spalte darf nicht zurückkommen.

## 9. Aktiver Plan (Dauerplan)

Ein Plan wird im Bereich „Pläne“ **aktiviert** (Start: heute, nächster Montag oder Datum) und füllt den Kalender danach selbst auf, bis er gewechselt, geändert oder beendet wird. Ein Plan ist freiwillig. Das frühere „Eintragen“ (`applyPlan`) und „+ Trainingsplan“ im Tagesdetail gibt es nicht mehr.

Logik in `core/lib/sportPlanSync.js` (core, weil der Hub sie vor seiner Heute-Abfrage aufruft):
- Tabelle `spo_active_plan` (eine Zeile pro Person: `plan_id`, `start_date` = Tag 1 des Zyklus), Spalte `spo_workouts.auto_planned` — Migration `supabase/spo_active_plan_migration.sql`. Ohne Migration bleibt alles still (`getActivePlan()` → null).
- Der Plan-Tag ergibt sich aus `(Datum − start_date) mod Anzahl Tage`. Pläne haben beliebig viele Tage und sind nicht an Wochentage gebunden.
- `syncActivePlan(session)` legt 28 Tage im Voraus echte `spo_workouts`-Zeilen an (`auto_planned = true`, `plan_id`, `plan_day_index`, Ruhetage wie früher `is_rest` + `status='done'`), nie rückwirkend. Aufruf in `SportModule.load()` und `Hub.loadTodaySport()`. Die Zeilen bleiben echt, damit Hub, Überblicke, Auswertung und Push unverändert rechnen.
- **Eigene Einträge haben Vorrang:** `spoData.saveWorkout` blendet die Plan-Zeile desselben Tages per `deleted_at` aus; wer den eigenen Eintrag löscht, bekommt die Plan-Einheit beim nächsten Laden zurück. Bearbeiten einer Plan-Zeile setzt `auto_planned = false`. Plan-Zeilen haben im Tagesdetail kein Löschen (auslassen = „+ Ruhetag“).
- Wechseln/Ändern/Beenden gelten ab heute: nur unberührte, offene Plan-Zeilen ab heute werden ersetzt (`clearFutureAutoRows`), Erledigtes, Eigenes und Vergangenes bleibt. Beim Ändern bleibt `start_date`, der Plan läuft an derselben Stelle im Zyklus weiter (`savePlan` liefert dafür `_itemsChanged`).
- Teil-Index `spo_workouts_auto_day_uidx` verhindert Doppelte bei zwei Geräten; der Auffüller ignoriert 23505.

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

`SportModule` hält zwei wichtige Unterzustände:
- `formInitial` – Workout-Formular
- `editingPlan` – Plan-Editor
(Aktivieren/Beenden/Änderung bestätigen sind Bottom-Sheets in `PlaeneView`/`PlanSheets.jsx`.)

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

1. **`muscle_groups` gibt es in `spo_plan_items`/`spo_workouts` erst nach `spo_muscle_groups_migration.sql`.** Code muss ohne die Spalte weiterlaufen (Wiederholung ohne Spalte, Auflösung als Rückfall).
2. Plan-Name/Notiz-Änderungen sollen nicht unnötig Plan-Items löschen und neu anlegen.
3. `unit_id` kann bei vordefinierten Einheiten `null` sein; deren Auswahl wird über `_selectedUnitKey` bzw. `pre.*` identifiziert.
4. Ein Ruhetag ist ein eigener Plan-Tag und zeigt das Ruhetag-Symbol (`RestBadge`), nie Muskelbilder.
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
│   ├── PlanDaysBoard.jsx
│   ├── UnitPicker.jsx
│   ├── UnitVisual.jsx
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

Bei Änderungen an Plänen insbesondere zuerst `PlanEditor.jsx`, `PlanDaysBoard.jsx`, `PlaeneView.jsx` und `spoData.js` gemeinsam betrachten.

Bei Änderungen an Workout-/Kalenderlogik mindestens `SportModule.jsx`, `VerlaufView.jsx`, `WorkoutForm.jsx` und `spoData.js` gemeinsam betrachten.

Neue Funktionen sollen sich in die bestehende Core-Architektur und den aktuellen Designstand „Kompakte Tiefe“ einfügen.
