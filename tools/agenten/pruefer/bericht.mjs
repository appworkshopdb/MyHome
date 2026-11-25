#!/usr/bin/env node
// Bericht des Agenten "Prüfer" für den Leitstand (/opt/nestua/ops/reports/pruefer-<datum>-<zeit>.json, .md, -ki.md, -design.md)
// und Text der Discord-Meldung (stdout). Die Ampel zeigt NUR Fehler, keine normalen Änderungen:
//   rot  = echter Fehler: Regel-Check-Fehler (blockiert den Merge), KI mit STUFE: rot, Lauf rot (Check kaputt)
//   gelb = möglicher Fehler: Regel-Check-Hinweis (z. B. RLS-/Navigations-Risiko), KI-Befund "Fehler" ohne rot,
//          Lauf gelb (Prüfung unvollständig)
//   grün = sonst. Infos des Regel-Checks (Lob, Erinnerungen), KI-Hinweise und Design-Empfehlungen stehen im
//          Bericht, färben aber nicht.
// Aufruf: node bericht.mjs --pr <nr> --sha <sha> --regeln <regeln.json> [--ki <review.md>] [--design <design-review.md>]
//         [--ui <ui-dateien.txt>] [--lauf <datei, je Zeile label|status|wert>] [--commits n]
import { readFile, writeFile, readdir, stat, unlink, mkdir } from 'node:fs/promises';
import path from 'node:path';

const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const REPORTS = process.env.LEITSTAND_REPORTS || '/opt/nestua/ops/reports';
const KEEP_DAYS = 120, TZ = 'Europe/Berlin', REPO = 'https://github.com/appworkshopdb/MyHome';
const read = async (p) => { try { return (await readFile(p, 'utf8')).trim(); } catch { return ''; } };

