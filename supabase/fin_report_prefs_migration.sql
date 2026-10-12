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
