-- =====================================================================
-- "Zuhause" — Finanzen-Modul — Supabase-Datenbankschema
-- =====================================================================
-- Ausführen im Supabase SQL-Editor (Project > SQL Editor > New query).
-- Enthält zwei Schichten:
--   1) KERN  — modulübergreifend, wächst mit jedem weiteren Modul mit
--   2) fin_* — das Finanzen-Modul selbst
-- =====================================================================

create extension if not exists "pgcrypto"; -- für gen_random_uuid()

-- ---------------------------------------------------------------------
-- 1) KERN — Profile
-- ---------------------------------------------------------------------
create table if not exists profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  locale text not null default 'de-DE',
  currency text not null default 'EUR',
  week_start text not null default 'monday',
  created_at timestamptz not null default now()
);

create or replace function handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', new.email));
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

alter table profiles enable row level security;
create policy "eigenes Profil lesen" on profiles for select using (auth.uid() = id);
create policy "eigenes Profil ändern" on profiles for update using (auth.uid() = id);

-- ---------------------------------------------------------------------
-- 2) KERN — Measurements
-- ---------------------------------------------------------------------
-- Die generische Zeitreihe aus dem Architektur-Entwurf: alles Zählbare
-- (Ausgaben, Kalorien, Trainingsvolumen, Streaks) landet hier mit einem
-- modulspezifischen metric_key. Der Kern kennt die Bedeutung der Keys
-- nicht — er speichert und aggregiert nur. Dashboards/Ziele fragen
-- später ausschließlich diese eine Tabelle ab, nie die Modul-Tabellen
-- direkt.
create table if not exists measurements (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  metric_key text not null,          -- z.B. 'finance.expense', 'finance.income'
  value numeric not null,
  unit text not null,                -- z.B. 'EUR'
  occurred_on date not null,
  source_module text not null,       -- z.B. 'finance'
  source_ref_id uuid,                -- verweist auf fin_entries.id o.ä.
  created_at timestamptz not null default now()
);

create index if not exists idx_measurements_owner_metric
  on measurements (owner_id, metric_key, occurred_on);

alter table measurements enable row level security;
create policy "eigene Measurements" on measurements
  for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

-- ---------------------------------------------------------------------
-- 3) fin_* — Enums
-- ---------------------------------------------------------------------
do $$ begin
  if not exists (select 1 from pg_type where typname = 'fin_category') then
    create type fin_category as enum
      ('fixeinnahmen', 'sonstige_einnahmen', 'fixkosten', 'variable_kosten', 'sonstige_ausgaben');
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_type where typname = 'fin_payment') then
    create type fin_payment as enum ('Bank', 'Bar', 'Paypal', 'SEPA', 'Gutschein');
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_type where typname = 'fin_template_category') then
    create type fin_template_category as enum ('fixeinnahmen', 'fixkosten');
  end if;
end $$;

-- ---------------------------------------------------------------------
-- 4) fin_entries — Buchungen eines Monats
-- ---------------------------------------------------------------------
create table if not exists fin_entries (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  year int not null,
  month int not null check (month between 1 and 12),
  category fin_category not null,
  name text not null,
  payment fin_payment not null default 'Bank',
  amount numeric not null check (amount >= 0),
  paid boolean not null default false,
  from_template uuid,               -- verweist auf fin_fixtemplates.id, falls automatisch übernommen
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists idx_fin_entries_owner_month
  on fin_entries (owner_id, year, month) where deleted_at is null;

-- ---------------------------------------------------------------------
-- 5) fin_savings — Erspartes pro Monat
-- ---------------------------------------------------------------------
create table if not exists fin_savings (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  year int not null,
  month int not null check (month between 1 and 12),
  amount numeric not null check (amount >= 0),
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists idx_fin_savings_owner_month
  on fin_savings (owner_id, year, month) where deleted_at is null;

-- ---------------------------------------------------------------------
-- 6) fin_contracts — Laufende Verträge
-- ---------------------------------------------------------------------
create table if not exists fin_contracts (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  amount numeric not null check (amount >= 0),
  duration text,
  start_date date,
  end_date date,               -- null zusammen mit is_monthly = true heißt "läuft monatlich"
  is_monthly boolean not null default false,
  payment fin_payment,
  cancellation text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

-- ---------------------------------------------------------------------
-- 7) fin_fixtemplates — Vorlagen für wiederkehrende Fixposten
-- ---------------------------------------------------------------------
create table if not exists fin_fixtemplates (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  category fin_template_category not null,
  name text not null,
  payment fin_payment not null default 'Bank',
  amount numeric not null check (amount >= 0),
  quarterly boolean not null default false,
  start_month int check (start_month between 1 and 12),
  start_year int,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

-- ---------------------------------------------------------------------
-- 8) updated_at automatisch pflegen
-- ---------------------------------------------------------------------
create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_fin_entries_updated on fin_entries;
create trigger trg_fin_entries_updated before update on fin_entries
  for each row execute function set_updated_at();

