-- Sparpläne: Tabelle fin_savings_plans und Spalte fin_entries.savings_plan_id — rein additiv.
--
-- Ein Sparplan ist ein Sparziel (Name, Zielbetrag, optional Zieldatum) mit Raten
-- (monatlich oder quartalsweise). Die Raten selbst sind normale Buchungen in
-- fin_entries (Ausgabe "Sparrate · <Name>", Kategorie variable_kosten) mit
-- savings_plan_id: offen bis zur Einzahlung, dann bezahlt. Damit zählen fällige
-- Raten als offene Posten und im Saldo; eingezahlte Raten zählen im Sparschwein.
-- Keine Punkte, kein Einfluss auf das Level (Finanzen vergibt keine Punkte).
--
-- Nur für die eigene Person (RLS auf owner_id). Löschen ist ein Soft Delete
-- (deleted_at); das Konto zu löschen entfernt alle Zeilen (on delete cascade).
-- Die ältere App (main) ignoriert Tabelle und Spalte. Ohne diese Migration
-- blendet die App die Sparpläne aus, das Sparschwein läuft weiter.
--
-- due_day: Tag im Monat, an dem eine Rate fällig ist (1, 15, 31 = Monatsende;
-- auf die Monatslänge begrenzt).
--
-- Idempotent. Einspielen auf dem Server (Staging und Produktion teilen dieses Backend):
--   docker exec -i supabase-db psql -U postgres -d postgres -v ON_ERROR_STOP=1 \
--     < supabase/fin_savings_plans_migration.sql
--
-- Danach prüfen (muss 0 bleiben):
--   select count(*) from information_schema.role_table_grants
--     where table_schema='public' and grantee='anon';

create table if not exists public.fin_savings_plans (
  id            uuid primary key default gen_random_uuid(),
  owner_id      uuid not null references auth.users (id) on delete cascade,
  name          text not null check (length(trim(name)) > 0),
  target_amount numeric(12,2) not null check (target_amount > 0),
  target_date   date,
  rhythm        text not null default 'monthly' check (rhythm in ('monthly', 'quarterly')),
  rate          numeric(12,2) not null check (rate > 0),
  due_day       smallint not null default 1 check (due_day between 1 and 31),
  status        text not null default 'aktiv' check (status in ('aktiv', 'beendet')),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  deleted_at    timestamptz
);

create index if not exists idx_fin_savings_plans_owner
  on public.fin_savings_plans (owner_id)
  where deleted_at is null;

alter table public.fin_savings_plans enable row level security;

drop policy if exists "eigene Sparpläne" on public.fin_savings_plans;
create policy "eigene Sparpläne" on public.fin_savings_plans
  for all to authenticated
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

revoke all on public.fin_savings_plans from anon;
grant select, insert, update, delete on public.fin_savings_plans to authenticated;

alter table public.fin_entries
  add column if not exists savings_plan_id uuid references public.fin_savings_plans (id) on delete set null;

create index if not exists idx_fin_entries_savings_plan
  on public.fin_entries (savings_plan_id)
  where savings_plan_id is not null and deleted_at is null;

-- PostgREST soll Tabelle und Spalte sofort kennen
notify pgrst, 'reload schema';
