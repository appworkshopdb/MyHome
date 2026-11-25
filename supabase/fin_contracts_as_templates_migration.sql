-- Verträge buchen wie Fixkosten: Ein Vertrag ist jetzt eine Vorlage in
-- fin_fixtemplates (Kategorie fixkosten) mit is_contract = true. Damit bucht er
-- jeden Monat genau wie Fixkosten (bis auf weiteres oder bis zum Vertragsende).
-- Dazu die Vertragsfelder Kündigung und Notiz.
--
-- Rein additiv und idempotent. Die Tabelle fin_contracts bleibt bestehen (die
-- ältere App liest sie noch); die neue App zeigt verbliebene Verträge von dort
-- weiter an und übernimmt sie beim nächsten Speichern als Vorlage.
-- Ohne die Spalten speichert die App einen Vertrag als normale Fixkosten.
--
-- Einspielen auf dem Server (Staging und Produktion teilen dieses Backend):
--   docker exec -i supabase-db psql -U postgres -d postgres -v ON_ERROR_STOP=1 \
--     < supabase/fin_contracts_as_templates_migration.sql

alter table public.fin_fixtemplates
  add column if not exists is_contract boolean not null default false;

alter table public.fin_fixtemplates
  add column if not exists cancellation text;

alter table public.fin_fixtemplates
  add column if not exists notes text;

notify pgrst, 'reload schema';
