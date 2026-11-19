#!/usr/bin/env node
// Server-Bericht aus den Scan-Daten (ohne KI). Liest www/data/leitstand.json, vergleicht mit dem letzten Bericht
// und schreibt /opt/nestua/ops/reports/server-<datum>-<zeit>.md und .json.
// Exit-Code: 0 = grün, 1 = gelb, 2 = rot (Phase 3 ruft nur bei 1 oder 2 die KI-Auswertung auf).
import { readFile, writeFile, readdir, mkdir, unlink, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const BASE = path.dirname(fileURLToPath(import.meta.url));
const REPORTS = process.env.LEITSTAND_REPORTS || '/opt/nestua/ops/reports';
const KEEP_DAYS = 30;
const TZ = 'Europe/Berlin';
const fmt = (o) => new Intl.DateTimeFormat('de-DE', { timeZone: TZ, ...o });
const WORD = { ok: 'grün', warn: 'gelb', bad: 'rot' };

const d = JSON.parse(await readFile(path.join(BASE, 'www', 'data', 'leitstand.json'), 'utf8'));
const reg = JSON.parse(await readFile(path.join(BASE, 'registry.json'), 'utf8'));
const now = new Date(d.generated);
const day = fmt({ year: 'numeric', month: '2-digit', day: '2-digit' }).format(now).split('.').reverse().join('-');
const time = fmt({ hour: '2-digit', minute: '2-digit' }).format(now);

// Welche Prüfungen zählen: System + Bausteine der Agenten + Ressourcen mit Prüfung (ohne Doppelte)
const ids = [...new Set([...reg.system, ...reg.nodes.flatMap((n) => [n.check, ...(n.builds || [])]).filter(Boolean)])];
const checks = ids.map((id) => ({ id, hint: reg.checks[id]?.hint || '', ...d.checks[id] })).filter((c) => c.status);
// Bausteine von Agenten im Aufbau sind keine Befunde, sondern Aufbau-Stand (eigener Abschnitt)
const agentBuilds = new Set(reg.nodes.filter((n) => n.kind === 'agent').flatMap((n) => n.builds || []));
const building = checks.filter((c) => agentBuilds.has(c.id) && c.status !== 'ok' && !reg.system.includes(c.id));
const findings = checks.filter((c) => c.status !== 'ok' && !building.includes(c));
const bad = findings.filter((c) => c.status === 'bad'), warn = findings.filter((c) => c.status === 'warn');
const sysBad = reg.system.map((i) => d.checks[i]).filter((c) => c.status === 'bad').length;
const sysWarn = reg.system.map((i) => d.checks[i]).filter((c) => c.status === 'warn').length;
const status = sysBad ? 'bad' : sysWarn ? 'warn' : 'ok';

// Vergleich mit dem letzten Bericht
let prev = null;
try {
  const files = (await readdir(REPORTS)).filter((f) => /^server-.*\.json$/.test(f)).sort();
  if (files.length) prev = JSON.parse(await readFile(path.join(REPORTS, files.at(-1)), 'utf8'));
} catch { /* erster Bericht */ }
const prevMap = Object.fromEntries((prev?.checks || []).map((c) => [c.id, c.status]));
const changed = checks.filter((c) => prev && prevMap[c.id] && prevMap[c.id] !== c.status);
const fresh = checks.filter((c) => c.status !== 'ok' && prev && !prevMap[c.id]);

const line = (c) => `- **${c.label}: ${c.value}** (${WORD[c.status]}${c.status === 'bad' ? ', Dringlichkeit hoch' : ', Dringlichkeit mittel'})\n  - Beleg: ${c.detail || 'keiner'}\n  - Vorschlag: ${c.hint || 'prüfen und mit Beleg vorschlagen'}`;
const sys = d.system;
const agents = reg.nodes.filter((n) => n.kind === 'agent').map((n) => d.nodes.find((x) => x.id === n.id)).filter(Boolean);
const fazit = `System ${sys.ok}/${sys.total} grün, ${sys.warn} ${sys.warn === 1 ? 'Hinweis' : 'Hinweise'}, ${sys.bad} Fehler. ${status === 'ok' ? 'Nichts zu tun.' : `Zu klären: ${[...bad, ...warn].filter((c) => reg.system.includes(c.id)).map((c) => c.label).join(', ')}.`}`;
const diffs = [...changed.map((c) => `${c.label}: ${WORD[prevMap[c.id]]} → ${WORD[c.status]}`), ...fresh.map((c) => `neu: ${c.label} (${WORD[c.status]})`)];
const md = `---
agent: server
datum: ${day}
zeit: ${time}
status: ${WORD[status]}
---
# Server-Bericht ${fmt({ day: '2-digit', month: '2-digit', year: 'numeric' }).format(now)}, ${time} Uhr

## Kurzfazit

${fazit}

## Befunde

${[...bad, ...warn].length ? [...bad, ...warn].map(line).join('\n') : 'Keine.'}

## Veränderungen seit dem letzten Bericht

${!prev ? 'Erster Bericht, kein Vergleich.' : diffs.length ? diffs.map((x) => `- ${x}`).join('\n') : `Keine (letzter Bericht ${prev.datum} ${prev.zeit}).`}

## Agenten

${agents.map((n) => `- ${n.name}: ${n.value}`).join('\n')}
${building.length ? `\nNoch nicht gebaut: ${building.map((c) => c.label).join(', ')}.\n` : ''}
## Nicht geprüft

- Cloud-Agenten (Kontext, Prüfer, Datenschutz, Social): laufen außerhalb des Servers.
- Dependabot-Warnungen auf GitHub: brauchen einen Zugang, den der Server nicht hat.
- Inhalt der Backups: der private GPG-Schlüssel liegt nicht auf dem Server (Restore-Test vierteljährlich).

Quelle: Leitstand-Scan ${d.generatedText} Uhr (${d.durationMs} ms), ${checks.length} Prüfungen.
`;

await mkdir(REPORTS, { recursive: true });
const stem = `server-${day}-${time.replace(':', '')}`;
await writeFile(path.join(REPORTS, `${stem}.md`), md);
await writeFile(path.join(REPORTS, `${stem}.json`), JSON.stringify({ agent: 'server', datum: day, zeit: time, status: WORD[status], system: sys, fazit, befunde: [...bad, ...warn].map(({ id, label, status: s, value, hint }) => ({ id, label, status: WORD[s], value, hint })), veraenderungen: prev ? diffs : null, quelle: d.generatedText, checks: checks.map(({ id, label, status: s, value, detail }) => ({ id, label, status: s, value, detail })) }, null, 1));
// Aufbewahrung
for (const f of await readdir(REPORTS)) {
  const p = path.join(REPORTS, f);
  if (/^server-/.test(f) && (Date.now() - (await stat(p)).mtimeMs) / 864e5 > KEEP_DAYS) await unlink(p);
}
console.log(`${path.join(REPORTS, stem)}.md: ${WORD[status]} (System ${sys.ok}/${sys.total}, ${bad.length} rot, ${warn.length} gelb)`);
process.exit(status === 'ok' ? 0 : status === 'warn' ? 1 : 2);
