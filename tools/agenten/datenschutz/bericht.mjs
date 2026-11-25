#!/usr/bin/env node
// Bericht des Agenten "Datenschutz" für den Leitstand (/opt/nestua/ops/reports/datenschutz-<datum>-<zeit>.json, .md, -ki.md)
// und Text der Discord-Meldung (stdout).
// Status: rot bei STUFE: rot oder rotem Lauf, gelb bei STUFE: gelb, Befunden der Stufe Fehler oder Problemen im Lauf, sonst grün.
// Aufruf: node bericht.mjs --fakten <fakten.json> --kurz <kurzfassung.md> --notiz-datei <monatsbericht.md> --notiz <pfad im vault> [--lauf <datei>]
import { readFile, writeFile, readdir, stat, unlink, mkdir } from 'node:fs/promises';
import path from 'node:path';

const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const REPORTS = process.env.LEITSTAND_REPORTS || '/opt/nestua/ops/reports';
const KEEP_DAYS = 400, TZ = 'Europe/Berlin';
const read = async (p) => { try { return (await readFile(p, 'utf8')).trim(); } catch { return ''; } };

const F = JSON.parse((await read(arg('--fakten', ''))) || '{}');
let kurz = await read(arg('--kurz', ''));
const notizText = await read(arg('--notiz-datei', ''));
const notiz = arg('--notiz', '');
const lauf = (await read(arg('--lauf', ''))).split('\n').filter(Boolean).map((l) => { const [label, status, ...v] = l.split('|'); return { label, status, value: v.join('|') }; });
const stufe = (kurz.match(/STUFE:\s*(grün|gelb|rot)\s*$/i) || [])[1]?.toLowerCase() || '';
kurz = kurz.replace(/\n?STUFE:\s*(grün|gelb|rot)\s*$/i, '').trim();
const befundZeilen = (notizText.split(/^## /m).find((s) => s.startsWith('Befunde')) || '').split('\n').filter((l) => /^- \*\*(Fehler|Hinweis)\*\*/.test(l));
const befunde = [...befundZeilen.map((l) => ({ label: l.replace(/^- \*\*(Fehler|Hinweis)\*\*:?\s*/, '').replace(/\[\[|\]\]/g, '').slice(0, 220), value: /^- \*\*Fehler/.test(l) ? 'Fehler' : 'Hinweis', status: /^- \*\*Fehler/.test(l) ? 'rot' : 'gelb' })),
  ...lauf.map((x) => ({ label: x.label, value: x.value, status: x.status }))];
const nFehler = befundZeilen.filter((l) => /^- \*\*Fehler/.test(l)).length;

let status = 'grün';
if (stufe === 'rot' || lauf.some((x) => x.status === 'rot')) status = 'rot';
else if (stufe === 'gelb' || nFehler || lauf.length || !stufe) status = 'gelb';

const now = new Date(), p = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(now).map((x) => [x.type, x.value]));
const datum = `${p.year}-${p.month}-${p.day}`, zeit = `${p.hour}:${p.minute}`;
const D = F.db || {};
const fazit = `${F.monat?.text || 'Monat ?'}: ${befundZeilen.length} Befunde (${nFehler} Fehler). ${(D.tabellenMitNutzer || []).length} Tabellen mit Nutzerbezug, ${(D.ohneLoeschverknuepfung || []).length} ohne Löschverknüpfung, Kontolöschung in der App: ${(F.code?.main?.kontoloeschung || []).length ? 'vorhanden' : 'fehlt'}.`;

await mkdir(REPORTS, { recursive: true });
const stem = path.join(REPORTS, `datenschutz-${datum}-${zeit.replace(':', '')}`);
await writeFile(`${stem}.json`, JSON.stringify({ agent: 'datenschutz', datum, zeit, status, fazit, befunde, monat: F.monat?.datei || null, notiz }, null, 1));
await writeFile(`${stem}.md`, `---\nagent: datenschutz\ndatum: ${datum}\nzeit: ${zeit}\nstatus: ${status}\n---\n# Datenschutz ${datum.split('-').reverse().join('.')}, ${zeit} Uhr\n\n${fazit}\n\nMonatsbericht: ${notiz || 'keiner'}\n${befunde.length ? `\n## Befunde\n\n${befunde.map((b) => `- ${b.value}: ${b.label}`).join('\n')}\n` : ''}${kurz ? `\n## Kurzfassung\n\n${kurz}\n` : ''}`);
if (kurz) await writeFile(`${stem}-ki.md`, kurz);
for (const f of await readdir(REPORTS)) {
  const fp = path.join(REPORTS, f);
  if (/^datenschutz-/.test(f) && (Date.now() - (await stat(fp)).mtimeMs) / 864e5 > KEEP_DAYS) await unlink(fp);
}

const icon = { 'grün': '🟢', 'gelb': '🟡', 'rot': '🔴' }[status];
const link = notiz && !lauf.some((x) => x.label === 'Push') ? `\n[Monatsbericht öffnen](https://github.com/appworkshopdb/nestua-notes/blob/main/${notiz.split('/').map(encodeURIComponent).join('/')})` : '';
const body = kurz || `- ${befundZeilen.length} Befunde, ${nFehler} davon Fehler (siehe Bericht)`;
const laufTxt = lauf.length ? `\n\n**Lauf:** ${lauf.map((x) => `${x.label}: ${x.value}`).join('; ')}` : '';
console.log(`${icon} **Datenschutz ${F.monat?.text || ''}**\n${body}${laufTxt}${link}`);
