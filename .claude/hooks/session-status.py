#!/usr/bin/env python3
"""SessionStart-Hook: gibt den Kurzstand aus dem Leitstand aus (landet im Kontext der neuen Sitzung).

Liest nur /opt/nestua/ops/leitstand/www/data/leitstand.json. Fehlt die Datei (z. B. in einer Cloud-Sitzung),
gibt der Hook nichts aus. Endet immer mit Exit 0.
"""
import json
import sys
from datetime import datetime, timezone

DATA = "/opt/nestua/ops/leitstand/www/data/leitstand.json"


def main():
    try:
        with open(DATA, encoding="utf-8") as f:
            d = json.load(f)
    except Exception:
        return 0
    try:
        s = d["system"]
        age = (datetime.now(timezone.utc) - datetime.fromisoformat(d["generated"].replace("Z", "+00:00"))).total_seconds() / 60
        lines = [f"Leitstand (https://leitstand.nestua.de), Stand {d['generatedText']} Uhr Berlin"
                 + (f", ACHTUNG {int(age)} Min alt" if age > 15 else "")
                 + f": System {s['ok']}/{s['total']} grün, {s['warn']} Hinweise, {s['bad']} Fehler."]
        bad = [c for c in (d["checks"][i] for i in s["ids"]) if c["status"] != "ok"]
        if bad:
            lines.append("Nicht grün: " + "; ".join(f"{c['label']} {c['value']} ({c['detail']})" for c in bad))
        builds = [n for n in d["nodes"] if n.get("kind") == "agent" and n.get("status") == "build"]
        if builds:
            lines.append("Agenten im Aufbau: " + ", ".join(f"{n['name']} {n['value']}" for n in builds))
        t = d.get("tasks") or {}
        if t.get("du"):
            lines.append("Offen beim Nutzer: " + "; ".join(x["t"] for x in t["du"][:5]))
        if t.get("claude"):
            lines.append("Offen bei Claude: " + "; ".join(x["t"] for x in t["claude"][:5]))
        lines.append("Aufgabenliste pflegen: /opt/nestua/ops/leitstand/aufgaben.json (erledigt nach done, mit Datum).")
        print("\n".join(lines))
    except Exception:
        return 0
    return 0


if __name__ == "__main__":
    sys.exit(main())
