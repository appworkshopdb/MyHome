-- =====================================================================
-- Produktion nachziehen, Teil 1 (Supabase Cloud, SQL-Editor)
-- =====================================================================
-- Bündelt die bestehenden, idempotenten Migrationen, die der aktuelle
-- App-Stand braucht (Reihenfolge wie unten). Mehrfach ausführbar.
--
-- NICHT enthalten (kommt erst nach dem Schema-Abgleich Staging <-> Produktion):
--   nutrition_catalog*, nut_recipe_categories, nut_recipe_cover, analytics (100-104),
--   Google-Kalender-Tabellen.
--
-- Die drei Spalten in fin_entries unten haben im Repo keine eigene Migration
-- (wurden live angelegt); Typen vorläufig angenommen, per Abgleich bestätigen.
-- =====================================================================

-- ---- fin_entries: Teilzahlungen, Fälligkeit, Notiz --------------------
alter table public.fin_entries add column if not exists payments jsonb;
alter table public.fin_entries add column if not exists due_date date;
alter table public.fin_entries add column if not exists note text;

-- ---- avatar_migration.sql ----------------------------------------
-- Profilbild (256×256 JPEG als Data-URL, ca. 15–30 KB)
alter table public.body_profile add column if not exists avatar text;

-- ---- bird_species_migration.sql ----------------------------------
-- Vogelart (Rotkehlchen / Blaumeise), gewählt im Willkommens-Assistenten
alter table public.gamification_status add column if not exists bird_species text
  check (bird_species is null or bird_species in ('robin', 'meise'));

-- ---- onboarding_migration.sql ------------------------------------
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

-- ---- tutorials_migration.sql -------------------------------------
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

-- ---- hab_stats_hidden_migration.sql ------------------------------
-- Gewohnheiten: beim Löschen wählen, ob die Werte in der Statistik bleiben.
--
-- stats_hidden = true  → gelöschte Gewohnheit zählt in keiner Statistik mehr
-- stats_hidden = false → (Default) gelöschte Gewohnheit bleibt für die Tage in
--                        den Statistiken, an denen sie aktiv war
--
-- Gilt nur zusammen mit deleted_at: bei aktiven Gewohnheiten ohne Wirkung.
-- Idempotent: kann mehrfach ausgeführt werden.
--
-- Vor dem Ausführen live prüfen (Studio kann auf eine andere DB zeigen):
--   docker exec -it supabase-db psql -U postgres -d postgres -c "\d public.hab_habits"

alter table public.hab_habits
  add column if not exists stats_hidden boolean not null default false;

-- Optional, einmalig: bereits gelöschte Test-Gewohnheiten aus der Statistik nehmen
-- (Namen vorher prüfen):
--   update public.hab_habits set stats_hidden = true
--    where deleted_at is not null and name ilike 'test%';

-- ---- nut_meals_migration.sql -------------------------------------
-- Mahlzeiten (Verlauf): Tabelle nut_meals — rein additiv, ändert nichts Bestehendes.
--
-- Jede Zeile ist eine MOMENTAUFNAHME einer gegessenen Mahlzeit: Die Nährwerte
-- werden beim Speichern kopiert (nicht aus Rezept/Lebensmittel nachgeschlagen),
-- damit sich der Verlauf nicht ändert, wenn später ein Rezept bearbeitet oder
-- gelöscht wird. Entsprechend kein Fremdschlüssel auf nut_recipes (recipe_id ist
-- nur ein Hinweis).
--
-- Quellen: 'scan' (Foto-Schätzung, is_estimate = true, kcal_low/kcal_high als
-- Spanne) und 'recipe' (eigenes Rezept × Portionen, exakt).
-- Das Foto selbst wird nie gespeichert.
--
-- Nur für die eigene Person sichtbar (RLS auf owner_id) — kein Teilen im
-- Haushalt, anders als Rezepte/Lebensmittel. Löschen ist ein Soft Delete
-- (deleted_at); das Konto zu löschen entfernt alle Zeilen (on delete cascade).
--
-- eaten_on = lokales Kalenderdatum 'YYYY-MM-DD' (von der App aus lokalen
-- Komponenten gebaut, nie aus toISOString — siehe CLAUDE.md).
--
-- Idempotent. Einspielen auf dem Server:
--   docker exec -i supabase-db psql -U postgres -d postgres -v ON_ERROR_STOP=1 < supabase/nut_meals_migration.sql

create table if not exists public.nut_meals (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null references auth.users (id) on delete cascade,
  eaten_on    date not null,
  meal_type   text not null check (meal_type in ('fruehstueck', 'mittag', 'abend', 'snack')),
  name        text not null,
  source      text not null check (source in ('scan', 'recipe')),
  recipe_id   uuid,
  servings    numeric,
  is_estimate boolean not null default false,
  kcal        numeric not null default 0,
  protein     numeric not null default 0,
  carbs       numeric not null default 0,
  sugar       numeric not null default 0,
  fat         numeric not null default 0,
  satfat      numeric not null default 0,
  fiber       numeric not null default 0,
  salt        numeric not null default 0,
  kcal_low    numeric,
  kcal_high   numeric,
  items       jsonb not null default '[]'::jsonb,
  note        text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  deleted_at  timestamptz
);

create index if not exists idx_nut_meals_owner_day
  on public.nut_meals (owner_id, eaten_on)
  where deleted_at is null;

alter table public.nut_meals enable row level security;

drop policy if exists "eigene Mahlzeiten" on public.nut_meals;
create policy "eigene Mahlzeiten" on public.nut_meals
  for all to authenticated
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

grant select, insert, update, delete on public.nut_meals to authenticated;

-- PostgREST soll die neue Tabelle sofort kennen
notify pgrst, 'reload schema';

-- ---- receipt_scans_migration.sql ---------------------------------
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

-- ---- fin_report_prefs_migration.sql ------------------------------
-- Gespeicherte Ansicht der Finanz-Auswertung (Reihenfolge, ein-/ausgeblendete
-- Bereiche, Filter). Eine Zeile pro Nutzer, Inhalt als jsonb.
--
-- Ausführen auf dem Server (NICHT nur über Studio — Studio kann auf eine andere
-- DB zeigen, siehe CLAUDE.md):
--   docker exec -i supabase-db psql -U postgres -d postgres < fin_report_prefs_migration.sql
--
-- Ohne diese Tabelle läuft die Auswertung weiter, speichert die Ansicht dann
-- aber nur lokal im Browser (kein Sync zwischen Geräten).

create table if not exists public.fin_report_prefs (
  owner_id   uuid primary key references auth.users (id) on delete cascade,
  layout     jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.fin_report_prefs enable row level security;

drop policy if exists "eigene Auswertungs-Ansicht" on public.fin_report_prefs;
create policy "eigene Auswertungs-Ansicht" on public.fin_report_prefs
  for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

-- set_updated_at() existiert bereits (schema.sql); sicherheitshalber anlegen.
create or replace function public.set_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

drop trigger if exists trg_fin_report_prefs_updated on public.fin_report_prefs;
create trigger trg_fin_report_prefs_updated before update on public.fin_report_prefs
  for each row execute function public.set_updated_at();

grant select, insert, update, delete on public.fin_report_prefs to authenticated;

-- PostgREST soll die neue Tabelle sofort kennen
notify pgrst, 'reload schema';

-- PostgREST-Schema neu laden
notify pgrst, 'reload schema';
