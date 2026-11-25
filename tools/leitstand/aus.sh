#!/usr/bin/env bash
# aus.sh <agent-id>: Exit 0, wenn der Agent im Leitstand ausgeschaltet ist (Datei aus/<id> vorhanden), sonst 1.
# Die Cron-Skripte der Agenten rufen das als Erstes auf; AGENT_FORCE=1 überspringt die Prüfung für einen Handlauf.
[ -n "${1:-}" ] && [ -e "/opt/nestua/ops/leitstand/aus/$1" ]
