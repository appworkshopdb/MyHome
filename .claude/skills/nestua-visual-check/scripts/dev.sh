#!/usr/bin/env bash
# Dev-Server mit Testdaten starten/stoppen (Skill nestua-visual-check).
#   bash .claude/skills/nestua-visual-check/scripts/dev.sh start|stop
# WICHTIG: nie `pkill -f vite ...` benutzen — das trifft die eigene Shell (Exit 144).
# Beenden läuft über die gemerkte Prozess-ID. `stop` löscht auch .env.local, damit nichts davon im Commit landet.
set -u
ROOT="$(cd "$(dirname "$0")/../../../.." && pwd)"
TMP="${TMPDIR:-/tmp}"
PIDFILE="$TMP/nestua-vite.pid"
case "${1:-}" in
  start)
    cd "$ROOT" || exit 1
    printf 'VITE_SUPABASE_URL=https://mock.nestua.de\nVITE_SUPABASE_ANON_KEY=mock-anon-key\n' > .env.local
    # Vite direkt starten (nicht über npx): npx spaltet einen Prozess ab, der beim Beenden übrig bleibt.
    (nohup node node_modules/.bin/vite --port 5173 --host 127.0.0.1 > "$TMP/nestua-vite.log" 2>&1 & echo $! > "$PIDFILE")
    for _ in $(seq 1 30); do
      code=$(curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:5173/ || true)
      [ "$code" = "200" ] && { echo "bereit auf http://127.0.0.1:5173"; exit 0; }
      sleep 1
    done
    echo "Server kam nicht hoch, Log: $TMP/nestua-vite.log"; exit 1 ;;
  stop)
    if [ -f "$PIDFILE" ]; then
      pid=$(cat "$PIDFILE")
      kill "$pid" 2>/dev/null || true
      rm -f "$PIDFILE"
    fi
    rm -f "$ROOT/.env.local"
    echo "gestoppt, .env.local entfernt" ;;
  *) echo "Aufruf: dev.sh start|stop"; exit 2 ;;
esac
