#!/usr/bin/env bash
# Agent "Datenschutz" (Cron monatlich am 1. um 08:00 Berlin-Zeit):
#   1. Vault aktualisieren, 2. Fakten ohne KI (Datenbank nur Struktur und Zählungen, Code main/staging, Backups, Backlog),
#   3. KI schreibt den Monatsbericht Betrieb/Datenschutz/<JJJJ-MM>.md (nur diese Datei, keine Shell),
#   4. Skript verwirft alle anderen Änderungen, committet und pusht, 5. Bericht für den Leitstand, 6. Meldung nach Discord #datenschutz.
# Installiert als /opt/nestua/ops/agenten/datenschutz/datenschutz-cron.sh (tools/agenten/datenschutz/deploy.sh).
#   --no-ai     ohne KI (kein Monatsbericht, nur Fakten und Leitstand)
#   --no-push   nichts committen und pushen (Kopie des Berichts in run/notiz.md)
#   --no-send   nichts nach Discord senden
# Exit-Code: 0 grün, 1 gelb, 2 rot.
set -uo pipefail
# Im Leitstand ausgeschaltet: kein Lauf (AGENT_FORCE=1 überspringt das für einen Handlauf)
if [ -z "${AGENT_FORCE:-}" ] && /opt/nestua/ops/leitstand/aus.sh dsgvo; then echo "im Leitstand ausgeschaltet, kein Lauf"; exit 0; fi
OPS=/opt/nestua/ops
D=${DATENSCHUTZ_DIR:-$OPS/agenten/datenschutz}
VAULT=$OPS/vault
REPO=/opt/nestua/werkstatt
NODE=/usr/bin/node
CLAUDE=/home/nestua/.local/bin/claude
AI=1; PUSH=1; SEND=1
for a in "$@"; do case "$a" in --no-ai) AI=0 ;; --no-push) PUSH=0 ;; --no-send) SEND=0 ;; esac; done

exec 9>"$OPS/.datenschutz-cron.lock"
flock -n 9 || { echo "läuft schon"; exit 0; }
# Kontext & Status und Datenschutz teilen den Vault-Klon: nicht gleichzeitig darin arbeiten
exec 8>"$OPS/.vault.lock"
flock -w 900 8 || { echo "Vault seit 15 Minuten belegt"; exit 2; }
RUN=$D/run; rm -rf "$RUN"; mkdir -p "$RUN"; : > "$RUN/lauf"; : > "$RUN/kurz.md"
G() { git -c core.quotePath=false -C "$VAULT" "$@"; }
NOTIZ=""
lauf() { echo "$1|$2|$3" >> "$RUN/lauf"; echo "Lauf: $1 ($2): $3"; }

finish() {
  "$NODE" "$D/bericht.mjs" --fakten "$RUN/fakten.json" --kurz "$RUN/kurz.md" --notiz-datei "$RUN/notiz.md" --notiz "$NOTIZ" --lauf "$RUN/lauf" > "$RUN/discord.md"
  cat "$RUN/discord.md"
  if [ "$SEND" = 1 ]; then "$NODE" "$OPS/leitstand/notify.mjs" --agent dsgvo --message "$(cat "$RUN/discord.md")" || echo "Meldung nach Discord fehlgeschlagen"; fi
  if grep -q '|rot|' "$RUN/lauf"; then exit 2; elif [ -s "$RUN/lauf" ]; then exit 1; else exit 0; fi
}

# 1. Vault
if [ ! -d "$VAULT/.git" ]; then lauf "Vault" rot "kein Klon unter $VAULT"; echo '{}' > "$RUN/fakten.json"; finish; fi
if [ -n "$(G status --porcelain)" ]; then lauf "Vault" gelb "lokale Änderungen vor dem Lauf verworfen"; G reset -q --hard; G clean -qfd; fi
G pull -q --rebase 2> "$RUN/git.err" || { lauf "Vault" rot "pull fehlgeschlagen: $(tail -n 1 "$RUN/git.err")"; G rebase --abort 2>/dev/null; echo '{}' > "$RUN/fakten.json"; finish; }

