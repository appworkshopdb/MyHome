#!/usr/bin/env bash
# Kopiert den Agenten "Social Media" aus dem Repo nach /opt/nestua/ops/agenten/social/.
# Der Ordner ist zugleich der Arbeitsordner von claude -p: Nur hier ist der Metricool-Zugang eingetragen
# (cd /opt/nestua/ops/agenten/social && claude mcp login metricool --no-browser).
# Laufzeit: Cron montags 09:00 (social-cron.sh), Vault-Klon /opt/nestua/ops/vault, Berichte in /opt/nestua/ops/reports/social-*.
set -euo pipefail
SRC="$(dirname "$(readlink -f "$0")")"
DST=/opt/nestua/ops/agenten/social
mkdir -p "$DST"
install -m 755 "$SRC/social-cron.sh" "$DST/social-cron.sh"
install -m 644 "$SRC/fakten.mjs" "$DST/fakten.mjs"
install -m 644 "$SRC/bericht.mjs" "$DST/bericht.mjs"
install -m 644 "$SRC/PROMPT.md" "$DST/PROMPT.md"
echo "installiert nach $DST"
