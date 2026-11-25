#!/usr/bin/env bash
# Richtet leitstand.nestua.de einmalig in Caddy ein.
# Fragt das neue Leitstand-Passwort zweimal ab. Passwort und Hash erscheinen nirgends (nicht im Terminal,
# nicht in der Prozessliste, nicht im Verlauf). Danach sudo für Sicherung, Eintrag, Prüfung und reload.
# Aufruf: bash setup-caddy.sh [benutzername]   (Standard: nestua)
set -euo pipefail
CF=/etc/caddy/Caddyfile
REF=/opt/nestua/ops/reference/Caddyfile
WEBROOT=/opt/nestua/ops/leitstand/www
USER_NAME="${1:-nestua}"

if grep -q '^leitstand\.nestua\.de' "$CF"; then echo "leitstand.nestua.de steht schon im Caddyfile, nichts geändert."; exit 1; fi
[ -f "$WEBROOT/index.html" ] || { echo "$WEBROOT/index.html fehlt, erst deploy.sh ausführen."; exit 1; }

read -rsp "Neues Passwort für den Leitstand: " P1; echo
read -rsp "Noch einmal: " P2; echo
if [ -z "$P1" ] || [ "$P1" != "$P2" ]; then unset P1 P2; echo "Passwörter leer oder ungleich, nichts geändert."; exit 1; fi
H=$(printf '%s\n' "$P1" | caddy hash-password --algorithm bcrypt)
unset P1 P2
case "$H" in '$2'*) ;; *) unset H; echo "Hash sieht unerwartet aus, nichts geändert."; exit 1;; esac

TMP=$(mktemp); chmod 600 "$TMP"
trap 'rm -f "$TMP"' EXIT
cat > "$TMP" <<BLOCK

# Leitstand (nur lesend, seit 17.11.2026). Quelle: tools/leitstand im Repo, Daten vom Scan alle 5 Minuten.
leitstand.nestua.de {
	basic_auth {
		$USER_NAME $H
	}
	root * $WEBROOT
	file_server
	encode gzip zstd
	header {
		X-Robots-Tag "noindex, nofollow"
		Cache-Control "no-store"
		Referrer-Policy "no-referrer"
		X-Content-Type-Options "nosniff"
	}
}
BLOCK
unset H

BAK="$CF.bak-$(date +%Y%m%d-%H%M%S)"
sudo cp -a "$CF" "$BAK"
sudo sh -c "cat '$TMP' >> '$CF'"
if sudo caddy validate --config "$CF" --adapter caddyfile >/dev/null 2>&1; then
  sudo systemctl reload caddy
  install -m 600 "$CF" "$REF"
  echo "Sicherung: $BAK"
  echo LEITSTAND_OK
else
  sudo cp -a "$BAK" "$CF"
  echo "caddy validate ist fehlgeschlagen. Die Sicherung ist zurückgespielt, Caddy läuft unverändert."
  exit 1
fi
