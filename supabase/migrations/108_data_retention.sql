-- 108: Löschfristen für Protokolltabellen (Art. 5 Abs. 1 lit. e DSGVO)
--
-- Datenschutzbericht 2026-11, Entscheidung 2026-11-19. Täglich 04:30 UTC
-- (pg_cron läuft in UTC) = 05:30 Uhr Berlin im Winter, 06:30 Uhr im Sommer.
--
--  - notification_log: nach 90 Tagen. send-notifications schaut höchstens
--    25 Tage zurück (THROTTLE_DAYS.monthly_recap).
--  - receipt_scans: enthält nur Zähler und Kosten der Foto-Scans (kein Bild,
--    kein Inhalt). Das Kontingent zählt je Monat (period 'YYYY-MM', Berlin),
--    deshalb wird nach Periode gelöscht: behalten werden der laufende und die
--    zwei vorigen Monate. Eine feste 30-Tage-Frist würde Scans des laufenden
--    Monats löschen und das Kontingent zu niedrig zählen.
--  - oauth_states: abgelaufene Einträge (cleanup_old_oauth_states). Läuft
--    schon bei jedem Connect/Callback, hier als Absicherung.
--
-- Nicht hier: analytics_events (löscht analytics_rollup nach 90 Tagen),
-- cron.job_run_details (Migration 105), gamification_events (Punkteverlauf,
-- bleibt für die Laufzeit des Kontos).
--
-- cron.schedule mit Jobnamen ist idempotent, die Migration kann erneut laufen.

select cron.schedule(
  'data-retention',
  '30 4 * * *',
  $$
  delete from public.notification_log where sent_at < now() - interval '90 days';
  delete from public.receipt_scans
    where period < to_char((now() at time zone 'Europe/Berlin') - interval '2 months', 'YYYY-MM');
  select public.cleanup_old_oauth_states();
  $$
);
