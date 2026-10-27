-- =====================================================================
-- "Zuhause" — Finanzen-Modul — Supabase-Datenbankschema
-- =====================================================================
-- Ausführen im Supabase SQL-Editor (Project > SQL Editor > New query).
-- Enthält zwei Schichten:
--   1) KERN  — modulübergreifend, wächst mit jedem weiteren Modul mit
--   2) fin_* — das Finanzen-Modul selbst
-- =====================================================================

create extension if not exists "pgcrypto";

create table if not exists profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  locale text not null default 'de-DE',
  currency text not null default 'EUR',
  week_start text not null default 'monday',
  created_at timestamptz not null default now()
);
create or replace function handle_new_user() returns trigger language plpgsql security definer set search_path = public as $$ begin insert into public.profiles (id, display_name) values (new.id, coalesce(new.raw_user_meta_data->>'full_name', new.email)); return new; end; $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute function handle_new_user();
alter table profiles enable row level security;
create policy "eigenes Profil lesen" on profiles for select using (auth.uid() = id);
create policy "eigenes Profil ändern" on profiles for update using (auth.uid() = id);

create table if not exists measurements (
  id uuid primary key default gen_random_uuid(), owner_id uuid not null references auth.users (id) on delete cascade,
  metric_key text not null, value numeric not null, unit text not null, occurred_on date not null,
  source_module text not null, source_ref_id uuid, created_at timestamptz not null default now()
);
create index if not exists idx_measurements_owner_metric on measurements (owner_id, metric_key, occurred_on);
alter table measurements enable row level security;
create policy "eigene Measurements" on measurements for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

-- fin enums/tables
 do $$ begin if not exists (select 1 from pg_type where typname = 'fin_category') then create type fin_category as enum ('fixeinnahmen','sonstige_einnahmen','fixkosten','variable_kosten','sonstige_ausgaben'); end if; end $$;
do $$ begin if not exists (select 1 from pg_type where typname = 'fin_payment') then create type fin_payment as enum ('Bank','Bar','Paypal','SEPA','Gutschein'); end if; end $$;
do $$ begin if not exists (select 1 from pg_type where typname = 'fin_template_category') then create type fin_template_category as enum ('fixeinnahmen','fixkosten'); end if; end $$;

