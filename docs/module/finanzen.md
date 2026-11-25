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
- Auch in der Liste „Offene Posten“ (seit 25.11.2026, gleiche Knöpfe, Zeile mit „von X €“ und Teilzahlungs-Hinweis bleibt).
- Lange Namen und die Meta-Zeile werden mit „…“ abgeschnitten (`.fin-row-info { min-width:0 }`, `white-space:nowrap`); der Abstand zum Betrag bleibt über den Flex-Gap der Zeile konstant, bei schmaleren Displays wird entsprechend früher gekürzt.

## Posten bearbeiten (`EntryEditForm.jsx`)

Die Bearbeitung sieht aus wie "Neuer Eintrag" (`EntrySheet.jsx`, gleiche Bausteine aus `WizardKit`: `WizardFrame`, `WheelPicker`, `DateButton`, `MoreButton`, `SegGroup`). `EntryDetailSheet` zeigt die Ansicht (seit 25.11.2026 ebenfalls im Wizard-Aufbau: `WizardFrame` mit Titel "Posten", Beschriftungen wie im Formular, Werte als Text mit feinen Linien, unten Löschen und Bearbeiten; Tippen auf Kategorie/Zahlungsart, Fällig am oder Notiz öffnet die Bearbeitung, Status und Teilzahlungen lassen sich direkt umschalten) und wechselt per "Bearbeiten", Stift in der Liste oder Tipp auf ein Feld der Ansicht in die Bearbeitung; "Speichern" kehrt zur Ansicht zurück, das X schließt das Sheet.
- Ein Schritt (kein Fortschritt, kein Zurück). Name, Betrag, Regler Kategorie (fünf Einträge: wie beim Anlegen plus "Fixeinnahme") und Zahlungsart, darunter Status (Offen | Bezahlt, nur bei Ausgaben; bei nur Bar/Gutschein/Sparschwein nur ein Hinweis, weil diese sofort als bezahlt gelten).
- "Mehr Details": Fällig am (Kalender), Zahlung aufteilen (wie beim Anlegen, dazu je Teilzahlung ein Haken "bezahlt", Sofort-Zahlarten fest gesetzt), Notiz, Herkunft und "Eintrag löschen" (mit der Nachfrage aus `MonthsView.handleDelete`). Startet offen, wenn der Posten schon Datum, Notiz oder eine Aufteilung hat.
- Teilzahlungen: letzte Zeile ist immer der Rest; gespeichert wird wie bisher `payments` (Methode, Betrag, `paid`).

## Sparpläne (seit 25.11.2026, Migration `supabase/fin_savings_plans_migration.sql`)

