#!/usr/bin/env bash
# Startet die Schalter-Schnittstelle (api.mjs), falls sie nicht läuft. Gedacht für Cron alle 5 Minuten:
#   */5 * * * * /opt/nestua/ops/leitstand/api-start.sh >/dev/null 2>&1
# Die Sperre hält der Server selbst: läuft er, beendet sich jeder weitere Aufruf sofort.
D=/opt/nestua/ops/leitstand
exec setsid flock -n "$D/.api.lock" /usr/bin/node "$D/api.mjs" >> "$D/api.log" 2>&1
