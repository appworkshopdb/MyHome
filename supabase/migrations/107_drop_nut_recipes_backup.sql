-- 107: Sicherungstabelle der Rezept-Kategorien-Migration entfernen
--
-- nut_recipes_backup_20261009 war die Rollback-Kopie aus
-- supabase/nut_recipe_categories_migration.sql (09.10.2026). Stand 19.11.2026:
-- 1 Zeile, das Rezept existiert in nut_recipes mit gleichen Zutaten und Notiz,
-- kein Code liest die Tabelle. Sie hatte keine Löschverknüpfung auf das Konto
-- (Datenschutzbericht 2026-11; Entscheidung 2026-11-19). Weder staging noch
-- main nutzen sie, das Entfernen bricht also keine App-Version.

drop table if exists public.nut_recipes_backup_20261009;
