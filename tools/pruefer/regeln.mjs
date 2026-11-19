#!/usr/bin/env node
// Prüfer, Regel-Check ohne KI: prüft nur die Zeilen, die ein PR (base...head) hinzufügt.
// Läuft im GitHub-Workflow "Prüfer" (Fehler blockieren den Merge) und auf dem Server vor dem KI-Review.
// Braucht keine Arbeitskopie: alles über git diff/show, deshalb auch in einem Bare-Repo nutzbar.
//
// Aufruf: node tools/pruefer/regeln.mjs --base origin/main --head HEAD [--repo .] [--json out.json] [--github] [--no-audit]
// Exit: 0 keine Fehler (Hinweise erlaubt), 1 mindestens ein Fehler, 2 Aufruf- oder Git-Fehler.
//
// Ausnahmen: am Zeilenende "pruefer:ok" (als Kommentar) oder eine Zeile "<regel> <pfad-muster>" in tools/pruefer/ausnahmen.txt.
// Geheimnisse werden nie ausgegeben, nur Regel, Datei und Zeile.
import { execFile } from 'node:child_process';
import { writeFile, appendFile } from 'node:fs/promises';
import path from 'node:path';

const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const has = (k) => process.argv.includes(k);
const BASE = arg('--base', 'origin/main'), HEAD = arg('--head', 'HEAD'), REPO = arg('--repo', '.');
const run = (cmd, args, opts = {}) => new Promise((res, rej) => execFile(cmd, args, { maxBuffer: 64 * 1024 * 1024, timeout: 180000, ...opts },
  (e, so, se) => (e && !opts.okExit ? rej(new Error((se || e.message).toString().trim().split('\n').pop())) : res({ out: so.toString(), code: e ? e.code : 0 }))));
const git = async (...a) => (await run('git', ['-c', 'core.quotePath=false', '-C', REPO, ...a])).out;

const fehler = [], hinweise = [];
const add = (stufe, regel, titel, datei, zeile, text) => (stufe === 'fehler' ? fehler : hinweise).push({ regel, titel, datei, zeile, text });

/* ---------- Diff lesen: hinzugefügte Zeilen je Datei ---------- */
let mb;
try { mb = (await git('merge-base', BASE, HEAD)).trim(); } catch (e) { console.error(`Prüfer: ${e.message}`); process.exit(2); }
const status = (await git('diff', '--name-status', '-M', mb, HEAD)).trim().split('\n').filter(Boolean).map((l) => { const p = l.split('\t'); return { st: p[0][0], datei: p.at(-1) }; });
const diff = await git('diff', '-U0', '--no-color', '--no-ext-diff', mb, HEAD);
const added = {}; // datei -> [{zeile, text}]
{ let f = null, n = 0;
  for (const l of diff.split('\n')) {
    if (l.startsWith('+++ ')) { f = l === '+++ /dev/null' ? null : l.slice(6); if (f) added[f] ||= []; continue; }
    const h = l.match(/^@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@/); if (h) { n = Number(h[1]); continue; }
    if (f && l.startsWith('+')) { added[f].push({ zeile: n, text: l.slice(1) }); n++; }
  } }

let ausnahmen = [];
try { ausnahmen = (await git('show', `${HEAD}:tools/pruefer/ausnahmen.txt`)).split('\n').map((l) => l.trim()).filter((l) => l && !l.startsWith('#')).map((l) => l.split(/\s+/)); } catch { /* keine Datei */ }
const glob = (g) => new RegExp('^' + g.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*\*/g, '\u0000').replace(/\*/g, '[^/]*').replace(/\u0000/g, '.*') + '$');
const frei = (regel, datei, text = '') => /pruefer:ok/.test(text) || ausnahmen.some(([r, g]) => (r === regel || r === '*') && glob(g || '**').test(datei));
const each = (re, fn) => { for (const [d, lines] of Object.entries(added)) if (re.test(d)) for (const x of lines) fn(d, x); };
const CODE = /^src\/.*\.(jsx?|tsx?|mjs)$/;

