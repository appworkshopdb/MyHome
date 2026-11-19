#!/usr/bin/env bash
# Agent "Kontext & Status" (Cron montags 07:00 Berlin-Zeit):
#   1. Vault (nestua-notes) aktualisieren, 2. Fakten der Woche ohne KI sammeln,
#   3. KI schreibt die Wochennotiz und gleicht Backlog/Index.md ab (nur diese zwei Stellen, keine Shell),
#   4. Skript verwirft Änderungen an anderen Dateien, committet und pusht, 5. Bericht für den Leitstand, 6. Meldung nach Discord #kontext.
# Installiert als /opt/nestua/ops/agenten/kontext/kontext-cron.sh (tools/agenten/kontext/deploy.sh).
#   --no-ai     ohne KI (Ersatz-Wochennotiz aus den Fakten)
#   --no-push   nichts committen und pushen (Änderungen im Vault werden danach verworfen)
#   --no-send   nichts nach Discord senden (Meldung nur ausgeben)
# Exit-Code: 0 grün, 1 gelb, 2 rot.
set -uo pipefail
OPS=/opt/nestua/ops
K=${KONTEXT_DIR:-$OPS/agenten/kontext}     # nur für Tests überschreiben
VAULT=${KONTEXT_VAULT:-$OPS/vault}         # nur für Tests überschreiben (die KI-Rechte gelten fest für $OPS/vault)
REPO=/opt/nestua/werkstatt
NODE=/usr/bin/node
CLAUDE=/home/nestua/.local/bin/claude
AI=1; PUSH=1; SEND=1
for a in "$@"; do case "$a" in --no-ai) AI=0 ;; --no-push) PUSH=0 ;; --no-send) SEND=0 ;; esac; done

exec 9>"$OPS/.kontext-cron.lock"
flock -n 9 || { echo "läuft schon"; exit 0; }
# Kontext & Status und Datenschutz teilen den Vault-Klon: nicht gleichzeitig darin arbeiten
exec 8>"$OPS/.vault.lock"
flock -w 900 8 || { echo "Vault seit 15 Minuten belegt"; exit 2; }
RUN=$K/run; rm -rf "$RUN"; mkdir -p "$RUN"
STATUS=grün; : > "$RUN/befunde"
befund() { echo "$1|$2|$3" >> "$RUN/befunde"; if [ "$2" = rot ]; then STATUS=rot; elif [ "$STATUS" = grün ]; then STATUS=gelb; fi; echo "Befund: $1 ($2): $3"; }
G() { git -c core.quotePath=false -C "$VAULT" "$@"; }
NOTIZ=""

finish() {
  "$NODE" "$K/bericht.mjs" --fakten "$RUN/fakten.json" --status "$STATUS" --befunde "$RUN/befunde" --ki "$RUN/kurz.md" --notiz "$NOTIZ" > "$RUN/discord.md"
  cat "$RUN/discord.md"
  if [ "$SEND" = 1 ]; then "$NODE" "$OPS/leitstand/notify.mjs" --agent kontext --message "$(cat "$RUN/discord.md")" || echo "Meldung nach Discord fehlgeschlagen"
  else "$NODE" "$OPS/leitstand/notify.mjs" --agent kontext --dry-run --message "$(cat "$RUN/discord.md")" > /dev/null; fi
  case "$STATUS" in grün) exit 0 ;; gelb) exit 1 ;; *) exit 2 ;; esac
}

# 1. Vault aktualisieren (nur Fast-Forward und Rebase, nie erzwingen)
if [ ! -d "$VAULT/.git" ]; then befund "Vault" rot "kein Klon unter $VAULT"; echo '{}' > "$RUN/fakten.json"; finish; fi
if [ -n "$(G status --porcelain)" ]; then befund "Vault" gelb "lokale Änderungen vor dem Lauf verworfen"; G reset -q --hard; G clean -qfd; fi
G pull -q --rebase 2> "$RUN/git.err" || { befund "Vault" rot "pull fehlgeschlagen: $(tail -n 1 "$RUN/git.err")"; G rebase --abort 2>/dev/null; echo '{}' > "$RUN/fakten.json"; finish; }

# 2. Fakten ohne KI
"$NODE" "$K/fakten.mjs" --repo "$REPO" --vault "$VAULT" --out "$RUN/fakten.json" --md "$RUN/fakten.md" \
  || { befund "Fakten" rot "fakten.mjs fehlgeschlagen"; echo '{}' > "$RUN/fakten.json"; finish; }
read -r WOCHE KW VON BIS < <("$NODE" -e 'const w=require(process.argv[1]).woche;console.log(w.datei,w.kw,w.vonText,w.bisText)' "$RUN/fakten.json")
NOTIZ="Betrieb/Wochen/$WOCHE.md"
"$NODE" -e 'const f=require(process.argv[1]);for(const e of f.fehler)console.log(e)' "$RUN/fakten.json" | while read -r e; do echo "Hinweis Fakten: $e"; done
[ "$("$NODE" -e 'console.log(require(process.argv[1]).fehler.length)' "$RUN/fakten.json")" = 0 ] || befund "Fakten" gelb "unvollständig, siehe Wochennotiz"

