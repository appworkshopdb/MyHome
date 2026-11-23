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

## Laufende Posten (Vorlagen): Löschen und Bearbeiten gelten nur für den Monat

Posten aus einer Fixkosten-Vorlage (`from_template`) sind pro Monat unabhängig (Migration `supabase/fin_template_overrides_migration.sql`, additiv; ohne sie läuft die App weiter, nur ohne diese Merker):
- **Löschen** (`finData.deleteEntry`): Der Posten wird wirklich entfernt, und die Vorlage merkt sich den Monat in `fin_fixtemplates.skipped_months` (`'YYYY-MM'`). `applyMissingFixTemplatesWith` und `syncTemplateEntries` legen dort nichts neu an, auch nicht nach Bearbeiten der Vorlage. Posten ohne Vorlage bleiben beim Soft Delete (`deleted_at`).
- **Von Hand ändern** (Name, Betrag, Zahlung, Ausgabenart im Posten-Dialog, `MonthsView.handleSave`): setzt `fin_entries.template_locked = true`. `syncTemplateEntries` überspringt solche Posten (außer der Monat liegt nicht mehr im Gültigkeitsfenster der Vorlage, dann wird er wie bisher entfernt). Bezahlt/offen und die Notiz sperren nicht.

## Buchungen: Stift- und Papierkorb-Knopf je Posten

In den vier Bereichen der Buchungsliste (Einnahmen, Fixkosten, Variable Kosten, Sonstige Ausgaben; `MonthsView.EntryRow`) hat jede Karte rechts neben dem Betrag zwei kleine Knöpfe (`.fin-row-btn`, `IconEdit` / `IconTrash`):
- **Stift**: öffnet den Posten-Dialog direkt im Bearbeiten-Modus (`EntryDetailSheet` mit `startInEdit`; Tippen auf die Karte öffnet weiter die Ansicht).
- **Papierkorb**: fragt `confirm('Eintrag löschen?')` und löscht über `handleDelete` (Vorlagen-Posten: siehe oben, Monat wird in `skipped_months` vermerkt).
- Nicht in der Liste „Offene Posten“ (offene Frage, ob dort auch).
- Lange Namen und die Meta-Zeile werden mit „…“ abgeschnitten (`.fin-row-info { min-width:0 }`, `white-space:nowrap`); der Abstand zum Betrag bleibt über den Flex-Gap der Zeile konstant, bei schmaleren Displays wird entsprechend früher gekürzt.

## Posten bearbeiten (`EntryEditForm.jsx`)

Die Bearbeitung sieht aus wie "Neuer Eintrag" (`EntrySheet.jsx`, gleiche Bausteine aus `WizardKit`: `WizardFrame`, `WheelPicker`, `DateButton`, `MoreButton`, `SegGroup`). `EntryDetailSheet` zeigt weiter die Ansicht und wechselt per "Bearbeiten", Stift in der Liste oder Tipp auf ein Feld der Ansicht in die Bearbeitung; "Speichern" kehrt zur Ansicht zurück, das X schließt das Sheet.
- Ein Schritt (kein Fortschritt, kein Zurück). Name, Betrag, Regler Kategorie (fünf Einträge: wie beim Anlegen plus "Fixeinnahme") und Zahlungsart, darunter Status (Offen | Bezahlt, nur bei Ausgaben; bei nur Bar/Gutschein/Sparschwein nur ein Hinweis, weil diese sofort als bezahlt gelten).
- "Mehr Details": Fällig am (Kalender), Zahlung aufteilen (wie beim Anlegen, dazu je Teilzahlung ein Haken "bezahlt", Sofort-Zahlarten fest gesetzt), Notiz, Herkunft und "Eintrag löschen" (mit der Nachfrage aus `MonthsView.handleDelete`). Startet offen, wenn der Posten schon Datum, Notiz oder eine Aufteilung hat.
- Teilzahlungen: letzte Zeile ist immer der Rest; gespeichert wird wie bisher `payments` (Methode, Betrag, `paid`).

## Saldo-Karte

"+ Ein  − Aus" ergibt immer den Saldo: Aus = Ausgaben + Gespartes (Sparschwein-Einzahlungen minus Entnahmen), Ein ohne Entnahmen (Übersicht und Buchungen). Der Hub rechnet seine Ein/Aus-Zahlen aus den Messwerten (Sparschwein-Bewegungen dort als Aus/Ein) und zeigt daher andere Teilzahlen bei gleichem Saldo.

