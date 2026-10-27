-- Gewohnheiten: beim Löschen wählen, ob die Werte in der Statistik bleiben.
--
-- stats_hidden = true  → gelöschte Gewohnheit zählt in keiner Statistik mehr
-- stats_hidden = false → (Default) gelöschte Gewohnheit bleibt für die Tage in
--                        den Statistiken, an denen sie aktiv war
--
-- Gilt nur zusammen mit deleted_at: bei aktiven Gewohnheiten ohne Wirkung.
-- Idempotent: kann mehrfach ausgeführt werden.
--
-- Vor dem Ausführen live prüfen (Studio kann auf eine andere DB zeigen):
--   docker exec -it supabase-db psql -U postgres -d postgres -c "\d public.hab_habits"

alter table public.hab_habits
  add column if not exists stats_hidden boolean not null default false;

-- Optional, einmalig: bereits gelöschte Test-Gewohnheiten aus der Statistik nehmen
-- (Namen vorher prüfen):
--   update public.hab_habits set stats_hidden = true
--    where deleted_at is not null and name ilike 'test%';
