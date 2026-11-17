# Ernährung

Aus `CLAUDE.md` ausgelagert (17.11.2026). Vor Arbeit an diesem Bereich lesen; Änderungen hier pflegen, nicht in `CLAUDE.md`.

## Rezept → Einkaufsliste

Knopf "Einkaufsliste" im Rezept-Dialog (`RecipeDetailModal`) öffnet `core/components/RecipeToShoppingSheet.jsx`:
Portionen, Liste (vorgewählt: aktive Liste, sonst "Neue Liste") und Zutaten an-/abwählen. Rechenlogik rein in
`modules/shopping/lib/recipeImport.js` (Mengen umrechnen, Kategorie, Zusammenführen); Schreiben/Rückgängig in
`shoData.js` (`applyShoppingPlan`/`undoShoppingPlan`), keine Migration. Zutat steht schon OFFEN auf der Liste (gleicher
Name, verrechenbare Einheit, g/kg und ml/L) → Menge wird aufgestockt, sonst neue Zeile; abgehakte Artikel zählen nicht.
Herkunft steht im Feld `note` ("für Linsen-Curry" / "inkl. …"). Basis-Zutaten (Gruppe Gewürze, Salz/Öl/…, `isBasic`) sind
nicht vorgewählt. Der Hinweis mit "Rückgängig"/"Liste öffnen" (`ActionToast`) liegt im `NutritionModule`; die Übergabe an
das Einkaufsmodul (einmalige NEU-Markierung, gezielt Liste öffnen) läuft im Speicher über `core/lib/shoppingHandoff.js`.
Artikelansicht der Einkaufsliste (`ItemsView.jsx`, Styles am Ende von `design-v2.css`): Kopf-Karte mit Fortschritt und
"Einkauf abschließen", Zahlungen als schmale Karte, Kategorien als Karten, Menge als Chip, schwebende Eingabeleiste.
Löschen nur im Bearbeiten-Modus der Zeile (Tipp auf die Zeile). Der globale Plus-Knopf ist dort ausgeblendet
(`data-sho-items` am `<html>`, gesetzt von `ShoppingModule`). Einheiten "Zehe"/"Scheibe" gibt es auch in der
Einkaufsliste (`UNIT_OPTIONS`).
"Alle Listen" (`ListView.jsx`, Klassen `.sho-lseg`/`.sho-lrow*`/`.sho-lsheet*` in `design-v2.css`): oben `FocusCard` (Liste "Im Einkauf",
sonst nächster Termin, "Weiter einkaufen"), Filter Offen/Erledigt/Alle; in "Offen" nach Zeit gruppiert (Überfällig/Heute/Diese Woche/
Später/Ohne Datum), Zeile = Symbol, Name, Fortschritts-Ring, "•••". "•••" öffnet ein Sheet: Status (Wiederöffnen einer gebuchten Liste
storniert die Buchung), Fällig (Schnellwahl + Datum + Tageszeit), Name, Löschen (zweistufig). `saveList` schreibt beim Update nur
übergebene Felder (sonst löschte Umbenennen Symbol und Datum). Entwürfe: `design/mockup-alle-listen.html`.
Neue Liste NUR über den globalen Plus-Knopf (`ShoppingQuickSheet`, 3 Schritte): 1 Auswahl "Aus Vorlage"/"Manuelle Eingabe" (wie im
Finanz-Wizard; ohne Vorlagen ist die Karte ausgegraut; "Aus Vorlage" zeigt erst die Vorlagen, die gewählte füllt Schritt 2 und 3 vor,
Vorlagen lassen sich dort löschen), 2 Name/Symbol/Laden/Datum, 3 Artikel. Nach dem Speichern meldet der Wizard (liegt in core) per
`notifyShoppingChanged()` (`core/lib/shoppingHandoff.js`) window-Event, `ShoppingModule` lädt die Listen neu.
Abschluss (`CompleteListSheet.jsx`, Kopf-Knopf "Einkauf abschließen"): 1 "Alles gefunden?" (Tipp stellt "Noch offen"/"Im Warenkorb" um),
2 "Nicht gefunden" (nur wenn Artikel offen sind: ALLE gemeinsam auf eine andere Liste, eine neue Liste oder "Verwerfen" = löschen;
`planTransfer`/`transferHint` in `recipeImport.js` stocken auf wie beim Rezept-Import), 3 Bezahlung (mehrere Zahlungen; `ReceiptScanChoice` "Beleg scannen / Manuelle Eingabe" steht direkt im Schritt, ohne Galerie-Option
(`allowGallery={false}`); nach der ersten Zahlung nur noch zwei schmale Knöpfe (`compact`), "Gesamt" und Buchungsbezeichnung erst ab dann; ein Scan füllt Betrag, Zahlungsart, Laden und Notiz "Beleg vom …" nur VOR, gespeichert wird erst mit "Zahlung speichern";
das Scan-Kontingent ist dasselbe wie in Finanzen; Laden per `WheelPicker`; "Buchen & abschließen" bzw. "Ohne Buchung abschließen"; Schalter "Als Vorlage speichern" mit Namensfeld und
"Artikel ansehen" (Fenster, Eimer entfernt einen Artikel NUR aus der Vorlage; ohne Artikel keine Vorlage), speichert die gekauften
Artikel über `saveListAsTemplate(listId, name, icon, excludeIds)`, Fehler blockieren den Abschluss nicht; Buchungen landen immer in
"Sonstige Ausgaben", ein Hinweis erscheint nur bei offenen Zahlungsarten). Optik: offene Artikel getönt in Schritt 2, "Neue Liste" in
Modulfarbe, "Verwerfen" rot, "Gesamt" als eigene Karte (`.cl-*` in `design-v2.css`). Geschrieben wird erst am Ende, Reihenfolge:
Markierungen → Artikel übertragen/verwerfen → Vorlage → Zahlungen (`sho_payments`) → Buchung (Bar/Gutschein bezahlt, Rest offen,
vorhandene Buchung wird ersetzt) → Status "erledigt". Zahlungsbereich, "erledigte löschen" und "Als Vorlage speichern"
gibt es in der Liste selbst nicht mehr (`clearDoneItems` in `shoData.js` ist ungenutzt; Vorlagen entstehen im Abschluss und werden im
Anlege-Wizard über "Aus Vorlage" genutzt). `saveItem` schreibt beim Update nur
übergebene Felder (sonst würden Kategorie/Notiz beim Mengenändern gelöscht).

