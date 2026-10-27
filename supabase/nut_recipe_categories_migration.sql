-- Rezept-Typen: sieben alte Kategorien → vier Mahlzeit-Typen (ändert Daten!).
--
--   frueh      → fruehstueck   (Frühstück)
--   haupt      → mittag        (Hauptgerichte → Mittag)
--   suppen     → abend         (Suppen → Abend)
--   desserts   → snack
--   snacks     → snack
--   backen     → snack
--   getraenke  → snack
--
-- Die App übersetzt alte Werte beim Lesen ohnehin (normalizeRecipeCategory in
-- lib/nutrition.js) — diese Migration ist dafür da, dass die Datenbank die neuen
-- Werte tatsächlich enthält und neue/bearbeitete Rezepte gespeichert werden
-- können, auch wenn nut_recipes.category dort noch durch eine CHECK-Regel oder
-- einen Enum-Typ auf die alten Werte festgelegt ist. Der Zustand der echten
-- Datenbank war beim Schreiben unbekannt (schema.sql enthält nut_recipes nicht),
-- deshalb erkennt der DO-Block beides selbst:
--   - CHECK-Regeln auf category werden entfernt,
--   - ein Enum-Typ wird in text umgewandelt.
-- Läuft in einer Transaktion je Block; bei einem Fehler bleibt der Block wirkungslos.
--
-- Vorher wird eine gesperrte Sicherungskopie angelegt (nut_recipes_backup_20261009,
-- RLS an, keine Rechte für App-Nutzer). Wieder herstellen, falls nötig:
--   update public.nut_recipes r set category = b.category
--   from public.nut_recipes_backup_20261009 b where b.id = r.id;
--
-- Idempotent (bereits neue Werte bleiben unverändert). Einspielen:
--   docker exec -i supabase-db psql -U postgres -d postgres -v ON_ERROR_STOP=1 < supabase/nut_recipe_categories_migration.sql

\echo '--- Vorher: Rezepte je Kategorie'
select category, count(*) as anzahl from public.nut_recipes group by 1 order by 1;

create table if not exists public.nut_recipes_backup_20261009 as
  select * from public.nut_recipes;
alter table public.nut_recipes_backup_20261009 enable row level security;
revoke all on public.nut_recipes_backup_20261009 from anon, authenticated;

do $$
declare
  c record;
  col_type text;
begin
  select data_type into col_type
  from information_schema.columns
  where table_schema = 'public' and table_name = 'nut_recipes' and column_name = 'category';

  if col_type is null then
    raise exception 'Spalte nut_recipes.category nicht gefunden';
  end if;

  -- CHECK-Regeln, die category einschränken
  for c in
    select conname
    from pg_constraint
    where conrelid = 'public.nut_recipes'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%category%'
  loop
    execute format('alter table public.nut_recipes drop constraint %I', c.conname);
    raise notice 'CHECK-Regel entfernt: %', c.conname;
  end loop;

  -- Enum-Typ → text
  if col_type = 'USER-DEFINED' then
    alter table public.nut_recipes alter column category drop default;
    alter table public.nut_recipes alter column category type text using category::text;
    alter table public.nut_recipes alter column category set default 'mittag';
    raise notice 'Spalte category von Enum auf text umgestellt';
  end if;
end $$;

update public.nut_recipes
set category = case category
  when 'frueh'     then 'fruehstueck'
  when 'haupt'     then 'mittag'
  when 'suppen'    then 'abend'
  when 'desserts'  then 'snack'
  when 'snacks'    then 'snack'
  when 'backen'    then 'snack'
  when 'getraenke' then 'snack'
  else category
end
where category in ('frueh', 'haupt', 'suppen', 'desserts', 'snacks', 'backen', 'getraenke');

\echo '--- Nachher: Rezepte je Kategorie'
select category, count(*) as anzahl from public.nut_recipes group by 1 order by 1;

notify pgrst, 'reload schema';