Sparziel mit Raten. Daten: Tabelle `fin_savings_plans` (Name, `target_amount`, `target_date` optional, `rhythm` monthly/quarterly, `rate`, `due_day` 1/15/31 = Monatsende, `status` aktiv/beendet) und `fin_entries.savings_plan_id`. Beides additiv; ohne Migration zeigt der Bereich "Sparen" nur das Sparschwein.
- **Raten sind Buchungen:** beim Speichern werden alle Raten als Posten angelegt (`variable_kosten`, Name "Sparrate · <Plan>", Zahlungsart Bank, `paid=false`, `due_date`, `savings_plan_id`). Auf Wunsch des Nutzers sind sie **Variable Kosten** (`isSavingsPlanRate`): sie stehen in den Buchungen unter Variable Kosten (Meta-Zeile "fällig TT.MM.JJJJ"), zählen in Schnellübersicht, Saldo und Auswertung als Ausgabe und sind bis zur Einzahlung offene Posten. Ins Sparschwein zählen sie erst bezahlt (`isCountedDeposit`, ebenso in `core/lib/savingsBalance.js`); `isSparschweinDeposit` erkennt nur "Ersparnisse".
- **Anlegen/Ändern:** `SavingsPlanWizard.jsx` im Aufbau von "Neuer Eintrag": 1 Ziel (Name, Zielbetrag, Bis Datum mit Kalender und Schnellwahl 3/6/12/24 Monate oder Ohne Datum, erste Rate in diesem/nächsten Monat), 2 Plan wählen, 3 Prüfen (Fälligkeitstag). Ändern ersetzt die offenen Raten, eingezahlte bleiben (Vorschläge rechnen mit dem Rest).
- **Vorschläge** (`lib/savingsPlans.js`): Durchschnitt aus `analytics.monthlySeries` ohne Sparschwein-Buchungen. Weniger als 3 abgeschlossene Monate seit der ersten Buchung: alle Monate inkl. laufendem ("Dein aktueller Durchschnitt"), 3–5: letzte 3 ("· letzte 3 Monate"), ab 6: letzte 6. Mit Datum: monatlich gleich, quartalsweise, mit Puffer (2 Monate früher); ohne Datum: 25/50/75 % vom Übrig. Immer aufsteigend nach Rate, Einordnung passt gut (≤ 40 %), machbar (≤ 70 %), knapp (≤ 100 %), mehr als dein Übrig.
- **Plan-Ansicht** (`SavingsPlans.jsx`): Gespart mit Strich "Soll heute", Status (im Plan, Rate fällig, N Raten offen, Ziel erreicht), Raten-Liste, "Rate einzahlen"/"X € einzahlen"/"Rate vorziehen" jeweils mit "Rückgängig machen" (ActionToast, 10 Sekunden mit Zeitbalken), bei Rückstand "Plan anpassen" (Rest verteilen bis zum Zieldatum oder Ziel verschieben), Bearbeiten, Beenden (offene Raten fallen weg, Eingezahltes bleibt).
- **Rate eines Monats ändern** (seit 25.11.2026): im Plan "Diesen Monat mehr sparen" (nächste offene Rate) oder jede offene Rate in der Liste antippen → `RateChangeSheet` mit Schnellwahl (+50, +100, Doppelt, Alles), Vorschau und Obergrenze (`maxForRate`). Gilt nur für diesen Monat; `rebalanceRates` gleicht aus: mehr gespart → Raten nach der geänderten fallen von hinten weg bzw. die letzte wird kleiner, weniger → Fehlbetrag mit der normalen Rate ans Ende. Dieselbe Anpassung läuft, wenn der Betrag einer Rate über den Stift in den Buchungen/Offenen Posten geändert wird (`MonthsView.handleSave` → `finData.rebalanceSavingsPlan`). Rückgängig 10 Sekunden über einen Schnappschuss (`restoreSavingsPlanRates`). Raten mit abweichendem Betrag tragen "geändert" (außer der letzten).
- Keine Punkte, kein Einfluss aufs Level (Finanzen ruft `awardPoints` nicht auf). Push-Erinnerung ist für später geplant.
- Kalender im Wizard (gilt für alle Wizards): Tipp auf Monat/Jahr im Kopf öffnet Monats- und Jahresauswahl.

## Buchungen: Bereiche immer sichtbar (seit 25.11.2026)

Einnahmen, Fixkosten, Variable Kosten und Sonstige Ausgaben stehen in jedem Monat da, leere mit "0 Posten · 0,00 €" und beim Aufklappen "Keine Posten in diesem Monat" (`MonthsView.CollapseSection`). Laufende Posten (Fixkosten-Vorlagen) werden beim Öffnen eines Monats angelegt, auch für künftige Monate und Jahre, solange die Vorlage gilt (`templateAppliesTo`: bis auf weiteres oder bis zum Endmonat). Verträge buchen genauso (Vorlage mit `is_contract`, siehe Verträge).

## Einnahmen als Eingänge (seit 25.11.2026)