const pr = arg('--pr', '?'), shaFull = arg('--sha', '') || '', sha = shaFull.slice(0, 7), commits = arg('--commits', '?');
const von = arg('--von', '') || '';   // gesetzt: Entwicklungszweig seit diesem Stand (staging), Link auf genau diesen Abschnitt
const isPr = /^\d+$/.test(pr), name = isPr ? `PR #${pr}` : von ? `Branch ${pr} (neu seit ${von.slice(0, 7)})` : `Branch ${pr}`;
const link = isPr ? `${REPO}/pull/${pr}` : von ? `${REPO}/compare/${von}...${shaFull}` : `${REPO}/compare/main...${encodeURIComponent(pr)}`;
const R = JSON.parse((await read(arg('--regeln', ''))) || '{"fehler":[],"hinweise":[],"infos":[],"dateien":0}');
R.infos ??= [];
const ki = await read(arg('--ki', ''));
const lauf = (await read(arg('--lauf', ''))).split('\n').filter(Boolean).map((l) => { const [label, status, ...v] = l.split('|'); return { label, status, value: v.join('|') }; });
const stufe = (ki.match(/STUFE:\s*(grün|gelb|rot)\s*$/i) || [])[1]?.toLowerCase() || '';
const kiBefunde = (ki.split(/^## /m).find((s) => s.startsWith('Befunde')) || '').split('\n').filter((l) => /^- \*\*(Fehler|Hinweis)\*\*/.test(l));
const kiFehler = kiBefunde.filter((l) => /^- \*\*Fehler/.test(l)).length, kiHinweise = kiBefunde.length - kiFehler;
// Design-Review (nur bei UI-Änderungen, nur Empfehlungen) und Zählung der Design-Ratsche aus dem Regel-Check
const design = await read(arg('--design', ''));
const ui = (await read(arg('--ui', ''))).split('\n').filter(Boolean);
const dEmpf = (design.split(/^## /m).find((s) => s.startsWith('Empfehlungen')) || '').split('\n').filter((l) => /^- /.test(l) && !/^- \**keine\**\.?\s*$/i.test(l));   // jede Listenzeile zählt, auch wenn das Modell den Titel statt "Empfehlung" fett setzt
const dText = design ? `${dEmpf.length} Empfehlung${dEmpf.length === 1 ? '' : 'en'}` : ui.length ? 'nicht gelaufen' : 'keine UI-Änderung';
const ratsche = Object.entries(R.design || {}).filter(([k]) => k !== 'seit').map(([k, v]) => `${k.replace('design-', '')} +${v.neu}/−${v.entfernt}`).join(', ');

let status = 'grün';
if (R.fehler.length || stufe === 'rot' || lauf.some((x) => x.status === 'rot')) status = 'rot';
else if (R.hinweise.length || kiFehler > 0 || lauf.some((x) => x.status === 'gelb')) status = 'gelb';

const now = new Date(), p = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }).formatToParts(now).map((x) => [x.type, x.value]));
const datum = `${p.year}-${p.month}-${p.day}`, zeit = `${p.hour}:${p.minute}`;
const fazit = `${name} (${commits} Commits, ${R.dateien} Dateien): Regel-Check ${R.fehler.length} Fehler, ${R.hinweise.length} Hinweise${R.infos.length ? `, ${R.infos.length} Infos` : ''}; KI ${ki ? `${kiFehler} Fehler, ${kiHinweise} Hinweise` : 'nicht gelaufen'}; Design ${dText}.`;
const befunde = [...R.fehler.map((x) => ({ label: `${x.titel} (${x.datei}:${x.zeile})`, value: 'Regel-Check', status: 'rot' })),
  ...R.hinweise.map((x) => ({ label: `${x.titel} (${x.datei}:${x.zeile})`, value: 'Regel-Check', status: 'gelb' })),
  ...R.infos.map((x) => ({ label: `${x.titel} (${x.datei}:${x.zeile})`, value: 'Regel-Check, Info', status: 'grün' })),
  ...lauf.map((x) => ({ label: x.label, value: x.value, status: x.status }))];

await mkdir(REPORTS, { recursive: true });
// Sekunden im Namen: mehrere PRs in einem Lauf überschreiben sich nicht (der Leitstand liest HHMM und HHMMSS)
const stem = path.join(REPORTS, `pruefer-${datum}-${zeit.replace(":", "")}${p.second}`);
await writeFile(`${stem}.json`, JSON.stringify({ agent: 'pruefer', datum, zeit, status, fazit, befunde, pr: Number(pr) || pr, sha }, null, 1));
await writeFile(`${stem}.md`, `---\nagent: pruefer\ndatum: ${datum}\nzeit: ${zeit}\nstatus: ${status}\npr: ${pr}\nsha: ${sha}\n---\n# Prüfer: ${name}\n\n${fazit}\n\n${link}\n\n## Regel-Check\n\n${[...R.fehler.map((x) => `- Fehler \`${x.datei}:${x.zeile}\`: ${x.titel}. ${x.text}`), ...R.hinweise.map((x) => `- Hinweis \`${x.datei}:${x.zeile}\`: ${x.titel}. ${x.text}`), ...R.infos.map((x) => `- Info \`${x.datei}:${x.zeile}\`: ${x.titel}. ${x.text}`)].join('\n') || '- keine Befunde'}\n${lauf.length ? `\n## Lauf\n\n${lauf.map((x) => `- ${x.label}: ${x.value} (${x.status})`).join('\n')}\n` : ''}${ki ? `\n## KI-Review\n\n${ki}\n` : ''}${design || ui.length ? `\n## Design-Review (Empfehlung, blockiert nicht)\n\n${ratsche ? `Design-Ratsche${R.design?.seit ? ` seit ${String(R.design.seit).slice(0, 7)}` : ''}: ${ratsche}\n\n` : ''}${design || `Nicht gelaufen (${ui.length} UI-Dateien geändert).`}\n` : ''}`);
if (ki) await writeFile(`${stem}-ki.md`, ki);
if (design) await writeFile(`${stem}-design.md`, design);
for (const f of await readdir(REPORTS)) {
  const fp = path.join(REPORTS, f);
  if (/^pruefer-/.test(f) && (Date.now() - (await stat(fp)).mtimeMs) / 864e5 > KEEP_DAYS) await unlink(fp);
}


// Discord-Meldung (höchstens 2000 Zeichen): Kurzfazit und die vier wichtigsten Befunde gekürzt, der volle Text steht im Bericht
const icon = { 'grün': '🟢', 'gelb': '🟡', 'rot': '🔴' }[status];
const clip = (s, n) => { if (s.length <= n) return s; const k = s.lastIndexOf(' ', n); return s.slice(0, k > n * 0.6 ? k : n) + ' …'; };
const kurz = ((ki.split(/^## /m).find((s) => s.startsWith('Kurzfazit')) || '').replace(/^Kurzfazit\s*/, '').trim()) || 'Kein KI-Review (siehe Bericht).';
// notify.mjs kürzt bei etwa 1800 Zeichen; damit der Link am Ende bleibt, fallen vorher einzelne Befunde weg (Rest steht im Bericht)
const MAX = 1700;
const top = kiBefunde.slice(0, 4).map((l) => clip(l.replace(/^- /, '• '), 230));
const dTop = dEmpf.slice(0, 3).map((l) => clip(l.replace(/^- (\*\*Empfehlung\*\* )?/, '• '), 200));
const build = () => {
  const lines = [`${icon} **${name}** (${commits} Commits, ${R.dateien} Dateien, Stand ${sha})`, clip(kurz, design ? 350 : 450)];
  if (top.length) lines.push('', ...top, ...(kiBefunde.length > top.length ? [`… ${kiBefunde.length - top.length} weitere im Bericht`] : []));
  if (design) lines.push('', `🎨 Design: ${dText} (blockiert nicht)`, ...dTop, ...(dEmpf.length > dTop.length ? [`… ${dEmpf.length - dTop.length} weitere im Bericht`] : []));
  lines.push('', `Regel-Check: ${R.fehler.length} Fehler, ${R.hinweise.length} Hinweise${R.fehler.length ? ' (blockiert den Merge)' : ''}`);
  if (lauf.length) lines.push(`Lauf: ${lauf.map((x) => `${x.label} ${x.value}`).join('; ')}`);
  lines.push(`[${isPr ? 'PR' : 'Vergleich'} öffnen](${link})`);
  return lines.join('\n');
};
let msg = build();
while (msg.length > MAX && (top.length > 1 || dTop.length > 1)) { (dTop.length >= top.length ? dTop : top).pop(); msg = build(); }
console.log(msg);
