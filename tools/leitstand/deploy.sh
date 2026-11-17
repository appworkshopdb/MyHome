#!/usr/bin/env bash
# Kopiert den Leitstand aus dem Repo nach /opt/nestua/ops/leitstand und führt einmal den Scan aus.
# aufgaben.json und www/data/ bleiben unangetastet (Laufzeitdaten).
set -euo pipefail
SRC="$(dirname "$(readlink -f "$0")")"
DST=/opt/nestua/ops/leitstand
mkdir -p "$DST/www/data"
install -m 644 "$SRC/registry.json" "$DST/registry.json"
install -m 755 "$SRC/scan.mjs" "$DST/scan.mjs"
for f in index.html leitstand.css leitstand.js; do install -m 644 "$SRC/www/$f" "$DST/www/$f"; done
[ -f "$DST/aufgaben.json" ] || printf '{"du":[],"claude":[],"done":[]}\n' > "$DST/aufgaben.json"
node "$DST/scan.mjs" --print | head -1
