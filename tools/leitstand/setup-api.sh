#!/usr/bin/env bash
# Richtet die Schalter-Schnittstelle des Leitstands ein (einmalig, wiederholbar):
#   1. startet api.mjs (127.0.0.1:8788), falls es nicht läuft
#   2. ergänzt im Caddyfile-Block leitstand.nestua.de: /api/* geht an die Schnittstelle, alles andere wie bisher an die Dateien
#      (mit Sicherung, caddy validate und automatischem Zurückspielen; Neuladen über das freigegebene "sudo systemctl reload caddy")
#   3. trägt einen Cron-Eintrag ein, der die Schnittstelle alle 5 Minuten startet, falls sie nicht läuft
# Der Zugang bleibt hinter dem Login des Leitstands; die Schnittstelle selbst hört nur auf 127.0.0.1.
# Aufruf: bash setup-api.sh [--dry-run]    (--dry-run zeigt den neuen Caddy-Block und prüft ihn, ändert nichts)
set -euo pipefail
CF=/etc/caddy/Caddyfile
REF=/opt/nestua/ops/reference/Caddyfile
D=/opt/nestua/ops/leitstand
DRY=0; [ "${1:-}" = "--dry-run" ] && DRY=1

[ -x "$D/api-start.sh" ] && [ -f "$D/api.mjs" ] || { echo "api.mjs oder api-start.sh fehlt in $D, erst deploy.sh ausführen."; exit 1; }
grep -q '^leitstand\.nestua\.de' "$CF" || { echo "leitstand.nestua.de steht nicht im Caddyfile."; exit 1; }

# Neues Caddyfile in einer Temp-Datei bauen
TMP=$(mktemp); chmod 600 "$TMP"; trap 'rm -f "$TMP"' EXIT
if grep -q 'reverse_proxy 127.0.0.1:8788' "$CF"; then
  cp "$CF" "$TMP"; echo "Caddyfile: /api/* ist schon eingetragen."
else
  python3 - "$CF" "$TMP" <<'PY'
import sys,re
src=open(sys.argv[1],encoding='utf8',newline='').read()   # Zeilenenden unverändert lassen
old="\troot * /opt/nestua/ops/leitstand/www\n\tfile_server\n"
new="\thandle /api/* {\n\t\treverse_proxy 127.0.0.1:8788\n\t}\n\thandle {\n\t\troot * /opt/nestua/ops/leitstand/www\n\t\tfile_server\n\t}\n"
assert src.count(old)==1, "Leitstand-Block hat nicht die erwartete Form"
out=src.replace(old,new).replace("# Leitstand (nur lesend, seit 17.11.2026).","# Leitstand (lesend, seit 17.11.2026; seit 20.11.2026 mit Ein/Aus-Schalter je Agent über /api/*).")
open(sys.argv[2],'w',encoding='utf8',newline='').write(out)
PY
fi
echo "--- Änderung am Caddyfile:"; diff "$CF" "$TMP" | sed -E 's/\$2[aby]\$[^ ]*/<hash>/g' || true
if caddy validate --config "$TMP" --adapter caddyfile >/dev/null 2>&1; then echo "caddy validate: ok"; else echo "caddy validate FEHLGESCHLAGEN, nichts geändert."; caddy validate --config "$TMP" --adapter caddyfile 2>&1 | tail -3; exit 1; fi
if [ "$DRY" = 1 ]; then echo "Trockenlauf, nichts geändert."; exit 0; fi

# 1. Schnittstelle starten
if ! curl -fs http://127.0.0.1:8788/api/ping >/dev/null 2>&1; then
  nohup "$D/api-start.sh" >/dev/null 2>&1 &
  for i in 1 2 3 4 5 6 7 8 9 10; do curl -fs http://127.0.0.1:8788/api/ping >/dev/null 2>&1 && break; sleep 0.5; done
fi
curl -fs http://127.0.0.1:8788/api/ping >/dev/null || { echo "Schnittstelle startet nicht, siehe $D/api.log. Caddy bleibt unverändert."; exit 1; }
echo "Schnittstelle läuft auf 127.0.0.1:8788"

# 2. Caddyfile übernehmen (mit Sicherung; bei Fehler zurückspielen)
if ! cmp -s "$CF" "$TMP"; then
  BAK="$CF.bak-$(date +%Y%m%d-%H%M%S)"
  cp -a "$CF" "$BAK"
  cat "$TMP" > "$CF"
  if caddy validate --config "$CF" --adapter caddyfile >/dev/null 2>&1 && sudo -n systemctl reload caddy; then
    install -m 600 "$CF" "$REF"; echo "Caddy neu geladen. Sicherung: $BAK"
  else
    cat "$BAK" > "$CF"; echo "Neuladen oder Prüfung fehlgeschlagen, Sicherung zurückgespielt ($BAK)."; exit 1
  fi
fi

# 3. Cron-Eintrag
LINE="*/5 * * * * $D/api-start.sh >/dev/null 2>&1"
if crontab -l 2>/dev/null | grep -qF "$D/api-start.sh"; then echo "Cron: Eintrag war schon da."
else { crontab -l 2>/dev/null; echo "$LINE"; } | crontab -; echo "Cron: Eintrag ergänzt."; fi

# Kontrolle: von außen muss /api/ping an der Anmeldung hängen bleiben (401), nicht ins Leere laufen
CODE=$(curl -s -o /dev/null -w '%{http_code}' --max-time 15 https://leitstand.nestua.de/api/ping || true)
echo "Von außen ohne Login: HTTP $CODE (erwartet 401)"
echo API_OK
