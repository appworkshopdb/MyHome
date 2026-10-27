-- Rezeptbilder: vorgefertigte Motive statt Fotos
--
-- nut_recipes.cover speichert nur einen kurzen Text:
--   'suppe'       Motiv "suppe" mit Standardfarbe
--   'suppe:blau'  Motiv "suppe" auf blauem Grund
--   NULL          automatisch (App wählt über Rezeptname / Mahlzeit-Typ)
-- Die Motivliste steht im Frontend (modules/nutrition/lib/recipeCovers.jsx);
-- unbekannte Werte fallen dort still auf "automatisch" zurück, daher kein
-- CHECK-Constraint in der Datenbank.
--
-- Ausführen, BEVOR die App mit dem Rezeptbild-Stand ausgeliefert wird
-- (sonst scheitert das Speichern von Rezepten an der fehlenden Spalte):
--   docker exec -i supabase-db psql -U postgres -d postgres -v ON_ERROR_STOP=1 \
--     < nut_recipe_cover_migration.sql
-- Wiederholbar.

begin;

alter table public.nut_recipes add column if not exists cover text;

commit;

-- PostgREST kennt die neue Spalte erst nach einem Neuladen des Schema-Caches.
notify pgrst, 'reload schema';

select count(*) as rezepte, count(cover) as mit_bild from public.nut_recipes;
