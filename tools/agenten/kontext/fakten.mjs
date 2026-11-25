#!/usr/bin/env node
// Fakten für den Agenten "Kontext & Status", ohne KI: Woche, Commits, Backlog-Stand und -Veränderungen, Index-Abgleich, Pflegehinweise.
// Nur lesend (git log/show/ls-tree, Dateien lesen). Ergebnis: JSON für Skript und KI, Markdown als Ersatz-Wochennotiz, wenn die KI ausfällt.
// Aufruf: node fakten.mjs --repo <MyHome-Klon> --vault <nestua-notes-Klon> --out <fakten.json> --md <fakten.md> [--now <ISO-Zeit>] [--no-fetch]
import { readFile, readdir, writeFile } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import path from 'node:path';

const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const REPO = arg('--repo', '/opt/nestua/werkstatt'), VAULT = arg('--vault', '/opt/nestua/ops/vault');
const OUT = arg('--out', ''), MD = arg('--md', ''), NOW = new Date(arg('--now', new Date().toISOString()));
const LEITSTAND = '/opt/nestua/ops/leitstand/www/data/leitstand.json';
const TZ = 'Europe/Berlin', STALE_DAYS = 14;
const fehler = [];

// core.quotePath=false: Dateinamen mit Umlauten unverändert ausgeben (sonst "pr\303\274fen")
const git = (dir, args) => new Promise((res, rej) => execFile('git', ['-c', 'core.quotePath=false', '-C', dir, ...args],
  { maxBuffer: 32 * 1024 * 1024, timeout: 90000, env: { ...process.env, TZ } },
  (e, so, se) => (e ? rej(new Error((se || e.message).toString().trim().split('\n').pop())) : res(so.toString()))));

