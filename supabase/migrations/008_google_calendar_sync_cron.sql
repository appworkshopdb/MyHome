-- Google-Kalender-Sync für alle verbundenen Nutzer alle 15 Minuten.
--
-- VOR dem Einspielen live prüfen (Repo-Schema ist teils veraltet):
--   select jobname, schedule, command from cron.job;
-- Der bestehende Benachrichtigungs-Cron zeigt, wie dort URL und Service-Role-Key
-- eingebunden sind — dasselbe Muster hier verwenden, falls es abweicht.
--
-- Der Service-Role-Key gehört NICHT ins Repo. Hier wird er zur Laufzeit aus dem
-- Vault gelesen. Einmalig anlegen (Werte aus Zugangsdaten.env.md):
--   select vault.create_secret('<SERVICE_ROLE_KEY>', 'service_role_key');
--   select vault.create_secret('http://kong:8000',   'functions_internal_url');
-- (Interne Kong-URL des Self-Hosted-Stacks; sonst die öffentliche API-URL.)

create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.unschedule('google-calendar-sync-15min')
where exists (select 1 from cron.job where jobname = 'google-calendar-sync-15min');

select cron.schedule(
  'google-calendar-sync-15min',
  '*/15 * * * *',
  $$
  select net.http_post(
    url     := (select decrypted_secret from vault.decrypted_secrets where name = 'functions_internal_url')
               || '/functions/v1/google-calendar-sync',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key'),
      'Content-Type',  'application/json'
    ),
    body    := '{}'::jsonb,
    timeout_milliseconds := 55000
  );
  $$
);