# 3. KI: Wochennotiz und Index-Abgleich (Anmeldung wie beim Server-Check: Langzeit-Token aus der Meldungs-Konfiguration)
if [ "$AI" = 1 ]; then
  if [ -z "${CLAUDE_CODE_OAUTH_TOKEN:-}" ] && [ -r "$OPS/notify.env" ]; then
    T=$(sed -n 's/^CLAUDE_CODE_OAUTH_TOKEN=//p' "$OPS/notify.env" | tail -n 1 | tr -d "\"' \r")
    [ -n "$T" ] && export CLAUDE_CODE_OAUTH_TOKEN="$T"
  fi
  PROMPT=$(sed -e "s#{{FAKTEN}}#$RUN/fakten.json#g" -e "s#{{NOTIZ}}#$NOTIZ#g" -e "s#{{WOCHE}}#$WOCHE#g" -e "s#{{KW}}#$KW#g" -e "s#{{VON}}#$VON#g" -e "s#{{BIS}}#$BIS#g" "$K/PROMPT.md")
  mkdir -p "$VAULT/Betrieb/Wochen"
  ( cd "$VAULT" && timeout 900 "$CLAUDE" -p "$PROMPT" --max-turns 40 --permission-mode default \
      --allowedTools "Read(//opt/nestua/ops/vault/**)" "Read(//opt/nestua/ops/agenten/kontext/run/**)" "Glob" "Grep" \
        "Edit(//opt/nestua/ops/vault/Betrieb/Wochen/**)" "Edit(//opt/nestua/ops/vault/Backlog/Index.md)" \
      --disallowedTools "Bash" "WebFetch" "WebSearch" "NotebookEdit" \
      < /dev/null > "$RUN/kurz.md" 2> "$RUN/ki.err" ) || { befund "KI" gelb "Lauf fehlgeschlagen (siehe $RUN/ki.err), Ersatz-Wochennotiz ohne KI"; : > "$RUN/kurz.md"; }
fi
if [ ! -s "$VAULT/$NOTIZ" ] || ! grep -q "^art: wochenuebersicht" "$VAULT/$NOTIZ"; then
  [ "$AI" = 1 ] && [ -s "$RUN/kurz.md" ] && befund "KI" gelb "keine Wochennotiz geschrieben, Ersatz ohne KI"
  mkdir -p "$VAULT/Betrieb/Wochen"; cp "$RUN/fakten.md" "$VAULT/$NOTIZ"; : > "$RUN/kurz.md"
fi

# 4. Schreibschutz: nur Betrieb/Wochen/ und Backlog/Index.md dürfen sich ändern
G status --porcelain --untracked-files=all | cut -c4- | while IFS= read -r f; do
  f=${f#\"}; f=${f%\"}
  case "$f" in Betrieb/Wochen/*|Backlog/Index.md) ;; *) echo "verworfen: $f" >> "$RUN/verworfen" ;; esac
done
if [ -s "$RUN/verworfen" ]; then
  while IFS= read -r line; do f=${line#verworfen: }; G checkout -q -- "$f" 2>/dev/null || rm -f -- "$VAULT/$f"; done < "$RUN/verworfen"
  befund "Schreibschutz" gelb "$(wc -l < "$RUN/verworfen") Änderung(en) außerhalb der erlaubten Stellen verworfen"
fi

# 5. Commit und Push (Rebase bei Gleichzeitigkeit, nie erzwingen)
if [ "$PUSH" = 1 ]; then
  G add -- "Betrieb/Wochen" "Backlog/Index.md" 2>/dev/null
  if G -c user.name=Claude -c user.email=noreply@anthropic.com commit -q -m "Kontext: Wochenübersicht $WOCHE"; then
    ok=0
    for i in 1 2; do
      G pull -q --rebase 2>> "$RUN/git.err" || { G rebase --abort 2>/dev/null; break; }
      if G push -q origin HEAD 2>> "$RUN/git.err"; then ok=1; break; fi
    done
    [ "$ok" = 1 ] || befund "Push" rot "nestua-notes nicht gepusht: $(tail -n 1 "$RUN/git.err")"
  else echo "Keine Änderungen im Vault"; fi
else
  echo "--no-push: Vault-Änderungen werden verworfen (Kopie in $RUN/notiz.md und $RUN/vault.diff)"
  cp "$VAULT/$NOTIZ" "$RUN/notiz.md" 2>/dev/null; G diff > "$RUN/vault.diff"; G reset -q --hard; G clean -qfd
fi

finish
