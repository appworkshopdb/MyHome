#!/usr/bin/env python3
"""Tests für guard-secrets.py. Aufruf: python3 .claude/hooks/test_guard.py  (Exit 0 = alle ok)."""
import json
import pathlib
import subprocess
import sys

G = str(pathlib.Path(__file__).with_name("guard-secrets.py"))
FP = "git push " + "--force"            # zusammengesetzt, damit diese Datei selbst nichts auslöst
BLOCK = [
    "cat /opt/nestua/staging/supabase-project/.env", "grep JWT .env", "sudo cat /opt/nestua/backup.env",
    "head -3 ~/.ssh/github_myhome_deploy", "cat ~/.ssh/storagebox_key", "cp .env /tmp/x",
    "python3 -c 'print(open(\".env\").read())'",
    "docker exec supabase-edge-functions printenv", "docker exec supabase-edge-functions printenv SUPABASE_SERVICE_ROLE_KEY",
    "cd /x && docker compose config", "docker compose -f a.yml config",
    "gpg --armor --export-secret-keys x", "psql -c \"select decrypted_secret from vault.decrypted_secrets\"",
    FP + " origin staging", "git push -f origin staging", "git push origin +staging",
    "cd x && docker compose down", "docker volume rm supabase_db",
    "rm -rf /opt", "sudo rm -rf /etc/caddy", "rm -rf /opt/nestua/ops/backups/x",
]
ALLOW = [
    "ls -la /opt/nestua/staging/supabase-project/", "stat -c '%a' /opt/nestua/staging/supabase-project/.env",
    "test -r .env && echo ok", "cat .env.example", "sha256sum .env", "cat ~/.ssh/github_myhome_deploy.pub", "cat ~/.ssh/config",
    "docker exec supabase-edge-functions printenv | cut -d= -f1",
    "docker exec x sh -c 'printf %s \"$SUPABASE_SERVICE_ROLE_KEY\"' | sha256sum | cut -c1-64",
    "cd /opt/nestua/staging/supabase-project && docker compose config -q && echo OK", "docker compose ps",
    "bash -c 'set -a; . /opt/nestua/backup.env; curl -fsS -m 10 -o /dev/null \"$HC_PING_URL\" && echo PING_OK'",
    "psql -c \"select cron.alter_job(job_id := 1, command := $$ select (select decrypted_secret from vault.decrypted_secrets) $$)\"",
    "git push origin staging", "echo 'git push origin staging'\nx += [1]", "docker compose ps\necho down",
    "rm -rf /tmp/claude-1000/x", "rm -r ./build", "chgrp nestua /opt/nestua/staging/supabase-project/.env",
    "node /opt/nestua/ops/leitstand/scan.mjs --print", "git status --short", "/usr/bin/env node -v",
]


def code(cmd):
    return subprocess.run([sys.executable, G], input=json.dumps({"tool_input": {"command": cmd}}),
                          capture_output=True, text=True).returncode


bad = [("blockieren", c) for c in BLOCK if code(c) != 2] + [("erlauben", c) for c in ALLOW if code(c) != 0]
print(f"{len(BLOCK)} Sperr- und {len(ALLOW)} Erlaubnisfälle, {len(bad)} falsch")
for what, c in bad:
    print(f"  sollte {what}: {c!r}")
sys.exit(1 if bad else 0)
