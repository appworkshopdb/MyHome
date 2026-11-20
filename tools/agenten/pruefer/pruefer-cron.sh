#!/usr/bin/env bash
# Agent "Prüfer", KI-Teil auf dem Server (Cron alle 15 Minuten):
#   holt PR-Stände per Deploy-Key (refs/pull/*/head) in ein Bare-Repo, prüft jeden neuen, nicht gemergten Stand einmal:
#   Regel-Check (wie der GitHub-Check), dann KI-Review nur lesend, Bericht für den Leitstand, Meldung nach Discord #pruefer.
#   Der Server kann auf GitHub weder kommentieren noch PRs sehen, die geschlossen und nicht gemergt sind: ein solcher Stand
#   wird trotzdem nur einmal geprüft (state-Datei).
# Installiert als /opt/nestua/ops/agenten/pruefer/pruefer-cron.sh (tools/agenten/pruefer/deploy.sh).
#   --pr <nr>    diesen PR jetzt prüfen, auch wenn er schon geprüft ist
#   --seed       alle aktuellen PR-Stände als geprüft merken, ohne zu prüfen
#   --no-ai      ohne KI-Review     --no-send   nichts nach Discord senden
#   --no-design  ohne Design-Review (läuft sonst nur, wenn der PR UI-Dateien unter src/ ändert; nur Empfehlung, blockiert nichts)
set -uo pipefail
OPS=/opt/nestua/ops
P=${PRUEFER_DIR:-$OPS/agenten/pruefer}
BARE=$OPS/pruefer/MyHome.git
STATE=$OPS/pruefer/geprueft.txt
NODE=/usr/bin/node
CLAUDE=/home/nestua/.local/bin/claude
AI=1; SEND=1; ONLY=""; SEED=0; DESIGN=1
BRANCH=""
while [ $# -gt 0 ]; do case "$1" in --no-ai) AI=0 ;; --no-design) DESIGN=0 ;; --no-send) SEND=0 ;; --seed) SEED=1 ;; --pr) ONLY=$2; shift ;; --branch) BRANCH=$2; shift ;; esac; shift; done

exec 9>"$OPS/.pruefer-cron.lock"
flock -n 9 || { echo "läuft schon"; exit 0; }
G() { git -c core.quotePath=false -C "$BARE" "$@"; }

# Bare-Repo mit PR-Refs anlegen oder aktualisieren
if [ ! -d "$BARE" ]; then
  mkdir -p "$(dirname "$BARE")"
  git clone -q --bare git@github-myhome:appworkshopdb/MyHome.git "$BARE" || { echo "Klonen fehlgeschlagen"; exit 2; }
  G config --replace-all remote.origin.fetch '+refs/heads/*:refs/heads/*'
  G config --add remote.origin.fetch '+refs/pull/*/head:refs/pull/*/head'
fi
G fetch -q --prune origin 2> "$OPS/pruefer/fetch.err" || { echo "fetch fehlgeschlagen: $(tail -n 1 "$OPS/pruefer/fetch.err")"; exit 2; }
touch "$STATE"

# Offene Stände: PR-Head, der nicht in main enthalten ist und noch nicht geprüft wurde
todo=()
if [ -n "$BRANCH" ]; then   # Branch wie einen PR prüfen (zum Beispiel staging vor dem PR), ohne state
  sha=$(G rev-parse --verify -q "refs/heads/$BRANCH") || { echo "Branch $BRANCH nicht gefunden"; exit 2; }
  todo+=("$BRANCH $sha")
fi
[ -z "$BRANCH" ] && while read -r ref sha; do
  n=${ref#refs/pull/}; n=${n%/head}
  if [ -n "$ONLY" ]; then [ "$n" = "$ONLY" ] && todo+=("$n $sha"); continue; fi
  G merge-base --is-ancestor "$sha" refs/heads/main 2>/dev/null && continue
  grep -qx "$n $sha" "$STATE" && continue
  if [ "$SEED" = 1 ]; then echo "$n $sha" >> "$STATE"; echo "gemerkt: PR #$n $sha"; continue; fi
  todo+=("$n $sha")
done < <(G for-each-ref --format='%(refname) %(objectname)' 'refs/pull/*/head' | sort -t/ -k3 -n)
[ "$SEED" = 1 ] && exit 0
[ ${#todo[@]} -eq 0 ] && { echo "nichts Neues"; exit 0; }

# Langzeit-Token für claude -p aus der Meldungs-Konfiguration (wie beim Server-Check)
if [ "$AI" = 1 ] && [ -z "${CLAUDE_CODE_OAUTH_TOKEN:-}" ] && [ -r "$OPS/notify.env" ]; then
  T=$(sed -n 's/^CLAUDE_CODE_OAUTH_TOKEN=//p' "$OPS/notify.env" | tail -n 1 | tr -d "\"' \r")
  [ -n "$T" ] && export CLAUDE_CODE_OAUTH_TOKEN="$T"
fi

for item in "${todo[@]}"; do
  read -r PR SHA <<< "$item"
  RUN=$P/run/pr-$PR; rm -rf "$RUN"; mkdir -p "$RUN/tree"; : > "$RUN/lauf"
  if [ -n "$BRANCH" ]; then echo "== Branch $PR ($SHA)"; else echo "== PR #$PR ($SHA)"; fi
  MB=$(G merge-base refs/heads/main "$SHA")
  G log --oneline --no-merges "$MB..$SHA" > "$RUN/commits.txt"
  COMMITS=$(wc -l < "$RUN/commits.txt")

  # 1. Regel-Check (wie im GitHub-Workflow, ohne npm audit)
  "$NODE" "$P/regeln.mjs" --repo "$BARE" --base refs/heads/main --head "$SHA" --no-audit --json "$RUN/regeln.json" > "$RUN/regeln.txt"
  [ -s "$RUN/regeln.json" ] || { echo "Regel-Check|rot|fehlgeschlagen" >> "$RUN/lauf"; echo '{"fehler":[],"hinweise":[],"dateien":0}' > "$RUN/regeln.json"; }
  DATEIEN=$("$NODE" -e 'console.log(require(process.argv[1]).dateien)' "$RUN/regeln.json")

  # 2. Material für das Review: Diff (ohne Lock-Dateien und Bilder, höchstens 400 KB) und Dateistand
  # Ops-Werkzeuge (tools/, .claude/, design/) bleiben draußen: der Regel-Check prüft sie auf Geheimnisse, das Review gilt der App
  G diff --no-color "$MB" "$SHA" -- . ':(exclude)package-lock.json' ':(exclude)tools/**' ':(exclude).claude/**' ':(exclude)design/**' ':(exclude)*.png' ':(exclude)*.jpg' ':(exclude)*.jpeg' ':(exclude)*.webp' ':(exclude)*.svg' ':(exclude)*.woff2' > "$RUN/diff.full"
  if [ "$(stat -c %s "$RUN/diff.full")" -gt 400000 ]; then
    head -c 400000 "$RUN/diff.full" > "$RUN/diff.patch"; printf '\n\n[gekürzt: Diff ist %s KB groß, nur die ersten 400 KB enthalten]\n' "$(( $(stat -c %s "$RUN/diff.full") / 1024 ))" >> "$RUN/diff.patch"
  else mv "$RUN/diff.full" "$RUN/diff.patch"; fi
  rm -f "$RUN/diff.full"
  G archive "$SHA" -- src supabase docs CLAUDE.md 2>/dev/null | tar -x -C "$RUN/tree" 2>/dev/null
  # Für das Design-Review: Regelwerk und Tokens, Liste der UI-Dateien und der Dateien unter design/ (Mockups)
  G archive "$SHA" -- design/DESIGN.md design/tokens.css 2>/dev/null | tar -x -C "$RUN/tree" 2>/dev/null
  G diff --name-only --diff-filter=d "$MB" "$SHA" -- ':(glob)src/**/*.jsx' ':(glob)src/**/*.tsx' ':(glob)src/**/*.css' > "$RUN/ui-dateien.txt"
  G ls-tree -r --name-only "$SHA" -- design/ > "$RUN/design-dateien.txt"

  # 3. KI-Review: nur lesen im Lauf-Ordner, keine Shell, kein Schreiben
  ki() {   # ki <prompt-datei> <ausgabe> <label>
    local prompt; prompt=$(sed -e "s#{{PR}}#$PR#g" -e "s#{{COMMITS}}#$COMMITS#g" -e "s#{{DATEIEN}}#$DATEIEN#g" "$P/$1")
    ( cd "$RUN" && timeout 900 "$CLAUDE" -p "$prompt" --max-turns 40 --permission-mode default \
        --allowedTools "Read(//opt/nestua/ops/agenten/pruefer/run/**)" "Glob" "Grep" \
        --disallowedTools "Bash" "Write" "Edit" "NotebookEdit" "WebFetch" "WebSearch" \
        < /dev/null > "$RUN/$2" 2> "$RUN/$2.err" ) || { echo "$3|gelb|Review fehlgeschlagen (siehe $2.err)" >> "$RUN/lauf"; : > "$RUN/$2"; }
    grep -qE 'STUFE: *(grün|gelb|rot)' "$RUN/$2" || { [ -s "$RUN/$2" ] && echo "$3|gelb|Review ohne STUFE-Zeile" >> "$RUN/lauf"; }
  }
  : > "$RUN/design-review.md"
  if [ "$AI" = 1 ]; then
    ki PROMPT.md review.md KI
    # 3b. Design-Review nur bei geänderten UI-Dateien und vorhandenem Regelwerk; nur Empfehlung
    if [ "$DESIGN" = 1 ] && [ -s "$RUN/ui-dateien.txt" ]; then
      if [ -s "$RUN/tree/design/DESIGN.md" ]; then ki DESIGN-PROMPT.md design-review.md Design
      else echo "Design|gelb|nicht gelaufen, design/DESIGN.md fehlt im Stand" >> "$RUN/lauf"; fi
    fi
  fi

  # 4. Bericht und Meldung
  "$NODE" "$P/bericht.mjs" --pr "$PR" --sha "$SHA" --commits "$COMMITS" --regeln "$RUN/regeln.json" --ki "$RUN/review.md" --design "$RUN/design-review.md" --ui "$RUN/ui-dateien.txt" --lauf "$RUN/lauf" > "$RUN/discord.md"
  cat "$RUN/discord.md"
  if [ "$SEND" = 1 ]; then "$NODE" "$OPS/leitstand/notify.mjs" --agent pruefer --message "$(cat "$RUN/discord.md")" || echo "Meldung nach Discord fehlgeschlagen"; fi
  if [ -z "$BRANCH" ] && ! grep -qx "$PR $SHA" "$STATE"; then echo "$PR $SHA" >> "$STATE"; fi
done
exit 0
