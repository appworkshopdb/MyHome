-- Gewohnheiten: feste Kategorien/Einheiten, Uhrzeit-Ziel, halbe Liter.
--
-- Was die Migration tut:
--   1. hab_habits.goal_time (text 'HH:MM'): Uhrzeit-Ziel, z. B. "Feste Aufstehzeit 06:30".
--   2. hab_habits.target_count und hab_entries.count von ganzzahlig auf numeric(6,2),
--      damit "Wasser trinken" in halben Litern (2,5 L) gespeichert werden kann.
--   3. Kategorien auf die neue feste Liste bringen (eine Kategorie pro Gewohnheit):
--      Bewegung, Ernährung, Schlaf, Mental, Produktivität, Lernen, Haushalt, Soziales, Sonstiges.
--      Bekannte Vorlagen bekommen ihre Katalog-Kategorie, "Alltag" wird Haushalt,
--      "Gesundheit" und alles Unbekannte wird Sonstiges. `categories` = [category].
--   4. Einheiten vereinheitlichen (Mehrzahl, siehe HABIT_UNITS in core/lib/habitCatalog.js).
--      "ml" wird zu Litern umgerechnet (auf halbe Liter gerundet).
--
-- Bestehende Ziele (Ja/Nein, Zähler, Zielwert) bleiben unverändert; ein Block am Ende
-- (auskommentiert) stellt Vorlagen-Gewohnheiten optional auf die neuen Ziele um.
--
-- Idempotent: kann mehrfach ausgeführt werden. VOR dem Ausrollen der App einspielen.
-- Vorher live prüfen (Studio kann auf eine andere DB zeigen):
--   docker exec -it supabase-db psql -U postgres -d postgres -c "\d public.hab_habits"
--   docker exec -it supabase-db psql -U postgres -d postgres -c "\d public.hab_entries"
-- `categories` muss text[] sein (sonst Schritt 3 anpassen).
--
-- Zum Ansehen vorher/nachher:
--   select category, count(*) from public.hab_habits group by 1 order by 1;
--   select unit, count(*) from public.hab_habits group by 1 order by 1;

begin;

-- 1) Uhrzeit-Ziel
alter table public.hab_habits add column if not exists goal_time text;

-- 2) Dezimale Ziele und Zählerstände
alter table public.hab_habits  alter column target_count type numeric(6,2);
alter table public.hab_entries alter column count        type numeric(6,2);

-- 3) Kategorien
update public.hab_habits h
   set category = v.cat
  from (values
    ('30 Min bewegen','Bewegung'), ('Spazieren gehen','Bewegung'), ('Sport / Gym','Bewegung'),
    ('Dehnen & Stretching','Bewegung'), ('Treppe statt Aufzug','Bewegung'),
    ('Wasser trinken','Ernährung'), ('Gemüse essen','Ernährung'), ('Obst essen','Ernährung'),
    ('Kein Zucker','Ernährung'), ('Zu Hause kochen','Ernährung'), ('Achtsam essen','Ernährung'),
    ('Vor 23 Uhr ins Bett','Schlaf'), ('Kein Handy vor dem Schlafen','Schlaf'),
    ('Feste Aufstehzeit','Schlaf'), ('Kein Koffein nach 14 Uhr','Schlaf'),
    ('Meditieren','Mental'), ('Atemübungen','Mental'), ('Dankbarkeit notieren','Mental'),
    ('Journaling','Mental'), ('Digitale Pause','Mental'), ('Digitale Pause am Abend','Mental'),
    ('Tagesplanung machen','Produktivität'), ('Kein Handy morgens','Produktivität'),
    ('Deep-Work-Block','Produktivität'), ('Abend-Review','Produktivität'), ('Post/Mails checken','Produktivität'),
    ('Lesen','Lernen'),
    ('Bett machen','Haushalt'), ('Pflanzen gießen','Haushalt'),
    ('Küche abends aufräumen','Haushalt'), ('10 Min aufräumen','Haushalt')
  ) as v(name, cat)
 where lower(trim(h.name)) = lower(v.name)
   and h.category is distinct from v.cat;

update public.hab_habits set category = 'Haushalt' where category = 'Alltag';

update public.hab_habits
   set category = 'Sonstiges'
 where category is null
    or category not in ('Bewegung','Ernährung','Schlaf','Mental','Produktivität','Lernen','Haushalt','Soziales','Sonstiges');

update public.hab_habits
   set categories = array[category]
 where categories is distinct from array[category];

-- 4) Einheiten
update public.hab_habits
   set target_count = greatest(0.5, round(target_count / 1000.0 * 2) / 2),
       unit = 'L'
 where unit = 'ml';

update public.hab_habits set unit = 'Gläser'     where unit = 'Glas';
update public.hab_habits set unit = 'Portionen'  where unit = 'Portion';
update public.hab_habits set unit = 'Mahlzeiten' where unit = 'Mahlzeit';
update public.hab_habits set unit = 'Dinge'      where unit in ('Ding', 'Aufgabe');
update public.hab_habits set unit = 'Sätze'      where unit = 'Satz';
-- "×" war nur "einfach abhaken" bzw. "Mal": ohne Menge → Ja/Nein, mit Menge → Dinge
update public.hab_habits set unit = null    where unit = '×' and target_count <= 1;
update public.hab_habits set unit = 'Dinge' where unit = '×' and target_count > 1;

commit;

-- OPTIONAL, einmalig: bestehende Vorlagen-Gewohnheiten auf die neuen Ziele umstellen.
-- Bereits abgehakte Tage bleiben erledigt (gespeicherte Zahl >= neues Ziel).
--
--   -- Ja/Nein statt Zähler
--   update public.hab_habits set unit = null, target_count = 1
--    where lower(trim(name)) in ('meditieren','atemübungen','dankbarkeit notieren',
--                                'digitale pause','lesen','gemüse essen');
--   -- Wasser trinken in Litern
--   update public.hab_habits set unit = 'L', target_count = 2
--    where lower(trim(name)) = 'wasser trinken' and unit is distinct from 'L';
--   -- Uhrzeit-Ziele
--   update public.hab_habits set goal_time = '06:30', unit = null, target_count = 1
--    where lower(trim(name)) = 'feste aufstehzeit' and goal_time is null;
--   update public.hab_habits set goal_time = '14:00', unit = null, target_count = 1
--    where lower(trim(name)) = 'kein koffein nach 14 uhr' and goal_time is null;