# 2. Fakten ohne KI
"$NODE" "$D/fakten.mjs" --repo "$REPO" --vault "$VAULT" --out "$RUN/fakten.json" || { lauf "Fakten" rot "fakten.mjs fehlgeschlagen"; echo '{}' > "$RUN/fakten.json"; finish; }
read -r MONAT < <("$NODE" -e 'console.log(require(process.argv[1]).monat.datei)' "$RUN/fakten.json")
MONATTEXT=$("$NODE" -e 'console.log(require(process.argv[1]).monat.text)' "$RUN/fakten.json")
NOTIZ="Betrieb/Datenschutz/$MONAT.md"
[ "$("$NODE" -e 'console.log(require(process.argv[1]).fehler.length)' "$RUN/fakten.json")" = 0 ] || lauf "Fakten" gelb "unvollständig: $("$NODE" -e 'console.log(require(process.argv[1]).fehler.join("; ").slice(0,200))' "$RUN/fakten.json")"

# 3. KI: Monatsbericht (Anmeldung wie bei den anderen Agenten: Langzeit-Token aus der Meldungs-Konfiguration)
if [ "$AI" = 1 ]; then
  if [ -z "${CLAUDE_CODE_OAUTH_TOKEN:-}" ] && [ -r "$OPS/notify.env" ]; then
    T=$(sed -n 's/^CLAUDE_CODE_OAUTH_TOKEN=//p' "$OPS/notify.env" | tail -n 1 | tr -d "\"' \r")
    [ -n "$T" ] && export CLAUDE_CODE_OAUTH_TOKEN="$T"
  fi
  PROMPT=$(sed -e "s#{{FAKTEN}}#$RUN/fakten.json#g" -e "s#{{NOTIZ}}#$NOTIZ#g" -e "s#{{MONAT}}#$MONAT#g" -e "s#{{MONATTEXT}}#$MONATTEXT#g" "$D/PROMPT.md")
  mkdir -p "$VAULT/Betrieb/Datenschutz"
  ( cd "$VAULT" && timeout 900 "$CLAUDE" -p "$PROMPT" --max-turns 30 --permission-mode default \
      --allowedTools "Read(//opt/nestua/ops/vault/**)" "Read(//opt/nestua/ops/agenten/datenschutz/run/**)" "Glob" "Grep" \
        "Edit(//opt/nestua/ops/vault/Betrieb/Datenschutz/**)" \
      --disallowedTools "Bash" "WebFetch" "WebSearch" "NotebookEdit" \
      < /dev/null > "$RUN/kurz.md" 2> "$RUN/ki.err" ) || { lauf "KI" gelb "Lauf fehlgeschlagen (siehe ki.err)"; : > "$RUN/kurz.md"; }
  if [ ! -s "$VAULT/$NOTIZ" ] || ! grep -q "^art: datenschutzbericht" "$VAULT/$NOTIZ"; then lauf "KI" gelb "kein Monatsbericht geschrieben"; fi
fi
cp "$VAULT/$NOTIZ" "$RUN/notiz.md" 2>/dev/null || : > "$RUN/notiz.md"

# 4. Schreibschutz: nur Betrieb/Datenschutz/ darf sich ändern
G status --porcelain --untracked-files=all | cut -c4- | while IFS= read -r f; do
  f=${f#\"}; f=${f%\"}; case "$f" in Betrieb/Datenschutz/*) ;; *) echo "$f" >> "$RUN/verworfen" ;; esac
done
if [ -s "$RUN/verworfen" ]; then
  while IFS= read -r f; do G checkout -q -- "$f" 2>/dev/null || rm -f -- "$VAULT/$f"; done < "$RUN/verworfen"
  lauf "Schreibschutz" gelb "$(wc -l < "$RUN/verworfen") Änderung(en) außerhalb von Betrieb/Datenschutz verworfen"
fi

# 5. Commit und Push
if [ "$PUSH" = 1 ] && [ -s "$RUN/notiz.md" ]; then
  G add -- "Betrieb/Datenschutz" 2>/dev/null
  if G -c user.name=Claude -c user.email=noreply@anthropic.com commit -q -m "Datenschutz: Monatsbericht $MONAT"; then
    ok=0
    for i in 1 2; do
      G pull -q --rebase 2>> "$RUN/git.err" || { G rebase --abort 2>/dev/null; break; }
      if G push -q origin HEAD 2>> "$RUN/git.err"; then ok=1; break; fi
    done
    [ "$ok" = 1 ] || lauf "Push" rot "nestua-notes nicht gepusht: $(tail -n 1 "$RUN/git.err")"
  else echo "Keine Änderungen im Vault"; fi
else
  [ "$PUSH" = 0 ] && echo "--no-push: Vault-Änderungen werden verworfen (Kopie in $RUN/notiz.md)"
  G reset -q --hard; G clean -qfd
fi

finish
