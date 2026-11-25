#!/usr/bin/env node
// Fakten für den Agenten "Datenschutz", ohne KI und nur lesend.
// Datenbank: nur Struktur, Zählungen und Zeitstempel (keine Inhalte, keine Namen von Nutzern), über docker exec psql.
// Code: Stand von main (was Nutzer sehen) und was staging neu mitbringt, über git (keine Arbeitskopie nötig).
// Aufruf: node fakten.mjs --repo <MyHome-Klon> --vault <nestua-notes-Klon> --out <fakten.json> [--no-fetch]
import { readFile, readdir, writeFile } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import path from 'node:path';

const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const REPO = arg('--repo', '/opt/nestua/werkstatt'), VAULT = arg('--vault', '/opt/nestua/ops/vault'), OUT = arg('--out', '');
const REPORTS = '/opt/nestua/ops/reports', BACKUP_SH = '/opt/nestua/backup.sh', TZ = 'Europe/Berlin';
const fehler = [];
const run = (cmd, args) => new Promise((res, rej) => execFile(cmd, args, { maxBuffer: 32 * 1024 * 1024, timeout: 90000, env: { ...process.env, TZ } },
  (e, so, se) => (e ? rej(new Error((se || e.message).toString().trim().split('\n').pop())) : res(so.toString()))));
const git = (...a) => run('git', ['-c', 'core.quotePath=false', '-C', REPO, ...a]);
const sql = async (q) => (await run('docker', ['exec', 'supabase-db', 'psql', '-U', 'postgres', '-d', 'postgres', '-At', '-F', '\t', '-v', 'ON_ERROR_STOP=1', '-c', q])).trim().split('\n').filter(Boolean).map((l) => l.split('\t'));
const safe = async (label, fn, dflt) => { try { return await fn(); } catch (e) { fehler.push(`${label}: ${e.message}`); return dflt; } };

const now = new Date();
const p = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now).map((x) => [x.type, x.value]));
const monat = { datei: `${p.year}-${p.month}`, text: new Intl.DateTimeFormat('de-DE', { timeZone: TZ, month: 'long', year: 'numeric' }).format(now), stichtag: `${p.year}-${p.month}-${p.day}` };

/* ---------- Datenbank ---------- */
const db = {};
db.nutzer = await safe('Nutzerzahl', async () => Number((await sql('select count(*) from auth.users'))[0][0]), null);
db.tabellenMitNutzer = await safe('Tabellen', async () => (await sql("select distinct table_name from information_schema.columns where table_schema='public' and column_name in ('owner_id','user_id') order by 1")).map((r) => r[0]), []);
db.loeschregeln = await safe('Löschregeln', async () => Object.fromEntries((await sql("select confdeltype, count(*) from pg_constraint where contype='f' and confrelid='auth.users'::regclass group by 1")).map(([t, n]) => [{ a: 'keine Aktion', r: 'verhindert Löschen', c: 'wird mitgelöscht', n: 'auf leer gesetzt', d: 'auf Standard gesetzt' }[t] || t, Number(n)])), {});
db.ohneLoeschverknuepfung = await safe('Tabellen ohne FK', async () => (await sql(`select c.table_name||'.'||c.column_name from information_schema.columns c where c.table_schema='public' and c.column_name in ('owner_id','user_id')
  and not exists (select 1 from pg_constraint k where k.contype='f' and k.confrelid='auth.users'::regclass and k.conrelid=(quote_ident(c.table_schema)||'.'||quote_ident(c.table_name))::regclass) order by 1`)).map((r) => r[0]), []);
db.verhindernLoeschen = await safe('Restrict-FKs', async () => (await sql("select conrelid::regclass::text from pg_constraint where contype='f' and confrelid='auth.users'::regclass and confdeltype in ('a','r') order by 1")).map((r) => r[0]), []);
db.personenSpalten = await safe('Personen-Spalten', async () => (await sql(`select table_name||'.'||column_name from information_schema.columns where table_schema='public'
  and column_name ~* '(email|phone|telefon|birth|geburt|weight|gewicht|height|groesse|gender|geschlecht|address|adresse|location|ort|lat|lng|ip|display_name|vorname|nachname)' order by 1`)).map((r) => r[0]), []);
db.gesundheit = await safe('Gesundheitsdaten', async () => (await sql(`select distinct table_name from information_schema.columns where table_schema='public'
  and (table_name ~* '^(body|measurement|nut_meals|nut_profile|spo_workouts|spo_entries|hab_entries)' or column_name ~* '(weight|gewicht|height|body|kcal|calorie)') order by 1`)).map((r) => r[0]), []);
