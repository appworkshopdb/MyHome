# Design-Werkstatt auf dem Server

Läuft auf dem Hetzner-Server in `/opt/nestua/werkstatt` (Klon von `staging`), nur auf `127.0.0.1:5180`.
Von außen nicht erreichbar, Zugriff per SSH-Tunnel. Die Staging-App ist davon unabhängig.

## Einmalig einrichten (Server)

```bash
cd /opt/nestua/werkstatt
git pull origin staging
npm ci                      # NIE `npm audit fix` ausführen
which node                  # Pfad prüfen, muss zu ExecStart in der Unit passen
sudo cp tools/werkstatt/nestua-werkstatt.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now nestua-werkstatt
systemctl status nestua-werkstatt --no-pager
```

Vorher ein evtl. von Hand gestartetes Vite beenden (`Strg+C`) und prüfen, dass Port 5180 frei ist: `ss -ltnp | grep 5180`.

## Benutzen (Windows-PC)

PowerShell auf dem PC (Prompt `PS C:\…`, NICHT auf dem Server):

```powershell
ssh -L 5180:127.0.0.1:5180 nestua@2.28.67.38
```

Fenster offen lassen, im Browser `http://localhost:5180` öffnen.

## Aktualisieren (Server)

```bash
cd /opt/nestua/werkstatt
git pull origin staging
npm ci
sudo systemctl restart nestua-werkstatt
```

Der Neustart zählt das Inventar neu (`scan.mjs` läuft vor dem Start).

## Tokens committen (von Hand, Server)

Die Seite "Design Tokens" schreibt `design/tokens.json` und `design/tokens.css` im Klon. Übernehmen:

```bash
cd /opt/nestua/werkstatt
git status --short          # nur design/tokens.* sollte geändert sein
git add design/tokens.json design/tokens.css
git commit -m "Design-Tokens angepasst"
git push origin HEAD:staging
```

Vor dem nächsten `git pull` erst committen oder `git stash`, sonst gibt es Konflikte.

## Fehlersuche

- Log: `journalctl -u nestua-werkstatt -n 50 --no-pager`
- "Port 5180 is in use": ein alter Vite- oder SSH-Prozess blockiert, `ss -ltnp | grep 5180`, dann `kill <PID>`.
- `ERR_CONNECTION_REFUSED` im Browser: Tunnel läuft nicht (oder auf dem Server statt auf dem PC gestartet).
- Der Tunnel-Befehl gehört immer auf den Windows-PC.
