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
#   --no-staging staging nicht mitprüfen (sonst: jeder neue Stand von staging, nur die neuen Commits seit dem letzten geprüften Stand)
#   --no-design  ohne Design-Review (läuft sonst nur, wenn der PR UI-Dateien unter src/ ändert; nur Empfehlung, blockiert nichts)
set -uo pipefail
OPS=/opt/nestua/ops
P=${PRUEFER_DIR:-$OPS/agenten/pruefer}
BARE=$OPS/pruefer/MyHome.git
STATE=$OPS/pruefer/geprueft.txt
STSTATE=$OPS/pruefer/staging-geprueft.txt   # zuletzt geprüfter Stand von staging (eine Zeile, Commit-Hash)
NODE=/usr/bin/node
CLAUDE=/home/nestua/.local/bin/claude
AI=1; SEND=1; ONLY=""; SEED=0; DESIGN=1; STAGING=1
BRANCH=""
while [ $# -gt 0 ]; do case "$1" in --no-ai) AI=0 ;; --no-design) DESIGN=0 ;; --no-staging) STAGING=0 ;; --no-send) SEND=0 ;; --seed) SEED=1 ;; --pr) ONLY=$2; shift ;; --branch) BRANCH=$2; shift ;; esac; shift; done

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

# staging ist der Entwicklungszweig: jeder neue Stand wird geprüft, aber nur die Commits seit dem letzten geprüften Stand.
# Erster Lauf ohne Stand: aktuellen Stand merken, geprüft wird ab dem nächsten Push (der Bestand wäre ein Review über Hunderte Dateien).
STHEAD=$(G rev-parse --verify -q refs/heads/staging || true)
if [ "$SEED" = 1 ]; then [ -n "$STHEAD" ] && { echo "$STHEAD" > "$STSTATE"; echo "gemerkt: staging $STHEAD"; }; exit 0; fi
if [ -z "$BRANCH" ] && [ -z "$ONLY" ] && [ "$STAGING" = 1 ] && [ -n "$STHEAD" ]; then
  STLAST=$(cat "$STSTATE" 2>/dev/null || true)
  if [ -z "$STLAST" ] || ! G cat-file -e "${STLAST}^{commit}" 2>/dev/null; then
    echo "$STHEAD" > "$STSTATE"; echo "staging: Ausgangsstand ${STHEAD:0:7} gemerkt, geprüft wird ab dem nächsten Push"
  elif [ "$STHEAD" != "$STLAST" ]; then
    # Vorgänger-Stand; wurde staging überschrieben (Force-Push), gilt der gemeinsame Vorfahr als Basis
    VONB=$STLAST; G merge-base --is-ancestor "$STLAST" "$STHEAD" 2>/dev/null || VONB=$(G merge-base "$STLAST" "$STHEAD" 2>/dev/null || true)
    if [ -n "$VONB" ]; then todo+=("staging $STHEAD $VONB"); else echo "$STHEAD" > "$STSTATE"; fi
  fi
fi
[ ${#todo[@]} -eq 0 ] && { echo "nichts Neues"; exit 0; }

# Langzeit-Token für claude -p aus der Meldungs-Konfiguration (wie beim Server-Check)
if [ "$AI" = 1 ] && [ -z "${CLAUDE_CODE_OAUTH_TOKEN:-}" ] && [ -r "$OPS/notify.env" ]; then
  T=$(sed -n 's/^CLAUDE_CODE_OAUTH_TOKEN=//p' "$OPS/notify.env" | tail -n 1 | tr -d "\"' \r")
  [ -n "$T" ] && export CLAUDE_CODE_OAUTH_TOKEN="$T"
fi

for item in "${todo[@]}"; do
  read -r PR SHA VON <<< "$item"   # VON gesetzt = staging seit diesem Stand (kein PR)
  RUN=$P/run/pr-$PR; rm -rf "$RUN"; mkdir -p "$RUN/tree"; : > "$RUN/lauf"
  if [ -n "$VON" ]; then echo "== staging ${VON:0:7}..${SHA:0:7}"; elif [ -n "$BRANCH" ]; then echo "== Branch $PR ($SHA)"; else echo "== PR #$PR ($SHA)"; fi
  if [ -n "$VON" ]; then
    MB=$VON; ZIEL="den Entwicklungszweig \`staging\` (neue Commits seit ${VON:0:7}, kein PR; verglichen wird mit diesem Stand, nicht mit main)"
  else
    MB=$(G merge-base refs/heads/main "$SHA")
    if [ -n "$BRANCH" ]; then ZIEL="den Branch \`$PR\` gegen \`main\`"; else ZIEL="PR #$PR gegen \`main\`"; fi
  fi
  G log --oneline --no-merges "$MB..$SHA" > "$RUN/commits.txt"
  COMMITS=$(wc -l < "$RUN/commits.txt")

  # 1. Regel-Check (wie im GitHub-Workflow, ohne npm audit)
  "$NODE" "$P/regeln.mjs" --repo "$BARE" --base "${VON:-refs/heads/main}" --head "$SHA" --no-audit --json "$RUN/regeln.json" > "$RUN/regeln.txt"
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

  # staging: nur Werkzeuge oder Doku geändert und der Regel-Check ohne Befund: nichts zu prüfen, still weiter
  if [ -n "$VON" ] && [ -z "$(G diff --name-only "$MB" "$SHA" -- src supabase .github package.json package-lock.json)" ] && [ "$("$NODE" -e 'const r=require(process.argv[1]); console.log(r.fehler.length+r.hinweise.length)' "$RUN/regeln.json")" = 0 ]; then
    echo "staging ${SHA:0:7}: nichts unter src/, supabase/, .github/ oder in den Paketdateien geändert, nichts zu prüfen"; echo "$SHA" > "$STSTATE"; continue
  fi

  # 3. KI-Review: nur lesen im Lauf-Ordner, keine Shell, kein Schreiben
  ki() {   # ki <prompt-datei> <ausgabe> <label>
    local prompt; prompt=$(sed -e "s#{{PR}}#$PR#g" -e "s#{{COMMITS}}#$COMMITS#g" -e "s#{{DATEIEN}}#$DATEIEN#g" -e "s|{{ZIEL}}|$ZIEL|g" "$P/$1")
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
  "$NODE" "$P/bericht.mjs" --pr "$PR" --sha "$SHA" --von "$VON" --commits "$COMMITS" --regeln "$RUN/regeln.json" --ki "$RUN/review.md" --design "$RUN/design-review.md" --ui "$RUN/ui-dateien.txt" --lauf "$RUN/lauf" > "$RUN/discord.md"
  cat "$RUN/discord.md"
  if [ "$SEND" = 1 ]; then "$NODE" "$OPS/leitstand/notify.mjs" --agent pruefer --message "$(cat "$RUN/discord.md")" || echo "Meldung nach Discord fehlgeschlagen"; fi
  if [ -n "$VON" ]; then echo "$SHA" > "$STSTATE"
  elif [ -z "$BRANCH" ] && ! grep -qx "$PR $SHA" "$STATE"; then echo "$PR $SHA" >> "$STATE"; fi
done
exit 0