/* ---------- Fehlerliste aus CLAUDE.md ---------- */
each(CODE, (d, x) => {
  if (/toISOString\(\)\s*\.split\(\s*['"`]T['"`]\s*\)\s*\[\s*0\s*\]/.test(x.text) && !frei('datum-utc', d, x.text))
    add('fehler', 'datum-utc', 'Datum über UTC gebildet', d, x.zeile, 'toISOString().split("T")[0] verschiebt Tage bei Berlin-Zeit. Lokale Komponenten nehmen (siehe core/lib/habitsStore.js, todayStr).');
});
each(/^src\/core\//, (d, x) => {
  if (/(?:from\s+|import\s*\(\s*)['"`][^'"`]*\/modules\//.test(x.text) && !frei('core-modules', d, x.text))
    add('fehler', 'core-modules', 'core/ importiert aus modules/', d, x.zeile, 'core/ darf nicht aus modules/ importieren. Gemeinsame Logik nach core/lib/ verschieben.');
});
each(/(^index\.html$|^src\/)/, (d, x) => {
  if (/fonts\.(googleapis|gstatic)\.com/.test(x.text) && !frei('fonts-extern', d, x.text))
    add('hinweis', 'fonts-extern', 'Schrift von Google Fonts', d, x.zeile, 'Fonts sind self-hosted. Neue Schriften in die eigenen Font-Dateien aufnehmen.');
});
// Fixed-Nav: transform/filter/perspective/will-change/backdrop-filter in Regeln für mögliche Vorfahren von .chrome-top/.bottom-nav
const ANCESTOR = /(^|[\s,>])(html|body|#root|main|\.app\b|\.app-[\w-]+|\.shell\b|\.layout\b|\.page\b|\.screen\b)/;
for (const d of Object.keys(added).filter((f) => /\.css$/.test(f))) {
  let src = ''; try { src = await git('show', `${HEAD}:${d}`); } catch { continue; }
  const addedLines = new Set(added[d].map((x) => x.zeile));
  const re = /([^{}]+)\{([^{}]*)\}/g; let m;
  while ((m = re.exec(src))) {
    const startLine = src.slice(0, m.index).split('\n').length, endLine = startLine + m[0].split('\n').length - 1;
    const sel = m[1].trim(), body = m[2];
    if (!ANCESTOR.test(sel) || !/(^|[\s;{])(transform|filter|perspective|will-change|backdrop-filter|contain)\s*:/.test(body)) continue;
    const hit = [...addedLines].find((z) => z >= startLine && z <= endLine);
    if (hit && !frei('fixed-nav', d)) add('hinweis', 'fixed-nav', 'Mögliche Störung der festen Navigation', d, hit, `"${sel.slice(0, 60)}" setzt transform/filter o. ä. Auf Vorfahren von .chrome-top/.bottom-nav bricht das position: fixed.`);
  }
}

/* ---------- Geheimnisse ---------- */
const SECRETS = [
  ['privater Schlüssel', /-----BEGIN [A-Z ]*PRIVATE KEY-----/],
  ['Anthropic-Schlüssel', /sk-ant-[A-Za-z0-9_-]{10,}/],
  ['GitHub-Token', /\bgh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{30,}/],
  ['Discord-Webhook', /discord(?:app)?\.com\/api\/webhooks\/\d+\/[\w-]{20,}/],
  ['Google-Chat-Webhook', /chat\.googleapis\.com\/v1\/spaces\/[^?\s]+\/messages\?key=/],
  ['AWS-Schlüssel', /\bAKIA[0-9A-Z]{16}\b/],
  ['JWT', /\beyJ[A-Za-z0-9_-]{15,}\.eyJ[A-Za-z0-9_-]{15,}\.[A-Za-z0-9_-]{10,}/],
  ['Passwort oder Server-Schlüssel', /(service_role_key|SERVICE_ROLE_KEY|JWT_SECRET|POSTGRES_PASSWORD|SMTP_PASS(WORD)?|DB_PASSWORD)\s*[:=]\s*['"]?[^\s'"$<{]{16,}/i]
];
each(/^(?!.*(package-lock\.json|\.svg|\.min\.js)$)/, (d, x) => {
  for (const [name, re] of SECRETS) if (re.test(x.text) && !frei('geheimnis', d, x.text)) { add('fehler', 'geheimnis', `${name} im Code`, d, x.zeile, `Sieht aus wie ein ${name}. Entfernen, Schlüssel rotieren, Wert in Secrets oder .env ablegen.`); break; }
});
for (const s of status) if (s.st !== 'D' && /(^|\/)\.env(\.[\w-]+)?$/.test(s.datei) && !/\.(example|sample|template)$/.test(s.datei) && !frei('geheimnis', s.datei))
  add('fehler', 'geheimnis', '.env-Datei im Repo', s.datei, 1, '.env-Dateien gehören nicht ins Repo. Datei entfernen und Werte rotieren.');

/* ---------- SQL-Migrationen ---------- */
for (const d of Object.keys(added).filter((f) => /\.sql$/i.test(f))) {
  let src = ''; try { src = await git('show', `${HEAD}:${d}`); } catch { continue; }
  const addedLines = new Set(added[d].map((x) => x.zeile));
  const clean = src.replace(/--[^\n]*/g, (c) => ' '.repeat(c.length)).replace(/\/\*[\s\S]*?\*\//g, (c) => c.replace(/[^\n]/g, ' '));
  // Anweisungen mit Zeilenbereich; $$-Blöcke (Funktionskörper) zählen zur Anweisung
  const stmts = []; let buf = '', start = 1, line = 1, dollar = false;
  for (let i = 0; i < clean.length; i++) {
    const c = clean[i]; if (!buf.trim() && c !== '\n' && c !== ' ' && c !== '\t' && c !== '\r') start = line;
    if (clean.startsWith('$$', i)) { dollar = !dollar; buf += '$$'; i++; continue; }
    buf += c; if (c === '\n') line++;
    if (c === ';' && !dollar) { stmts.push({ text: buf.trim(), von: start, bis: line }); buf = ''; }
  }
  if (buf.trim()) stmts.push({ text: buf.trim(), von: start, bis: line });
  const isNew = (s) => [...addedLines].some((z) => z >= s.von && z <= s.bis);
  const low = clean.toLowerCase();
  for (const s of stmts.filter(isNew)) {
    const t = s.text.toLowerCase().replace(/\s+/g, ' ');
    const tb = t.match(/^create table (?:if not exists )?((?:"?\w+"?\.)?"?(\w+)"?)/);
    if (tb && !/^create table (?:if not exists )?(pg_temp|temp)/.test(t)) {
      const name = tb[2];
      if (!new RegExp(`alter table (?:only )?(?:if exists )?(?:"?\\w+"?\\.)?"?${name}"? enable row level security`).test(low.replace(/\s+/g, ' ')) && !frei('sql-rls', d))
        add('fehler', 'sql-rls', `Tabelle ${name} ohne RLS`, d, s.von, 'Neue Tabelle braucht "alter table … enable row level security" und eine Policy für authenticated (CLAUDE.md, Datenbank-Sicherheit).');
    }
    if (/\bgrant\b[^;]*\bto\b[^;]*\banon\b/.test(t) || /^create policy[^;]*\bto\b[^;]*\banon\b/.test(t)) {
      if (!frei('sql-anon', d)) add('fehler', 'sql-anon', 'Rechte für anon', d, s.von, 'anon hat keine Rechte auf public. Nur authenticated freigeben.');
    }
    if (/^create (or replace )?function/.test(t)) {
      const fn = (t.match(/^create (?:or replace )?function ((?:"?\w+"?\.)?"?\w+"?)/) || [])[1] || '?';
      if (/security definer/.test(t) && !/set search_path/.test(t) && !frei('sql-search-path', d))
        add('fehler', 'sql-search-path', `security definer ohne search_path: ${fn}`, d, s.von, 'SECURITY-DEFINER-Funktionen brauchen "set search_path = …".');
      const bare = fn.replace(/^.*\./, '').replace(/"/g, '');
      if (!new RegExp(`revoke [^;]*execute on function [^;]*${bare}[^;]*from [^;]*public`).test(low.replace(/\s+/g, ' ')) && !frei('sql-revoke', d))
        add('hinweis', 'sql-revoke', `Funktion ohne revoke: ${fn}`, d, s.von, 'EXECUTE kommt sonst über PUBLIC. "revoke execute … from public, anon, authenticated" und gezielt freigeben.');
    }
    if (/^drop (table|function|policy|view)|alter table [^;]* (drop column|rename)/.test(t) && !frei('sql-nicht-additiv', d))
      add('hinweis', 'sql-nicht-additiv', 'Nicht additive Änderung', d, s.von, 'Staging und main teilen ein Backend: Löschen und Umbenennen erst, wenn main nachgezogen hat.');
  }
}
for (const s of status.filter((x) => x.st === 'A' && /^supabase\/migrations\//.test(x.datei)))
  if (!/^supabase\/migrations\/\d{3}_[a-z0-9_]+\.sql$/.test(s.datei)) add('hinweis', 'migration-name', 'Migrationsname', s.datei, 1, 'Schema: supabase/migrations/NNN_kurzer_name.sql');

/* ---------- Edge Functions ---------- */
const fns = [...new Set(status.filter((x) => /^supabase\/functions\/[^/]+\//.test(x.datei)).map((x) => x.datei.split('/')[2]))];
for (const f of fns) add('hinweis', 'functions-deploy', `Edge Function geändert: ${f}`, `supabase/functions/${f}`, 1, `Nach dem Merge ausrollen: tools/deploy-functions.sh ${f} (vorher --dry-run).`);

/* ---------- npm audit (nur mit Arbeitskopie und Netz) ---------- */
let audit = null;
if (!has('--no-audit')) {
  try {
    const { out } = await run('npm', ['audit', '--omit=dev', '--json'], { cwd: REPO, okExit: true, timeout: 120000 });
    const v = JSON.parse(out).metadata?.vulnerabilities || {};
    audit = { kritisch: v.critical || 0, hoch: v.high || 0, mittel: v.moderate || 0, niedrig: v.low || 0 };
    if (audit.kritisch || audit.hoch) add('hinweis', 'npm-audit', 'Abhängigkeiten mit Sicherheitslücken', 'package-lock.json', 1, `npm audit (ohne dev): ${audit.kritisch} kritisch, ${audit.hoch} hoch, ${audit.mittel} mittel. Mit "npm audit" ansehen und gezielt aktualisieren.`);
  } catch (e) { audit = { fehler: e.message }; }
}

/* ---------- Ausgabe ---------- */
const zeilen = Object.values(added).reduce((n, a) => n + a.length, 0);
const R = { base: BASE, head: HEAD, mergeBase: mb, dateien: status.length, zeilen, fehler, hinweise, audit };
if (arg('--json', '')) await writeFile(arg('--json'), JSON.stringify(R, null, 1));
const row = (x) => `${x.datei}:${x.zeile}  ${x.titel}`;
console.log(`Prüfer: ${status.length} Dateien, ${zeilen} neue Zeilen. ${fehler.length} Fehler, ${hinweise.length} Hinweise.`);
for (const x of fehler) console.log(`  FEHLER   ${row(x)}`);
for (const x of hinweise) console.log(`  Hinweis  ${row(x)}`);
if (has('--github')) {
  const esc = (s) => String(s).replace(/%/g, '%25').replace(/\r/g, '%0D').replace(/\n/g, '%0A');
  for (const x of fehler) console.log(`::error file=${x.datei},line=${x.zeile},title=Prüfer: ${esc(x.titel)}::${esc(x.text)}`);
  for (const x of hinweise) console.log(`::warning file=${x.datei},line=${x.zeile},title=Prüfer: ${esc(x.titel)}::${esc(x.text)}`);
  if (process.env.GITHUB_STEP_SUMMARY) {
    const t = (list) => list.length ? `| Datei | Zeile | Befund | Was tun |\n|---|---|---|---|\n${list.map((x) => `| \`${x.datei}\` | ${x.zeile} | ${x.titel} | ${x.text} |`).join('\n')}` : 'Keine.';
    await appendFile(process.env.GITHUB_STEP_SUMMARY, `## Prüfer: Regel-Check\n\n${status.length} Dateien, ${zeilen} neue Zeilen.\n\n### Fehler (blockieren den Merge): ${fehler.length}\n\n${t(fehler)}\n\n### Hinweise: ${hinweise.length}\n\n${t(hinweise)}\n\nAusnahmen: am Zeilenende \`pruefer:ok\` oder Eintrag in \`tools/pruefer/ausnahmen.txt\`.\n`);
  }
}
process.exit(fehler.length ? 1 : 0);
