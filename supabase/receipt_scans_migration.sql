-- Foto-Scans: Monatskontingent pro Nutzer und Art (Edge Function scan-receipt).
--
-- Pro Scan, der Claude erreicht, eine Zeile. Das Limit (Default 30 pro Monat
-- und Art, RECEIPT_MONTHLY_LIMIT / MEAL_MONTHLY_LIMIT) prüft ausschließlich die
-- Function — mit dem service_role-Key, der RLS umgeht. Die Tabelle ist bewusst
-- für App-Nutzer komplett gesperrt (RLS an, keine Policy, keine Grants): Wer sie
-- selbst lesen oder beschreiben könnte, könnte sein Kontingent zurücksetzen.
--
-- period = Kalendermonat in Europe/Berlin als 'YYYY-MM'. Die Function bestimmt
--          ihn selbst; so braucht es keine Zeitzonen-Rechnung in der Datenbank.
-- kind   = Art des Scans: 'receipt' (Kassenbon, Finanzen) oder 'meal'
--          (Mahlzeit, Ernährung). Jede Art hat ihr eigenes Kontingent.
-- model, input_tokens, output_tokens, cost_usd = Verbrauch des Scans (von der
--          Function nach der Antwort eingetragen) — Kostenkontrolle pro Nutzer.
--          cost_usd ist ein Schnappschuss mit den Preisen der Function; die Tokens
--          reichen, um später mit anderen Preisen nachzurechnen. Nicht in der App
--          sichtbar (die Tabelle ist für App-Nutzer gesperrt). Zeilen ohne Werte
--          sind Scans aus der Zeit vor dieser Erweiterung.
--
-- Idempotent: kann mehrfach ausgeführt werden. Bestehende Zeilen gelten als
-- 'receipt'. Die Spalte kind ist abwärtskompatibel — die ältere Function ohne
-- kind trägt automatisch 'receipt' ein. Erst diese Migration einspielen, dann
-- die neue Function ersetzen.
-- Einspielen auf dem Server:
--   docker exec -i supabase-db psql -U postgres -d postgres < supabase/receipt_scans_migration.sql

create table if not exists public.receipt_scans (
  id            uuid primary key default gen_random_uuid(),
  owner_id      uuid not null references auth.users (id) on delete cascade,
  period        text not null check (period ~ '^\d{4}-\d{2}$'),
  kind          text not null default 'receipt' check (kind in ('receipt', 'meal')),
  model         text,
  input_tokens  integer,
  output_tokens integer,
  cost_usd      numeric(10, 6),
  created_at    timestamptz not null default now()
);

-- Für Installationen, die die Tabelle schon ohne kind angelegt haben
alter table public.receipt_scans
  add column if not exists kind text not null default 'receipt' check (kind in ('receipt', 'meal'));

alter table public.receipt_scans
  add column if not exists model         text,
  add column if not exists input_tokens  integer,
  add column if not exists output_tokens integer,
  add column if not exists cost_usd      numeric(10, 6);

create index if not exists idx_receipt_scans_owner_period
  on public.receipt_scans (owner_id, period);
create index if not exists idx_receipt_scans_owner_period_kind
  on public.receipt_scans (owner_id, period, kind);

alter table public.receipt_scans enable row level security;

-- Supabase vergibt auf neue Tabellen standardmäßig Rechte an anon/authenticated.
-- Hier ausdrücklich entziehen (service_role behält seine Rechte).
revoke all on public.receipt_scans from anon, authenticated;

-- PostgREST soll die neue Spalte sofort kennen
notify pgrst, 'reload schema';

-- Kosten pro Nutzer und Monat (nur auf dem Server per psql, nicht in der App):
--   select owner_id, period, kind, count(*) as scans,
--          sum(input_tokens) as in_tok, sum(output_tokens) as out_tok,
--          round(sum(cost_usd), 4) as usd
--   from public.receipt_scans
--   group by 1, 2, 3 order by period desc, usd desc nulls last;
