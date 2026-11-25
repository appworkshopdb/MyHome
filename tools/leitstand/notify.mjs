#!/usr/bin/env node
// Meldung der Agenten nach Discord (Incoming Webhook). Ein Server "Nestua", ein Kanal je Agent, ein Webhook je Kanal.
// Aufruf: node notify.mjs <bericht>          Bericht = Pfad ohne Endung, .md oder .json (liest <stamm>.json und, falls da, <stamm>-ki.md)
//         node notify.mjs --latest           neuester Bericht in /opt/nestua/ops/reports/
//         node notify.mjs --test             kurze Testnachricht
//         node notify.mjs --message <text>   freie Meldung eines Agenten
//         node notify.mjs --scan-failed <text>
//         --agent <kennung>                  Absender und Kanal, Kennung aus registry.json (Standard: server)
//         --dry-run                          Nachricht nur ausgeben, nichts senden (geht ohne Konfigurationsdatei)
// Konfigurationsdatei /opt/nestua/ops/notify.env:
//   DISCORD_WEBHOOK_<KENNUNG>=https://discord.com/api/webhooks/<id>/<token>   Webhook des Kanals dieses Agenten, z. B. DISCORD_WEBHOOK_SERVER
//   DISCORD_WEBHOOK=...                optional: gemeinsamer Ersatz, wenn für einen Agenten kein eigener Webhook eingetragen ist
//   NOTIFY_GREEN=0                     bei grün nichts senden (Standard: eine Zeile)
//   CLAUDE_CODE_OAUTH_TOKEN=...        Langzeit-Token (claude setup-token) für die KI-Auswertung; liest server-check-cron.sh, nicht dieses Skript
// Die Webhook-Adresse ist ein Geheimnis: sie wird nur hier im Prozess gelesen, nie ausgegeben und nicht als Argument übergeben.
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';

const ENV_FILE = process.env.NOTIFY_ENV || '/opt/nestua/ops/notify.env';
const REPORTS = process.env.LEITSTAND_REPORTS || '/opt/nestua/ops/reports';
const LEITSTAND = 'https://leitstand.nestua.de';
const ICON = { grün: '🟢', gelb: '🟡', rot: '🔴' };
const LIMIT = 1900; // Discord erlaubt 2000 Zeichen je Nachricht

const raw = process.argv.slice(2);
const ai = raw.indexOf('--agent');
const AGENT = (ai >= 0 ? raw[ai + 1] : 'server') || 'server';
if (!/^[a-z0-9_-]+$/.test(AGENT)) { console.error('Discord: --agent erwartet eine Kennung wie server, kontext, pruefer'); process.exit(1); }
const args = ai >= 0 ? raw.filter((_, i) => i !== ai && i !== ai + 1) : raw;
const dry = args.includes('--dry-run');
const pos = args.filter((a) => !a.startsWith('--'));

// Name des Agenten aus der Registry (steht neben dem Skript), sonst die Kennung
let AGENT_NAME = AGENT;
try {
  const reg = JSON.parse(await readFile(new URL('./registry.json', import.meta.url), 'utf8'));
  const n = reg.nodes.find((x) => x.kind === 'agent' && x.id === AGENT);
  if (n) AGENT_NAME = n.name;
  else if (AGENT !== 'server') throw new Error(`Agent „${AGENT}“ steht nicht in der Registry`);
} catch (e) { if (/Registry/.test(e.message)) { console.error(`Discord: ${e.message}`); process.exit(1); } }

