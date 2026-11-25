#!/usr/bin/env bash
# Server-Check: Scan aller Prüfungen, dann Bericht nach /opt/nestua/ops/reports/.
# Nur lesend (bis auf den Bericht). Exit-Code wie der Bericht: 0 grün, 1 gelb, 2 rot, 3 Scan fehlgeschlagen.
# Installiert als /opt/nestua/ops/server-check.sh (tools/leitstand/deploy.sh).
set -uo pipefail
L=/opt/nestua/ops/leitstand
/usr/bin/node "$L/scan.mjs" || { echo "Scan fehlgeschlagen"; exit 3; }
/usr/bin/node "$L/report.mjs"
