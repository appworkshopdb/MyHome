-- 105: Löschfrist für das pg_cron-Protokoll (cron.job_run_details)
--
-- pg_cron protokolliert jeden Joblauf und räumt selbst nie auf; die Tabelle
-- wächst unbegrenzt. Das Protokoll wird nur zur Fehlersuche gebraucht,
-- daher werden Einträge nach 14 Tagen gelöscht (Löschkonzept, Entscheidung 2026-11-12).
--
-- Analytics-Rohdaten (public.analytics_events) werden bereits durch
-- public.analytics_rollup() nach 90 Tagen gelöscht — hier nichts zu tun.
--
-- cron.schedule mit Jobnamen ist idempotent (pg_cron >= 1.4 aktualisiert
-- einen bestehenden Job gleichen Namens), die Migration kann also erneut laufen.

select cron.schedule(
  'cron-history-cleanup',
  '45 4 * * *',
  $$delete from cron.job_run_details where end_time < now() - interval '14 days'$$
);
