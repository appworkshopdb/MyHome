# Kalender

Aus `CLAUDE.md` ausgelagert (17.11.2026). Vor Arbeit an diesem Bereich lesen; Änderungen hier pflegen, nicht in `CLAUDE.md`.

## Google-Kalender-Integration (Kurzüberblick)

Tabellen: `oauth_states` (CSRF-State, mit `expires_at`), `google_calendar_connections`
(1 Zeile/User, Vault-Secret-ID), `google_calendars` (Liste der Google-Kalender
des Users inkl. `color`, `summary`, `sync_enabled`), `calendar_events`
(vereinheitlichte Events-Tabelle, Google-Zeilen mit `source_module='google'`,
Unique-Constraint `calendar_events_google_uidx` auf
`(owner_id, google_calendar_id, google_event_id)`).

`google_calendars.sync_enabled` existiert bereits in der DB, wird aber vom
Frontend noch nicht genutzt — geplantes Feature: echtes Ein-/Ausblenden
einzelner Google-Kalender (wie in Googles eigener Kalenderliste), noch nicht
umgesetzt.
