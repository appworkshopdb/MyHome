#!/usr/bin/env bash
# Rollt eine Edge Function aus dem Repo auf den Server aus (Repo ist die Quelle).
# Aufruf: tools/deploy-functions.sh <function> [--dry-run]
#   1. prüft: Function im Repo vorhanden und committet, Syntax ok (esbuild)
#   2. vergleicht mit dem Live-Stand; ist alles gleich, passiert nichts
#   3. sichert den Live-Stand nach /opt/nestua/ops/backups/functions/<name>-<zeit>/
#   4. kopiert den Repo-Stand, startet die Edge Runtime neu, wartet auf healthy
#   5. prüft: Live = Repo, Endpunkt antwortet ohne 5xx
# Kein sudo nötig (volumes/functions gehört nestua, Docker über die docker-Gruppe).
set -euo pipefail
REPO=/opt/nestua/werkstatt
LIVE=/opt/nestua/staging/supabase-project/volumes/functions
BK=/opt/nestua/ops/backups/functions
NAME="${1:-}"; DRY="${2:-}"
[[ "$NAME" =~ ^[a-z0-9-]+$ ]] || { echo "Aufruf: $0 <function> [--dry-run]"; exit 1; }
SRC="$REPO/supabase/functions/$NAME"; DST="$LIVE/$NAME"
[ -d "$SRC" ] || { echo "Nicht im Repo: $SRC"; exit 1; }

cd "$REPO"
if ! git diff --quiet HEAD -- "supabase/functions/$NAME" || [ -n "$(git ls-files --others --exclude-standard -- "supabase/functions/$NAME")" ]; then
  echo "Nicht committete Änderungen in supabase/functions/$NAME. Erst committen, dann ausrollen."; exit 1
fi
for f in "$SRC"/*.ts; do "$REPO/node_modules/.bin/esbuild" --loader=ts --log-level=warning < "$f" > /dev/null; done
echo "Repo-Stand $(git log -1 --format=%h -- "supabase/functions/$NAME"): Syntax ok"

if [ -d "$DST" ] && diff -rq "$SRC" "$DST" > /dev/null; then echo "Live ist schon gleich dem Repo, nichts zu tun."; exit 0; fi
echo "Unterschiede Repo -> Live:"; diff -rq "$SRC" "$DST" 2>/dev/null | sed "s#$REPO/##; s#$LIVE#LIVE#" || true
[ "$DRY" = "--dry-run" ] && { echo "Probelauf: nichts geändert."; exit 0; }

STAMP=$(date +%Y%m%d-%H%M%S)
if [ -d "$DST" ]; then mkdir -p "$BK"; cp -a "$DST" "$BK/$NAME-$STAMP"; echo "Sicherung: $BK/$NAME-$STAMP"; fi
mkdir -p "$DST"; find "$DST" -mindepth 1 -delete; cp -a "$SRC/." "$DST/"; chmod -R go-w "$DST"
diff -rq "$SRC" "$DST" > /dev/null && echo "Live = Repo"

docker restart supabase-edge-functions > /dev/null
for i in $(seq 1 30); do s=$(docker inspect -f '{{.State.Health.Status}}' supabase-edge-functions); [ "$s" = healthy ] && break; sleep 2; done
echo "Edge Runtime: $s"
code=$(curl -s -o /dev/null -w '%{http_code}' -m 15 "https://api-staging.nestua.de/functions/v1/$NAME")
echo "Antwort ohne Schlüssel: $code"
if [ "$s" != healthy ] || [ "${code:0:1}" = 5 ] || [ "$code" = 000 ]; then
  echo "PROBLEM. Zurück mit: find $DST -mindepth 1 -delete && cp -a $BK/$NAME-$STAMP/. $DST/ && docker restart supabase-edge-functions"; exit 1
fi
echo "AUSGEROLLT: $NAME"