Einnahmen und Ausgaben werden getrennt verwaltet, die Summen hängen zusammen. Ausgaben (Fix, Variable, Sonstige) bleiben monatlich wie bisher. Regeln in `lib/income.js`, Seite `IncomeView.jsx` (`#/finance/einnahmen`, erreichbar über Antippen der Fokuskarte "Verfügbar jetzt", nicht mehr als Kachel).
- **Einnahmen-Vorlagen** (`fin_fixtemplates`, `fixeinnahmen`) buchen **nicht mehr automatisch** jeden Monat (`applyMissingFixTemplatesWith`, `applyNewTemplateEverywhere`, Sync beim Speichern überspringen sie). Stattdessen "Eingang bestätigen": `finData.confirmIncome` legt eine normale Einnahme-Buchung an (`from_template`, Monat und `due_date` = heute, `template_locked`). Sie zählt in Auswertung und Hub im **Eingangsmonat**.
- **Fix** (Vorlage hat `due_day`, beim Anlegen "Jeden Monat am selben Tag"): der Knopf erscheint ab diesem Tag im Monat und bleibt, bis bestätigt. **Unterschiedlich** (kein `due_day`): Knopf immer sichtbar. Beides **höchstens einmal je Kalendermonat und Quelle**: danach steht "Bestätigt am …", kein zweites Bestätigen (auch beim Speichern noch einmal frisch geprüft). Rückgängig 10 Sekunden (`undoIncome`, Soft Delete) oder die Buchung löschen.
- **Verfügbar jetzt** (Fokuskarte der Übersicht, `income.available`): alle Eingänge bis heute (nicht in der Zukunft) minus alles Bezahlte, **ab dem Startmonat** (`body_profile.fin_start_month`, wird beim ersten Öffnen auf den laufenden Monat gesetzt, Migration `supabase/fin_income_confirm_migration.sql`) bis zum laufenden Monat, monatsübergreifend. Gleiche Rechnung wie der bisherige Monatssaldo (Saldo + offene Posten), deshalb entspricht der Wert am Starttag dem früheren "Aktuell inkl. offener Zahlungen". Ältere Monate (auch offene Posten von früher) zählen nicht. "Nach N offenen Zahlungen" zieht die offenen Posten ab. Eine zusätzliche Karte "Bis Monatsende"/"Bis zum nächsten Eingang" gab es kurz, sie ist entfernt (Daten stehen in der Fokuskarte). Der Hub rechnet noch mit dem Monatssaldo.
- **Bestätigt** gilt nur ein Posten mit `fin_entries.received_on` im laufenden Monat (Knopf). Früher automatisch angelegte Einnahme-Posten zählen als Einnahme des Monats, aber nicht als bestätigt: der Knopf bleibt verfügbar.
- Aus der Zeit vor dem Umbau können in künftigen Monaten noch automatisch angelegte Einnahme-Posten stehen; sie zählen nicht in "Verfügbar" und lassen sich per SQL entfernen (siehe Backlog-Notiz).

## Saldo-Karte

"+ Ein  − Aus" ergibt immer den Saldo: Aus = Ausgaben + Gespartes (Sparschwein-Einzahlungen minus Entnahmen), Ein ohne Entnahmen (Übersicht und Buchungen). Der Hub rechnet seine Ein/Aus-Zahlen aus den Messwerten (Sparschwein-Bewegungen dort als Aus/Ein) und zeigt daher andere Teilzahlen bei gleichem Saldo.

**Fokuskarte (Übersicht, Buchungen, Hub):** große Zahl = Saldo **nach** den offenen Zahlungen (wie bisher); darunter "Aktuell inkl. offener Zahlung(en): X" = Saldo + offene Zahlungen, nur wenn etwas offen ist. Der Balken zeigt bezahlt ausgefüllt und offen schraffiert (`FocusCard.Progress` mit `open`). **Einnahmen mit Fälligkeitsdatum in der Zukunft zählen erst ab diesem Tag** (`isIncomePending` in `core/lib/paymentParts.js`; heute zählt schon; ohne Datum zählt sofort), "Ein" auf der Karte zeigt nur die schon erhaltenen. Der Hub holt dafür die Einnahmen mit Datum extra (`loadPendingIncome`) und zieht sie vom Einnahmen-Messwert ab. Texte: `offeneZahlungenText` / `offenerZahlungenText` (Zahlung/Zahlungen), `offenePostenText` (Posten) in der Liste "Offene Posten". Posten aus Vorlagen bekommen ihr Fälligkeitsdatum aus dem Tag der Vorlage (siehe unten).

## Verträge (Seite `#/finance/vertraege`)