create table if not exists fin_entries (
  id uuid primary key default gen_random_uuid(), owner_id uuid not null references auth.users (id) on delete cascade,
  year int not null, month int not null check (month between 1 and 12), category fin_category not null, name text not null,
  payment fin_payment not null default 'Bank', amount numeric not null check (amount >= 0), paid boolean not null default false,
  from_template uuid, created_at timestamptz not null default now(), updated_at timestamptz not null default now(), deleted_at timestamptz
);
create index if not exists idx_fin_entries_owner_month on fin_entries (owner_id, year, month) where deleted_at is null;
create table if not exists fin_savings (
  id uuid primary key default gen_random_uuid(), owner_id uuid not null references auth.users (id) on delete cascade,
  year int not null, month int not null check (month between 1 and 12), amount numeric not null check (amount >= 0), note text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), deleted_at timestamptz
);
create index if not exists idx_fin_savings_owner_month on fin_savings (owner_id, year, month) where deleted_at is null;
create table if not exists fin_contracts (
  id uuid primary key default gen_random_uuid(), owner_id uuid not null references auth.users (id) on delete cascade,
  name text not null, amount numeric not null check (amount >= 0), duration text, start_date date, end_date date,
  is_monthly boolean not null default false, payment fin_payment, cancellation text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), deleted_at timestamptz
);
create table if not exists fin_fixtemplates (
  id uuid primary key default gen_random_uuid(), owner_id uuid not null references auth.users (id) on delete cascade,
  category fin_template_category not null, name text not null, payment fin_payment not null default 'Bank', amount numeric not null check (amount >= 0),
  quarterly boolean not null default false, start_month int check (start_month between 1 and 12), start_year int,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), deleted_at timestamptz
);
create or replace function set_updated_at() returns trigger language plpgsql as $$ begin new.updated_at = now(); return new; end; $$;
drop trigger if exists trg_fin_entries_updated on fin_entries; create trigger trg_fin_entries_updated before update on fin_entries for each row execute function set_updated_at();
drop trigger if exists trg_fin_savings_updated on fin_savings; create trigger trg_fin_savings_updated before update on fin_savings for each row execute function set_updated_at();
drop trigger if exists trg_fin_contracts_updated on fin_contracts; create trigger trg_fin_contracts_updated before update on fin_contracts for each row execute function set_updated_at();
drop trigger if exists trg_fin_fixtemplates_updated on fin_fixtemplates; create trigger trg_fin_fixtemplates_updated before update on fin_fixtemplates for each row execute function set_updated_at();
create or replace function fin_entries_to_measurement() returns trigger language plpgsql as $$ declare metric text; occ date; begin if new.category in ('fixeinnahmen','sonstige_einnahmen') then metric := 'finance.income'; else metric := 'finance.expense'; end if; occ := make_date(new.year,new.month,1); delete from measurements where source_module='finance' and source_ref_id=new.id; if new.deleted_at is null then insert into measurements(owner_id,metric_key,value,unit,occurred_on,source_module,source_ref_id) values(new.owner_id,metric,new.amount,'EUR',occ,'finance',new.id); end if; return new; end; $$;
drop trigger if exists trg_fin_entries_measurement on fin_entries; create trigger trg_fin_entries_measurement after insert or update on fin_entries for each row execute function fin_entries_to_measurement();
create or replace function fin_entries_delete_measurement() returns trigger language plpgsql as $$ begin delete from measurements where source_module='finance' and source_ref_id=old.id; return old; end; $$;
drop trigger if exists trg_fin_entries_measurement_delete on fin_entries; create trigger trg_fin_entries_measurement_delete after delete on fin_entries for each row execute function fin_entries_delete_measurement();
alter table fin_entries enable row level security; alter table fin_savings enable row level security; alter table fin_contracts enable row level security; alter table fin_fixtemplates enable row level security;
create policy "eigene Buchungen" on fin_entries for all using (auth.uid()=owner_id) with check (auth.uid()=owner_id);
create policy "eigenes Erspartes" on fin_savings for all using (auth.uid()=owner_id) with check (auth.uid()=owner_id);
create policy "eigene Verträge" on fin_contracts for all using (auth.uid()=owner_id) with check (auth.uid()=owner_id);
create policy "eigene Vorlagen" on fin_fixtemplates for all using (auth.uid()=owner_id) with check (auth.uid()=owner_id);

-- =====================================================================
-- Google Calendar Integration
-- =====================================================================
create extension if not exists vault with schema vault;

create table if not exists public.oauth_states (
  state text primary key,
  owner_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '10 minutes')
);
create index if not exists idx_oauth_states_expires_at on public.oauth_states(expires_at);

create table if not exists public.google_calendar_connections (
  owner_id uuid primary key references auth.users(id) on delete cascade,
  google_email text not null,
  calendar_id text not null default 'primary',
  refresh_token_secret_id uuid,
  connected_at timestamptz not null default now(),
  last_synced_at timestamptz,
  sync_error text
);

alter table public.oauth_states enable row level security;
alter table public.google_calendar_connections enable row level security;
drop policy if exists "eigene OAuth States" on public.oauth_states;
create policy "eigene OAuth States" on public.oauth_states for all to authenticated using (auth.uid()=owner_id) with check (auth.uid()=owner_id);
drop policy if exists "eigene Google Kalender Verbindung" on public.google_calendar_connections;
create policy "eigene Google Kalender Verbindung" on public.google_calendar_connections for all to authenticated using (auth.uid()=owner_id) with check (auth.uid()=owner_id);
grant select, insert, update, delete on public.oauth_states to authenticated;
grant select, insert, update, delete on public.google_calendar_connections to authenticated;

