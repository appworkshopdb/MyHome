#!/usr/bin/env node
// Leitstand-Scan: führt die Prüfungen aus registry.json aus und schreibt www/data/leitstand.json.
// Nur lesend. Geheimnisse werden nie ausgegeben: envset prüft nur, ob ein Wert gesetzt ist.
// Aufruf: node scan.mjs            (Basisordner = Ordner dieses Skripts)
//         node scan.mjs --print    (zusätzlich Kurzfassung auf stdout)
import { readFile, writeFile, rename, stat, readdir, mkdir, access } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { connect } from 'node:tls';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const BASE = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.join(BASE, 'www', 'data');
const TZ = 'Europe/Berlin';
const t0 = Date.now();

const run = (cmd, args, timeout = 15000) => new Promise((resolve, reject) => {
  execFile(cmd, args, { timeout, maxBuffer: 4 * 1024 * 1024 }, (err, stdout, stderr) => {
    if (err) reject(new Error((stderr || err.message).toString().trim().split('\n').slice(-1)[0]));
    else resolve(stdout.toString());
  });
});
const psql = (...queries) => run('docker', ['exec', 'supabase-db', 'psql', '-U', 'postgres', '-d', 'postgres', '-At', '-v', 'ON_ERROR_STOP=1', ...queries.flatMap((q) => ['-c', q])]);
const exists = async (p) => { try { await access(p); return true; } catch { return false; } };
const fmtTime = (d) => new Intl.DateTimeFormat('de-DE', { timeZone: TZ, hour: '2-digit', minute: '2-digit' }).format(d);
const fmtDate = (d) => new Intl.DateTimeFormat('de-DE', { timeZone: TZ, day: '2-digit', month: '2-digit' }).format(d);
const sameDay = (a, b) => fmtDate(a) === fmtDate(b);
const R = (status, value, detail = '') => ({ status, value, detail });

async function hashTree(dir) {
  const out = new Map();
  async function walk(d, rel) {
    for (const e of await readdir(d, { withFileTypes: true })) {
      const p = path.join(d, e.name), r = path.join(rel, e.name);
      if (e.isDirectory()) await walk(p, r);
      else if (e.isFile()) out.set(r, createHash('sha256').update(await readFile(p)).digest('hex'));
    }
  }
  await walk(dir, '');
  return out;
}

