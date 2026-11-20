// Verbrauch pro Agent: liest die Sitzungs-Transkripte von Claude Code (~/.claude/projects/*/*.jsonl) und sammelt je Sitzung
// Kostenschätzung und Tokens in /opt/nestua/ops/leitstand/usage.json. Die Datei bleibt erhalten, auch wenn Claude Code alte
// Transkripte nach 30 Tagen löscht. Gelesen werden nur Zahlen und der Anfang des ersten Prompts (zur Zuordnung), kein Inhalt wird gespeichert.
// Zuordnung über den ersten Prompt: 'Du bist der Agent "<Name>"' bzw. 'Unbeaufsichtigter Server-Check' (Server-Agent).
// Alles andere zählt als "Du" (interaktive Sitzungen) oder "Sonstige" (kleine Hilfsläufe).
// Wichtig: Die Kosten sind Schätzungen zu API-Listenpreisen (totalCostUSD aus Claude Code). Das Abo-Kontingent selbst
// (5-Stunden- und Wochenlimit) ist von hier nicht lesbar.
import { createReadStream } from 'node:fs';
import { readFile, writeFile, rename, readdir, stat } from 'node:fs/promises';
import { createInterface } from 'node:readline';
import os from 'node:os';
import path from 'node:path';

const PROJECTS = path.join(os.homedir(), '.claude', 'projects');
const STORE = '/opt/nestua/ops/leitstand/usage.json';
const TZ = 'Europe/Berlin';
const day = new Intl.DateTimeFormat('sv-SE', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' });

// Reihenfolge = Anzeige. id passt zu den Knoten im Register.
export const AGENTS = [
  { id: 'server', name: 'Server & DB', rx: /^Unbeaufsichtigter Server-Check/ },
  { id: 'kontext', name: 'Kontext & Status', rx: /Du bist (?:der )?Agent\s+"Kontext & Status"/ },
  { id: 'pruefer', name: 'Prüfer', rx: /Du bist (?:der )?Agent\s+"Prüfer"/ },
  { id: 'dsgvo', name: 'Datenschutz', rx: /Du bist (?:der )?Agent\s+"Datenschutz"/ },
  { id: 'social', name: 'Social Media', rx: /Du bist (?:der )?Agent\s+"Social Media"/ }
];

function classify(first, entrypoint) {
  for (const a of AGENTS) if (a.rx.test(first || '')) return a.id;
  return entrypoint === 'sdk-cli' ? 'sonst' : 'du';
}

async function readSession(file) {
  const seen = new Map();            // Nachricht-ID -> usage (Streaming schreibt mehrfach, die letzte Zeile gewinnt)
  let first = null, entry = null, start = null, cost = null, modelUsage = null;
  const rl = createInterface({ input: createReadStream(file, { encoding: 'utf8' }), crlfDelay: Infinity });
  for await (const line of rl) {
    if (!line) continue;
    const isUsage = line.includes('"usage"'), isCost = line.includes('totalCostUSD'), isUser = first === null && line.includes('"type":"user"');
    if (!isUsage && !isCost && !isUser && start) continue;
    let o; try { o = JSON.parse(line); } catch { continue; }
    if (!start && o.timestamp) start = o.timestamp;
    if (!entry && o.entrypoint) entry = o.entrypoint;
    const m = o.message || {};
    if (o.type === 'user' && first === null && !o.isSidechain) {
      const c = m.content;
      first = (typeof c === 'string' ? c : Array.isArray(c) ? c.map((x) => x?.text || '').join(' ') : '').slice(0, 200);
    }
    if (m.usage && m.id) seen.set(m.id, { model: m.model, u: m.usage, ts: o.timestamp || start });
    if (o.totalCostUSD != null) { cost = o.totalCostUSD; modelUsage = o.modelUsage || modelUsage; }
  }
  const tok = { in: 0, out: 0, cw: 0, cr: 0 };
  const models = {};
  const byDay = {};   // Verteilungsschlüssel je Tag (Preisverhältnis der Tokenarten), wird später auf die Sitzungskosten skaliert
  for (const { model, u, ts } of seen.values()) {
    const w = (u.input_tokens || 0) + 5 * (u.output_tokens || 0) + 1.25 * (u.cache_creation_input_tokens || 0) + 0.1 * (u.cache_read_input_tokens || 0);
    if (ts) { const d = day.format(new Date(ts)); byDay[d] = (byDay[d] || 0) + w; }
    tok.in += u.input_tokens || 0; tok.out += u.output_tokens || 0; tok.cw += u.cache_creation_input_tokens || 0; tok.cr += u.cache_read_input_tokens || 0;
    if (model) models[model] = (models[model] || 0) + 1;
  }
  if (!seen.size && cost == null) return null;
  return { agent: classify(first, entry), start, entry, messages: seen.size, cost, models: Object.keys(models), tokens: tok, byDay };
}

async function listFiles() {
  const out = [];
  for (const d of await readdir(PROJECTS, { withFileTypes: true })) {
    if (!d.isDirectory()) continue;
    for (const f of await readdir(path.join(PROJECTS, d.name))) if (f.endsWith('.jsonl')) out.push(path.join(PROJECTS, d.name, f));
  }
  return out;
}

const BUDGET = '/opt/nestua/ops/leitstand/budget.json';
const PERIODS = ['heute', 't7', 't30'];
async function readBudget() {
  try { return JSON.parse(await readFile(BUDGET, 'utf8')); }
  catch {
    const b = { hinweis: 'Bezugswerte (Dollar-Schätzung) je Zeitraum heute, t7, t30; null = nicht festgelegt. Setzen: node usage.mjs --referenz t7 <dollar> oder --kalibrieren t7 <prozent laut claude.ai>.', heute: null, t7: null, t30: null, gesetzt: null, quelle: null };
    try { await writeFile(BUDGET, JSON.stringify(b, null, 1) + '\n'); } catch { /* ohne Datei weiter */ }
    return b;
  }
}

export async function collectUsage(now = new Date()) {
  let store = { sessions: {} };
  try { store = JSON.parse(await readFile(STORE, 'utf8')); } catch { /* erster Lauf */ }
  let changed = false;
  for (const file of await listFiles()) {
    const st = await stat(file); const id = path.basename(file, '.jsonl');
    const old = store.sessions[id];
    if (old && old.byDay && old.size === st.size && old.mtime === Math.round(st.mtimeMs)) continue;   // unverändert und schon mit Tagesverteilung
    const s = await readSession(file).catch(() => null);
    if (!s) continue;
    store.sessions[id] = { ...s, day: day.format(new Date(s.start || st.mtimeMs)), size: st.size, mtime: Math.round(st.mtimeMs) };
    changed = true;
  }
  if (changed) { const tmp = `${STORE}.${process.pid}.tmp`; await writeFile(tmp, JSON.stringify(store)); await rename(tmp, STORE); }

  const today = day.format(now);
  const ago = (n) => day.format(new Date(now.getTime() - n * 864e5));
  const d7 = ago(6), d30 = ago(29);
  const days30 = Array.from({ length: 30 }, (_, i) => ago(29 - i));
  const blank = () => ({ runs: [0, 0, 0], out30: 0, last: null, models: new Set(), perDay: {}, total: { runs: 0 } });
  const agg = Object.fromEntries([...AGENTS.map((a) => a.id), 'du', 'sonst'].map((k) => [k, blank()]));
  for (const s of Object.values(store.sessions)) {
    const a = agg[s.agent] || agg.sonst;
    const w = [s.day === today, s.day >= d7, s.day >= d30];       // Läufe zählen am Starttag
    [0, 1, 2].forEach((i) => { if (w[i]) a.runs[i]++; });
    if (w[2]) a.out30 += s.tokens.out;
    a.total.runs++;
    // Kosten auf die Tage der Sitzung verteilt (nach Token-Gewicht): eine mehrtägige Sitzung gibt so keinen einzelnen Ausschlag
    const cost = s.cost || 0, bd = s.byDay && Object.keys(s.byDay).length ? s.byDay : { [s.day]: 1 };
    const sum = Object.values(bd).reduce((x, y) => x + y, 0) || 1;
    for (const [d, wt] of Object.entries(bd)) a.perDay[d] = (a.perDay[d] || 0) + cost * wt / sum;
    if (!a.last || s.start > a.last) a.last = s.start;
    s.models.filter((m) => !m.startsWith('<')).forEach((m) => a.models.add(m));
  }
  const names = Object.fromEntries([...AGENTS.map((a) => [a.id, a.name]), ['du', 'Du (interaktiv)'], ['sonst', 'Sonstige Hilfsläufe']]);
  const sumFrom = (perDay, from) => Object.entries(perDay).reduce((x, [d, c]) => (d >= from ? x + c : x), 0);
  const rows = Object.entries(agg).map(([id, a]) => ({
    id, name: names[id], runs: { heute: a.runs[0], t7: a.runs[1], t30: a.runs[2] },
    cost: { heute: sumFrom(a.perDay, today), t7: sumFrom(a.perDay, d7), t30: sumFrom(a.perDay, d30), gesamt: sumFrom(a.perDay, '0000') },
    out: { t30: a.out30 }, runsGesamt: a.total.runs,
    avg: a.runs[2] ? sumFrom(a.perDay, d30) / a.runs[2] : null, last: a.last, models: [...a.models].sort(),
    daily: days30.map((d) => Math.round((a.perDay[d] || 0) * 10000) / 10000)
  }));
  const sum30 = rows.reduce((x, r) => x + r.cost.t30, 0);
  const sumAgents30 = rows.filter((r) => AGENTS.some((a) => a.id === r.id)).reduce((x, r) => x + r.cost.t30, 0);
  rows.forEach((r) => { r.share30 = sum30 ? r.cost.t30 / sum30 : 0; });
  const since = Object.values(store.sessions).reduce((m, s) => (s.day < m ? s.day : m), today);
  const budget = await readBudget();
  return { days: days30, budget, rows, sum30, sumAgents30, sum7: rows.reduce((x, r) => x + r.cost.t7, 0), sumHeute: rows.reduce((x, r) => x + r.cost.heute, 0), since, sessions: Object.keys(store.sessions).length };
}

if (process.argv[1] && process.argv[1].endsWith('usage.mjs')) {
  const args = process.argv.slice(2), u = await collectUsage();
  const i = args.findIndex((x) => x === '--referenz' || x === '--kalibrieren');
  if (i >= 0) {
    const mode = args[i], per = args[i + 1], val = Number(String(args[i + 2] || '').replace(',', '.'));
    if (!PERIODS.includes(per) || !(val > 0) || (mode === '--kalibrieren' && val > 100)) {
      console.error('Aufruf: usage.mjs --referenz <heute|t7|t30> <dollar>   oder   --kalibrieren <heute|t7|t30> <prozent 1-100>'); process.exit(1);
    }
    const used = u.rows.reduce((x, r) => x + r.cost[per], 0), b = await readBudget();
    b[per] = mode === '--referenz' ? val : used / (val / 100);
    b.gesetzt = new Date().toISOString().slice(0, 10);
    const note = args[i + 3] && !args[i + 3].startsWith('--') ? args.slice(i + 3).join(' ') : null;
    b.quellen = b.quellen || {};
    b.quellen[per] = note || (mode === '--referenz' ? 'von Hand gesetzt' : `kalibriert: ${val} % laut claude.ai bei $${used.toFixed(2)} gemessen`);
    b.quelle = Object.entries(b.quellen).map(([k, v]) => `${k}: ${v}`).join('; ');
    await writeFile(BUDGET, JSON.stringify(b, null, 1) + '\n');
    console.log(`Bezugswert ${per}: $${b[per].toFixed(2)} (${b.quellen[per]})`); process.exit(0);
  }
  console.log(`Verbrauch seit ${u.since} (${u.sessions} Sitzungen), geschätzt zu API-Listenpreisen:`);
  for (const r of u.rows) console.log(`  ${r.name.padEnd(22)} Läufe 30 T: ${String(r.runs.t30).padStart(3)}  Kosten heute/7/30 T: $${r.cost.heute.toFixed(2)} / $${r.cost.t7.toFixed(2)} / $${r.cost.t30.toFixed(2)}  Ø/Lauf: ${r.avg == null ? '-' : '$' + r.avg.toFixed(2)}  ${r.models.join(', ')}`);
  console.log(`  Summe 30 T: $${u.sum30.toFixed(2)} | davon Agenten: $${u.sumAgents30.toFixed(2)}`);
  console.log(`  Bezugswerte: heute ${u.budget.heute ?? '-'}, 7 Tage ${u.budget.t7 ?? '-'}, 30 Tage ${u.budget.t30 ?? '-'}`);
}
