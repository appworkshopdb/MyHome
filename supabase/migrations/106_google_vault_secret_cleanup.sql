-- 106: Google-Refresh-Token im Vault mitlöschen, wenn die Verbindung wegfällt
--
-- google_calendar_connections, google_calendars und oauth_states hängen per
-- Fremdschlüssel an public.profiles (ON DELETE CASCADE), profiles hängt mit
-- CASCADE an auth.users. Eine Kontolöschung entfernt diese Zeilen also schon.
-- Übrig blieb nur das Secret in vault.secrets, auf das
-- google_calendar_connections.refresh_token_secret_id zeigt (Datenschutzbericht
-- 2026-11, Art. 17 DSGVO; Entscheidung 2026-11-19).
--
-- Der Trigger löscht das Secret nach jedem Löschen einer Verbindungszeile, egal
-- ob durch Kontolöschung oder Trennen. Die Function google-calendar-disconnect
-- löscht das Secret vorher selbst; dann trifft der Trigger keine Zeile mehr.
-- Rein additiv, die Migration kann erneut laufen.

create or replace function public.delete_google_secret_on_connection_delete()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.refresh_token_secret_id is not null then
    delete from vault.secrets where id = old.refresh_token_secret_id;
  end if;
  return old;
end;
$$;

revoke execute on function public.delete_google_secret_on_connection_delete() from public, anon, authenticated;

drop trigger if exists trg_google_connection_delete_secret on public.google_calendar_connections;
create trigger trg_google_connection_delete_secret
  after delete on public.google_calendar_connections
  for each row execute function public.delete_google_secret_on_connection_delete();
