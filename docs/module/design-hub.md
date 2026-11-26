# Design und Hub

Aus `CLAUDE.md` ausgelagert (17.11.2026). Vor Arbeit an diesem Bereich lesen; Änderungen hier pflegen, nicht in `CLAUDE.md`.

## Farbsystem und Hub-Layout (Front-End)

Warme Basis (`--raw-sand-*`, warmes Dunkelblau als Text; Dunkelmodus warm, `themes.css`) plus
EINE Farbfamilie je Modul: Finanzen Blau, Ernährung Grün, Sport Koralle, Gewohnheiten Gold,
Einkauf Violett; Hub-Funktionen (Termine, Aufgaben, Kalender) neutral (`--mod-n-*`). Tokens je
Familie in `base.css`/`themes.css`: `--mod-<fin|food|sport|hab|shop>-` + `tint|ink|ac|on|deep|hero|hero-ink|pill`
(`deep` = Text auf hellem Grund, AA; `ac`/`on` = Füllung + Schrift darauf). `App.jsx` setzt
`data-module` auf `<html>`, solange ein Modul offen ist; dann mappt `base.css` `--m-*` und die
Aktionsfarbe (`--action-primary`) auf die Familie, Nav-Pille/Plus-Knopf nutzen `--m-ac`/`--m-on`.
Einzelne Kacheln außerhalb eines Moduls (Hub) bekommen die Familie per Klasse `.tone-<familie>` (`--t-*`).
Neue Familie/Farbe nur als Token ergänzen, nie als Hex in Komponenten; Farbe ist nie das einzige
Zeichen (Symbol + Name bleiben). Kontraste vor Änderungen nachrechnen (Text ≥ 4,5:1).

Die neue Optik steht in `styles/design-v2.css` (zuletzt geladene Datei; übersteuert `app-extra.css`),
Bausteine: `FocusCard` (Verlauf der Familie, optional `family`), `AreaList variant="tiles"` +
`AreaRow icon/featured` (Bereiche als Kacheln, Symbole in `AreaIcons.jsx`), `Ring.jsx`, `HubTiles.jsx`.
Hub-Reihenfolge: Tagesplan (mit "Als Nächstes" = erstes offenes Training), Saldo + Gewohnheiten +
Training, Ernährung (`NutritionBlock`, in den Modulen `variant="hero"`), Aufgaben, Kalender/Statistiken.
Logik, Texte, Links und Daten sind dieselben wie vorher; die Ernährung steht nicht mehr IM Tagesplan.

Hub-Details: Der Tagesplan zeigt den Fortschritt als Linienbalken unter der Überschrift, Termine stehen in einer
eigenen kleinen Liste über der übrigen. Das Auge in der Saldo-Karte blendet Beträge aus (`core/lib/privacyStore.js`,
`components/Money.jsx` zeigt statt des Betrags einen weichgezeichneten Platzhalter, der echte Wert steckt dann nicht im DOM; je Nutzer in `body_profile.hide_amounts`, Migration `supabase/hide_amounts_migration.sql`, ohne sie nur lokal).
Die Saldo-Karte im Hub ist seit 26.11.2026 dieselbe Karte "Verfügbar jetzt" wie in Finanzen (`core/components/AvailableCard.jsx`, Rechnung `core/lib/finAvailable.js`); Ein/Aus/Spar sind entfallen. Das Muster "Zahlungen im Tagesplan" ist bisher nur im Hub angewendet (Saldo-Karte, Zahlungen im Tagesplan), Module folgen. Kacheln tragen ihre Überschrift
innerhalb der Karte (auch "Aufgaben"); "+ Mahlzeit eintragen" gibt es nur noch in der Ernährungs-Hero-Karte. Im Hub gibt es keinen Plus-Knopf (`GlobalFab`), Aufgaben legt der Knopf "Neue Aufgabe" in der Aufgaben-Karte an.

Sport zeigt und fragt KEINE Dauer mehr (weder Einheiten, Hub, Auswertung noch Anlegen-Dialoge); die Spalten `duration_min`
bleiben in der DB und werden nur durchgereicht, nichts anzeigen oder neu abfragen. Auswertung (`AuswertungView`, `BadgesCard`,
`SportIcons.jsx`, Klassen `.sa-*` in `design-v2.css`): Zahlen auf ruhigen Kacheln, Erfolge als Medaillen mit Symbol je Badge-Schlüssel. Aktivität = 12 Monatsspalten mit Wochenzellen, vorgewählt ist immer die aktuelle Woche.