`ContractsView.jsx`: zwei Gruppen, **Einnahmen** und **Fixkosten & Verträge**, je Eintrag eine Karte (`.vt-*` in `design-v2.css`), ohne Fokuskarte; Summe pro Monat rechts neben der Gruppenüberschrift, darunter "N aktiv · … pro Jahr". Drei Symbole (`ContractIcons.jsx`): Einnahme = Münze mit Euro, Fixkosten = Kalender, Vertrag = Dokument. Abgelaufene sind eingeklappt, "Hinzufügen" ist eine gestrichelte Karte.
Alle Fenster dieser Seite = `RecurringSheet.jsx` (ersetzt `FixTemplateModal`, `ContractModal`, `PaymentBadge`): "Einnahme hinzufügen" (Vorlage `fixeinnahmen`), "Hinzufügen" mit Art Fixkosten | Vertrag, beim Bearbeiten steht die Art fest und es gibt "Löschen" (auch für Verträge, das ging vorher in der Oberfläche nicht). **Fixkosten** sind Vorlagen (`fin_fixtemplates`) und legen jeden Monat eine Buchung an. **Verträge** verhalten sich seit 25.11.2026 genau gleich (Wunsch des Nutzers): ein Vertrag ist eine Vorlage mit Kategorie `fixkosten` und `is_contract = true` (dazu `cancellation`, `notes`; Migration `supabase/fin_contracts_as_templates_migration.sql`, additiv) und bucht jeden Monat bis auf weiteres oder bis zum Vertragsende. Ältere Verträge aus `fin_contracts` (buchen nicht) werden weiter angezeigt und beim nächsten Speichern als Vorlage übernommen (alter Eintrag wird gelöscht). Ohne Migration speichert `saveFixTemplate` einen Vertrag als normale Fixkosten. Entwurf: Mockup-Runde "Verträge" (Satz 1 der Symbole).

## Einstellungen (Seite `#/finance/einstellungen`)

`SettingsView.jsx` (Entwurf: Mockup "Einstellungen", Variante B): Fokuskarte "Backup erstellen" mit "JSON exportieren" als Hauptaktion, darunter "Importieren" (JSON) und "Aus Excel" (XLSX, SheetJS wird erst bei Bedarf geladen), getrennt der "Gefahrenbereich". Nach dem Excel-Einlesen öffnet sich das Fenster "Excel-Datei lesen" (gefundene Einträge und Ersparnis-Monate, dann "Jetzt importieren"). **Alle Daten löschen** öffnet ein Fenster, in dem das Wort **"Löschen"** eingetippt werden muss (Groß-/Kleinschreibung egal), erst dann wird der rote Knopf aktiv (ersetzt die zwei `confirm()`-Rückfragen). Gelöscht werden nur Finanzdaten (`fin_entries`, `fin_savings`, `fin_contracts`, `fin_fixtemplates`).

**Fälligkeit bei Vorlagen und Verträgen:** Im Fenster steht "Fällig am" als Kalender-Datum (optional); gespeichert wird weiter nur der Tag im Monat (`due_day`, keine Migration), die Anzeige bleibt im laufenden Monat. Daraus bekommt jeder Monatsposten ein Fälligkeitsdatum (`dueDateFor` in `finance.js`, Tag auf die Monatslänge begrenzt): beim Anlegen, beim Speichern der Vorlage (nur ungesperrte Posten) und als Nachtrag beim Laden des Monats für Posten ohne Datum. **Nur laufender und zukünftiger Monat**; rückwirkend angelegte Posten alter Monate bekommen keins (sonst wären sie sofort überfällig und kämen in die Morgen-Pushes). Ein von Hand geändertes Datum sperrt den Posten wie Name/Betrag (`template_locked`). Folge: Fixkosten aus Vorlagen erscheinen mit Datum im Tagesplan und als überfällig, Einnahmen aus Vorlagen zählen in der Fokuskarte erst ab ihrem Tag.


## Aufbau der Übersicht (seit 25.11.2026)

Reihenfolge: Fokuskarte "Verfügbar jetzt" (antippbar, öffnet Einnahmen), Streifen "Offene Posten" (rot mit Summe, bei nichts offen "Alles bezahlt"; führt auf `#/finance/offen`), Schnellübersicht (Umbau zum Kreisdiagramm geplant), Bereiche als Liste mit Symbolkreisen (Buchungen, Verträge, Auswertung, Einstellungen; `AreaList icons`), ganz unten Sparen (Sparschwein, Sparpläne). Offene Posten steht nicht mehr in den Bereichen.