db.sicherungsTabellen = await safe('Sicherungstabellen', async () => (await sql("select table_name from information_schema.tables where table_schema='public' and table_name ~* '(backup|_old|_bak|_copy|_\\d{8})' order by 1")).map((r) => r[0]), []);
db.ohneRls = await safe('RLS', async () => (await sql("select c.relname from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r' and not c.relrowsecurity order by 1")).map((r) => r[0]), []);
db.anonRechte = await safe('anon-Rechte', async () => Number((await sql("select count(*) from information_schema.role_table_grants where table_schema='public' and grantee='anon'"))[0][0]), null);
db.storage = await safe('Storage', async () => (await sql("select b.name, b.public::text, count(o.id) from storage.buckets b left join storage.objects o on o.bucket_id=b.id group by 1,2 order by 1")).map(([name, pub, n]) => ({ name, oeffentlich: pub === 'true', dateien: Number(n) })), []);
db.cronJobs = await safe('Cron-Jobs', async () => (await sql('select jobname, schedule, active::text from cron.job order by 1')).map(([name, plan, aktiv]) => ({ name, plan, aktiv: aktiv === 'true' })), []);
// Protokoll- und Verlaufstabellen: Anzahl, ältester und neuester Eintrag (wie lange wird aufbewahrt?)
const LOGS = [['public.analytics_events', 'ts'], ['public.notification_log', 'sent_at'], ['public.gamification_events', 'created_at'], ['public.receipt_scans', 'created_at'], ['public.oauth_states', 'created_at'], ['cron.job_run_details', 'start_time'], ['net._http_response', 'created']];
db.aufbewahrung = [];
for (const [t, c] of LOGS) {
  const r = await safe(`Aufbewahrung ${t}`, async () => (await sql(`select count(*), to_char(min(${c}) at time zone 'Europe/Berlin','YYYY-MM-DD'), to_char(max(${c}) at time zone 'Europe/Berlin','YYYY-MM-DD') from ${t}`))[0], null);
  if (r) db.aufbewahrung.push({ tabelle: t, eintraege: Number(r[0]), aeltester: r[1] || null, neuester: r[2] || null });
}

/* ---------- Server: Backups ---------- */
const backup = await safe('backup.sh', async () => {
  const s = await readFile(BACKUP_SH, 'utf8'), g = (k) => Number((s.match(new RegExp(`^${k}=(\\d+)`, 'm')) || [])[1]) || null;
  return { remoteTage: g('RETENTION_REMOTE_DAYS'), lokalTage: g('RETENTION_LOCAL_DAYS'), logTage: g('RETENTION_LOG_DAYS'), verschluesselt: /gpg/i.test(s) };
}, null);

