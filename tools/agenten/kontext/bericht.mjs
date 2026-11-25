#!/usr/bin/env node
// Bericht des Agenten "Kontext & Status" für den Leitstand (/opt/nestua/ops/reports/kontext-<datum>-<zeit>.json, .md, -ki.md)
// und Text der Discord-Meldung (stdout).
// Aufruf: node bericht.mjs --fakten <fakten.json> --status grün|gelb|rot [--befunde <datei, je Zeile label|status|wert>] [--ki <kurzfassung.md>] [--notiz <pfad im vault>]
import { readFile, writeFile, readdir, stat, unlink, mkdir } from 'node:fs/promises';
import path from 'node:path';

const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const REPORTS = process.env.LEITSTAND_REPORTS || '/opt/nestua/ops/reports';
const KEEP_DAYS = 120, TZ = 'Europe/Berlin';
const read = async (p) => { try { return (await readFile(p, 'utf8')).trim(); } catch { return ''; } };

const F = JSON.parse((await read(arg('--fakten', ''))) || '{}');
const status = arg('--status', 'rot');
const befunde = (await read(arg('--befunde', ''))).split('\n').filter(Boolean).map((l) => { const [label, st, ...v] = l.split('|'); return { label, status: st, value: v.join('|') }; });
const ki = await read(arg('--ki', ''));
const notiz = arg('--notiz', '');

const now = new Date(), p = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(now).map((x) => [x.type, x.value]));
const datum = `${p.year}-${p.month}-${p.day}`, zeit = `${p.hour}:${p.minute}`;
const W = F.woche || {}, C = F.commits || { staging: [], main: [] }, V = F.veraenderung || { neu: [], erledigt: [], wechsel: [] }, P = F.pflege || { indexFehlt: [], indexFalsch: [], indexVerwaist: [], veraltet: [], doppelt: [] };
const kw = W.kw ? `KW ${W.kw}` : 'Woche ?';
const pflege = P.indexFehlt.length + P.indexFalsch.length + P.indexVerwaist.length;
const fazit = `${kw}: ${C.staging.length} Commits, ${V.erledigt.length} erledigt, ${V.neu.length} neu. Pflege: ${pflege} Index-Abweichungen, ${P.veraltet.length} veraltet, ${P.doppelt.length} möglich doppelt.`
  + (befunde.length ? ` Lauf: ${befunde.map((b) => `${b.label} ${b.value}`).join('; ')}.` : '');

await mkdir(REPORTS, { recursive: true });
const stem = path.join(REPORTS, `kontext-${datum}-${zeit.replace(':', '')}`);
await writeFile(`${stem}.json`, JSON.stringify({ agent: 'kontext', datum, zeit, status, fazit, befunde, woche: W.datei || null, notiz }, null, 1));
await writeFile(`${stem}.md`, `---\nagent: kontext\ndatum: ${datum}\nzeit: ${zeit}\nstatus: ${status}\n---\n# Kontext & Status ${datum.split('-').reverse().join('.')}, ${zeit} Uhr\n\n${fazit}\n\nWochennotiz: ${notiz || 'keine'}\n${befunde.length ? `\n## Befunde zum Lauf\n\n${befunde.map((b) => `- ${b.label}: ${b.value} (${b.status})`).join('\n')}\n` : ''}${ki ? `\n## Kurzfassung\n\n${ki}\n` : ''}`);
if (ki) await writeFile(`${stem}-ki.md`, ki);
for (const f of await readdir(REPORTS)) {
  const fp = path.join(REPORTS, f);
  if (/^kontext-/.test(f) && (Date.now() - (await stat(fp)).mtimeMs) / 864e5 > KEEP_DAYS) await unlink(fp);
}

// Discord-Meldung
const icon = { 'grün': '🟢', 'gelb': '🟡', 'rot': '🔴' }[status] || '⚪';
const link = notiz && status !== 'rot' ? `\n[Wochennotiz öffnen](https://github.com/appworkshopdb/nestua-notes/blob/main/${notiz.split('/').map(encodeURIComponent).join('/')})` : '';
const body = ki || [`- ${C.staging.length} Commits auf staging, ${C.main.length} auf main`, `- Backlog: ${V.neu.length} neu, ${V.erledigt.length} erledigt, ${V.wechsel.length} Statuswechsel`,
  `- Pflege: ${pflege} Index-Abweichungen, ${P.veraltet.length} seit über 14 Tagen in Arbeit, ${P.doppelt.length} möglich doppelt`].join('\n');
const lauf = befunde.length ? `\n\n**Lauf ${status}:** ${befunde.map((b) => `${b.label}: ${b.value}`).join('; ')}` : '';
console.log(`${icon} **Wochenübersicht ${kw}**${W.vonText ? ` (${W.vonText.slice(0, 6)} bis ${W.bisText.slice(0, 6)})` : ''}\n${body}${lauf}${link}`);