**Fokuskarte (Übersicht, Buchungen, Hub):** große Zahl = Saldo **nach** den offenen Zahlungen (wie bisher); darunter "Aktuell inkl. offener Zahlung(en): X" = Saldo + offene Zahlungen, nur wenn etwas offen ist. Der Balken zeigt bezahlt ausgefüllt und offen schraffiert (`FocusCard.Progress` mit `open`). **Einnahmen mit Fälligkeitsdatum in der Zukunft zählen erst ab diesem Tag** (`isIncomePending` in `core/lib/paymentParts.js`; heute zählt schon; ohne Datum zählt sofort), "Ein" auf der Karte zeigt nur die schon erhaltenen. Der Hub holt dafür die Einnahmen mit Datum extra (`loadPendingIncome`) und zieht sie vom Einnahmen-Messwert ab. Texte: `offeneZahlungenText` / `offenerZahlungenText` (Zahlung/Zahlungen), `offenePostenText` (Posten) in der Liste "Offene Posten". Posten aus Vorlagen bekommen ihr Fälligkeitsdatum aus dem Tag der Vorlage (siehe unten).

## Verträge (Seite `#/finance/vertraege`)

`ContractsView.jsx`: zwei Gruppen, **Einnahmen** und **Fixkosten & Verträge**, je Eintrag eine Karte (`.vt-*` in `design-v2.css`), ohne Fokuskarte; Summe pro Monat rechts neben der Gruppenüberschrift, darunter "N aktiv · … pro Jahr". Drei Symbole (`ContractIcons.jsx`): Einnahme = Münze mit Euro, Fixkosten = Kalender, Vertrag = Dokument. Abgelaufene sind eingeklappt, "Hinzufügen" ist eine gestrichelte Karte.
Alle Fenster dieser Seite = `RecurringSheet.jsx` (ersetzt `FixTemplateModal`, `ContractModal`, `PaymentBadge`): "Einnahme hinzufügen" (Vorlage `fixeinnahmen`), "Hinzufügen" mit Art Fixkosten | Vertrag, beim Bearbeiten steht die Art fest und es gibt "Löschen" (auch für Verträge, das ging vorher in der Oberfläche nicht). **Fixkosten** sind Vorlagen (`fin_fixtemplates`) und legen jeden Monat eine Buchung an; **Verträge** (`fin_contracts`) erscheinen nur in der Übersicht und buchen nichts. Neue Verträge lassen sich seit diesem Umbau in der Oberfläche anlegen. Entwurf: Mockup-Runde "Verträge" (Satz 1 der Symbole).

## Einstellungen (Seite `#/finance/einstellungen`)

`SettingsView.jsx` (Entwurf: Mockup "Einstellungen", Variante B): Fokuskarte "Backup erstellen" mit "JSON exportieren" als Hauptaktion, darunter "Importieren" (JSON) und "Aus Excel" (XLSX, SheetJS wird erst bei Bedarf geladen), getrennt der "Gefahrenbereich". Nach dem Excel-Einlesen öffnet sich das Fenster "Excel-Datei lesen" (gefundene Einträge und Ersparnis-Monate, dann "Jetzt importieren"). **Alle Daten löschen** öffnet ein Fenster, in dem das Wort **"Löschen"** eingetippt werden muss (Groß-/Kleinschreibung egal), erst dann wird der rote Knopf aktiv (ersetzt die zwei `confirm()`-Rückfragen). Gelöscht werden nur Finanzdaten (`fin_entries`, `fin_savings`, `fin_contracts`, `fin_fixtemplates`).

**Fälligkeit bei Vorlagen und Verträgen:** Im Fenster steht "Fällig am" als Kalender-Datum (optional); gespeichert wird weiter nur der Tag im Monat (`due_day`, keine Migration), die Anzeige bleibt im laufenden Monat. Daraus bekommt jeder Monatsposten ein Fälligkeitsdatum (`dueDateFor` in `finance.js`, Tag auf die Monatslänge begrenzt): beim Anlegen, beim Speichern der Vorlage (nur ungesperrte Posten) und als Nachtrag beim Laden des Monats für Posten ohne Datum. **Nur laufender und zukünftiger Monat**; rückwirkend angelegte Posten alter Monate bekommen keins (sonst wären sie sofort überfällig und kämen in die Morgen-Pushes). Ein von Hand geändertes Datum sperrt den Posten wie Name/Betrag (`template_locked`). Folge: Fixkosten aus Vorlagen erscheinen mit Datum im Tagesplan und als überfällig, Einnahmen aus Vorlagen zählen in der Fokuskarte erst ab ihrem Tag.

