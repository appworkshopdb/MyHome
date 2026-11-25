# Statistiken

Aus `CLAUDE.md` ausgelagert (17.11.2026). Vor Arbeit an diesem Bereich lesen; Änderungen hier pflegen, nicht in `CLAUDE.md`.

## Wochen- und Monatsüberblick (Hub → Statistiken)

Im Hub steht unter dem Kalender EIN Bereich "Statistiken" → `core/Statistiken.jsx` (Auswahl
Wochenüberblick / Monatsüberblick). Eigene Core-Routen wie `profile`, damit die Pushes direkt
verlinken können: `#/statistiken`, `#/statistiken/woche`, `#/statistiken/monat`. Beide Überblicke
sind `core/PeriodReview.jsx` (`kind` = week | month, `‹ ›` blättert zurück). Rechnung rein in
`core/lib/periodStats.js`: Woche = Mo–So, eine Spalte je Tag; Monat = Kalendermonat, eine Spalte je
Kalenderwoche. Gewohnheiten rechnen wie die Statistik im Habits-Modul (Helfer in
`core/lib/habitStatsMath.js`, `habUtils.js`/`StatsView.jsx` importieren sie von dort; Vergleich mit
gleich vielen Tagen des Zeitraums davor), Training = erledigt von geplant (Ruhetage zählen nicht),
Ernährung = erfasste Tage aus `nut_meals`, Ø-kcal gegen Tagesziel, Protein-Ziel = ≥ 90 % des
Tagesziels (ohne vollständiges Körperprofil nur Tage). Der Gesamtring mittelt die Karten, die im
Zeitraum Daten haben.

Pushes (Function `send-notifications`, ausrollen mit `tools/deploy-functions.sh send-notifications`):
`weekly_recap` Montag 07:00 (Vorwoche → `#/statistiken/woche`) und `monthly_recap` am 1. um 09:00
(Vormonat → `#/statistiken/monat`). Beide nur, wenn im Zeitraum etwas erfasst wurde, und OHNE
Anrechnung aufs Tageslimit von 2 (sonst würden sie Finanzen/Aufgaben an Montagen und Monatsersten
verdrängen); Throttle 6 bzw. 25 Tage. Toggles "Wochenüberblick"/"Monatsüberblick" im Menü
(`AppMenu.jsx`, Standard an). Test: `?test_owner=<uuid>&test_category=weekly_recap` bzw.
`monthly_recap` (rechnet mit der letzten vollen Woche/dem letzten vollen Monat).
Die Function nimmt nur Aufrufe mit `Authorization: Bearer <SUPABASE_SERVICE_ROLE_KEY>` an
(so ruft pg_cron auf), alles andere bekommt 401 — auch Tests mit `test_owner`. Die Edge
Runtime läuft mit `VERIFY_JWT=false`, die Prüfung steht deshalb in der Function selbst.
Den Schlüssel nie ausgeben oder in Befehle schreiben, die im Verlauf landen.
