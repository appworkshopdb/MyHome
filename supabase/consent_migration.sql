-- Tracking-Einwilligung pro Nutzer (statt nur pro Gerät im localStorage).
-- Liegt wie der Rest des Onboardings in body_profile (eine Zeile pro Nutzer).
-- Damit fragt die App nach Abmelden/Anmelden, auf einem neuen Gerät oder nach
-- Neuinstallation nicht erneut, sondern übernimmt die gespeicherte Entscheidung.
--
-- VOR dem Ausführen live prüfen (nicht nur in Studio):
--   docker exec -it supabase-db psql -U postgres -d postgres -c '\d public.body_profile'
-- Ohne diese Spalten läuft die App weiter, merkt sich die Entscheidung aber nur
-- lokal (je Nutzer auf dem Gerät).
alter table public.body_profile add column if not exists analytics_consent text
  check (analytics_consent in ('granted', 'denied'));
alter table public.body_profile add column if not exists analytics_consent_at timestamptz;
alter table public.body_profile add column if not exists analytics_consent_version int;
