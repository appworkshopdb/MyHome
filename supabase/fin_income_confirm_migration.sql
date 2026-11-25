-- Einnahmen als Eingänge (lib/income.js): zwei additive Spalten.
--
--  fin_entries.received_on        Tag, an dem der Nutzer den Eingang einer Einnahme bestätigt hat
--                                 ("Eingang bestätigen"). Nur solche Posten gelten als bestätigt;
--                                 früher automatisch angelegte Einnahme-Posten bleiben leer.
--  body_profile.fin_start_month   Startmonat ('YYYY-MM') für "Verfügbar jetzt": gezählt werden
--                                 nur Posten ab diesem Monat. Wird beim ersten Öffnen der
--                                 Übersicht auf den laufenden Monat gesetzt. Liegt wie die
--                                 übrigen Nutzer-Einstellungen in body_profile.
--
-- Rein additiv und idempotent; die ältere App (main) ignoriert beide Spalten.
-- Ohne die Spalten kann ein Eingang nicht bestätigt werden (die App meldet es), und
-- "Verfügbar jetzt" rechnet nur mit dem laufenden Monat.
--
-- Einspielen auf dem Server (Staging und Produktion teilen dieses Backend):
--   docker exec -i supabase-db psql -U postgres -d postgres -v ON_ERROR_STOP=1 \
--     < supabase/fin_income_confirm_migration.sql

alter table public.fin_entries add column if not exists received_on date;
alter table public.body_profile add column if not exists fin_start_month text;

notify pgrst, 'reload schema';