drop trigger if exists trg_fin_savings_updated on fin_savings;
create trigger trg_fin_savings_updated before update on fin_savings
  for each row execute function set_updated_at();

drop trigger if exists trg_fin_contracts_updated on fin_contracts;
create trigger trg_fin_contracts_updated before update on fin_contracts
  for each row execute function set_updated_at();

drop trigger if exists trg_fin_fixtemplates_updated on fin_fixtemplates;
create trigger trg_fin_fixtemplates_updated before update on fin_fixtemplates
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------
-- 9) Kern-Kopplung: jede Buchung schreibt automatisch einen Measurement-
--    Eintrag. Das ist die Ereigniskette aus dem Architektur-Entwurf ganz
--    konkret umgesetzt — spätere Module (z.B. ein Dashboard, das
--    Ernährungs- und Finanzdaten kombiniert) lesen nur "measurements"
--    und müssen "fin_entries" nie direkt kennen.
-- ---------------------------------------------------------------------
create or replace function fin_entries_to_measurement()
returns trigger language plpgsql as $$
declare
  metric text;
  occ date;
begin
  if new.category in ('fixeinnahmen', 'sonstige_einnahmen') then
    metric := 'finance.income';
  else
    metric := 'finance.expense';
  end if;

  occ := make_date(new.year, new.month, 1);

  delete from measurements where source_module = 'finance' and source_ref_id = new.id;

  if new.deleted_at is null then
    insert into measurements (owner_id, metric_key, value, unit, occurred_on, source_module, source_ref_id)
    values (new.owner_id, metric, new.amount, 'EUR', occ, 'finance', new.id);
  end if;

  return new;
end;
$$;

drop trigger if exists trg_fin_entries_measurement on fin_entries;
create trigger trg_fin_entries_measurement
  after insert or update on fin_entries
  for each row execute function fin_entries_to_measurement();

create or replace function fin_entries_delete_measurement()
returns trigger language plpgsql as $$
begin
  delete from measurements where source_module = 'finance' and source_ref_id = old.id;
  return old;
end;
$$;

drop trigger if exists trg_fin_entries_measurement_delete on fin_entries;
create trigger trg_fin_entries_measurement_delete
  after delete on fin_entries
  for each row execute function fin_entries_delete_measurement();

-- ---------------------------------------------------------------------
-- 10) Row Level Security — jede Person sieht nur eigene Daten
-- ---------------------------------------------------------------------
alter table fin_entries enable row level security;
alter table fin_savings enable row level security;
alter table fin_contracts enable row level security;
alter table fin_fixtemplates enable row level security;

create policy "eigene Buchungen" on fin_entries
  for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

create policy "eigenes Erspartes" on fin_savings
  for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

create policy "eigene Verträge" on fin_contracts
  for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

create policy "eigene Vorlagen" on fin_fixtemplates
  for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

-- =====================================================================
-- Fertig. Danach: Email-Auth in Supabase aktivieren (Authentication >
-- Providers > Email) und die Werte aus Project Settings > API in die
-- .env-Datei der App eintragen.
-- =====================================================================
