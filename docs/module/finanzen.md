# Finanzen

Aus `CLAUDE.md` ausgelagert (17.11.2026). Vor Arbeit an diesem Bereich lesen; Änderungen hier pflegen, nicht in `CLAUDE.md`.

## Finanz-Auswertung (Dashboard)

`SummaryView.jsx` + `components/report/` + `lib/analytics.js` (reine Rechenlogik,
Sparschwein-Regeln wie Übersicht/Buchungen). Zehn Bereiche, je ein-/ausblend-,
einklapp- und sortierbar; Ansicht + Filter liegen pro Nutzer in `fin_report_prefs`
(Migration `supabase/fin_report_prefs_migration.sql`, per `docker exec ... psql`
einspielen — ohne Tabelle speichert die App nur lokal). Jeder Bereich nennt in
`SECTIONS` (sections.jsx), welche globalen Filter er beachtet.

Teilzahlungen: Logik zentral in `core/lib/paymentParts.js` (`openAmount`, `entryParts`, `setPartsPaid`). Bar/Gutschein/Sparschwein gelten sofort als bezahlt; "offen" ist nur die Summe der unbezahlten Teilzahlungen (`payments[].paid`, jsonb, keine Migration). Zeilen-`paid` = alles bezahlt und maßgeblich, wenn `true`. "Offener Posten" = `isOpenExpense` (Ausgabe, keine Sparschwein-Einzahlung "Ersparnisse", Restbetrag > 0) — dieselbe Regel in Hub, Finanzen-Listen/Zählern und `send-notifications` (dupliziert), sonst weichen Anzahl/Summe ab. Finanz-Schreibzugriffe (`finData`) verwerfen den Hub-Cache (`core/lib/hubCache.js`, Version im Schlüssel bei Strukturänderung erhöhen); der Saldo bleibt unverändert (alle Ausgaben abgezogen).

Buchungen (`MonthsView`): Tipp auf einen Posten öffnet `EntryDetailSheet` (Status offen/bezahlt
per Tipp, Details, Löschen); "Bearbeiten" macht dieselbe Ansicht an Ort und Stelle änderbar (Entwurf, Speichern/Abbrechen).
`saveEntry` übernimmt ein ausdrücklich übergebenes `paid`; nur ohne Angabe wird es aus den
Zahlungsarten abgeleitet (Bar/Gutschein/Sparschwein = sofort bezahlt).