const CHECKS = {
  async docker(c) {
    const all = (await run('docker', ['ps', '-a', '--format', '{{.Names}}\t{{.State}}\t{{.Status}}\t{{.Label "com.docker.compose.project"}}\t{{.Image}}'])).trim().split('\n').filter(Boolean).map((l) => l.split('\t'));
    const rows = all.filter((r) => r[3] === (c.project || 'supabase'));
    const stray = all.filter((r) => r[3] !== (c.project || 'supabase')).map((r) => `${r[0]} (${r[4]}, ${r[1]})`);
    const down = rows.filter((r) => r[1] !== 'running').map((r) => r[0]);
    const sick = rows.filter((r) => /\(unhealthy\)/.test(r[2])).map((r) => r[0]);
    const value = `${rows.length - down.length}/${rows.length}`;
    const extra = stray.length ? `; außerhalb des Stacks: ${stray.join(', ')}` : '';
    if (down.length || sick.length) return R('bad', value, [down.length && `gestoppt: ${down.join(', ')}`, sick.length && `unhealthy: ${sick.join(', ')}`].filter(Boolean).join('; ') + extra);
    return R('ok', value, `Stack: alle laufen, keiner unhealthy${extra}`);
  },
  async backup(c) {
    const logs = (await readdir(c.dir)).filter((f) => /^backup_\d{4}-\d{2}-\d{2}\.log$/.test(f)).sort();
    if (!logs.length) return R('bad', 'kein Log', c.dir);
    const f = path.join(c.dir, logs.at(-1));
    const st = await stat(f);
    const lines = (await readFile(f, 'utf8')).trim().split('\n');
    const done = /Backup abgeschlossen/.test(lines.at(-1) || '');
    const age = (Date.now() - st.mtimeMs) / 36e5;
    const when = sameDay(st.mtime, new Date()) ? fmtTime(st.mtime) : `${fmtDate(st.mtime)} ${fmtTime(st.mtime)}`;
    if (!done) return R('bad', when, `letzte Zeile: ${(lines.at(-1) || '').slice(0, 120)}`);
    if (age > c.maxAgeHours) return R('warn', when, `älter als ${c.maxAgeHours} Stunden`);
    return R('ok', when, `${logs.at(-1)}: abgeschlossen`);
  },
  async cronhttp(c) {
    const out = await psql(
      `select code || '|' || n from (select coalesce(status_code::text, 'Timeout') as code, count(*) as n from net._http_response where created > now() - interval '${Number(c.hours)} hours' group by 1) x order by 1`,
      `select count(*) from cron.job_run_details where status <> 'succeeded' and start_time > now() - interval '24 hours'`,
      `select count(*) from cron.job where active`
    );
    const lines = out.trim().split('\n');
    const jobs = Number(lines.pop()); const failed = Number(lines.pop());
    const codes = Object.fromEntries(lines.filter(Boolean).map((l) => l.split('|')));
    const other = Object.entries(codes).filter(([k]) => k !== '200');
    const detail = `${jobs} aktive Jobs; Antworten der letzten ${c.hours} h: ` + (Object.entries(codes).map(([k, v]) => `${v}× ${k}`).join(', ') || 'keine');
    if (failed) return R('bad', `${failed} Fehler`, `${failed} fehlgeschlagene Läufe in 24 h; ` + detail);
    if (other.length) return R('warn', other.map(([k, v]) => `${v}× ${k}`).join(', '), detail);
    return R('ok', '200', detail);
  },
  async http(c) {
    const res = await Promise.all(c.targets.map(async (t) => {
      try { const r = await fetch(t.url, { redirect: 'manual', signal: AbortSignal.timeout(8000) }); return { t, code: r.status }; }
      catch { return { t, code: 0 }; }
    }));
    const okN = res.filter((r) => r.t.expect.includes(r.code)).length;
    const detail = res.map((r) => `${new URL(r.t.url).host}: ${r.code || 'keine Antwort'} (erwartet ${r.t.expect.join('/')})`).join('; ');
    return R(okN === res.length ? 'ok' : 'bad', `${okN}/${res.length}`, detail);
  },
  async fnsync(c) {
    const names = (await readdir(c.repo, { withFileTypes: true })).filter((e) => e.isDirectory()).map((e) => e.name);
    const off = [];
    for (const n of names) {
      const a = await hashTree(path.join(c.repo, n));
      const b = (await exists(path.join(c.live, n))) ? await hashTree(path.join(c.live, n)) : new Map();
      const keys = new Set([...a.keys(), ...b.keys()]);
      if ([...keys].some((k) => a.get(k) !== b.get(k))) off.push(n);
    }
    const value = `${names.length - off.length}/${names.length}`;
    return off.length ? R('bad', value, `weicht ab: ${off.join(', ')}`) : R('ok', value, 'Repo und Server gleich');
  },
  async rls() {
    const [tables, off, anon, pol] = (await psql(
      `select count(*) from pg_tables where schemaname = 'public'`,
      `select count(*) from pg_tables where schemaname = 'public' and not rowsecurity`,
      `select count(*) from information_schema.role_table_grants where table_schema = 'public' and grantee = 'anon'`,
      `select count(*) from pg_policies where schemaname = 'public'`
    )).trim().split('\n').map(Number);
    const detail = `${tables} Tabellen, ${tables - off} mit RLS, ${pol} Policies, anon-Rechte ${anon}`;
    return (off || anon) ? R('bad', `${tables - off}/${tables}`, detail) : R('ok', `${tables}/${tables}`, detail);
  },
  async perms(c) {
    const open = [];
    for (const f of c.noOtherRead) { try { const s = await stat(f); if (s.mode & 0o004) open.push(path.basename(f)); } catch { /* fehlt: nicht Sache dieser Prüfung */ } }
    let writable = 0;
    async function walk(d) { for (const e of await readdir(d, { withFileTypes: true })) { const p = path.join(d, e.name); const s = await stat(p); if (s.mode & 0o002) writable++; if (e.isDirectory()) await walk(p); } }
    if (c.noOtherWriteDir) await walk(c.noOtherWriteDir);
    if (open.length || writable) return R('bad', `${open.length + writable} offen`, [open.length && `für andere lesbar: ${open.join(', ')}`, writable && `${writable} Einträge in Functions für andere beschreibbar`].filter(Boolean).join('; '));
    return R('ok', 'ok', 'Geheimnis-Dateien nicht für andere lesbar, Functions nicht für andere beschreibbar');
  },
  async tls(c) {
    const days = await Promise.all(c.hosts.map((h) => new Promise((resolve) => {
      const s = connect({ host: '127.0.0.1', port: 443, servername: h, rejectUnauthorized: false, timeout: 6000 }, () => {
        const cert = s.getPeerCertificate(); s.end();
        resolve(cert && cert.valid_to ? Math.floor((new Date(cert.valid_to) - Date.now()) / 864e5) : -1);
      });
      s.on('error', () => resolve(-1)); s.on('timeout', () => { s.destroy(); resolve(-1); });
    })));
    const min = Math.min(...days);
    const detail = c.hosts.map((h, i) => `${h}: ${days[i] < 0 ? 'kein Zertifikat' : days[i] + ' Tage'}`).join('; ');
    if (min < 0) return R('bad', 'fehlt', detail);
    return R(min < c.warnDays ? 'warn' : 'ok', `${min} T`, detail);
  },
  async same(c) {
    if (!(await exists(c.b))) return R('warn', 'keine Referenz', c.b);
    const [a, b] = await Promise.all([readFile(c.a), readFile(c.b)]);
    return a.equals(b) ? R('ok', 'gleich', `${c.a} = Referenzkopie`) : R('warn', 'geändert', `${c.a} weicht von der Referenzkopie ab`);
  },
  async disk(c) {
    const p = Number((await run('df', ['-P', '/'])).trim().split('\n').pop().split(/\s+/)[4].replace('%', ''));
    return R(p >= c.warnPercent ? 'warn' : 'ok', `${p} %`, `Systemplatte zu ${p} % belegt`);
  },
  async envset(c) {
    let txt = '';
    try { txt = await readFile(c.file, 'utf8'); } catch { return R('bad', 'fehlt', `${path.basename(c.file)} nicht lesbar`); }
    const m = txt.match(new RegExp(`^\\s*${c.key}\\s*=\\s*(.*)$`, 'm'));
    const val = m ? m[1].trim().replace(/^["']|["']$/g, '') : '';
    return val ? R('ok', 'gesetzt', `${c.key} ist gesetzt`) : R(c.missing || 'warn', 'leer', `${c.key} in ${path.basename(c.file)} ist leer`);
  },
  async reboot() {
    const up = Number((await readFile('/proc/uptime', 'utf8')).split(' ')[0]);
    const d = Math.floor(up / 86400);
    return (await exists('/var/run/reboot-required')) ? R('warn', 'offen', `Neustart nötig, ${d} Tage ohne Neustart`) : R('ok', `${d} T`, `kein Neustart nötig, läuft seit ${d} Tagen`);
  },
  async sql(c) {
    const v = (await psql(c.query)).trim();
    return v === String(c.expect) ? R('ok', 'da', `${c.label}: vorhanden`) : R('bad', 'fehlt', `${c.label}: erwartet ${c.expect}, gefunden ${v}`);
  },
  async file(c) { return (await exists(c.path)) ? R('ok', 'da', c.path) : R('bad', 'fehlt', c.path); },
  async contains(c) {
    let txt = '';
    try { txt = await readFile(c.path, 'utf8'); } catch { return R('bad', 'fehlt', c.path); }
    return txt.includes(c.text) ? R('ok', 'aktiv', `${c.path} enthält ${c.what || c.text}`) : R('bad', 'fehlt', `${c.path} enthält ${c.what || c.text} nicht`);
  },
  async cron(c) {
    let tab = '';
    try { tab = await run('crontab', ['-l']); } catch { tab = ''; }
    const hit = tab.split('\n').some((l) => !l.trim().startsWith('#') && l.includes(c.pattern));
    return hit ? R('ok', 'eingerichtet', `crontab enthält „${c.pattern}“`) : R('bad', 'fehlt', `kein Eintrag „${c.pattern}“ in der crontab`);
  }
};

// Läufe eines Agenten: letzter Bericht (<report>-JJJJ-MM-TT-HHMM.json, dazu -ki.md) und nächster Lauf aus runAt (täglich, Berlin-Zeit).
// overdue = der letzte geplante Lauf (30 Minuten Puffer) hat keinen Bericht hinterlassen.
const REPORTS_DIR = '/opt/nestua/ops/reports';
function berlin(d) {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
    .formatToParts(d).map((x) => [x.type, x.value]));
  return { day: `${p.year}-${p.month}-${p.day}`, hm: `${p.hour}:${p.minute}` };
}
async function runInfo(n, now) {
  const run = {};
  if (n.report) {
    try {
      const re = new RegExp(`^${n.report}-\\d{4}-\\d{2}-\\d{2}-\\d{4}\\.json$`);
      const f = (await readdir(REPORTS_DIR)).filter((x) => re.test(x)).sort().at(-1);
      if (f) {
        const r = JSON.parse(await readFile(path.join(REPORTS_DIR, f), 'utf8'));
        let ki = '';
        try { ki = (await readFile(path.join(REPORTS_DIR, f.replace(/\.json$/, '-ki.md')), 'utf8')).trim().slice(0, 1500); } catch { /* keine KI-Auswertung */ }
        const bef = (r.befunde || []).map((b) => ({ label: b.label, value: b.value, status: b.status }));
        run.last = { datum: r.datum, zeit: r.zeit, status: r.status, befunde: bef.length, befundListe: bef, fazit: r.fazit || '', ki, file: path.join(REPORTS_DIR, f.replace(/\.json$/, '.md')) };
      }
    } catch { /* noch kein Bericht */ }
  }
  if (n.runAt) {
    const b = berlin(now), tomorrow = berlin(new Date(now.getTime() + 864e5)), yesterday = berlin(new Date(now.getTime() - 864e5));
    run.next = { datum: b.hm < n.runAt ? b.day : tomorrow.day, zeit: n.runAt };
    const [h, m] = n.runAt.split(':').map(Number), g = h * 60 + m + 30;
    const grace = `${String(Math.floor(g / 60) % 24).padStart(2, '0')}:${String(g % 60).padStart(2, '0')}`;
    const due = b.hm >= grace ? b.day : yesterday.day;
    run.overdue = (run.last ? `${run.last.datum} ${run.last.zeit}` : '') < `${due} ${n.runAt}`;
  }
  return run;
}

async function main() {
  const reg = JSON.parse(await readFile(path.join(BASE, 'registry.json'), 'utf8'));
  let tasks = {};
  try { tasks = JSON.parse(await readFile(path.join(BASE, 'aufgaben.json'), 'utf8')); } catch { tasks = { fehlt: true }; }

  const checks = {};
  await Promise.all(Object.entries(reg.checks).map(async ([id, c]) => {
    const s = Date.now();
    try { checks[id] = { label: c.label, ...(await CHECKS[c.type](c)) }; }
    catch (e) { checks[id] = { label: c.label, status: 'warn', value: 'nicht prüfbar', detail: String(e.message || e).slice(0, 200) }; }
    checks[id].ms = Date.now() - s;
  }));

  const polar = ([deg, r]) => [Math.round(Math.cos(deg * Math.PI / 180) * r), Math.round(Math.sin(deg * Math.PI / 180) * r)];
  const nodes = reg.nodes.map((n) => {
    const o = { ...n, pos: n.pos || polar(n.polar) }; delete o.polar;
    if (n.builds) {
      const done = n.builds.filter((b) => checks[b]?.status === 'ok').length;
      const all = done === n.builds.length;
      o.progress = [done, n.builds.length];
      if (n.kind === 'agent') { o.status = all ? 'ok' : 'build'; o.value = all ? 'bereit' : `Aufbau ${done}/${n.builds.length}`; }
      else { o.status = all ? 'ok' : 'warn'; o.value = `${done}/${n.builds.length}`; }
    } else if (n.state === 'plan') { o.status = 'plan'; o.value = n.kind === 'agent' ? (n.id === 'social' ? 'später' : 'geplant') : 'extern'; }
    else if (n.check) { o.status = checks[n.check].status; o.value = checks[n.check].value; }
    return o;
  });
  const byId = Object.fromEntries(nodes.map((n) => [n.id, n]));
  const edges = reg.edges.map(([a, b, fixed]) => {
    if (fixed) return [a, b, fixed];
    const A = byId[a], B = byId[b];
    const res = A.kind === 'res' ? A : B.kind === 'res' ? B : null;
    const src = res || (A.kind === 'core' ? B : A);
    return [a, b, src.status || 'plan'];
  });
  let lastReport = null;
  try {
    const dir = '/opt/nestua/ops/reports';
    const f = (await readdir(dir)).filter((x) => /^server-.*\.json$/.test(x)).sort().at(-1);
    if (f) { const r = JSON.parse(await readFile(path.join(dir, f), 'utf8')); lastReport = { datum: r.datum, zeit: r.zeit, status: r.status, file: path.join(dir, f.replace(/\.json$/, '.md')) }; }
  } catch { /* noch kein Bericht */ }
  const sys = reg.system.map((id) => checks[id]);
  const now = new Date();
  await Promise.all(nodes.filter((n) => n.kind === 'agent').map(async (n) => { const r = await runInfo(n, now); if (Object.keys(r).length) n.run = r; }));
  const data = {
    generated: now.toISOString(),
    generatedText: `${fmtDate(now)}, ${fmtTime(now)}`,
    durationMs: Date.now() - t0,
    system: { ids: reg.system, ok: sys.filter((c) => c.status === 'ok').length, warn: sys.filter((c) => c.status === 'warn').length, bad: sys.filter((c) => c.status === 'bad').length, total: sys.length },
    checks, nodes, edges, tasks, lastReport
  };
  await mkdir(OUT_DIR, { recursive: true });
  const tmp = path.join(OUT_DIR, `.leitstand.${process.pid}.tmp`);
  await writeFile(tmp, JSON.stringify(data, null, 1));
  await rename(tmp, path.join(OUT_DIR, 'leitstand.json'));
  if (process.argv.includes('--print')) {
    console.log(`Leitstand-Scan ${data.generatedText} (${data.durationMs} ms): System ${data.system.ok}/${data.system.total} grün, ${data.system.warn} ${data.system.warn === 1 ? 'Hinweis' : 'Hinweise'}, ${data.system.bad} Fehler`);
    for (const [id, c] of Object.entries(checks)) console.log(`  ${c.status.padEnd(4)} ${c.label.padEnd(26)} ${String(c.value).padEnd(14)} ${c.detail}`);
  }
}
main().catch((e) => { console.error('Leitstand-Scan fehlgeschlagen:', e.message); process.exit(1); });