async function loadEnv() {
  let txt;
  try { txt = await readFile(ENV_FILE, 'utf8'); } catch { return {}; }
  const env = {};
  for (const l of txt.split('\n')) {
    const m = l.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
  return env;
}

// Markdown aus der KI-Auswertung für Discord: Überschriften fett, Aufzählungen mit •; kürzen auf max Zeichen
function chatText(md, max) {
  let t = md.replace(/\r/g, '').trim()
    .replace(/^#{1,6}\s*(.+)$/gm, '**$1**')
    .replace(/^(\s*)[-*]\s+/gm, '$1• ')
    .replace(/\n{3,}/g, '\n\n');
  return cut(t, max);
}
function cut(t, max) {
  if (t.length <= max) return t;
  const tail = '\n…(gekürzt, ganzer Text im Bericht)';
  const k = t.lastIndexOf('\n', max - tail.length);
  return t.slice(0, k > 0 ? k : max - tail.length) + tail;
}

async function latestStem() {
  const f = (await readdir(REPORTS)).filter((x) => /^server-\d{4}-\d{2}-\d{2}-\d{4}\.json$/.test(x)).sort().at(-1);
  if (!f) throw new Error(`kein Bericht in ${REPORTS}`);
  return path.join(REPORTS, f.replace(/\.json$/, ''));
}

async function reportMessage(stem, env) {
  const r = JSON.parse(await readFile(`${stem}.json`, 'utf8'));
  const [y, mo, da] = r.datum.split('-');
  const head = `${ICON[r.status] || '⚪'} **${AGENT_NAME}: Server-Check ${da}.${mo}.${y}, ${r.zeit} Uhr: ${r.status}**`;
  const link = `[Leitstand öffnen](${LEITSTAND})`;
  const s = r.system;
  if (r.status === 'grün') {
    if (env.NOTIFY_GREEN === '0') return null;
    return `${head}\nSystem ${s.ok}/${s.total} grün, nichts zu tun. ${link}`;
  }
  const parts = [head, r.fazit || `System ${s.ok}/${s.total} grün, ${s.warn} Hinweise, ${s.bad} Fehler.`];
  if (r.befunde?.length) parts.push('**Befunde**\n' + r.befunde.map((b) => `• ${b.label}: ${b.value} (${b.status})`).join('\n'));
  if (r.veraenderungen?.length) parts.push('**Seit dem letzten Bericht**\n' + r.veraenderungen.map((x) => `• ${x}`).join('\n'));
  const foot = `${link} · Bericht: ${path.basename(stem)}.md`;
  let ki = '';
  try { ki = (await readFile(`${stem}-ki.md`, 'utf8')).trim(); } catch { /* keine KI-Auswertung */ }
  const fix = parts.join('\n\n');
  if (!ki) return cut(`${fix}\n\n_Keine KI-Auswertung vorhanden._\n\n${foot}`, LIMIT);
  // Die KI-Einschätzung bekommt den Platz, der übrig bleibt
  const room = LIMIT - fix.length - foot.length - 60;
  return `${fix}\n\n**Einschätzung (KI, nur Vorschlag)**\n${room > 200 ? chatText(ki, room) : '_(zu lang, siehe Bericht)_'}\n\n${foot}`;
}

async function send(url, text) {
  for (let i = 0; i < 2; i++) {
    let res;
    try {
      res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json; charset=UTF-8' },
        // allowed_mentions leer: Texte aus Berichten dürfen niemanden anpingen (@everyone usw.)
        body: JSON.stringify({ content: text, allowed_mentions: { parse: [] } }),
        signal: AbortSignal.timeout(15000)
      });
    } catch (e) {
      if (i === 0) { await new Promise((r) => setTimeout(r, 5000)); continue; }
      throw new Error(`keine Verbindung zu Discord (${e.name})`);
    }
    if (res.ok) return; // 204 ohne Inhalt
    if (i === 0 && (res.status === 429 || res.status >= 500)) {
      let wait = 5000;
      if (res.status === 429) { try { wait = Math.min(30000, Math.ceil(((await res.json()).retry_after || 5) * 1000)); } catch { /* Standard */ } }
      await new Promise((r) => setTimeout(r, wait)); continue;
    }
    let msg = '';
    try { msg = (await res.json())?.message || ''; } catch { /* kein JSON */ }
    throw new Error(`Discord antwortet ${res.status}${msg ? `: ${msg}` : ''}${res.status === 404 ? ' (Webhook gelöscht oder Adresse falsch)' : ''}`);
  }
}

try {
  const env = await loadEnv();
  let text;
  if (args.includes('--test')) text = `🧪 **${AGENT_NAME}**: Testnachricht, Discord ist verbunden. [Leitstand](${LEITSTAND})`;
  else if (args.includes('--message')) text = cut(`**${AGENT_NAME}**\n${chatText(pos.join(' ') || 'ohne Text', LIMIT - 100)}`, LIMIT);
  else if (args.includes('--scan-failed')) text = `🔴 **${AGENT_NAME}: Server-Check, Scan fehlgeschlagen**\n${(pos.join(' ') || 'ohne Ausgabe').slice(0, 1000)}\n\nLog: /opt/nestua/ops/reports/cron-last.log`;
  else {
    const stem = args.includes('--latest') ? await latestStem() : pos[0]?.replace(/(-ki)?\.(md|json)$/, '');
    if (!stem) throw new Error('Bericht fehlt (Pfad, --latest oder --test)');
    text = await reportMessage(stem, env);
    if (text === null) { console.log('grün und NOTIFY_GREEN=0: nichts gesendet'); process.exit(0); }
  }
  if (dry) { console.log(text); process.exit(0); }
  // Webhook des Kanals dieses Agenten, sonst der gemeinsame
  const key = `DISCORD_WEBHOOK_${AGENT.toUpperCase().replace(/-/g, '_')}`;
  const url = env[key] || env.DISCORD_WEBHOOK || '';
  if (!url) throw new Error(`${key} (oder DISCORD_WEBHOOK) in ${ENV_FILE} fehlt oder ist leer`);
  if (!/^https:\/\/(discord|discordapp)\.com\/api\/webhooks\/\d+\/[\w-]+$/.test(url)) throw new Error(`${env[key] ? key : 'DISCORD_WEBHOOK'} sieht nicht wie eine Discord-Webhook-Adresse aus (https://discord.com/api/webhooks/<zahl>/<token>, ohne Anführungszeichen und Leerzeichen)`);
  await send(url, text);
  console.log(`Discord: gesendet (${text.length} Zeichen) an Kanal von ${AGENT}`);
} catch (e) {
  console.error(`Discord: ${e.message}`);
  process.exit(1);
}