## Lebensmittel-Katalog (Ernährung)

Alle Lebensmittel stehen in EINER Tabelle, `nut_foods` (Migration
`supabase/nutrition_catalog_migration.sql`); `foods.js` gibt es nicht mehr.
`owner_id IS NULL` = globaler Katalog (für alle angemeldeten Nutzer lesbar, nur per
Migration beschreibbar, `seed_id` = stabile Zahlen-Id), `owner_id` gesetzt = eigenes
Lebensmittel oder persönlicher Override eines Katalogeintrags (`override_of` = `seed_id`).
Rezepte zeigen per `foodId` auf `seed_id` (Katalog) bzw. die uuid (eigene) — `seed_id`s
nie ändern oder wiederverwenden. Neue Katalogeinträge: weitere Migration mit
`seed_id` ab 718 (318–717 vergeben, `supabase/nutrition_catalog_expansion_migration.sql`),
`ON CONFLICT (seed_id) WHERE owner_id IS NULL DO NOTHING`. Entfernte Katalogeinträge nur
per `deleted_at` ausblenden, nie hart löschen. Konvention bei Milchprodukten & Co.: zu
jeder normalen Variante gibt es eine "… light"-Variante (Ampel eine Stufe besser).
`glutenfrei`/`laktosefrei` sind abgeleitet (Allergen "Gluten"/"Milch"), nie von Hand.
`nutData.getFoods()` lädt alles und hält je Nutzer einen Offline-Cache im localStorage.

## Rezeptbilder (Ernährung)

Keine Fotos: 30 flächige Illustrationen (inkl. gemischte Gerichte: Teller mit Hähnchen/Steak/
Fisch, gemischter Teller, Auflauf, Pfannengericht, Power Bowl) in `modules/nutrition/lib/recipeCovers.jsx`
(Zeichenfläche 200×85, Farben der App; dunkelblaue Teile nutzen die Klassen `cv-ink`/
`cv-soft`, weil `var()` als SVG-Attribut nicht greift). `nut_recipes.cover` = `motiv` oder
`motiv:farbton` (`supabase/nut_recipe_cover_migration.sql`), `NULL` = automatisch über
Rezeptname bzw. Mahlzeit-Typ (`resolveCover`: Gericht-Wörter wie Suppe/Auflauf schlagen Zutaten, Eiweiß +
weitere Zutat → Teller-Motiv; Wörter mit Leerzeichen-Präfix wie ' eis', sonst trifft "Reis"). Neues Motiv: Eintrag in `COVER_MOTIFS`
(bestehende Keys nie umbenennen, sonst fallen gespeicherte Rezepte auf "automatisch").

## Rezeptliste (Ernährung)

Suche + Filter + Sortierung in `RezepteView` über `modules/nutrition/lib/recipeFilter.js`
(reine Funktionen); Mahlzeit-Chips + Suchfeld stehen oben, alle weiteren Filter und die
Sortierung im Bottom-Sheet `RecipeFilterSheet` (Knopf im Suchfeld, gewählte Filter als Chips). Gespeichert ist nur die Mahlzeit (`category`); Ernährungsform (aus
`food.diet`/Gruppe der Zutaten), Nährwert-Filter (pro Portion), Gerichtart (aus dem
Rezeptbild) und die Suche (Name > Zutaten > Tags/Notiz, Umlaut-unabhängig, alle Wörter
müssen passen) werden abgeleitet. Rezept-Dialog: Portionsrechner rechnet Zutatenmengen und
Nährwerte nur in der Ansicht um (`servings` = Portionen, für die die Mengen angelegt sind).
Tab "Vorlagen" zeigt zuerst Kategorien (`TemplateCategories.jsx`, Regeln in `lib/templateCategories.js`: 4 Mahlzeiten + Schnell & einfach
(≤ 4 Zutaten), Süßes, Sportlich (≥ 30 g Eiweiß), Vegetarisch & vegan, Meal Prep, Leicht (< 300 kcal), Fisch & Meer, Low Carb; alles aus
den Rezeptdaten abgeleitet, ein Rezept kann in mehreren stehen). Tipp öffnet die Liste (Zurück-Pfeil, Suche/Filter/Sortierung wie sonst,
auf die Kategorie begrenzt); Suche oder Filter in der Übersicht zeigen direkt die Gesamtliste. Karte: zwei Infokästchen rechts (Portionen, Zutaten).
