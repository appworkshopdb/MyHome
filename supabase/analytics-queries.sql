-- =====================================================================
-- Beispielabfragen für die Nutzungsanalyse
-- =====================================================================
-- Im Supabase SQL-Editor ausführen (läuft als postgres, umgeht RLS).
-- Tabellen: analytics_events (Rohdaten, 90 Tage), analytics_daily und
-- analytics_active_days (dauerhaft verdichtet) — siehe
-- supabase/migrations/100_analytics.sql.
-- Ein "heartbeat" entspricht ca. 1 Minute aktiver Nutzung.
-- =====================================================================

-- Wer ist gerade wo? (letzte 3 Minuten)
select module, view, count(distinct user_id) as nutzer
from analytics_events
where ts > now() - interval '3 minutes'
group by 1, 2
order by nutzer desc;

-- Aktive Nutzer pro Tag (deutsche Zeit), letzte 30 Tage
select (ts at time zone 'Europe/Berlin')::date as tag,
       count(distinct user_id) as aktive_nutzer,
       count(distinct session_id) as sitzungen
from analytics_events
where ts > now() - interval '30 days'
group by 1
order by 1;

-- DAU / WAU / MAU heute (dauerhaft, auch über 90 Tage hinaus möglich)
select
  count(distinct user_id) filter (where day = current_date)       as dau,
  count(distinct user_id) filter (where day > current_date - 7)   as wau,
  count(distinct user_id) filter (where day > current_date - 30)  as mau
from analytics_active_days;

-- Wo sind die Nutzer? Aufrufe, Nutzer, Minuten und Klicks pro Bereich
select module,
       count(*) filter (where name = 'screen_view')                         as aufrufe,
       count(distinct user_id)                                              as nutzer,
       count(*) filter (where name = 'heartbeat')                           as aktive_minuten,
       coalesce(sum((props->>'clicks')::int) filter (where name = 'heartbeat'), 0) as klicks
from analytics_events
where ts > now() - interval '30 days'
group by module
order by aufrufe desc;

-- Ø aktive Minuten pro Nutzer und Tag
select tag, round(avg(minuten), 1) as minuten_pro_nutzer
from (
  select (ts at time zone 'Europe/Berlin')::date as tag, user_id, count(*) as minuten
  from analytics_events
  where name = 'heartbeat' and ts > now() - interval '30 days'
  group by 1, 2
) t
group by tag
order by tag;

-- Funnel Gewohnheiten-Onboarding: wie viele Nutzer erreichen welchen Schritt?
select
  count(distinct user_id) filter (where name = 'onboarding_step' and props->>'step' = '1') as schritt_1,
  count(distinct user_id) filter (where name = 'onboarding_step' and props->>'step' = '2') as schritt_2,
  count(distinct user_id) filter (where name = 'onboarding_step' and props->>'step' = '3') as schritt_3,
  count(distinct user_id) filter (where name = 'onboarding_done')                          as angelegt,
  count(distinct user_id) filter (where name = 'onboarding_skip')                          as uebersprungen,
  count(distinct user_id) filter (where name = 'habit_checkin')                            as erster_checkin
from analytics_events
where ts > now() - interval '30 days';

-- Abbruch beim Erfassen: Sheet geöffnet (pro Modul) vs. gespeichert.
-- Hinweis: sheet_open zählt jedes Öffnen über den "+"-Button; Speicher-Ereignisse
-- gibt es für Finanzen, Sport (workout_saved) und Einkauf (shopping_item_added).
select
  count(*) filter (where name = 'sheet_open' and props->>'target' = 'finance') as finanzen_geoeffnet,
  count(*) filter (where name = 'finance_entry_saved')                         as finanzen_gespeichert,
  count(*) filter (where name = 'sheet_open' and props->>'target' = 'sport')   as sport_geoeffnet,
  count(*) filter (where name = 'workout_saved')                               as sport_gespeichert
from analytics_events
where ts > now() - interval '30 days';

-- Wer füllt Pflichtangaben aus? (Hinweis angetippt vs. Körperprofil gespeichert)
select
  count(distinct user_id) filter (where name = 'required_data_fix')  as hinweis_angetippt,
  count(distinct user_id) filter (where name = 'body_profile_saved') as profil_gespeichert
from analytics_events
where ts > now() - interval '30 days';

-- Retention nach Anmelde-Woche (aus analytics_active_days)
with erste as (
  select user_id, date_trunc('week', min(day))::date as kohorte
  from analytics_active_days group by 1
)
select e.kohorte,
       count(distinct e.user_id) as nutzer,
       round(100.0 * count(distinct d.user_id) filter (where d.day >= e.kohorte + 7  and d.day < e.kohorte + 14) / count(distinct e.user_id)) as woche_1_prozent,
       round(100.0 * count(distinct d.user_id) filter (where d.day >= e.kohorte + 14 and d.day < e.kohorte + 21) / count(distinct e.user_id)) as woche_2_prozent,
       round(100.0 * count(distinct d.user_id) filter (where d.day >= e.kohorte + 21 and d.day < e.kohorte + 28) / count(distinct e.user_id)) as woche_3_prozent
from erste e
join analytics_active_days d using (user_id)
group by e.kohorte
order by e.kohorte;

-- Fehler der letzten 7 Tage
select props->>'message' as meldung, props->>'file' as datei, count(*) as anzahl,
       count(distinct user_id) as nutzer, max(ts) as zuletzt
from analytics_events
where name = 'js_error' and ts > now() - interval '7 days'
group by 1, 2
order by anzahl desc;

-- Installiert (PWA) vs. Browser
select standalone, count(distinct user_id) as nutzer
from analytics_events
where ts > now() - interval '30 days'
group by 1;

-- Verlauf eines einzelnen Nutzers (user_id einsetzen)
select ts, name, module, view, props
from analytics_events
where user_id = '00000000-0000-0000-0000-000000000000'
order by ts desc
limit 200;
