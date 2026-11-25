#!/usr/bin/env python3
"""PreToolUse-Hook (Bash): blockiert Befehle, die Geheimnisse ausgeben oder Unumkehrbares tun.

Sicherheitsgurt, keine Garantie: erkennt typische Muster. Erlaubt bleiben Rechte-/Existenzprüfungen
(ls, stat, test, chmod, chgrp), Hash-Vergleiche (sha256sum) und das Einlesen in Variablen ohne Ausgabe.
Exit 2 = blockiert, die Meldung auf stderr bekommt Claude zu sehen. Jeder andere Fehler lässt den Befehl durch
(lieber ein fehlender Schutz als eine blockierte Sitzung).
"""
import json
import re
import sys

SECRET_FILE = re.compile(
    r"(?:(?<![\w.-])\.env(?![\w.-])(?!\.example)"            # .env (nicht .env.example)
    r"|\.env\.(?:old|bak[\w.-]*|local|prod[\w.-]*)\b"           # Kopien der .env
    r"|\bbackup\.env\b|\bnotify\.env\b"
    r"|\.gpg\b"
    r"|\.ssh/(?!known_hosts|config|authorized_keys)(?![\w.-]+\.pub\b)[\w.-]+"
    r"|\.git-credentials\b|\.credentials\.json\b)"
)
SHOW_TOOL = re.compile(
    r"(?:^|[|;&(`]\s*|\$\(\s*|\b(?:sudo|xargs)\s+)"
    r"(?:cat|tac|nl|less|more|head|tail|grep|egrep|fgrep|rg|sed|awk|cut|strings|xxd|od|hexdump|base64|"
    r"cp|mv|scp|rsync|tee|vi|vim|nano|python3?|node|jq|diff|sort|uniq|paste|column|iconv)\b"
)
HASH_ONLY = re.compile(r"\|\s*(?:sha256sum|sha1sum|md5sum|wc\b)")

RULES = [
    # Alle Regeln gelten nur innerhalb einer Zeile und eines Teilbefehls ([^|;&\n]),
    # damit mitgeschickter Code (Heredocs, Python) keine Treffer über Zeilen hinweg erzeugt.
    (re.compile(r"\bdocker\s+exec\b[^|;&\n]*\b(?:printenv|env)\b(?!\s*\|\s*(?:cut\s+-d=?\s*-f1|sed\s+-E?\s*'s/=\.\*))"),
     "Umgebung eines Containers ausgeben zeigt Schlüssel. Nur Namen (printenv | cut -d= -f1) oder Hash-Vergleich (| sha256sum)."),
    (re.compile(r"\bdocker\s+compose\b(?:(?!\s-q\b|--quiet)[^|;&\n])*\bconfig\b(?!(?:[^|;&\n])*(?:\s-q\b|--quiet))"),
     "docker compose config ohne -q gibt die aufgelöste .env mit allen Schlüsseln aus. Nur mit -q prüfen."),
    (re.compile(r"\bgpg\b[^|;&\n]*--export-secret"),
     "Privater GPG-Schlüssel darf nie ausgegeben werden."),
    (re.compile(r"\bdecrypted_secret\b"),
     None),  # Sonderfall unten
    (re.compile(r"\bgit\s+push\b[^|;&\n]*(?:\s--force\b|\s-f\b|\s--force-with-lease\b|\s\+[\w./-])"),
     "Force-Push ist gesperrt. Nur normaler Push nach staging."),
    (re.compile(r"\bdocker\s+compose\b[^|;&\n]*\bdown\b"),
     "docker compose down stoppt den ganzen Stack (Staging = Produktion). Gezielt einzelne Dienste neu starten."),
    (re.compile(r"\bdocker\s+(?:volume\s+rm|system\s+prune|volume\s+prune)\b"),
     "Löschen von Docker-Volumes ist gesperrt (Datenbank und Uploads)."),
    (re.compile(r"\brm\s+-[a-zA-Z]*[rR][a-zA-Z]*\s+(?:-\S+\s+)*[\"']?/(?:$|\s|\*|(?:opt|etc|var|home|root|usr|srv|boot)\b)"),
     "Rekursives Löschen in Systemordnern ist gesperrt."),
]


def check(cmd: str):
    # Dateiregel je Teilbefehl (Zeile, ;, &&, ||), Pipes bleiben zusammen (cat x | sha256sum ist erlaubt)
    for seg in (s.strip() for s in re.split(r"\n|;|&&|\|\|", cmd)):
        if SECRET_FILE.search(seg) and SHOW_TOOL.search(seg) and not HASH_ONLY.search(seg):
            return ("Befehl würde eine Geheimnis-Datei (.env, backup.env, notify.env, *.gpg, SSH-Schlüssel) lesen "
                    "oder kopieren. Erlaubt: Rechte/Existenz prüfen, Schlüsselnamen ohne Werte, Hash-Vergleich. "
                    "Werte trägt der Nutzer selbst ein.")
    for rx, msg in RULES:
        if not rx.search(cmd):
            continue
        if msg is None:  # decrypted_secret: nur in Cron-Definitionen oder als Hash erlaubt
            if re.search(r"cron\.(?:alter_job|schedule)|sha256|digest\(", cmd) or HASH_ONLY.search(cmd):
                continue
            return "vault.decrypted_secrets ausgeben zeigt Schlüssel im Klartext. Nur als Hash vergleichen oder in Cron-Befehlen verwenden."
        return msg
    return None


def main():
    try:
        data = json.load(sys.stdin)
        cmd = (data.get("tool_input") or {}).get("command") or ""
    except Exception:
        return 0
    reason = check(cmd)
    if reason:
        print(f"Blockiert (guard-secrets): {reason}", file=sys.stderr)
        return 2
    return 0


if __name__ == "__main__":
    sys.exit(main())
