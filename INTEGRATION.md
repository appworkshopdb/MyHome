# Integration — Gewohnheiten-Modul einbinden

Drei Schritte, dann ist das Modul live.

---

## Schritt 1: Supabase-Migration ausführen

Im **Supabase SQL-Editor** die Datei ausführen:

```
supabase/migrations/003_habits.sql
```

Danach prüfen ob die Tabellen `hab_habits` und `hab_entries` angelegt wurden.

---

## Schritt 2: `core/modules.js` — `built: true` setzen

Suche in `core/modules.js` den Eintrag für "Gewohnheiten" (bzw. "habits")
und setze `built: true`:

```js
// Vorher (StubModule-Testphase):
{ id: 'habits', name: 'Gewohnheiten', built: false, color: '...' }

// Nachher:
{ id: 'habits', name: 'Gewohnheiten', built: true, color: '...' }
```

---

## Schritt 3: `src/App.jsx` — Modul eintragen

In `App.jsx` gibt es einen Block namens `MODULE_COMPONENTS` (ein Objekt
oder switch-case). Dort HabitsModule importieren und eintragen:

### Import oben hinzufügen:

```js
import HabitsModule from './modules/habits/HabitsModule.jsx';
```

### In MODULE_COMPONENTS eintragen:

```js
const MODULE_COMPONENTS = {
  finance:   FinanceModule,
  nutrition: NutritionModule,
  sport:     SportModule,
  // NEU:
  habits:    HabitsModule,
  // ...
};
```

> Das genaue Muster kannst du aus einem der anderen Module (z.B. SportModule)
> ablesen — HabitsModule folgt exakt demselben Interface:
> Props `view` und `onNavigateView` (kommt von useRoute()).

---

## Dateistruktur (neue Dateien)

```
src/
  modules/
    habits/
      HabitsModule.jsx          ← Modul-Einstiegspunkt
      habits.css                ← Modul-CSS
      components/
        TodayView.jsx           ← Heute-Ansicht (Check-ins)
        HabitsView.jsx          ← Verwaltung (Erstellen/Bearbeiten)
        CalendarView.jsx        ← Verlauf & Heatmap
        StatsView.jsx           ← Auswertung & Badges
      lib/
        habData.js              ← Supabase-Datenschicht
        habUtils.js             ← Berechnungen (Streaks, Badges, Heatmap)

supabase/
  migrations/
    003_habits.sql              ← DB-Migration (Tabellen, RLS, Trigger)
```

---

## Bekannte Abhängigkeiten zu core/

Das Modul nutzt folgende bestehende core-Komponenten — diese müssen
nicht verändert werden, sie existieren bereits:

- `core/components/ModuleTopBar.jsx`
- `core/components/ModuleTabs.jsx`
- `core/components/GoalsSection.jsx`
- `core/lib/supabaseClient.js` (inkl. `getSupabase()`)

---

## Measurements-Trigger — Hinweis

Der DB-Trigger in `003_habits.sql` schreibt bei jedem Check-in einen
`hab.checkin`-Eintrag in die `measurements`-Tabelle. Das sorgt dafür,
dass der Hub automatisch Aktivität aus dem Habits-Modul anzeigt,
sobald Daten vorhanden sind — ohne dass der Hub-Code angefasst werden muss.

Falls die `measurements`-Tabelle noch keinen `UNIQUE`-Constraint auf
`(source_module, source_ref_id)` hat: einfach den `ON CONFLICT`-Teil
aus dem Trigger entfernen (dann wird statt UPDATE immer ein neuer
INSERT gemacht — funktioniert, erzeugt aber Duplikate beim Bearbeiten).
Sicherheitshalber prüfen, wie die anderen Module (Finanzen, Sport)
ihren Trigger geschrieben haben — das Muster ist identisch.
