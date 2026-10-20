# Nestua Analytics (Admin-Dashboard)

Eigenständige Web-App mit eigener Adresse, nur für dich. Sie liegt im selben
Repository wie die Nutzer-App, wird aber **separat gebaut und ausgeliefert**
(Cloudflare Pages, Root-Verzeichnis `admin/`). Die Nutzer-App enthält davon
nichts.

## Wie der Zugriff geschützt ist

Die Adresse selbst schützt nichts. Entscheidend ist die Datenbank:

- Die Tabellen `analytics_*` sind für Clients gesperrt.
- Das Dashboard ruft nur Funktionen auf (`analytics_overview`, `analytics_funnels`,
  `analytics_users`, …). Jede prüft zuerst, ob der angemeldete Nutzer in
  `analytics_admins` steht, sonst Fehler `42501`.
- Der Browser kennt nur den öffentlichen anon-Key. Den `service_role`-Key
  niemals hier verwenden.
- Nutzer erscheinen nur als Kennung (`u_7c2e`), nicht mit E-Mail.

## Einrichtung

### 1. Supabase

Im SQL-Editor nacheinander ausführen:

1. `supabase/migrations/100_analytics.sql` (Tabellen, Tracking-Schreibzugriff)
2. `supabase/migrations/101_analytics_admin.sql` (Admin-Tabelle + Funktionen)
3. Dich als Admin eintragen (E-Mail deines **Nestua-App-Kontos**):

```sql
insert into analytics_admins (user_id)
select id from auth.users where email = 'DEINE@MAIL.DE';
```

Weitere Admins: dieselbe Abfrage mit anderer E-Mail. Entfernen:
`delete from analytics_admins where user_id = '…';`

### 2. Cloudflare Pages

1. Cloudflare → **Workers & Pages** → **Create** → **Pages** → **Connect to Git**,
   Repository `appworkshopdb/MyHome`.
2. Einstellungen:
   - **Production branch:** `main`. Solange der Code noch nicht in `main` ist,
     kann der Branch `claude/stoic-dijkstra-ri8fz7` für einen ersten Test
     dienen (Cloudflare baut Branches als Preview mit eigener Adresse).
   - **Root directory:** `admin`
   - **Build command:** `npm run build`
   - **Build output directory:** `dist`
3. **Environment variables** (Production und Preview):
   - `VITE_SUPABASE_URL` und `VITE_SUPABASE_ANON_KEY` — dieselben Werte wie bei
     der Nutzer-App
   - `NODE_VERSION` = `22`
4. Speichern und deployen. Du bekommst eine Adresse wie
   `nestua-admin.pages.dev` (anpassbar unter **Custom domains**).

Optional als zweite Schranke: **Cloudflare Zero Trust → Access**, Anwendung für
diese Adresse anlegen und nur deine E-Mail zulassen (Einmal-Code per Mail).
Preise und Free-Limits bitte bei Cloudflare prüfen.

### Lokal ausprobieren

```bash
cd admin
cp .env.example .env   # Werte eintragen
npm install
npm run dev
```

## Was das Dashboard zeigt

| Bereich | Quelle |
|---|---|
| Übersicht: Nutzer heute/7/30 Tage, live, Verlauf, Bereiche, App vs. Browser | `analytics_overview`, `analytics_live` (alle 30 s) |
| Funnels: Onboarding, Formular-Abbruch, Retention | `analytics_funnels` |
| Nutzer: Liste, Kennzahlen, letzte Sitzung als Zeitleiste | `analytics_users`, `analytics_user` |
| Fehler: JavaScript-Fehler gruppiert | `analytics_errors` |

## Hinweise

- Rohereignisse werden nach 90 Tagen gelöscht, die Retention nutzt die
  dauerhaften Tagesdaten (`analytics_active_days`). Die Verdichtung läuft
  täglich um 03:15 UTC (pg_cron); bis sie einmal gelaufen ist, ist die
  Retention-Tabelle leer.
- Es ist nur sichtbar, wer in der Nutzer-App der Statistik zugestimmt hat.
