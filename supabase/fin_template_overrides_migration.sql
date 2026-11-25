-- Laufende Posten (Vorlagen): Löschen und Bearbeiten gelten nur für den Monat.
--
--  fin_fixtemplates.skipped_months  Monate ('YYYY-MM'), in denen der Nutzer den Posten
--                                   dieser Vorlage gelöscht hat. Die Prüfung legt dort
--                                   keinen neuen Posten an, auch nicht nach Bearbeiten
--                                   der Vorlage.
--  fin_entries.template_locked      true = Posten aus einer Vorlage wurde von Hand
--                                   geändert (Name, Betrag, Zahlung). Eine spätere
--                                   Änderung der Vorlage überschreibt ihn nicht.
--
-- Rein additiv und idempotent; die ältere App ignoriert beide Spalten.
-- Ohne die Spalten läuft die App weiter, nur ohne diese Merker (Löschen legt den Posten
-- dann beim nächsten Laden wieder an).
--
-- Einspielen auf dem Server (Staging und Produktion teilen dieses Backend):
--   docker exec -i supabase-db psql -U postgres -d postgres -v ON_ERROR_STOP=1 \
--     < supabase/fin_template_overrides_migration.sql

alter table public.fin_fixtemplates
  add column if not exists skipped_months text[] not null default '{}';

alter table public.fin_entries
  add column if not exists template_locked boolean not null default false;

notify pgrst, 'reload schema';
