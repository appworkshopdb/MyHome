-- Modul-Tutorials: welche Einführungen eine Person schon gesehen hat.
-- Liegt wie der Rest des Onboardings in body_profile (eine Zeile pro Nutzer).
--
-- VOR dem Ausführen live prüfen (nicht nur in Studio):
--   docker exec -it supabase-db psql -U postgres -d postgres -c '\d public.body_profile'
alter table public.body_profile add column if not exists tutorials_done text[] not null default '{}';

-- Bestandsnutzer kennen die App: für sie gelten ALLE Tutorials als gesehen.
-- Nur neue Konten (Zeile entsteht erst im Registrierungs-Wizard) starten leer.
-- Ids müssen zu core/lib/tutorials.js passen.
update public.body_profile
   set tutorials_done = array['hub','habits','nutrition','finance','sport','shopping']
 where tutorials_done = '{}';

-- Zum Testen mit dem eigenen Konto alle Tutorials wieder anzeigen:
--   update public.body_profile set tutorials_done = '{}'
--    where owner_id = (select id from auth.users where email = 'DEINE@ADRESSE');
