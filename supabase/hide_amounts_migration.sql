-- "Beträge ausblenden" (Auge in der Saldo-Karte des Hubs) pro Nutzer statt pro Gerät.
-- Liegt wie die übrigen Nutzer-Einstellungen in body_profile (eine Zeile pro Nutzer).
-- Rein additiv; Staging und main teilen ein Backend, die ältere main-App ignoriert die Spalte.
--
-- VOR dem Ausführen live prüfen (nicht nur in Studio):
--   docker exec -it supabase-db psql -U postgres -d postgres -c '\d public.body_profile'
-- Ohne die Spalte läuft die App weiter, merkt sich die Einstellung aber nur lokal
-- (je Nutzer auf dem Gerät).
alter table public.body_profile add column if not exists hide_amounts boolean not null default false;
