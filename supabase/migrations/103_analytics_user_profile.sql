-- =====================================================================
-- Nutzerprofil im Dashboard: Konto-Metadaten + App/Browser-Nutzung
-- =====================================================================
-- Nach 102 ausführen. Ersetzt nur analytics_user(). Neu im Ergebnis:
--   account.created_at       Registrierungsdatum
--   account.last_sign_in_at  letzter Login
--   account.email_confirmed  E-Mail bestätigt (ja/nein, nicht die Adresse)
--   stats.uses_app / uses_browser  Nutzung als installierte App und/oder im Browser
-- E-Mail-Adresse und Name werden bewusst NICHT ausgeliefert.
-- Rechte (nur Admins, per Prüfung in der Funktion) bleiben erhalten.
-- =====================================================================

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
        'uses_app',    coalesce(bool_or(standalone), false),
        'uses_browser', coalesce(bool_or(not coalesce(standalone, false)), false),
        'app_version', (array_agg(app_version order by ts desc))[1],
        'consent_at',  min(ts) filter (where name = 'consent_granted')
      )
      from analytics_events where user_id = p_user
    ),
    -- Konto-Metadaten (ohne E-Mail-Adresse und ohne Namen).
    'account', (
      select jsonb_build_object(
        'created_at',      u.created_at,
        'last_sign_in_at', u.last_sign_in_at,
        'email_confirmed', u.email_confirmed_at is not null
      )
      from auth.users u where u.id = p_user
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
