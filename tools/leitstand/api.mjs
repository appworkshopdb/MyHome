#!/usr/bin/env node
// Schalter-Schnittstelle des Leitstands: Agenten ein- und ausschalten.
// Läuft nur auf 127.0.0.1:8788; Caddy reicht /api/* hinter dem Login (basic_auth) des Leitstands durch.
//   GET  /api/ping                       -> {ok:true}
//   GET  /api/schalter                   -> Zustand aller Agenten
//   POST /api/agent {"id":"pruefer","an":false}   (Header X-Leitstand: 1, Content-Type: application/json)
// Zustand: Datei aus/<id> (leer = an; vorhanden = aus, die Cron-Skripte prüfen sie über aus.sh) und schalter.json
// (Zeitpunkte in Berlin-Zeit: seit = ausgeschaltet am, ein = zuletzt eingeschaltet am). Nach jeder Änderung läuft scan.mjs,
// damit der Leitstand sofort aktuell ist.
// Einschalten zählt ab jetzt: es wird nichts nachgeholt. Für den Prüfer heißt das: alle PR- und staging-Stände, die in der Pause
// dazukamen, gelten als gesehen (pruefer-cron.sh --seed), bevor der Schalter freigegeben wird.
// Schutz: nur bekannte Agenten-Kennungen aus registry.json, nur dieser eine Vorgang, Prüfung von Origin, Sec-Fetch-Site und
// eigenem Header (eine fremde Seite kann so keinen Schalter betätigen), Textlänge begrenzt.
import http from 'node:http';
import { readFile, writeFile, rename, mkdir, rm, access } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import path from 'node:path';

const BASE = process.env.LEITSTAND_DIR || '/opt/nestua/ops/leitstand';
const PORT = Number(process.env.LEITSTAND_API_PORT || 8788);
const ORIGIN = process.env.LEITSTAND_ORIGIN || 'https://leitstand.nestua.de';
const AUS = path.join(BASE, 'aus'), FILE = path.join(BASE, 'schalter.json');
const ENV = { ...process.env, PATH: '/usr/local/bin:/usr/bin:/bin', AGENT_FORCE: '1' };
// Aufräumen beim Einschalten (läuft mit AGENT_FORCE=1, solange der Agent noch aus ist)
const RESUME = { pruefer: ['/opt/nestua/ops/agenten/pruefer/pruefer-cron.sh', '--seed'] };

const stamp = () => {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Berlin', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date()).map((x) => [x.type, x.value]));
  return `${p.year}-${p.month}-${p.day} ${p.hour}:${p.minute}`;
};
const exists = async (p) => { try { await access(p); return true; } catch { return false; } };
const readJson = async (p, d) => { try { return JSON.parse(await readFile(p, 'utf8')); } catch { return d; } };
const agentIds = async () => ((await readJson(path.join(BASE, 'registry.json'), { nodes: [] })).nodes || []).filter((n) => n.kind === 'agent').map((n) => n.id);
const run = (cmd, args, timeout) => new Promise((resolve) => execFile(cmd, args, { env: ENV, timeout }, (err, stdout, stderr) => resolve({ err, out: `${stdout || ''}${stderr || ''}` })));
const log = (m) => console.log(`${stamp()} ${m}`);

async function zustand() {
  const st = await readJson(FILE, {}), out = {};
  for (const id of await agentIds()) out[id] = { aus: await exists(path.join(AUS, id)), seit: st[id]?.seit || null, ein: st[id]?.ein || null };
  return out;
}

async function setzen(id, an) {
  const flag = path.join(AUS, id), st = await readJson(FILE, {}), istAus = await exists(flag);
  if (an === !istAus) return { ok: true, geaendert: false };
  if (!an) {
    await mkdir(AUS, { recursive: true });
    await writeFile(flag, `${stamp()}\n`);
    st[id] = { ...st[id], aus: true, seit: stamp() };
  } else {
    if (RESUME[id]) {   // höchstens dreimal, falls gerade noch ein Lauf Sperre hält
      let ok = false, last = '';
      for (let i = 0; i < 3 && !ok; i++) {
        const r = await run(RESUME[id][0], RESUME[id].slice(1), 120000);
        last = r.out.trim().split('\n').slice(-1)[0] || (r.err ? String(r.err.message).slice(0, 120) : '');
        ok = !r.err && !/läuft schon|fehlgeschlagen/.test(r.out);
        if (!ok) await new Promise((res) => setTimeout(res, 8000));
      }
      if (!ok) return { ok: false, fehler: `Aufräumen vor dem Einschalten fehlgeschlagen (${last}). Der Agent bleibt aus.` };
    }
    await rm(flag, { force: true });
    st[id] = { aus: false, seit: st[id]?.seit || null, ein: stamp() };
  }
  const tmp = `${FILE}.tmp`;
  await writeFile(tmp, JSON.stringify(st, null, 1)); await rename(tmp, FILE);
  log(`${id}: ${an ? 'eingeschaltet' : 'ausgeschaltet'}`);
  await run(process.execPath, [path.join(BASE, 'scan.mjs')], 40000);   // Anzeige sofort aktualisieren
  return { ok: true, geaendert: true };
}

let queue = Promise.resolve();   // Änderungen nacheinander, nie gleichzeitig
const send = (res, code, obj) => { res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' }); res.end(JSON.stringify(obj)); };

http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://x');
    if (req.method === 'GET' && url.pathname === '/api/ping') return send(res, 200, { ok: true });
    if (req.method === 'GET' && url.pathname === '/api/schalter') return send(res, 200, await zustand());
    if (req.method !== 'POST' || url.pathname !== '/api/agent') return send(res, 404, { ok: false, fehler: 'unbekannt' });
    const o = req.headers.origin, sf = req.headers['sec-fetch-site'];
    if ((o && o !== ORIGIN) || (sf && sf !== 'same-origin')) return send(res, 403, { ok: false, fehler: 'Herkunft nicht erlaubt' });
    if (req.headers['x-leitstand'] !== '1' || !String(req.headers['content-type'] || '').startsWith('application/json')) return send(res, 400, { ok: false, fehler: 'Anfrage unvollständig' });
    let body = '';
    for await (const c of req) { body += c; if (body.length > 2048) return send(res, 413, { ok: false, fehler: 'zu groß' }); }
    let b; try { b = JSON.parse(body); } catch { return send(res, 400, { ok: false, fehler: 'kein JSON' }); }
    if (typeof b.an !== 'boolean' || typeof b.id !== 'string' || !(await agentIds()).includes(b.id)) return send(res, 400, { ok: false, fehler: 'Agent unbekannt' });
    const r = await (queue = queue.catch(() => {}).then(() => setzen(b.id, b.an)));
    return send(res, r.ok ? 200 : 500, { ...r, schalter: await zustand() });
  } catch (e) { log(`Fehler: ${String(e.message || e).slice(0, 160)}`); return send(res, 500, { ok: false, fehler: 'Serverfehler' }); }
}).listen(PORT, '127.0.0.1', () => log(`Schalter-Schnittstelle auf 127.0.0.1:${PORT}`));
