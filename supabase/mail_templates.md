# Deutsche Mail-Vorlagen (GoTrue)

Die drei Vorlagen liegen in `public/mail/` (`confirmation.html`, `recovery.html`,
`email_change.html`) und werden mit der App ausgeliefert (`dist/mail/…`). GoTrue holt sie
beim Start per URL ab — sie müssen also unter der öffentlichen Adresse erreichbar sein,
bevor der Auth-Container neu gestartet wird (erst Frontend deployen, dann Server ändern).

## Server (Staging: `/opt/nestua/staging/supabase-project/`)

Im `auth`-Service von `docker-compose.yml` (gehört root → `sudo`) ergänzen:

```yaml
      GOTRUE_MAILER_SUBJECTS_CONFIRMATION: "Bestätige deine E-Mail-Adresse für Nestua"
      GOTRUE_MAILER_SUBJECTS_RECOVERY: "Neues Passwort für Nestua festlegen"
      GOTRUE_MAILER_SUBJECTS_EMAIL_CHANGE: "Neue E-Mail-Adresse bei Nestua bestätigen"
      GOTRUE_MAILER_TEMPLATES_CONFIRMATION: "https://staging.nestua.de/mail/confirmation.html"
      GOTRUE_MAILER_TEMPLATES_RECOVERY: "https://staging.nestua.de/mail/recovery.html"
      GOTRUE_MAILER_TEMPLATES_EMAIL_CHANGE: "https://staging.nestua.de/mail/email_change.html"
```

Danach nur den Auth-Dienst neu anlegen (Neustart reicht nicht):

```bash
cd /opt/nestua/staging/supabase-project
sudo docker compose up -d --no-deps auth
```

Prüfen: `curl -sI https://staging.nestua.de/mail/confirmation.html` → `200`, dann eine
Testregistrierung bzw. „Passwort vergessen?“ auslösen.

## Hinweise

- Platzhalter in den Vorlagen: `{{ .ConfirmationURL }}` (fertiger Link inkl. `redirect_to`).
- Das App-Symbol im Kopf lädt von `https://staging.nestua.de/icons/icon-192.png` (absolute URL, in Mails nicht anders möglich); für Production die Domain in den drei Dateien ersetzen. Mail-Programme blenden Bilder oft zunächst aus — der Kopf bleibt dann mit Wortmarke lesbar.
- Gültigkeitsdauer des Links steuert `GOTRUE_MAILER_OTP_EXP` (Sekunden, Standard 3600); die Mail nennt bewusst keine Zahl.
- Alle Styles sind inline (Mail-Programme ignorieren `<style>`); Farben fest (kein Dunkelmodus).
- Ist die Vorlagen-URL nicht erreichbar, fällt GoTrue auf die englische Standardvorlage zurück.
- Production hat eine eigene Compose-Datei und eine eigene Domain → URLs dort anpassen.
