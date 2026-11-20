#!/usr/bin/env bash
# Kopiert den KI-Teil des Agenten "Prüfer" nach /opt/nestua/ops/agenten/pruefer/ (dazu das Regelskript aus tools/pruefer/).
# Laufzeit: Cron alle 15 Minuten (pruefer-cron.sh), Bare-Repo mit PR-Refs unter /opt/nestua/ops/pruefer/, Berichte in /opt/nestua/ops/reports/pruefer-*.
set -euo pipefail
SRC="$(dirname "$(readlink -f "$0")")"
DST=/opt/nestua/ops/agenten/pruefer
mkdir -p "$DST" /opt/nestua/ops/pruefer
install -m 755 "$SRC/pruefer-cron.sh" "$DST/pruefer-cron.sh"
install -m 644 "$SRC/bericht.mjs" "$DST/bericht.mjs"
install -m 644 "$SRC/PROMPT.md" "$DST/PROMPT.md"
install -m 644 "$SRC/DESIGN-PROMPT.md" "$DST/DESIGN-PROMPT.md"
install -m 644 "$SRC/../../pruefer/regeln.mjs" "$DST/regeln.mjs"
echo "installiert nach $DST"
