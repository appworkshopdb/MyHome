-- Beleg-Scan: Monatskontingent pro Nutzer (Edge Function scan-receipt).
--
-- Pro Scan, der Claude erreicht, eine Zeile. Das Limit (Default 30 pro Monat,
-- RECEIPT_MONTHLY_LIMIT) prüft ausschließlich die Function — mit dem
-- service_role-Key, der RLS umgeht. Die Tabelle ist bewusst für App-Nutzer
-- komplett gesperrt (RLS an, keine Policy, keine Grants): Wer sie selbst lesen
-- oder beschreiben könnte, könnte sein Kontingent zurücksetzen.
--
-- period = Kalendermonat in Europe/Berlin als 'YYYY-MM'. Die Function bestimmt
-- ihn selbst; so braucht es keine Zeitzonen-Rechnung in der Datenbank.
--
-- Idempotent: kann mehrfach ausgeführt werden.
-- Einspielen auf dem Server:
--   docker exec -i supabase-db psql -U postgres -d postgres < supabase/receipt_scans_migration.sql

create table if not exists public.receipt_scans (
  id         uuid primary key default gen_random_uuid(),
  owner_id   uuid not null references auth.users (id) on delete cascade,
  period     text not null check (period ~ '^\d{4}-\d{2}$'),
  created_at timestamptz not null default now()
);

create index if not exists idx_receipt_scans_owner_period
  on public.receipt_scans (owner_id, period);

alter table public.receipt_scans enable row level security;

-- Supabase vergibt auf neue Tabellen standardmäßig Rechte an anon/authenticated.
-- Hier ausdrücklich entziehen (service_role behält seine Rechte).
revoke all on public.receipt_scans from anon, authenticated;

-- PostgREST soll die neue Tabelle sofort kennen
notify pgrst, 'reload schema';
