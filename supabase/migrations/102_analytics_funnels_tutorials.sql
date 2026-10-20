-- =====================================================================
-- Funnel-Auswertung auf die neuen Tutorials umstellen
-- =====================================================================
-- Nach 101 ausführen. Ersetzt nur die Funktion analytics_funnels:
-- der Gewohnheiten-Wizard (onboarding_step) existiert im Staging-Stand
-- nicht mehr, stattdessen gibt es pro Bereich ein Tutorial
-- (tutorial_shown / tutorial_done). Rechte bleiben erhalten.
-- =====================================================================

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

    -- Tutorials beim ersten Besuch eines Bereichs (core/components/ModuleTutorial.jsx).
    -- Ein Nutzer zählt je Schritt höchstens einmal.
    'onboarding', (
      select jsonb_build_array(
        jsonb_build_object('label', 'Tutorial gezeigt',                  'count', count(distinct user_id) filter (where name = 'tutorial_shown')),
        jsonb_build_object('label', 'Tutorial beendet oder übersprungen', 'count', count(distinct user_id) filter (where name = 'tutorial_done')),
        jsonb_build_object('label', 'Aktion im Tutorial ausgeführt',      'count', count(distinct user_id) filter (where name = 'tutorial_done' and props ->> 'acted' = 'true'))
      )
      from analytics_events
      where ts >= v_from
    ),

    'skipped', (
      select count(distinct user_id) from analytics_events
      where ts >= v_from and name = 'tutorial_done' and props ->> 'acted' = 'false'
    ),

    'tutorials', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'tutorial', t.tutorial, 'shown', t.shown, 'done', t.done, 'acted', t.acted
             ) order by t.shown desc), '[]'::jsonb)
      from (
        select props ->> 'tutorial' as tutorial,
               count(distinct user_id) filter (where name = 'tutorial_shown') as shown,
               count(distinct user_id) filter (where name = 'tutorial_done')  as done,
               count(distinct user_id) filter (where name = 'tutorial_done' and props ->> 'acted' = 'true') as acted
        from analytics_events
        where ts >= v_from and name in ('tutorial_shown', 'tutorial_done') and props ->> 'tutorial' is not null
        group by 1
      ) t
    ),

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
