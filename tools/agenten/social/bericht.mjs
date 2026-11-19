#!/usr/bin/env node
// Bericht des Agenten "Social Media" für den Leitstand (/opt/nestua/ops/reports/social-<datum>-<zeit>.json, .md, -ki.md)
// und Text der Discord-Meldung (stdout).
// Status: rot bei STUFE: rot, fehlender Datei oder rotem Lauf; gelb bei STUFE: gelb, weniger als 3 Entwürfen oder Problemen im Lauf; sonst grün.
// Aufruf: node bericht.mjs --fakten <fakten.json> --kurz <kurzfassung.md> --notiz-datei <entwuerfe.md> --notiz <pfad im vault> [--lauf <datei>]
import { readFile, writeFile, readdir, stat, unlink, mkdir } from 'node:fs/promises';
import path from 'node:path';

const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const REPORTS = process.env.LEITSTAND_REPORTS || '/opt/nestua/ops/reports';
const KEEP_DAYS = 120, TZ = 'Europe/Berlin', SOLL = 3;
const read = async (p) => { try { return (await readFile(p, 'utf8')).trim(); } catch { return ''; } };

const F = JSON.parse((await read(arg('--fakten', ''))) || '{}');
let kurz = await read(arg('--kurz', ''));
const text = await read(arg('--notiz-datei', ''));
const notiz = arg('--notiz', '');
const lauf = (await read(arg('--lauf', ''))).split('\n').filter(Boolean).map((l) => { const [label, status, ...v] = l.split('|'); return { label, status, value: v.join('|') }; });
const stufe = (kurz.match(/STUFE:\s*(grün|gelb|rot)\s*$/i) || [])[1]?.toLowerCase() || '';
kurz = kurz.replace(/\n?STUFE:\s*(grün|gelb|rot)\s*$/i, '').trim();
const titel = [...text.matchAll(/^## Entwurf \d+ · (.+)$/gm)].map((m) => m[1].trim());
// Selbstprüfung des Textes: "wir/unser" widerspricht der Ich-Perspektive (CLAUDE.md)
const wir = (text.match(/\b(wir|uns|unser\w*)\b/gi) || []).length;
const befunde = [...lauf.map((x) => ({ label: x.label, value: x.value, status: x.status })),
  ...(titel.length && titel.length < SOLL ? [{ label: 'Entwürfe', value: `nur ${titel.length} von ${SOLL}`, status: 'gelb' }] : []),
  ...(wir ? [{ label: 'Ich-Perspektive', value: `${wir}× "wir/uns/unser" im Text, vor dem Veröffentlichen prüfen`, status: 'gelb' }] : [])];

let status = 'grün';
if (stufe === 'rot' || !titel.length || lauf.some((x) => x.status === 'rot')) status = 'rot';
else if (stufe === 'gelb' || befunde.length || !stufe) status = 'gelb';

const now = new Date(), p = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(now).map((x) => [x.type, x.value]));
const datum = `${p.year}-${p.month}-${p.day}`, zeit = `${p.hour}:${p.minute}`;
const E = F.entwurf || {};
const fazit = `KW ${E.w || '?'}: ${titel.length} von ${SOLL} Entwürfen (${titel.join('; ') || 'keine'}).${befunde.length ? ` Hinweise: ${befunde.map((b) => `${b.label} ${b.value}`).join('; ')}.` : ''}`;

await mkdir(REPORTS, { recursive: true });
const stem = path.join(REPORTS, `social-${datum}-${zeit.replace(':', '')}`);
await writeFile(`${stem}.json`, JSON.stringify({ agent: 'social', datum, zeit, status, fazit, befunde, woche: E.datei || null, notiz, entwuerfe: titel.length }, null, 1));
await writeFile(`${stem}.md`, `---\nagent: social\ndatum: ${datum}\nzeit: ${zeit}\nstatus: ${status}\n---\n# Social Media ${datum.split('-').reverse().join('.')}, ${zeit} Uhr\n\n${fazit}\n\nEntwürfe: ${notiz || 'keine'}\n${befunde.length ? `\n## Hinweise zum Lauf\n\n${befunde.map((b) => `- ${b.label}: ${b.value} (${b.status})`).join('\n')}\n` : ''}${kurz ? `\n## Kurzfassung\n\n${kurz}\n` : ''}`);
if (kurz) await writeFile(`${stem}-ki.md`, kurz);
for (const f of await readdir(REPORTS)) {
  const fp = path.join(REPORTS, f);
  if (/^social-/.test(f) && (Date.now() - (await stat(fp)).mtimeMs) / 864e5 > KEEP_DAYS) await unlink(fp);
}

const icon = { 'grün': '🟢', 'gelb': '🟡', 'rot': '🔴' }[status];
const link = notiz && !lauf.some((x) => x.label === 'Push') && titel.length ? `\n[Entwürfe öffnen](https://github.com/appworkshopdb/nestua-notes/blob/main/${notiz.split('/').map(encodeURIComponent).join('/')})` : '';
const body = kurz || (titel.length ? titel.map((t, i) => `- Entwurf ${i + 1}: ${t}`).join('\n') : '- Keine Entwürfe geschrieben (siehe Bericht)');
const extra = befunde.length ? `\n\n**Hinweise:** ${befunde.map((b) => `${b.label}: ${b.value}`).join('; ')}` : '';
console.log(`${icon} **Social-Entwürfe KW ${E.w || '?'}**\n${body}${extra}${link}`);
