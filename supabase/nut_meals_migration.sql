-- Mahlzeiten (Verlauf): Tabelle nut_meals — rein additiv, ändert nichts Bestehendes.
--
-- Jede Zeile ist eine MOMENTAUFNAHME einer gegessenen Mahlzeit: Die Nährwerte
-- werden beim Speichern kopiert (nicht aus Rezept/Lebensmittel nachgeschlagen),
-- damit sich der Verlauf nicht ändert, wenn später ein Rezept bearbeitet oder
-- gelöscht wird. Entsprechend kein Fremdschlüssel auf nut_recipes (recipe_id ist
-- nur ein Hinweis).
--
-- Quellen: 'scan' (Foto-Schätzung, is_estimate = true, kcal_low/kcal_high als
-- Spanne) und 'recipe' (eigenes Rezept × Portionen, exakt).
-- Das Foto selbst wird nie gespeichert.
--
-- Nur für die eigene Person sichtbar (RLS auf owner_id) — kein Teilen im
-- Haushalt, anders als Rezepte/Lebensmittel. Löschen ist ein Soft Delete
-- (deleted_at); das Konto zu löschen entfernt alle Zeilen (on delete cascade).
--
-- eaten_on = lokales Kalenderdatum 'YYYY-MM-DD' (von der App aus lokalen
-- Komponenten gebaut, nie aus toISOString — siehe CLAUDE.md).
--
-- Idempotent. Einspielen auf dem Server:
--   docker exec -i supabase-db psql -U postgres -d postgres -v ON_ERROR_STOP=1 < supabase/nut_meals_migration.sql

create table if not exists public.nut_meals (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null references auth.users (id) on delete cascade,
  eaten_on    date not null,
  meal_type   text not null check (meal_type in ('fruehstueck', 'mittag', 'abend', 'snack')),
  name        text not null,
  source      text not null check (source in ('scan', 'recipe')),
  recipe_id   uuid,
  servings    numeric,
  is_estimate boolean not null default false,
  kcal        numeric not null default 0,
  protein     numeric not null default 0,
  carbs       numeric not null default 0,
  sugar       numeric not null default 0,
  fat         numeric not null default 0,
  satfat      numeric not null default 0,
  fiber       numeric not null default 0,
  salt        numeric not null default 0,
  kcal_low    numeric,
  kcal_high   numeric,
  items       jsonb not null default '[]'::jsonb,
  note        text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  deleted_at  timestamptz
);

create index if not exists idx_nut_meals_owner_day
  on public.nut_meals (owner_id, eaten_on)
  where deleted_at is null;

alter table public.nut_meals enable row level security;

drop policy if exists "eigene Mahlzeiten" on public.nut_meals;
create policy "eigene Mahlzeiten" on public.nut_meals
  for all to authenticated
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

grant select, insert, update, delete on public.nut_meals to authenticated;

-- PostgREST soll die neue Tabelle sofort kennen
notify pgrst, 'reload schema';
