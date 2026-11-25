-- Symbole für Einheiten (Sport): eigene Einheiten können statt Muskelbildern ein
-- Symbol tragen (Schlüssel aus src/modules/sport/lib/sportSymbols.js, z. B. 'kampf').
-- Wie muscle_groups wird das Symbol beim Speichern auf Kalender-Einheiten und
-- Plan-Tage kopiert, damit das Bild fest bleibt.
--
-- Rein additiv (Staging und Produktion teilen ein Backend). Idempotent.
-- Einspielen VOR dem Ausrollen der App (die App läuft aber auch ohne die Spalten:
-- sie schreibt dann ohne icon und löst Symbole aus Name/Typ auf).
--
--   docker exec -i supabase-db psql -U postgres -d postgres < supabase/spo_unit_icon_migration.sql

alter table public.spo_units      add column if not exists icon text;
alter table public.spo_workouts   add column if not exists icon text;
alter table public.spo_plan_items add column if not exists icon text;

-- PostgREST-Schema neu laden, damit die Spalten sofort erreichbar sind
notify pgrst, 'reload schema';

-- Prüfen:
-- select table_name, column_name, data_type from information_schema.columns
--  where table_schema = 'public' and column_name = 'icon' and table_name like 'spo_%' order by 1;
