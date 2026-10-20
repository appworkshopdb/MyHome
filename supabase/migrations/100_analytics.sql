-- =====================================================================
-- Nutzungsanalyse (eigenes Tracking, nur mit Einwilligung)
-- =====================================================================
-- Im Supabase SQL-Editor einmalig ausführen.
--
-- Rohereignisse (analytics_events) werden nach 90 Tagen gelöscht. Vorher
-- verdichtet analytics_rollup() sie täglich in analytics_daily (Zähler pro
-- Tag/Ereignis/Screen) und analytics_active_days (welcher Nutzer war an
-- welchem Tag aktiv — Grundlage für Retention über 90 Tage hinaus). So
-- bleibt die Datenbank klein (Free-Tier: ~500 MB für ALLE Daten).
--
-- Zugriff: Clients dürfen NUR eigene Ereignisse einfügen, nie lesen.
-- Auslesen geht über den SQL-Editor (läuft als postgres, umgeht RLS) —
-- Beispielabfragen in supabase/analytics-queries.sql.
-- =====================================================================

create table if not exists analytics_events (
  id          bigint generated always as identity primary key,
  ts          timestamptz not null default now(),   -- Empfangszeit (Server)
  client_ts   timestamptz not null,                 -- Zeitpunkt auf dem Gerät
  user_id     uuid not null references auth.users (id) on delete cascade,
  session_id  text not null,
  name        text not null,
  module      text not null default '',
  view        text not null default '',
  props       jsonb not null default '{}'::jsonb,
  app_version text,
  standalone  boolean,
  viewport_w  integer,
  constraint analytics_name_format  check (name ~ '^[a-z][a-z0-9_]{1,47}$'),
  constraint analytics_session_len  check (char_length(session_id) <= 40),
  constraint analytics_module_len   check (char_length(module) <= 40 and char_length(view) <= 60),
  constraint analytics_props_size   check (pg_column_size(props) <= 4096)
);

create index if not exists idx_analytics_events_ts       on analytics_events (ts);
create index if not exists idx_analytics_events_name_ts  on analytics_events (name, ts);
create index if not exists idx_analytics_events_user_ts  on analytics_events (user_id, ts);

alter table analytics_events enable row level security;

-- Nur Einfügen, nur für sich selbst, nur plausible Zeitstempel (max. 7 Tage
-- alt, falls das Gerät lange offline war). KEINE select/update/delete-Policy
-- → Clients können nichts lesen oder ändern.
drop policy if exists "eigene Events einfügen" on analytics_events;
create policy "eigene Events einfügen" on analytics_events
  for insert to authenticated
  with check (
    user_id = auth.uid()
    and client_ts between now() - interval '7 days' and now() + interval '1 hour'
  );

revoke all on analytics_events from anon, authenticated;
grant insert on analytics_events to authenticated;

-- ---------------------------------------------------------------------
-- Verdichtung (dauerhaft, enthält keine Rohdaten)
-- ---------------------------------------------------------------------
create table if not exists analytics_daily (
  day      date    not null,
  name     text    not null,
  module   text    not null default '',
  view     text    not null default '',
  events   integer not null,
  users    integer not null,
  sessions integer not null,
  primary key (day, name, module, view)
);

create table if not exists analytics_active_days (
  user_id uuid not null references auth.users (id) on delete cascade,
  day     date not null,
  primary key (user_id, day)
);

alter table analytics_daily       enable row level security;
alter table analytics_active_days enable row level security;
revoke all on analytics_daily, analytics_active_days from anon, authenticated;

-- Tage = deutsche Zeit. Verdichtet gestern + heute (idempotent, späte
-- Offline-Ereignisse landen auf dem Empfangstag) und löscht Rohdaten > 90 Tage.
create or replace function analytics_rollup()
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  from_ts timestamptz :=
    ((now() at time zone 'Europe/Berlin')::date - 1)::timestamp at time zone 'Europe/Berlin';
begin
  insert into analytics_daily (day, name, module, view, events, users, sessions)
  select (ts at time zone 'Europe/Berlin')::date, name, module, view,
         count(*), count(distinct user_id), count(distinct session_id)
  from analytics_events
  where ts >= from_ts
  group by 1, 2, 3, 4
  on conflict (day, name, module, view) do update
    set events = excluded.events, users = excluded.users, sessions = excluded.sessions;

  insert into analytics_active_days (user_id, day)
  select distinct user_id, (ts at time zone 'Europe/Berlin')::date
  from analytics_events
  where ts >= from_ts
  on conflict do nothing;

  delete from analytics_events where ts < now() - interval '90 days';
end;
$$;

revoke all on function analytics_rollup() from public, anon, authenticated;

-- Täglich 03:15 UTC. pg_cron wird für die Benachrichtigungen ohnehin genutzt;
-- fehlt die Extension, nur Hinweis statt Fehler (dann analytics_rollup()
-- von Hand oder anders geplant aufrufen).
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    begin
      perform cron.unschedule('analytics-rollup');
    exception when others then
      null; -- Job existierte noch nicht
    end;
    perform cron.schedule('analytics-rollup', '15 3 * * *', 'select public.analytics_rollup()');
  else
    raise notice 'pg_cron nicht aktiv — analytics_rollup() muss separat geplant werden.';
  end if;
end $$;
