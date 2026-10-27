-- =====================================================================
-- Analytics-Dashboard: Admin-Zugriff + Auswertungs-Funktionen
-- =====================================================================
-- Nach 100_analytics.sql im Supabase SQL-Editor ausführen.
--
-- Das Dashboard (Ordner admin/) liest NIE direkt aus analytics_events,
-- sondern nur über die Funktionen unten. Jede prüft zuerst, ob der
-- angemeldete Nutzer in analytics_admins steht — sonst Fehler 42501.
-- Die Funktionen laufen mit den Rechten des Besitzers (security definer),
-- die Tabellen bleiben für Clients gesperrt.
--
-- Dich als Admin eintragen (E-Mail deines App-Kontos einsetzen):
--   insert into analytics_admins (user_id)
--   select id from auth.users where email = 'DEINE@MAIL.DE';
-- =====================================================================

create table if not exists analytics_admins (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table analytics_admins enable row level security;
revoke all on analytics_admins from anon, authenticated;

-- ---------------------------------------------------------------------
-- Hilfsfunktionen
-- ---------------------------------------------------------------------
create or replace function analytics_assert_admin()
returns void
language plpgsql stable security definer set search_path = public
as $$
begin
  if not exists (select 1 from analytics_admins where user_id = auth.uid()) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
end;
$$;
revoke all on function analytics_assert_admin() from public, anon, authenticated;

-- Für das Dashboard-Login: "bin ich Admin?" ohne Fehler zurückgeben.
create or replace function is_analytics_admin()
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (select 1 from analytics_admins where user_id = auth.uid());
$$;
revoke all on function is_analytics_admin() from public, anon;
grant execute on function is_analytics_admin() to authenticated;

-- props kommen vom Client und sind nicht vertrauenswürdig: nie blind casten.
create or replace function analytics_clicks(p jsonb)
returns integer
language sql immutable
as $$
  select case when jsonb_typeof(p -> 'clicks') = 'number'
              then greatest(least((p ->> 'clicks')::numeric, 1000), 0)::integer
              else 0 end;
$$;

-- Montag der Woche, reine Datumsrechnung (ohne Zeitzonen-Effekte).
create or replace function analytics_week_start(d date)
returns date
language sql immutable
as $$
  select d - (extract(isodow from d)::integer - 1);
$$;

-- ---------------------------------------------------------------------
-- Übersicht
-- ---------------------------------------------------------------------
create or replace function analytics_overview(p_days integer default 30)
returns jsonb
language plpgsql stable security definer set search_path = public
as $$
declare
  v_days  integer     := least(greatest(coalesce(p_days, 30), 1), 90);
  v_today date        := (now() at time zone 'Europe/Berlin')::date;
  v_t0    timestamptz := v_today::timestamp at time zone 'Europe/Berlin';
  v_from  timestamptz := (v_today - (v_days - 1))::timestamp at time zone 'Europe/Berlin';
begin
  perform analytics_assert_admin();

  return jsonb_build_object(
    'days', v_days,
    'generated_at', now(),

    'kpis', (
      select jsonb_build_object(
        'dau',           count(distinct user_id)    filter (where ts >= v_t0),
        'dau_prev',      count(distinct user_id)    filter (where ts >= v_t0 - interval '1 day'   and ts < v_t0),
        'wau',           count(distinct user_id)    filter (where ts >= v_t0 - interval '6 days'),
        'wau_prev',      count(distinct user_id)    filter (where ts >= v_t0 - interval '13 days' and ts < v_t0 - interval '6 days'),
        'mau',           count(distinct user_id)    filter (where ts >= v_t0 - interval '29 days'),
        'mau_prev',      count(distinct user_id)    filter (where ts >= v_t0 - interval '59 days' and ts < v_t0 - interval '29 days'),
        'sessions',      count(distinct session_id) filter (where ts >= v_t0),
        'sessions_prev', count(distinct session_id) filter (where ts >= v_t0 - interval '1 day'   and ts < v_t0),
        'minutes',       count(*) filter (where name = 'heartbeat' and ts >= v_t0),
        'minutes_prev',  count(*) filter (where name = 'heartbeat' and ts >= v_t0 - interval '1 day' and ts < v_t0)
      )
      from analytics_events
      where ts >= v_t0 - interval '59 days'
    ),

    'series', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'day', d.day, 'users', coalesce(s.users, 0), 'sessions', coalesce(s.sessions, 0)
             ) order by d.day), '[]'::jsonb)
      from (select v_today - (v_days - 1) + i as day from generate_series(0, v_days - 1) as g(i)) d
      left join (
        select (ts at time zone 'Europe/Berlin')::date as day,
               count(distinct user_id) as users, count(distinct session_id) as sessions
        from analytics_events
        where ts >= v_from
        group by 1
      ) s on s.day = d.day
    ),

    'areas', (
      select coalesce(jsonb_agg(t.x order by (t.x ->> 'views')::integer desc), '[]'::jsonb)
      from (
        select jsonb_build_object(
                 'module',  module,
                 'views',   count(*) filter (where name = 'screen_view'),
                 'users',   count(distinct user_id),
                 'minutes', count(*) filter (where name = 'heartbeat'),
                 'clicks',  coalesce(sum(analytics_clicks(props)) filter (where name = 'heartbeat'), 0)
               ) as x
        from analytics_events
        where ts >= v_from and module <> ''
        group by module
      ) t
    ),

    'platform', (
      select jsonb_build_object(
               'installed', count(*) filter (where inst),
               'browser',   count(*) filter (where not inst))
      from (
        select user_id, bool_or(coalesce(standalone, false)) as inst
        from analytics_events
        where ts >= v_from
        group by user_id
      ) u
    ),

    'tracked', jsonb_build_object(
      'users', (select count(*) from (
                  select user_id from analytics_active_days
                  union
                  select user_id from analytics_events) x),
      'accounts', (select count(*) from auth.users)
    )
  );
