#!/usr/bin/env node
// Fakten für den Agenten "Social Media", ohne KI und nur lesend: Entwurfswoche mit Tagen, Wochennotiz von Kontext & Status
// (Basis der Themen), Commits der Vorwoche, bisherige Social-Entwürfe (gegen Wiederholungen).
// Metricool-Daten (Beiträge, Analytics, beste Zeiten) holt die KI selbst über den Metricool-Zugang.
// Aufruf: node fakten.mjs --repo <MyHome-Klon> --vault <nestua-notes-Klon> --out <fakten.json> [--now <ISO-Zeit>] [--no-fetch]
import { readFile, readdir, writeFile } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import path from 'node:path';

const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const REPO = arg('--repo', '/opt/nestua/werkstatt'), VAULT = arg('--vault', '/opt/nestua/ops/vault'), OUT = arg('--out', ''), NOW = new Date(arg('--now', new Date().toISOString()));
const TZ = 'Europe/Berlin';
const fehler = [];
const git = (...a) => new Promise((res, rej) => execFile('git', ['-c', 'core.quotePath=false', '-C', REPO, ...a], { maxBuffer: 32 * 1024 * 1024, timeout: 90000, env: { ...process.env, TZ } },
  (e, so, se) => (e ? rej(new Error((se || e.message).toString().trim().split('\n').pop())) : res(so.toString()))));
const safe = async (label, fn, dflt) => { try { return await fn(); } catch (e) { fehler.push(`${label}: ${e.message}`); return dflt; } };

/* ---------- Wochen (Montag bis Sonntag, Berlin-Zeit) ---------- */
const ymdOf = (d) => new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
const addDays = (s, n) => { const d = new Date(`${s}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const offset = (s) => new Intl.DateTimeFormat('en-US', { timeZone: TZ, timeZoneName: 'longOffset' }).formatToParts(new Date(`${s}T12:00:00Z`)).find((p) => p.type === 'timeZoneName').value.replace('GMT', '') || '+00:00';
const isoWeek = (s) => { const d = new Date(`${s}T12:00:00Z`), wd = d.getUTCDay() || 7; d.setUTCDate(d.getUTCDate() + 4 - wd); const y = d.getUTCFullYear(); const w = Math.ceil(((d - Date.UTC(y, 0, 1)) / 864e5 + 1) / 7); return { y, w, datei: `${y}-W${String(w).padStart(2, '0')}` }; };
const de = (s) => s.split('-').reverse().join('.');
const TAGE = ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag'];
const today = ymdOf(NOW), wd = new Date(`${today}T12:00:00Z`).getUTCDay() || 7;
const thisMon = addDays(today, 1 - wd), prevMon = addDays(thisMon, -7);
const entwurf = { ...isoWeek(thisMon), von: thisMon, bis: addDays(thisMon, 6), vonText: de(thisMon), bisText: de(addDays(thisMon, 6)),
  tage: TAGE.map((name, i) => { const datum = addDays(thisMon, i); return { name, datum, text: de(datum).slice(0, 6) }; }) };
const basis = { ...isoWeek(prevMon), von: prevMon, bis: addDays(prevMon, 6), vonText: de(prevMon), bisText: de(addDays(prevMon, 6)) };

/* ---------- Wochennotiz von Kontext & Status ---------- */
const wochennotiz = await safe('Wochennotiz', async () => {
  const datei = `Betrieb/Wochen/${basis.datei}.md`;
  try { return { datei, vorhanden: true, text: (await readFile(path.join(VAULT, datei), 'utf8')).slice(0, 7000) }; }
  catch { return { datei, vorhanden: false, text: '' }; }
}, { datei: '', vorhanden: false, text: '' });

/* ---------- Commits der Vorwoche (nur Titel) ---------- */
if (!process.argv.includes('--no-fetch')) await safe('git fetch', () => git('fetch', '-q', 'origin'), null);
const since = `${prevMon}T00:00:00${offset(prevMon)}`, until = `${thisMon}T00:00:00${offset(thisMon)}`;
const commits = {};
for (const b of ['staging', 'main']) {
  commits[b] = await safe(`git log ${b}`, async () => (await git('log', `origin/${b}`, `--since=${since}`, `--until=${until}`, '--no-merges', '--date=format-local:%d.%m.', '--format=%h%x09%ad%x09%s'))
    .trim().split('\n').filter(Boolean).slice(0, 60).map((l) => { const [hash, wann, ...s] = l.split('\t'); return { hash, wann, titel: s.join('\t') }; })
    .filter((c) => !/^(Kontext|Datenschutz|Social):/.test(c.titel)), []);
}

/* ---------- Bisherige Social-Entwürfe (Themen nicht wiederholen) ---------- */
const fruehere = await safe('frühere Entwürfe', async () => {
  const dir = path.join(VAULT, 'Betrieb', 'Social'); let files = [];
  try { files = (await readdir(dir)).filter((f) => /^\d{4}-W\d{2}\.md$/.test(f)).sort().slice(-6); } catch { return []; }
  const out = [];
  for (const f of files) {
    const t = await readFile(path.join(dir, f), 'utf8');
    out.push({ woche: f.replace(/\.md$/, ''), entwuerfe: [...t.matchAll(/^## Entwurf \d+ · (.+)$/gm)].map((m) => m[1].trim()) });
  }
  return out;
}, []);

const F = { erstellt: NOW.toISOString(), entwurf, basis, wochennotiz, commits, fruehere, fehler };
if (OUT) await writeFile(OUT, JSON.stringify(F, null, 1)); else console.log(JSON.stringify(F, null, 1));
