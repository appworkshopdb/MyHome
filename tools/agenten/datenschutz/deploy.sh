#!/usr/bin/env bash
# Kopiert den Agenten "Datenschutz" aus dem Repo nach /opt/nestua/ops/agenten/datenschutz/.
# Laufzeit: Cron monatlich am 1. um 08:00 (datenschutz-cron.sh), Vault-Klon /opt/nestua/ops/vault, Berichte in /opt/nestua/ops/reports/datenschutz-*.
set -euo pipefail
SRC="$(dirname "$(readlink -f "$0")")"
DST=/opt/nestua/ops/agenten/datenschutz
mkdir -p "$DST"
install -m 755 "$SRC/datenschutz-cron.sh" "$DST/datenschutz-cron.sh"
install -m 644 "$SRC/fakten.mjs" "$DST/fakten.mjs"
install -m 644 "$SRC/bericht.mjs" "$DST/bericht.mjs"
install -m 644 "$SRC/PROMPT.md" "$DST/PROMPT.md"
echo "installiert nach $DST"