end;
$$;

-- ---------------------------------------------------------------------
-- Live: wer ist gerade wo (letzte 3 Minuten)
-- ---------------------------------------------------------------------
create or replace function analytics_live()
returns jsonb
language plpgsql stable security definer set search_path = public
as $$
begin
  perform analytics_assert_admin();

  return jsonb_build_object(
    'total', (select count(distinct user_id) from analytics_events where ts > now() - interval '3 minutes'),
    'rows', (
      select coalesce(jsonb_agg(jsonb_build_object('module', module, 'view', view, 'users', n) order by n desc), '[]'::jsonb)
      from (
        select module, view, count(distinct user_id) as n
        from analytics_events
        where ts > now() - interval '3 minutes'
        group by module, view
      ) t
    )
  );
end;
$$;

-- ---------------------------------------------------------------------
-- Funnels, Formular-Abbruch, Retention
-- ---------------------------------------------------------------------
create or replace function analytics_funnels(p_days integer default 30)
returns jsonb
language plpgsql stable security definer set search_path = public
as $$
declare
  v_days  integer     := least(greatest(coalesce(p_days, 30), 1), 90);
  v_today date        := (now() at time zone 'Europe/Berlin')::date;
  v_from  timestamptz := (v_today - (v_days - 1))::timestamp at time zone 'Europe/Berlin';
  v_week0 date        := analytics_week_start(v_today) - 28;
begin
  perform analytics_assert_admin();

  return jsonb_build_object(
    'days', v_days,

    -- Wie viele Nutzer erreichen welchen Schritt (nicht streng sequenziell,
    -- aber ein Nutzer zählt je Schritt höchstens einmal).
    'onboarding', (
      select jsonb_build_array(
        jsonb_build_object('label', 'Onboarding gestartet',          'count', count(distinct user_id) filter (where name = 'onboarding_step' and props ->> 'step' = '1')),
        jsonb_build_object('label', 'Schritt 2 erreicht',            'count', count(distinct user_id) filter (where name = 'onboarding_step' and props ->> 'step' = '2')),
        jsonb_build_object('label', 'Schritt 3 erreicht',            'count', count(distinct user_id) filter (where name = 'onboarding_step' and props ->> 'step' = '3')),
        jsonb_build_object('label', 'Gewohnheiten angelegt',         'count', count(distinct user_id) filter (where name = 'onboarding_done')),
        jsonb_build_object('label', 'Erster Check-in',               'count', count(distinct user_id) filter (where name = 'habit_checkin'))
      )
      from analytics_events
      where ts >= v_from
    ),

    'skipped', (select count(distinct user_id) from analytics_events where ts >= v_from and name = 'onboarding_skip'),

    'forms', (
      select jsonb_build_array(
        jsonb_build_object('name', 'Buchung erfassen (Finanzen)',
          'opened', count(*) filter (where name = 'sheet_open' and props ->> 'target' = 'finance'),
          'saved',  count(*) filter (where name = 'finance_entry_saved')),
        jsonb_build_object('name', 'Training erfassen (Sport)',
          'opened', count(*) filter (where name = 'sheet_open' and props ->> 'target' = 'sport'),
          'saved',  count(*) filter (where name = 'workout_saved')),
        jsonb_build_object('name', 'Körperprofil (Pflichtdaten-Hinweis)',
          'opened', count(*) filter (where name = 'required_data_fix'),
          'saved',  count(*) filter (where name = 'body_profile_saved'))
      )
      from analytics_events
      where ts >= v_from
    ),

    'cohorts', (
      with weeks as (
        select v_week0 + 7 * i as w from generate_series(0, 4) as g(i)
      ), first_seen as (
        select user_id, analytics_week_start(min(day)) as cohort
        from analytics_active_days
        group by user_id
      ), sizes as (
        select w.w, count(f.user_id) as size
        from weeks w left join first_seen f on f.cohort = w.w
        group by w.w
      ), act as (
        select f.cohort, (analytics_week_start(d.day) - f.cohort) / 7 as k, count(distinct d.user_id) as n
        from first_seen f
        join analytics_active_days d using (user_id)
        where f.cohort >= v_week0
        group by 1, 2
      )
      select coalesce(jsonb_agg(jsonb_build_object(
               'cohort', s.w,
               'size',   s.size,
               'weeks', (
                 select jsonb_agg(
                          case when s.w + 7 * g.k > v_today or s.size = 0 then null
                               else round(100.0 * coalesce(a.n, 0) / s.size) end
                          order by g.k)
                 from generate_series(0, 4) as g(k)
                 left join act a on a.cohort = s.w and a.k = g.k
               )
             ) order by s.w desc), '[]'::jsonb)
      from sizes s
    )
  );
