#!/usr/bin/env bash
# Agent "Social Media" (Cron montags 09:00 Berlin-Zeit, nach Kontext & Status um 07:00):
#   1. Vault aktualisieren, 2. Fakten ohne KI (Entwurfswoche, Wochennotiz, Commits, frühere Entwürfe),
#   3. KI liest Metricool (nur Leseaufrufe) und schreibt 3 Entwürfe nach Betrieb/Social/<JJJJ-Www>.md (nur diese Datei, keine Shell),
#   4. Skript verwirft alle anderen Änderungen, committet und pusht, 5. Bericht für den Leitstand, 6. Meldung nach Discord #social.
# Der Agent veröffentlicht und plant nichts: Metricool-Schreibaufrufe sind gesperrt.
# Installiert als /opt/nestua/ops/agenten/social/social-cron.sh (tools/agenten/social/deploy.sh). Der Metricool-Zugang ist nur für diesen Ordner
# eingetragen (claude mcp add --scope local, Anmeldung: claude mcp login metricool --no-browser); claude -p läuft deshalb hier.
#   --no-ai     ohne KI (keine Entwürfe, nur Fakten und Leitstand)
#   --no-push   nichts committen und pushen (Kopie der Entwürfe in run/notiz.md)
#   --no-send   nichts nach Discord senden
# Exit-Code: 0 grün, 1 gelb, 2 rot.
set -uo pipefail
# Im Leitstand ausgeschaltet: kein Lauf (AGENT_FORCE=1 überspringt das für einen Handlauf)
if [ -z "${AGENT_FORCE:-}" ] && /opt/nestua/ops/leitstand/aus.sh social; then echo "im Leitstand ausgeschaltet, kein Lauf"; exit 0; fi
OPS=/opt/nestua/ops
D=${SOCIAL_DIR:-$OPS/agenten/social}
VAULT=$OPS/vault
REPO=/opt/nestua/werkstatt
NODE=/usr/bin/node
CLAUDE=/home/nestua/.local/bin/claude
AI=1; PUSH=1; SEND=1
for a in "$@"; do case "$a" in --no-ai) AI=0 ;; --no-push) PUSH=0 ;; --no-send) SEND=0 ;; esac; done

exec 9>"$OPS/.social-cron.lock"
flock -n 9 || { echo "läuft schon"; exit 0; }
# Alle Agenten, die im Vault-Klon arbeiten, sperren sich gegenseitig
exec 8>"$OPS/.vault.lock"
flock -w 900 8 || { echo "Vault seit 15 Minuten belegt"; exit 2; }
RUN=$D/run; rm -rf "$RUN"; mkdir -p "$RUN"; : > "$RUN/lauf"; : > "$RUN/kurz.md"
G() { git -c core.quotePath=false -C "$VAULT" "$@"; }
NOTIZ=""
lauf() { echo "$1|$2|$3" >> "$RUN/lauf"; echo "Lauf: $1 ($2): $3"; }

finish() {
  "$NODE" "$D/bericht.mjs" --fakten "$RUN/fakten.json" --kurz "$RUN/kurz.md" --notiz-datei "$RUN/notiz.md" --notiz "$NOTIZ" --lauf "$RUN/lauf" > "$RUN/discord.md"
  cat "$RUN/discord.md"
  if [ "$SEND" = 1 ]; then "$NODE" "$OPS/leitstand/notify.mjs" --agent social --message "$(cat "$RUN/discord.md")" || echo "Meldung nach Discord fehlgeschlagen"; fi
  if grep -q '|rot|' "$RUN/lauf"; then exit 2; elif [ -s "$RUN/lauf" ]; then exit 1; else exit 0; fi
}

# 1. Vault
if [ ! -d "$VAULT/.git" ]; then lauf "Vault" rot "kein Klon unter $VAULT"; echo '{}' > "$RUN/fakten.json"; : > "$RUN/notiz.md"; finish; fi
if [ -n "$(G status --porcelain)" ]; then lauf "Vault" gelb "lokale Änderungen vor dem Lauf verworfen"; G reset -q --hard; G clean -qfd; fi
G pull -q --rebase 2> "$RUN/git.err" || { lauf "Vault" rot "pull fehlgeschlagen: $(tail -n 1 "$RUN/git.err")"; G rebase --abort 2>/dev/null; echo '{}' > "$RUN/fakten.json"; : > "$RUN/notiz.md"; finish; }

