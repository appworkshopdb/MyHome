# Zuhause

Modulare App mit Register-Reitern am rechten Rand — Finanzen ist das
erste vollständig gebaute Modul, fünf weitere (Alltag, Einkauf, Ernährung,
Sport, Gewohnheiten) sind als Konzept angelegt und zeigen eine ehrliche
"noch nicht verfügbar"-Vorschau statt einer vorgetäuschten Kauffunktion.

## Ordnerstruktur

```
src/
  core/                    ← modulübergreifend, kennt kein einzelnes Modul
    components/            (Login, Modal, Icons — generische UI-Bausteine)
    lib/                   (Auth, Supabase-Client, Theme, UI-Kontext)
    modules.js              zentrale Modul-Liste
    ModuleRegister.jsx       Register-Reiter am rechten Rand
    LockedModule.jsx         Vorschau für ungebaute Module

  modules/
    finance/                ← alles, was NUR das Finanzen-Modul betrifft
      components/           (MonthsView, SummaryView, ContractsView, …)
      lib/                  (finData.js, finance.js)
      FinanceModule.jsx      Einstiegspunkt des Moduls

  App.jsx                  Login-Gate + Modul-Hülle
  main.jsx                 Einstiegspunkt, Provider
  styles/                  Original-CSS (modulübergreifend)
```

**Die Regel dahinter:** `core/` darf nie etwas aus `modules/` importieren.
Module dürfen sich untereinander nie importieren — nur `core/`. `App.jsx`
ist die einzige Stelle, die weiß, welche Module es gibt.

**Ein neues Modul hinzufügen:**
1. `src/modules/<name>/` anlegen, analog zu `finance/` aufgebaut
   (`components/`, `lib/`, `<Name>Module.jsx`)
2. In `core/modules.js` den Eintrag auf `built: true` setzen
3. In `App.jsx` unter `MODULE_COMPONENTS` eintragen

Das Modul erscheint danach automatisch als eigener Reiter.

---

# Finanzen-Modul

Erstes Modul der "Zuhause"-App. React/Vite-Frontend, Supabase als
Datenbank/Auth, Deploy über GitHub Pages.

Enthält die **komplette Funktionalität und das komplette Design** der
bisherigen lokalen PWA (`finanzentool` / "Finanzen App"), aber gegen
Supabase statt IndexedDB — dadurch echtes Multi-Geräte-Sync statt
manuellem Export/Import.

## Was gegenüber der lokalen Version identisch ist

- **Design**: Die vier Original-CSS-Dateien (`base`, `themes`, `layout`,
  `components`) wurden unverändert übernommen. Kein Tailwind, keine
  Nachbauten — dieselben Klassennamen, dieselbe Optik.
- **4 Farbvorlagen** (Salbei, Schiefer, Sand, Graustufen) × Hell/Dunkel/System.
  Die Auswahl liegt bewusst in localStorage, ist also eine Geräte-Einstellung.
- **Monatsansicht** mit vier Spalten, Unterüberschriften bei Einnahmen,
  Sortierung wie im Original (Einnahmen/Fixkosten älteste oben, Variable/
  Sonstige neueste oben), Bezahlt-Häkchen, Zahlungs-Badges inkl. Klarna.
- **Feste monatliche Posten** inkl. Quartalslogik (alle 3 Monate ab Startmonat).
- **Verträge** mit Status Aktiv/Läuft aus/Abgelaufen.
- **Auswertung** mit Jahrestabelle und drei Diagrammen, deren Farben der
  aktiven Palette folgen.
- **JSON-Export/-Import** und **XLSX-Migration**, **Alle Daten löschen**, Toasts.

## Was bewusst anders ist

- **Cloud-Sync statt lokal**: Daten liegen in Supabase, nicht in IndexedDB.
  Alle Geräte mit demselben Konto sehen denselben Stand.
- **Login**: E-Mail/Passwort über Supabase Auth.
- **"Alle Daten löschen"** löscht kontoweit, nicht nur im aktuellen Browser.
- **Kein Service Worker / Offline-Betrieb** in dieser Version (bewusst
  zurückgestellt, siehe Absprache). Nachrüstbar.
- Der JSON-Import erkennt zusätzlich das **alte Format** (camelCase-Felder
  wie `fromTemplate`, `createdAt`) und wandelt es automatisch um.

## Lokale Entwicklung

```bash
npm install
npm run dev
```

`.env` anlegen (siehe `.env.example`):

```
VITE_SUPABASE_URL=https://xxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=sb_publishable_...
```

## Supabase einrichten

1. Projekt anlegen (Region Frankfurt, wegen DSGVO).
2. `supabase/schema.sql` **einmalig** im SQL-Editor ausführen.
3. Danach zusätzlich, als **eigene** Ausführung:
   ```sql
   ALTER TYPE fin_payment ADD VALUE 'Klarna';
   ```
   (Postgres erlaubt `ALTER TYPE ... ADD VALUE` nicht im selben Block wie
   andere Anweisungen.)
4. **Authentication → Providers → Email** aktivieren.
5. **Project Settings → API**: Werte in `.env` eintragen.

## Kern-Kopplung zum Rest von "Zuhause"

Neben den `fin_*`-Tabellen gibt es die modulübergreifende Kern-Tabelle
`measurements`. Jede Buchung erzeugt per Datenbank-Trigger automatisch
einen Eintrag dort (`finance.income` / `finance.expense`). Ein späteres
Modul (z. B. ein Dashboard über Ernährung, Sport und Finanzen) liest nur
diese eine Tabelle und muss die Finanzen-Tabellen nie kennen.

## Bekannte Abweichung

Login/Logout laufen über direkte HTTP-Requests an die Supabase-Auth-API
(`src/lib/rawAuth.js`) statt über `supabase.auth.*`. Grund: ein Bug in
`@supabase/auth-js` (Stand Anfang 2026) lässt `signInWithPassword()` unter
Windows + Chromium-Browsern hängen. Nebeneffekt: keine automatische
Token-Erneuerung — nach längerer Inaktivität ist ein erneuter Login nötig.
Sobald der Bug behoben ist, kann auf den Standardweg zurückgewechselt werden.

## Deploy auf GitHub Pages

**Settings → Pages** auf "GitHub Actions" stellen, unter **Settings →
Secrets and variables → Actions** die zwei Supabase-Secrets anlegen
(`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`). Der Workflow in
`.github/workflows/deploy.yml` baut und veröffentlicht bei jedem Push
auf `main`.
