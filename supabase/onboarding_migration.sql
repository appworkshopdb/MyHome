-- Onboarding (Erstregistrierung): Anzeigename + Abschluss der Profil-Einrichtung.
-- (Die Vogelwahl liegt separat in gamification_status.bird_species, siehe bird_species_migration.sql.)
-- Liegt wie das Profilbild in body_profile (eine Zeile pro Nutzer).
--
-- VOR dem Ausführen live prüfen (nicht nur in Studio):
--   docker exec -it supabase-db psql -U postgres -d postgres -c '\d public.body_profile'
alter table public.body_profile add column if not exists display_name text;
alter table public.body_profile add column if not exists onboarding_completed_at timestamptz;

-- WICHTIG: Bestandsnutzer sollen den Wizard NICHT durchlaufen müssen.
-- Alle bereits existierenden Konten gelten als „onboarded“. Neue Konten
-- bekommen den Wert erst, wenn sie den Wizard abschließen (Frontend setzt ihn).
insert into public.body_profile (owner_id, onboarding_completed_at)
select id, now() from auth.users
on conflict (owner_id) do update
  set onboarding_completed_at = coalesce(public.body_profile.onboarding_completed_at, now());
