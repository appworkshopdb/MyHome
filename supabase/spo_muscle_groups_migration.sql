-- Sport: feste Bilder je Einheit — rein additiv, ändert nichts Bestehendes.
--
-- Bisher ließen sich die Muskelbilder eines Plan-Tags nur über den TITEL der
-- Einheit wieder finden (spo_plan_items und spo_workouts kannten keine
-- Muskelgruppen). Damit ging es nicht für eigene Kombinationen und nicht für
-- einzelne Einheiten. Jetzt tragen beide Tabellen die Muskelgruppen selbst:
--
--   spo_plan_items.muscle_groups  Bilder des Plan-Tags
--   spo_workouts.muscle_groups    Bilder der Einheit im Kalender (auch die vom
--                                 Dauerplan angelegten Zeilen kopieren sie)
--
-- Werte sind Schlüssel aus src/modules/sport/lib/data/muscleGroups.js
-- ('brust-ganz', 'beine-ganz', 'bizeps', …). Leer = keine Muskelbilder; die App
-- fällt dann auf die bisherige Auflösung über Einheit, Titel und Typ zurück,
-- bestehende Zeilen brauchen daher KEINEN Nachtrag.
--
-- Staging und main teilen ein Backend, daher nur additiv. Reihenfolge: erst
-- diese Migration, dann die App ausrollen. Ohne die Migration läuft die App
-- weiter (sie schreibt die Spalte dann einfach nicht).
--
-- Idempotent. Einspielen auf dem Server:
--   docker exec -i supabase-db psql -U postgres -d postgres -v ON_ERROR_STOP=1 < supabase/spo_muscle_groups_migration.sql

alter table public.spo_workouts
  add column if not exists muscle_groups text[] not null default '{}';

alter table public.spo_plan_items
  add column if not exists muscle_groups text[] not null default '{}';

notify pgrst, 'reload schema';
