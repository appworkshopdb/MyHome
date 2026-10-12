-- Vogelart (Rotkehlchen / Blaumeise), gewählt im Willkommens-Assistenten
alter table public.gamification_status add column if not exists bird_species text
  check (bird_species is null or bird_species in ('robin', 'meise'));
