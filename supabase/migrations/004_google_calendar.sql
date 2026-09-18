-- Google Calendar integration schema
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
create policy "eigene OAuth States" on public.oauth_states for all to authenticated using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
drop policy if exists "eigene Google Kalender Verbindung" on public.google_calendar_connections;
create policy "eigene Google Kalender Verbindung" on public.google_calendar_connections for all to authenticated using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
grant select, insert, update, delete on public.oauth_states to authenticated;
grant select, insert, update, delete on public.google_calendar_connections to authenticated;

create table if not exists public.calendar_events (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  event_date date not null,
  event_time time,
  event_date_end date,
  event_time_end time,
  source_module text not null,
  source_ref_id uuid default gen_random_uuid(),
  google_event_id text,
  title text not null,
  description text,
  location text,
  status text,
  done boolean not null default false,
  reminder_minutes integer,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.calendar_events add column if not exists google_start_date date;
alter table public.calendar_events add column if not exists google_start_datetime text;
alter table public.calendar_events add column if not exists google_start_timezone text;
alter table public.calendar_events add column if not exists google_end_date date;
alter table public.calendar_events add column if not exists google_end_datetime text;
alter table public.calendar_events add column if not exists google_end_timezone text;
alter table public.calendar_events add column if not exists reminder_use_default boolean;
alter table public.calendar_events add column if not exists reminder_overrides_minutes integer[];

create unique index if not exists idx_calendar_events_owner_google_event on public.calendar_events(owner_id, google_event_id) where google_event_id is not null;
create index if not exists idx_calendar_events_owner_date on public.calendar_events(owner_id, event_date) where deleted_at is null;
alter table public.calendar_events enable row level security;
drop policy if exists "eigene Calendar Events" on public.calendar_events;
create policy "eigene Calendar Events" on public.calendar_events for all to authenticated using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
grant select, insert, update, delete on public.calendar_events to authenticated;

create or replace function public.store_google_refresh_token(p_secret_id uuid, p_refresh_token text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_secret_id uuid;
begin
  if p_refresh_token is null or length(trim(p_refresh_token)) = 0 then raise exception 'Refresh-Token fehlt'; end if;
  if p_secret_id is not null and exists (select 1 from vault.secrets where id = p_secret_id) then
    perform vault.update_secret(p_secret_id, p_refresh_token); v_secret_id := p_secret_id;
  else
    v_secret_id := vault.create_secret(p_refresh_token, 'google-calendar-refresh-token', 'Google Calendar OAuth refresh token');
  end if;
  return v_secret_id;
end; $$;

create or replace function public.get_google_refresh_token(p_secret_id uuid)
returns text language sql security definer set search_path = '' as $$ select decrypted_secret from vault.decrypted_secrets where id = p_secret_id; $$;
create or replace function public.delete_google_refresh_token(p_secret_id uuid)
returns void language plpgsql security definer set search_path = '' as $$ begin if p_secret_id is not null then delete from vault.secrets where id = p_secret_id; end if; end; $$;
create or replace function public.cleanup_old_oauth_states()
returns void language sql security definer set search_path = '' as $$ delete from public.oauth_states where expires_at < now(); $$;
revoke all on function public.store_google_refresh_token(uuid, text) from public, anon, authenticated;
revoke all on function public.get_google_refresh_token(uuid) from public, anon, authenticated;
revoke all on function public.delete_google_refresh_token(uuid) from public, anon, authenticated;
revoke all on function public.cleanup_old_oauth_states() from public, anon, authenticated;
grant execute on function public.store_google_refresh_token(uuid, text) to service_role;
grant execute on function public.get_google_refresh_token(uuid) to service_role;
grant execute on function public.delete_google_refresh_token(uuid) to service_role;
grant execute on function public.cleanup_old_oauth_states() to service_role;

create or replace function public.set_calendar_event_updated_at()
returns trigger language plpgsql set search_path = '' as $$ begin new.updated_at = now(); return new; end; $$;
drop trigger if exists trg_calendar_events_updated on public.calendar_events;
create trigger trg_calendar_events_updated before update on public.calendar_events for each row execute function public.set_calendar_event_updated_at();