create table if not exists public.calendar_events (
  id uuid primary key default gen_random_uuid(), owner_id uuid not null references auth.users(id) on delete cascade,
  event_date date not null, event_time time, event_date_end date, event_time_end time,
  source_module text not null, source_ref_id uuid default gen_random_uuid(), google_event_id text,
  title text not null, description text, location text, status text, done boolean not null default false,
  reminder_minutes integer, deleted_at timestamptz, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
alter table public.calendar_events add column if not exists google_start_date date;
alter table public.calendar_events add column if not exists google_start_datetime text;
alter table public.calendar_events add column if not exists google_start_timezone text;
alter table public.calendar_events add column if not exists google_end_date date;
alter table public.calendar_events add column if not exists google_end_datetime text;
alter table public.calendar_events add column if not exists google_end_timezone text;
alter table public.calendar_events add column if not exists reminder_use_default boolean;
alter table public.calendar_events add column if not exists reminder_overrides_minutes integer[];
create unique index if not exists idx_calendar_events_owner_google_event on public.calendar_events(owner_id,google_event_id) where google_event_id is not null;
create index if not exists idx_calendar_events_owner_date on public.calendar_events(owner_id,event_date) where deleted_at is null;
alter table public.calendar_events enable row level security;
drop policy if exists "eigene Calendar Events" on public.calendar_events;
create policy "eigene Calendar Events" on public.calendar_events for all to authenticated using (auth.uid()=owner_id) with check (auth.uid()=owner_id);
grant select, insert, update, delete on public.calendar_events to authenticated;

create or replace function public.store_google_refresh_token(p_secret_id uuid,p_refresh_token text) returns uuid language plpgsql security definer set search_path='' as $$ declare v_secret_id uuid; begin if p_refresh_token is null or length(trim(p_refresh_token))=0 then raise exception 'Refresh-Token fehlt'; end if; if p_secret_id is not null and exists(select 1 from vault.secrets where id=p_secret_id) then perform vault.update_secret(p_secret_id,p_refresh_token); v_secret_id:=p_secret_id; else v_secret_id:=vault.create_secret(p_refresh_token,'google-calendar-refresh-token','Google Calendar OAuth refresh token'); end if; return v_secret_id; end; $$;
create or replace function public.get_google_refresh_token(p_secret_id uuid) returns text language sql security definer set search_path='' as $$ select decrypted_secret from vault.decrypted_secrets where id=p_secret_id; $$;
create or replace function public.delete_google_refresh_token(p_secret_id uuid) returns void language plpgsql security definer set search_path='' as $$ begin if p_secret_id is not null then delete from vault.secrets where id=p_secret_id; end if; end; $$;
create or replace function public.cleanup_old_oauth_states() returns void language sql security definer set search_path='' as $$ delete from public.oauth_states where expires_at < now(); $$;
revoke all on function public.store_google_refresh_token(uuid,text) from public,anon,authenticated; revoke all on function public.get_google_refresh_token(uuid) from public,anon,authenticated; revoke all on function public.delete_google_refresh_token(uuid) from public,anon,authenticated; revoke all on function public.cleanup_old_oauth_states() from public,anon,authenticated;
grant execute on function public.store_google_refresh_token(uuid,text) to service_role; grant execute on function public.get_google_refresh_token(uuid) to service_role; grant execute on function public.delete_google_refresh_token(uuid) to service_role; grant execute on function public.cleanup_old_oauth_states() to service_role;

create or replace function public.set_calendar_event_updated_at() returns trigger language plpgsql set search_path='' as $$ begin new.updated_at=now(); return new; end; $$;
drop trigger if exists trg_calendar_events_updated on public.calendar_events;
create trigger trg_calendar_events_updated before update on public.calendar_events for each row execute function public.set_calendar_event_updated_at();
