#!/usr/bin/env bash
# Kopiert den Agenten "Kontext & Status" aus dem Repo nach /opt/nestua/ops/agenten/kontext/.
# Laufzeit: Cron montags 07:00 (kontext-cron.sh), Vault-Klon unter /opt/nestua/ops/vault, Berichte in /opt/nestua/ops/reports/kontext-*.
set -euo pipefail
SRC="$(dirname "$(readlink -f "$0")")"
DST=/opt/nestua/ops/agenten/kontext
mkdir -p "$DST"
install -m 755 "$SRC/kontext-cron.sh" "$DST/kontext-cron.sh"
install -m 644 "$SRC/fakten.mjs" "$DST/fakten.mjs"
install -m 644 "$SRC/bericht.mjs" "$DST/bericht.mjs"
install -m 644 "$SRC/PROMPT.md" "$DST/PROMPT.md"
echo "installiert nach $DST"
