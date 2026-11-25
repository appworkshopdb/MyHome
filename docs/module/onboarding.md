# Onboarding

Aus `CLAUDE.md` ausgelagert (17.11.2026). Vor Arbeit an diesem Bereich lesen; Änderungen hier pflegen, nicht in `CLAUDE.md`.

## Registrierung, Onboarding und Modul-Tutorials

Konto erstellen → Bestätigungsmail (GoTrue-SMTP, Resend; Port 587, 465 ist bei Hetzner
gesperrt) → Link führt zurück in die App (`rawAuth.consumeAuthRedirect` fängt die Tokens im
Hash ab, bevor das Hash-Routing sie sieht) → `ProfileWizard` (Gate in `App.jsx` über
`body_profile.onboarding_completed_at`) → Hub. Die Wizard-Leiste hat 6 Schritte, Schritt 1
(E-Mail) gilt beim Start schon als erledigt; das Ei (`EggFill`) füllt sich je Schritt
(20/40/60/80 %), in der Vogelwahl ist es weg, am Ende das echte Vogel-Ei. Ernährung/Allergene
sind freiwillig. Die Vogelart wird erst am Ende festgeschrieben (`setBirdSpecies`, endgültig).
Anmelden/Registrieren/„Passwort vergessen“ = `Login.jsx` (Navy-Kopf `AuthHero.jsx` + weißes Sheet,
Styles `.lg-*` in `onboarding.css`); Recovery-Link → `rawAuth.consumeAuthRedirect` (`type=recovery`) →
`AuthContext.recovery` → `App.jsx` zeigt `ResetPassword.jsx`. Datenschutz-Link auf `public/datenschutz.html`;
Nutzungsbedingungen gibt es noch nicht. Deutsche Mail-Vorlagen: `public/mail/*.html`, Server-Setup
(GoTrue-Env, `sudo`) in `supabase/mail_templates.md` — von Hand auf dem Server einzutragen.
Adressen `support@`/`technik@`/`no-reply@nestua.de` (App-Absender `no-reply@`, Name „Nestua“, siehe `SMTP_ADMIN_EMAIL`/`SMTP_SENDER_NAME` in der Server-`.env`; alle drei als ImprovMX-Alias): DNS liegt bei INWX; Empfang per ImprovMX (kostenlose
Weiterleitung an das Projekt-Gmail, MX `mx1/mx2.improvmx.com`, SPF `include:spf.improvmx.com include:spf.resend.com`),
Antworten aus Gmail per „Senden als“ über `smtp.resend.com:465` (Benutzer `resend`, eigener API-Schlüssel). Kein
Mailbox.org nötig; Absender-Logo (Google-Konto/Gravatar/BIMI) erst nach fertigem App-Logo.
Der alte `WelcomeWizard` bleibt nur für Bestandsnutzer ohne Vogel. Styles: `styles/onboarding.css`
(Wizard, Bestätigungsseite, Touren, Anlege-Seiten; nur semantische Tokens, Akzent `--warm`).

Jeder Bereich (Hub + 5 Module) hat beim ersten Besuch eine Tour: `core/components/ModuleTutorial.jsx`
(einmal in `App.jsx`), Bühnen in `TutorialStage.jsx`, Inhalte rein als Daten in `core/lib/tutorials.js`
(Folien + Mission + Erfolgstext). Die Mission öffnet das echte Anlege-Sheet (dieselben wie im
`GlobalFab`); bei Gewohnheiten die Vorlagen-Auswahl `HabitTemplatePicker` (Vorlagen in
`lib/habitTemplates.js`, max. 3). Anlege-Seiten im Tour-Design: `ShoppingQuickSheet` (Vollseite mit
Vorschaukarte), `NutritionFabMenu` (gruppiert). Gesehen-Zustand: `body_profile.tutorials_done`
(Migrationen `onboarding_migration.sql`, `tutorials_migration.sql`; Bestandsnutzer vorab „gesehen“).
Neues Modul = Eintrag in `tutorials.js` + Id in der Migration. Bereichs-Symbole zentral in
`ModuleIcons.jsx` (auch Bottom-Nav). Der Hub zeigt keinen Leerzustand mehr.