end;
$$;

-- ---------------------------------------------------------------------
-- Nutzerliste + Einzelansicht (pseudonym: nur Kennung, keine E-Mail)
-- ---------------------------------------------------------------------
create or replace function analytics_users(p_search text default null, p_limit integer default 50)
returns jsonb
language plpgsql stable security definer set search_path = public
as $$
declare
  v_search text := lower(regexp_replace(coalesce(p_search, ''), '[^0-9a-fA-F]', '', 'g'));
begin
  perform analytics_assert_admin();

  return (
    select coalesce(jsonb_agg(x order by (x ->> 'last_seen') desc), '[]'::jsonb)
    from (
      select jsonb_build_object(
               'user_id',    user_id,
               'last_seen',  max(ts),
               'sessions',   count(distinct session_id),
               'standalone', (array_agg(standalone order by ts desc))[1]
             ) as x
      from analytics_events
      where v_search = '' or replace(user_id::text, '-', '') like v_search || '%'
      group by user_id
      order by max(ts) desc
      limit least(greatest(coalesce(p_limit, 50), 1), 200)
    ) t
  );
end;
$$;

create or replace function analytics_user(p_user uuid)
returns jsonb
language plpgsql stable security definer set search_path = public
as $$
declare
  v_session text;
begin
  perform analytics_assert_admin();

  select session_id into v_session
  from analytics_events where user_id = p_user order by ts desc limit 1;

  return jsonb_build_object(
    'user_id', p_user,
    'stats', (
      select jsonb_build_object(
        'first_seen',  min(ts),
        'last_seen',   max(ts),
        'sessions',    count(distinct session_id),
        'minutes',     count(*) filter (where name = 'heartbeat'),
        'clicks',      coalesce(sum(analytics_clicks(props)) filter (where name = 'heartbeat'), 0),
        'standalone',  (array_agg(standalone order by ts desc))[1],
        'app_version', (array_agg(app_version order by ts desc))[1],
        'consent_at',  min(ts) filter (where name = 'consent_granted')
      )
      from analytics_events where user_id = p_user
    ),
    'areas', (
      select coalesce(jsonb_agg(jsonb_build_object('module', module, 'minutes', n) order by n desc), '[]'::jsonb)
      from (
        select module, count(*) as n
        from analytics_events
        where user_id = p_user and name = 'heartbeat' and module <> ''
        group by module
      ) t
    ),
    'events', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'ts', ts, 'name', name, 'module', module, 'view', view, 'props', props
             ) order by ts), '[]'::jsonb)
      from (
        select ts, name, module, view, props
        from analytics_events
        where user_id = p_user and session_id = v_session
        order by ts desc
        limit 120
      ) e
    )
  );
end;
$$;

-- ---------------------------------------------------------------------
-- Fehler
-- ---------------------------------------------------------------------
create or replace function analytics_errors(p_days integer default 7)
returns jsonb
language plpgsql stable security definer set search_path = public
as $$
declare
  v_days integer := least(greatest(coalesce(p_days, 7), 1), 90);
begin
  perform analytics_assert_admin();

  return (
    select coalesce(jsonb_agg(x order by (x ->> 'count')::integer desc), '[]'::jsonb)
    from (
      select jsonb_build_object(
               'message', props ->> 'message',
               'file',    props ->> 'file',
               'count',   count(*),
               'users',   count(distinct user_id),
               'last',    max(ts),
               'version', (array_agg(app_version order by ts desc))[1]
             ) as x
      from analytics_events
      where name = 'js_error' and ts > now() - make_interval(days => v_days)
      group by props ->> 'message', props ->> 'file'
      limit 100
    ) t
  );
end;
$$;

-- Nur angemeldete Konten dürfen aufrufen; die Admin-Prüfung steckt in
-- jeder Funktion selbst.
revoke all on function analytics_overview(integer), analytics_live(),
                       analytics_funnels(integer), analytics_users(text, integer),
                       analytics_user(uuid), analytics_errors(integer)
  from public, anon;
grant execute on function analytics_overview(integer), analytics_live(),
                          analytics_funnels(integer), analytics_users(text, integer),
                          analytics_user(uuid), analytics_errors(integer)
  to authenticated;
