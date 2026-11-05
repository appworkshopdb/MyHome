-- Sicherheits-Härtung (Stand: Prüfung der Live-DB am 2026-11-05)
--
-- Einspielen auf dem Server (NICHT über Studio, siehe CLAUDE.md):
--   docker exec -i supabase-db psql -U postgres -d postgres < security_hardening_migration.sql
--
-- ACHTUNG: Staging und Produktion teilen EIN Backend. Die Änderungen wirken sofort
-- auch für die (ältere) main-App. Nach dem Einspielen mit Staging testen: ausloggen,
-- einloggen, Einkauf/Ernährung/Finanzen/Sport speichern, Rezept speichern, Konto neu
-- registrieren. Alles hier ist per GRANT/CREATE POLICY wieder umkehrbar.
--
-- Annahme (im Frontend geprüft): Die App SCHREIBT nie in households/household_members,
-- sie liest nur (nutData.getHouseholdId). Haushalte legst du von Hand/Service-Role an.
-- Wird später eine Einladungs-Funktion gebaut, muss sie als Edge Function (service_role)
-- oder als SECURITY DEFINER-RPC mit Prüfung laufen, nicht über Client-Schreibrechte.

begin;

-- ---------------------------------------------------------------------
-- 1. Haushalte: Clients dürfen nur LESEN.
--    Vorher konnte sich jeder angemeldete Nutzer per INSERT in jeden Haushalt
--    eintragen (user_id = auth.uid()) und danach geteilte Rezepte/Lebensmittel lesen;
--    jedes Mitglied durfte den Haushalt außerdem ändern/löschen.
-- ---------------------------------------------------------------------
drop policy if exists "eigene Mitgliedschaften" on public.household_members;
drop policy if exists "eigene Mitgliedschaften lesen" on public.household_members;
create policy "eigene Mitgliedschaften lesen"
  on public.household_members
  for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists "eigene Haushalte" on public.households;
drop policy if exists "eigene Haushalte lesen" on public.households;
create policy "eigene Haushalte lesen"
  on public.households
  for select
  to authenticated
  using (
    created_by = auth.uid()
    or id in (
      select hm.household_id
      from public.household_members hm
      where hm.user_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------
-- 2. Rezepte/Lebensmittel: household_id nur setzen dürfen, wenn man Mitglied ist
--    (vorher konnte man Inhalte in fremde Haushalte schieben).
-- ---------------------------------------------------------------------
drop policy if exists "eigene Lebensmittel" on public.nut_foods;
create policy "eigene Lebensmittel"
  on public.nut_foods
  for all
  to authenticated
  using (auth.uid() = owner_id)
  with check (
    auth.uid() = owner_id
    and (
      household_id is null
      or exists (
        select 1 from public.household_members hm
        where hm.household_id = nut_foods.household_id
          and hm.user_id = auth.uid()
      )
    )
  );

drop policy if exists "eigene Rezepte" on public.nut_recipes;
create policy "eigene Rezepte"
  on public.nut_recipes
  for all
  to authenticated
  using (auth.uid() = owner_id)
  with check (
    auth.uid() = owner_id
    and (
      household_id is null
      or exists (
        select 1 from public.household_members hm
        where hm.household_id = nut_recipes.household_id
          and hm.user_id = auth.uid()
      )
    )
  );

-- ---------------------------------------------------------------------
-- 3. Rechte: Die anonyme Rolle (nicht angemeldet) braucht auf public NICHTS.
--    Supabase vergibt standardmäßig alle Rechte (auch TRUNCATE, das RLS umgeht).
--    RLS bleibt als zweite Schicht bestehen.
-- ---------------------------------------------------------------------
revoke all on all tables    in schema public from anon;
revoke all on all sequences in schema public from anon;

-- Künftige Tabellen/Sequenzen/Funktionen (angelegt von postgres) bekommen anon nicht mehr.
alter default privileges for role postgres in schema public revoke all on tables    from anon;
alter default privileges for role postgres in schema public revoke all on sequences from anon;
alter default privileges for role postgres in schema public revoke execute on functions from anon;

-- Angemeldete Nutzer brauchen weder TRUNCATE noch REFERENCES noch TRIGGER.
revoke truncate, references, trigger on all tables in schema public from authenticated;

-- ---------------------------------------------------------------------
-- 4. Funktionen, die nur intern laufen sollen (Trigger bzw. Aufräumen):
--    nicht per RPC (/rest/v1/rpc/...) aufrufbar. EXECUTE kommt standardmäßig über
--    PUBLIC; deshalb von public UND den API-Rollen entziehen.
--    Trigger laufen weiter (EXECUTE wird nur beim CREATE TRIGGER geprüft).
-- ---------------------------------------------------------------------
revoke execute on function public.log_body_weight()          from public, anon, authenticated;
revoke execute on function public.handle_new_user()          from public, anon, authenticated;
revoke execute on function public.cleanup_old_oauth_states() from public, anon, authenticated;
grant  execute on function public.cleanup_old_oauth_states() to service_role;

commit;

-- ---------------------------------------------------------------------
-- Kontrolle danach (einzeln ausführen):
--   select count(*) from information_schema.role_table_grants
--     where table_schema='public' and grantee='anon';            -- erwartet: 0
--   select proname, has_function_privilege('anon', p.oid, 'execute') anon_exec
--     from pg_proc p join pg_namespace n on n.oid=p.pronamespace
--     where n.nspname='public' and prosecdef order by 1;          -- überall f
--   select tablename, policyname, cmd from pg_policies
--     where tablename in ('households','household_members');      -- nur SELECT
--
-- Rückgängig (Beispiele):
--   grant select, insert, update, delete on public.<tabelle> to anon;
--   grant execute on function public.log_body_weight() to public;
-- ---------------------------------------------------------------------
