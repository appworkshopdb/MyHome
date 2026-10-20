-- =====================================================================
-- Nutzerliste: aktueller Bildschirm für den Live-Status
-- =====================================================================
-- Nach 103 ausführen. Ersetzt nur analytics_users(). Neu im Ergebnis:
--   last_module / last_view  Bildschirm des letzten Ereignisses
-- "online" entscheidet das Dashboard selbst: letztes Ereignis < 3 Minuten.
-- Rechte (nur Admins, per Prüfung in der Funktion) bleiben erhalten.
-- =====================================================================

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
               'user_id',     user_id,
               'last_seen',   max(ts),
               'sessions',    count(distinct session_id),
               'standalone',  (array_agg(standalone order by ts desc))[1],
               'last_module', (array_agg(module order by ts desc) filter (where module <> ''))[1],
               'last_view',   (array_agg(view   order by ts desc) filter (where module <> ''))[1]
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