/* ---------- Woche (Montag bis Sonntag vor dem Lauf, Berlin-Zeit) ---------- */
const ymdOf = (d) => new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
const addDays = (s, n) => { const d = new Date(`${s}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const offset = (s) => new Intl.DateTimeFormat('en-US', { timeZone: TZ, timeZoneName: 'longOffset' }).formatToParts(new Date(`${s}T12:00:00Z`))
  .find((p) => p.type === 'timeZoneName').value.replace('GMT', '') || '+00:00';
const isoWeek = (s) => { const d = new Date(`${s}T12:00:00Z`), wd = d.getUTCDay() || 7; d.setUTCDate(d.getUTCDate() + 4 - wd);
  const y = d.getUTCFullYear(); return { y, w: Math.ceil(((d - Date.UTC(y, 0, 1)) / 864e5 + 1) / 7) }; };
const de = (s) => s.split('-').reverse().join('.');
const today = ymdOf(NOW), wdToday = new Date(`${today}T12:00:00Z`).getUTCDay() || 7;
const thisMon = addDays(today, 1 - wdToday), start = addDays(thisMon, -7), end = thisMon;
const since = `${start}T00:00:00${offset(start)}`, until = `${end}T00:00:00${offset(end)}`;
const { y, w } = isoWeek(start);
const woche = { jahr: y, kw: w, datei: `${y}-W${String(w).padStart(2, '0')}`, von: start, bis: addDays(end, -1), vonText: de(start), bisText: de(addDays(end, -1)) };

/* ---------- Commits im App-Repo ---------- */
async function commits() {
  if (!process.argv.includes('--no-fetch')) { try { await git(REPO, ['fetch', '-q', 'origin']); } catch (e) { fehler.push(`git fetch MyHome: ${e.message}`); } }
  const out = {};
  for (const b of ['staging', 'main']) {
    try {
      const txt = await git(REPO, ['log', `origin/${b}`, `--since=${since}`, `--until=${until}`, '--no-merges', '--date=format-local:%d.%m. %H:%M', '--format=%h%x09%ad%x09%s']);
      out[b] = txt.trim().split('\n').filter(Boolean).map((l) => { const [hash, wann, ...s] = l.split('\t'); return { hash, wann, titel: s.join('\t') }; });
    } catch (e) { out[b] = []; fehler.push(`git log ${b}: ${e.message}`); }
  }
  return out;
}

/* ---------- Backlog ---------- */
function front(txt) {
  const m = txt.match(/^---\r?\n([\s\S]*?)\r?\n---/); const fm = {};
  if (m) for (const l of m[1].split(/\r?\n/)) { const k = l.match(/^([\wäöüÄÖÜß-]+):\s*(.*)$/); if (k) fm[k[1]] = k[2].replace(/^["']|["']$/g, '').trim(); }
  const t = txt.replace(/^---[\s\S]*?\n---/, '').match(/^#\s+(.+)$/m);
  return { fm, titel: t ? t[1].trim() : null };
}
async function notes() {
  const dir = path.join(VAULT, 'Backlog'); let files = [];
  try { files = (await readdir(dir)).filter((f) => f.endsWith('.md') && f !== 'Index.md'); } catch (e) { fehler.push(`Backlog-Ordner: ${e.message}`); }
  const list = [];
  for (const f of files) {
    const { fm, titel } = front(await readFile(path.join(dir, f), 'utf8'));
    list.push({ datei: f, name: f.replace(/\.md$/, ''), titel: titel || f.replace(/\.md$/, ''), status: (fm.status || '').toLowerCase(), bereich: fm.bereich || '', art: fm.art || '', projekt: fm.projekt || '', prio: fm.prio || '' });
  }
  return list;
}
async function veraenderung(now) {
  const res = { neu: [], erledigt: [], wechsel: [], entfernt: [] };
  let rev = '';
  try { rev = (await git(VAULT, ['rev-list', '-1', `--before=${since}`, 'HEAD'])).trim(); } catch (e) { fehler.push(`Vault-Verlauf: ${e.message}`); }
  const old = {};
  if (rev) {
    let tree = [];
    try { tree = (await git(VAULT, ['ls-tree', '-r', '--name-only', rev, 'Backlog/'])).trim().split('\n').filter((p) => p.endsWith('.md') && !p.endsWith('/Index.md')); } catch { /* leer */ }
    for (const p of tree) { try { const { fm } = front(await git(VAULT, ['show', `${rev}:${p}`])); old[path.basename(p)] = (fm.status || '').toLowerCase(); } catch { /* nicht lesbar */ } }
  }
  const nowBy = Object.fromEntries(now.map((n) => [n.datei, n]));
  for (const n of now) {
    if (!(n.datei in old)) { if (rev) res.neu.push(n.name); continue; }
    if (old[n.datei] !== n.status) { if (n.status === 'done') res.erledigt.push(n.name); else res.wechsel.push({ name: n.name, von: old[n.datei], nach: n.status }); }
  }
  for (const f of Object.keys(old)) if (!nowBy[f]) res.entfernt.push(f.replace(/\.md$/, ''));
  res.vergleichMoeglich = !!rev;
  return res;
}

/* ---------- Pflege: Index-Abgleich, veraltete und doppelte Einträge (nur markieren) ---------- */
const STATUS_HEAD = [[/erledigt|\bdone\b/i, 'done'], [/review|prüfen/i, 'in-review'], [/in[- ]?progress|in arbeit/i, 'in-progress'], [/\btodo\b|offen/i, 'todo'], [/backlog|ideen?\b|prototyp/i, 'backlog']];
async function pflege(list) {
  const res = { indexFehlt: [], indexFalsch: [], indexVerwaist: [], veraltet: [], doppelt: [] };
  let idx = '';
  try { idx = await readFile(path.join(VAULT, 'Backlog', 'Index.md'), 'utf8'); } catch { fehler.push('Backlog/Index.md fehlt'); }
  if (idx) {
    // Status gilt nur in einem Status-Abschnitt und dessen tieferen Unterüberschriften; "Nach Bereich", "Nach Projekt" usw. beenden ihn.
    let head = null, level = 0; const where = {};
    for (const line of idx.split(/\r?\n/)) {
      const h = line.match(/^(#{1,6})\s+(.*)$/);
      if (h) {
        const s = STATUS_HEAD.find(([re]) => re.test(h[2])), L = h[1].length;
        if (L === 1) { head = null; level = 0; }
        else if (s) { head = s[1]; level = L; }
        else if (!(head && L > level)) { head = null; level = L; }
        continue;
      }
      for (const m of line.matchAll(/\[\[([^\]|#]+)/g)) (where[m[1].trim()] ||= []).push(head);
    }
    const names = new Set(list.map((n) => n.name));
    for (const n of list) {
      const heads = where[n.name] || where[n.titel];
      if (!heads) { res.indexFehlt.push(n.name); continue; }
      const st = heads.filter((x) => x && x !== 'projekt');
      if (st.length && n.status && !st.includes(n.status)) res.indexFalsch.push({ name: n.name, steht: st[0], status: n.status });
    }
    let alle = new Set();
    try { alle = new Set((await git(VAULT, ['ls-files', '*.md'])).trim().split('\n').map((p) => path.basename(p, '.md'))); } catch { /* nur Backlog */ }
    for (const k of Object.keys(where)) if (!names.has(k) && !alle.has(k) && !list.some((n) => n.titel === k)) res.indexVerwaist.push(k);
  }
  for (const n of list.filter((x) => x.status === 'in-progress')) {
    try {
      const iso = (await git(VAULT, ['log', '-1', '--format=%cI', '--', `Backlog/${n.datei}`])).trim();
      const tage = iso ? Math.floor((NOW - new Date(iso)) / 864e5) : null;
      if (tage !== null && tage > STALE_DAYS) res.veraltet.push({ name: n.name, tage });
    } catch { /* ohne Verlauf */ }
  }
  const STOP = new Set(['für', 'und', 'oder', 'der', 'die', 'das', 'den', 'dem', 'des', 'mit', 'von', 'zum', 'zur', 'ein', 'eine', 'einen', 'bei', 'auf', 'aus', 'nach', 'neu', 'neue']);
  const words = (s) => new Set(s.toLowerCase().replace(/[^a-zäöüß0-9 ]/g, ' ').split(/\s+/).filter((x) => x.length > 2 && !STOP.has(x)));
  const open = list.filter((n) => n.status !== 'done').map((n) => ({ n, w: words(n.titel) }));
  for (let i = 0; i < open.length; i++) for (let j = i + 1; j < open.length; j++) {
    const a = open[i].w, b = open[j].w; if (!a.size || !b.size) continue;
    const inter = [...a].filter((x) => b.has(x)).length, jac = inter / (a.size + b.size - inter);
    if (jac >= 0.75) res.doppelt.push([open[i].n.name, open[j].n.name]);
  }
  return res;
}

async function leitstand() {
  try {
    const d = JSON.parse(await readFile(LEITSTAND, 'utf8'));
    const ag = d.nodes.filter((n) => n.kind === 'agent').map((n) => ({ name: n.name, status: n.status, wert: n.value, letzterLauf: n.run?.last ? `${n.run.last.datum} ${n.run.last.zeit} ${n.run.last.status}` : null }));
    return { stand: d.generatedText, system: `${d.system.ok}/${d.system.total}`, agenten: ag, offenBeiDir: (d.tasks?.du || []).length };
  } catch { return null; }
}

const count = (arr, k) => arr.reduce((o, x) => { const v = x[k] || '(ohne)'; o[v] = (o[v] || 0) + 1; return o; }, {});
const list = await notes();
const offen = list.filter((n) => n.status !== 'done');
const F = {
  erstellt: NOW.toISOString(), woche, commits: await commits(),
  backlog: { gesamt: list.length, nachStatus: count(list, 'status'), offenNachProjekt: count(offen, 'projekt'), offenNachBereich: count(offen, 'bereich'),
    hochPrio: offen.filter((n) => /hoch|high|^1$/i.test(n.prio)).map((n) => n.name) },
  veraenderung: await veraenderung(list), pflege: await pflege(list), leitstand: await leitstand(), fehler
};

/* ---------- Ersatz-Wochennotiz (nur wenn die KI ausfällt) ---------- */
const L = (a) => (a.length ? a.map((x) => `- ${x}`).join('\n') : '- keine');
const md = `---
art: wochenuebersicht
woche: ${woche.datei}
von: ${woche.von}
bis: ${woche.bis}
erstellt: automatisch (ohne KI)
---
# Woche ${woche.kw}/${woche.jahr} (${woche.vonText} bis ${woche.bisText})

## Gebaut

${F.commits.staging.length} Commits auf staging, ${F.commits.main.length} auf main.

${L(F.commits.staging.map((c) => `${c.titel} (${c.hash}, ${c.wann})`))}

## Backlog

Neu:
${L(F.veraenderung.neu.map((n) => `[[${n}]]`))}

Erledigt:
${L(F.veraenderung.erledigt.map((n) => `[[${n}]]`))}

Statuswechsel:
${L(F.veraenderung.wechsel.map((x) => `[[${x.name}]]: ${x.von} → ${x.nach}`))}

Offen nach Projekt: ${Object.entries(F.backlog.offenNachProjekt).map(([k, v]) => `${k} ${v}`).join(', ') || 'keine'}

## Backlog-Pflege (nur markiert)

Fehlen im Index:
${L(F.pflege.indexFehlt.map((n) => `[[${n}]]`))}

Im falschen Abschnitt:
${L(F.pflege.indexFalsch.map((x) => `[[${x.name}]]: steht unter ${x.steht}, Status ${x.status}`))}

Seit über ${STALE_DAYS} Tagen in Arbeit:
${L(F.pflege.veraltet.map((x) => `[[${x.name}]] (${x.tage} Tage)`))}

Vielleicht doppelt:
${L(F.pflege.doppelt.map(([a, b]) => `[[${a}]] und [[${b}]]`))}
${fehler.length ? `\n## Hinweise zum Lauf\n\n${L(fehler)}\n` : ''}`;

if (OUT) await writeFile(OUT, JSON.stringify(F, null, 1)); else console.log(JSON.stringify(F, null, 1));
if (MD) await writeFile(MD, md);