# 2. Fakten ohne KI
"$NODE" "$D/fakten.mjs" --repo "$REPO" --vault "$VAULT" --out "$RUN/fakten.json" || { lauf "Fakten" rot "fakten.mjs fehlgeschlagen"; echo '{}' > "$RUN/fakten.json"; : > "$RUN/notiz.md"; finish; }
J() { "$NODE" -e "const f=require(process.argv[1]);console.log($1)" "$RUN/fakten.json"; }
WOCHE=$(J 'f.entwurf.datei'); KW=$(J 'f.entwurf.w'); VON=$(J 'f.entwurf.vonText'); BIS=$(J 'f.entwurf.bisText')
NOTIZ="Betrieb/Social/$WOCHE.md"
[ "$(J 'f.fehler.length')" = 0 ] || lauf "Fakten" gelb "unvollständig: $(J 'f.fehler.join("; ").slice(0,200)')"
[ "$(J 'f.wochennotiz.vorhanden')" = true ] || lauf "Wochennotiz" gelb "$(J 'f.wochennotiz.datei') fehlt (Kontext & Status nicht gelaufen?), Themen nur aus Commits"

# 3. KI: Entwürfe. Anmeldung wie bei den anderen Agenten (Langzeit-Token aus der Meldungs-Konfiguration)
if [ "$AI" = 1 ]; then
  if [ -z "${CLAUDE_CODE_OAUTH_TOKEN:-}" ] && [ -r "$OPS/notify.env" ]; then
    T=$(sed -n 's/^CLAUDE_CODE_OAUTH_TOKEN=//p' "$OPS/notify.env" | tail -n 1 | tr -d "\"' \r")
    [ -n "$T" ] && export CLAUDE_CODE_OAUTH_TOKEN="$T"
  fi
  METRICOOL="nicht verfügbar (benutze nur Fakten, Wochennotiz und Backlog, und sage das im Abschnitt Hinweise)"
  if ( cd "$D" && timeout 90 "$CLAUDE" mcp list < /dev/null 2>&1 | grep -q "metricool.*Connected" ); then METRICOOL="verfügbar"
  else lauf "Metricool" gelb "nicht verbunden: claude mcp login metricool --no-browser im Ordner $D"; fi
  PROMPT=$(sed -e "s#{{FAKTEN}}#$RUN/fakten.json#g" -e "s#{{NOTIZ}}#$NOTIZ#g" -e "s#{{WOCHE}}#$WOCHE#g" -e "s#{{KW}}#$KW#g" -e "s#{{VON}}#$VON#g" -e "s#{{BIS}}#$BIS#g" -e "s#{{METRICOOL}}#$METRICOOL#g" "$D/PROMPT.md")
  mkdir -p "$VAULT/Betrieb/Social"
  ( cd "$D" && timeout 1200 "$CLAUDE" -p "$PROMPT" --max-turns 40 --permission-mode default \
      --allowedTools "Read(//opt/nestua/ops/vault/**)" "Read(//opt/nestua/ops/agenten/social/run/**)" "Glob" "Grep" \
        "Edit(//opt/nestua/ops/vault/Betrieb/Social/**)" \
        "mcp__metricool__getBrandSettings" "mcp__metricool__getScheduledPosts" "mcp__metricool__getBestTimeToPostByNetwork" \
        "mcp__metricool__getAnalyticsAvailableMetrics" "mcp__metricool__getAnalyticsDataByMetrics" \
      --disallowedTools "Bash" "WebFetch" "WebSearch" "NotebookEdit" \
        "mcp__metricool__createScheduledPost" "mcp__metricool__createScheduledPostForReview" "mcp__metricool__updateScheduledPost" "mcp__metricool__sendScheduledPostForReview" \
      < /dev/null > "$RUN/kurz.md" 2> "$RUN/ki.err" ) || { lauf "KI" gelb "Lauf fehlgeschlagen (siehe ki.err)"; : > "$RUN/kurz.md"; }
  if [ ! -s "$VAULT/$NOTIZ" ] || ! grep -q "^art: social-entwuerfe" "$VAULT/$NOTIZ"; then lauf "KI" rot "keine Entwürfe geschrieben"; fi
fi
cp "$VAULT/$NOTIZ" "$RUN/notiz.md" 2>/dev/null || : > "$RUN/notiz.md"

# 4. Schreibschutz: nur Betrieb/Social/ darf sich ändern
G status --porcelain --untracked-files=all | cut -c4- | while IFS= read -r f; do
  f=${f#\"}; f=${f%\"}; case "$f" in Betrieb/Social/*) ;; *) echo "$f" >> "$RUN/verworfen" ;; esac
done
if [ -s "$RUN/verworfen" ]; then
  while IFS= read -r f; do G checkout -q -- "$f" 2>/dev/null || rm -f -- "$VAULT/$f"; done < "$RUN/verworfen"
  lauf "Schreibschutz" gelb "$(wc -l < "$RUN/verworfen") Änderung(en) außerhalb von Betrieb/Social verworfen"
fi

# 5. Commit und Push
if [ "$PUSH" = 1 ] && [ -s "$RUN/notiz.md" ]; then
  G add -- "Betrieb/Social" 2>/dev/null
  if G -c user.name=Claude -c user.email=noreply@anthropic.com commit -q -m "Social: Entwürfe $WOCHE"; then
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