/* ---------- Code: main (live) und was staging neu bringt ---------- */
if (!process.argv.includes('--no-fetch')) await safe('git fetch', () => git('fetch', '-q', 'origin'), null);
async function codeStand(ref) {
  const out = { ref };
  out.domains = await safe(`Domains ${ref}`, async () => {
    const txt = await git('grep', '-h', '-o', '-I', '-E', 'https?://[a-zA-Z0-9.-]+\\.[a-z]{2,}', ref, '--', 'src', 'index.html', 'public').catch(() => '');
    const skip = /(w3\.org|placeholder|xxxxx|example\.|localhost|schema\.org)/;
    return [...new Set(txt.split('\n').map((l) => l.trim().replace(/^https?:\/\//, '')).filter((d) => d && !skip.test(d)))].sort();
  }, []);
  out.functionVariablen = await safe(`Variablen ${ref}`, async () => {
    const txt = await git('grep', '-h', '-o', '-E', "get\\(['\"][A-Z][A-Z0-9_]+['\"]\\)", ref, '--', 'supabase/functions').catch(() => '');
    return [...new Set(txt.split('\n').map((l) => (l.match(/\(['"]([A-Z0-9_]+)/) || [])[1]).filter(Boolean))].sort();
  }, []);
  out.functions = await safe(`Functions ${ref}`, async () => [...new Set((await git('ls-tree', '--name-only', `${ref}:supabase/functions`)).trim().split('\n').filter(Boolean))], []);
  out.localStorage = await safe(`localStorage ${ref}`, async () => {
    const txt = await git('grep', '-h', '-o', '-E', "localStorage\\.setItem\\(\\s*[`'\"][^`'\"]+", ref, '--', 'src').catch(() => '');
    return [...new Set(txt.split('\n').map((l) => l.replace(/^.*setItem\(\s*[`'"]/, '')).filter(Boolean))].sort();
  }, []);
  out.kontoloeschung = await safe(`Kontolöschung ${ref}`, async () => (await git('grep', '-l', '-i', '-E', 'deleteUser|delete_account|deleteAccount|konto.?l(ö|oe)sch', ref, '--', 'src', 'supabase/functions').catch(() => '')).trim().split('\n').filter(Boolean).map((l) => l.replace(/^[^:]*:/, '')), []);
  out.einwilligung = await safe(`Einwilligung ${ref}`, async () => (await git('grep', '-l', '-E', 'analytics_consent', ref, '--', 'src').catch(() => '')).trim().split('\n').filter(Boolean).map((l) => l.replace(/^[^:]*:/, '')), []);
  out.datenschutzerklaerung = await safe(`Datenschutzerklärung ${ref}`, async () => {
    const html = await git('show', `${ref}:public/datenschutz.html`);
    const zuletzt = (await git('log', '-1', '--format=%cs', ref, '--', 'public/datenschutz.html')).trim();
    const abschnitte = [...html.matchAll(/<h[1-3][^>]*>([\s\S]*?)<\/h[1-3]>/gi)].map((m) => m[1].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim()).filter(Boolean);
    const text = html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, '').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
    return { datei: 'public/datenschutz.html', zuletztGeaendert: zuletzt, zeichen: text.length, abschnitte, text: text.slice(0, 12000) };
  }, null);
  return out;
}
const main = await codeStand('origin/main'), staging = await codeStand('origin/staging');
const neu = (k) => (staging[k] || []).filter((x) => !(main[k] || []).includes(x));
const code = { main, neuInStaging: { domains: neu('domains'), functionVariablen: neu('functionVariablen'), functions: neu('functions'), localStorage: neu('localStorage') },
  datenschutzerklaerungGeaendertInStaging: !!(main.datenschutzerklaerung && staging.datenschutzerklaerung && main.datenschutzerklaerung.text !== staging.datenschutzerklaerung.text) };
// Dienste, an die Daten gehen können (aus Variablennamen und Domains abgeleitet)
const DIENSTE = [[/^ANTHROPIC/, 'Anthropic (KI-Scan von Belegen und Mahlzeiten, USA)'], [/^GOOGLE/, 'Google (Kalender-Verbindung, USA)'], [/^VAPID/, 'Web-Push-Dienste der Browser-Hersteller (Google, Apple, Mozilla)'], [/^RESEND|^SMTP|^MAIL/, 'E-Mail-Versand']];
code.dienste = [...new Set([...main.functionVariablen, ...code.neuInStaging.functionVariablen].flatMap((v) => DIENSTE.filter(([re]) => re.test(v)).map(([, n]) => n)))];
for (const d of [...main.domains, ...code.neuInStaging.domains]) if (/jsdelivr|unpkg|cdnjs|googleapis|gstatic/.test(d)) code.dienste.push(`Externes Laden im Browser: ${d}`);

/* ---------- Vault: offene Einträge zu Datenschutz und Recht ---------- */
const vault = await safe('Vault', async () => {
  const dir = path.join(VAULT, 'Backlog'), out = [];
  for (const f of (await readdir(dir)).filter((x) => x.endsWith('.md') && x !== 'Index.md')) {
    const t = await readFile(path.join(dir, f), 'utf8');
    if (!/datenschutz|rechtlich|dsgvo|löschung|loeschung|tracking|einwillig|cookie|play-store|sicherheit/i.test(t)) continue;
    const fm = Object.fromEntries((t.match(/^---\n([\s\S]*?)\n---/) || ['', ''])[1].split('\n').map((l) => l.split(/:\s*/)).filter((x) => x.length > 1).map(([k, ...v]) => [k, v.join(':').trim()]));
    out.push({ name: f.replace(/\.md$/, ''), status: fm.status || '', projekt: fm.projekt || '', kategorie: fm.kategorie || '' });
  }
  return out;
}, []);

/* ---------- Letzter Bericht zum Vergleich ---------- */
const vorher = await safe('letzter Bericht', async () => {
  const f = (await readdir(REPORTS)).filter((x) => /^datenschutz-\d{4}-\d{2}-\d{2}-\d{4}\.json$/.test(x)).sort().at(-1);
  if (!f) return null;
  const r = JSON.parse(await readFile(path.join(REPORTS, f), 'utf8'));
  return { datum: r.datum, status: r.status, befunde: r.befunde || [] };
}, null);

const F = { erstellt: now.toISOString(), monat, db, backup, code, vault, vorher, fehler };
if (OUT) await writeFile(OUT, JSON.stringify(F, null, 1)); else console.log(JSON.stringify(F, null, 1));
