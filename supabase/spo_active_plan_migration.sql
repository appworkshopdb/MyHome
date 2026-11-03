-- Sport: aktiver Trainingsplan ("Dauerplan") — rein additiv, ändert nichts Bestehendes.
--
-- Ein Plan wird einmal aktiviert und füllt den Kalender danach selbst auf
-- (App-seitig, 28 Tage im Voraus, siehe src/core/lib/sportPlanSync.js). Die
-- Einheiten bleiben echte Zeilen in spo_workouts, damit Kalender, Hub,
-- Wochen-/Monatsüberblick, Auswertung und der Morgen-Push unverändert
-- weiterrechnen.
--
-- spo_active_plan: genau eine Zeile pro Person (owner_id ist der Schlüssel).
--   plan_id    der aktive Plan (spo_plans)
--   start_date Tag 1 des Zyklus; der Zyklus läuft von hier an endlos weiter
--              (Tag im Plan = (Datum − start_date) mod Anzahl Plan-Tage). Beim
--              Ändern des Plans bleibt start_date, der Plan läuft an derselben
--              Stelle im Zyklus weiter.
--
-- spo_workouts.auto_planned: true = Zeile stammt vom Auffüller und ist
-- unberührt. Wird sie bearbeitet, setzt die App das Flag auf false (dann ist
-- es ein eigener Eintrag). Eigene Einträge haben Vorrang: Legt jemand an einem
-- Tag etwas selbst an, wird die Plan-Zeile dieses Tages per deleted_at
-- ausgeblendet; löscht er den eigenen Eintrag, legt der Auffüller sie neu an.
--
-- Der Teil-Index verhindert zwei Plan-Zeilen am selben Tag, auch wenn zwei
-- Geräte gleichzeitig auffüllen (die App ignoriert den Fehler 23505).
--
-- VOR dem Einspielen live prüfen (CLAUDE.md: das Repo-Schema ist nicht
-- verlässlich, für spo_* gibt es hier keine Migration):
--   docker exec -it supabase-db psql -U postgres -d postgres -c '\d public.spo_workouts' -c '\d public.spo_plans'
-- Erwartet: spo_workouts hat owner_id, occurred_on, status, is_rest, deleted_at,
-- plan_id, plan_day_index; spo_plans.id ist uuid.
--
-- Staging und main teilen ein Backend, daher nur additiv. Reihenfolge: erst
-- diese Migration, dann die App ausrollen. Ohne die Migration läuft die App
-- weiter, der Dauerplan ist dann nur nicht nutzbar.
--
-- Idempotent. Einspielen auf dem Server:
--   docker exec -i supabase-db psql -U postgres -d postgres -v ON_ERROR_STOP=1 < supabase/spo_active_plan_migration.sql

create table if not exists public.spo_active_plan (
  owner_id   uuid primary key references auth.users (id) on delete cascade,
  plan_id    uuid not null references public.spo_plans (id) on delete cascade,
  start_date date not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.spo_active_plan enable row level security;

drop policy if exists "eigener aktiver Plan" on public.spo_active_plan;
create policy "eigener aktiver Plan" on public.spo_active_plan
  for all to authenticated
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

grant select, insert, update, delete on public.spo_active_plan to authenticated;

alter table public.spo_workouts
  add column if not exists auto_planned boolean not null default false;

create unique index if not exists spo_workouts_auto_day_uidx
  on public.spo_workouts (owner_id, occurred_on)
  where auto_planned and deleted_at is null;

notify pgrst, 'reload schema';
