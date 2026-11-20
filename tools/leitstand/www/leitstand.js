// Nestua Leitstand "Brücke": liest data/leitstand.json (Scan alle 5 Minuten) und zeigt den Agenten-Kern mit einer Karte je Agent.
// Eine Karte klappt zur Agenten-Seite auf (#<kennung>), dort laufen die Verknüpfungen als Fluss. Nur lesend: nichts löst etwas am Server aus.
(() => {
const IC = {
  server:'<rect x="4" y="4" width="16" height="6" rx="1.5"/><rect x="4" y="14" width="16" height="6" rx="1.5"/><path d="M8 7h.01M8 17h.01"/>',
  cloud:'<path d="M7 18h10a4 4 0 0 0 .6-7.96A6 6 0 0 0 6.2 9.1 4.5 4.5 0 0 0 7 18z"/>',
  git:'<circle cx="6" cy="6" r="2"/><circle cx="6" cy="18" r="2"/><circle cx="18" cy="8" r="2"/><path d="M6 8v8M18 10v1a4 4 0 0 1-4 4H8"/>',
  shield:'<path d="M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6z"/>',
  chat:'<path d="M4 5h16v11H9l-5 4z"/><path d="M8 9h8M8 12h5"/>',
  db:'<ellipse cx="12" cy="6" rx="7" ry="2.5"/><path d="M5 6v12c0 1.4 3.1 2.5 7 2.5s7-1.1 7-2.5V6M5 12c0 1.4 3.1 2.5 7 2.5s7-1.1 7-2.5"/>',
  box:'<path d="M12 3l8 4.5v9L12 21l-8-4.5v-9z"/><path d="M12 12l8-4.5M12 12v9M12 12L4 7.5"/>',
  clock:'<circle cx="12" cy="12" r="8"/><path d="M12 8v4l3 2"/>',
  file:'<path d="M7 3h7l5 5v13H7z"/><path d="M14 3v5h5"/>',
  folder:'<path d="M3 7h6l2 2h10v10H3z"/>',
  bell:'<path d="M6 16V11a6 6 0 0 1 12 0v5l2 2H4z"/><path d="M10 20a2 2 0 0 0 4 0"/>',
  key:'<circle cx="8" cy="15" r="4"/><path d="m11 12 9-9M17 6l3 3"/>',
  check:'<path d="M20 6 9 17l-5-5"/>',
  pulse:'<path d="M3 12h4l2-5 4 10 2-5h6"/>',
  book:'<path d="M5 4h10a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3z"/><path d="M5 17a3 3 0 0 1 3-3h10"/>',
  send:'<path d="M21 3L10 14M21 3l-7 18-4-7-7-4z"/>',
  hdd:'<rect x="3" y="13" width="18" height="7" rx="2"/><path d="M5 13 7.5 5h9L19 13M7 16.5h.01"/>',
  back:'<path d="M15 6l-6 6 6 6"/>', arrow:'<path d="M5 12h14M13 6l6 6-6 6"/>'
};
const svg = (n) => `<svg viewBox="0 0 24 24" aria-hidden="true">${IC[n] || IC.pulse}</svg>`;
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;' })[c]);
const COLOR = { ok:'#34F0C2', warn:'#FFB547', bad:'#FF4D6D', plan:'#5C668C', build:'#8B7CFF' };
const RANK = { bad:3, warn:2, build:1, ok:0, plan:-1 };
const REP = { 'grün':'ok', 'gelb':'warn', 'rot':'bad' };
const POLL_MS = 15000, STALE_MIN = 12;
const dm = (iso) => (iso || '').split('-').reverse().slice(0, 2).join('.') + '.';
const berlinDay = (d) => new Intl.DateTimeFormat('en-CA', { timeZone:'Europe/Berlin', year:'numeric', month:'2-digit', day:'2-digit' }).format(d);

/* ---------- Verbrauch (Schätzung zu API-Listenpreisen, aus den Transkripten von Claude Code) ---------- */
const usd = (v) => new Intl.NumberFormat('de-DE', { style:'currency', currency:'USD' }).format(v || 0);
const pct = (v) => (v * 100 < 0.1 && v > 0 ? 'unter 0,1' : (v * 100).toLocaleString('de-DE', { maximumFractionDigits:1 })) + ' %';
const mdl = (list) => (list || []).map((m) => m.replace(/^claude-/, '').replace(/-(\d+)-(\d+)$/, ' $1.$2').replace(/-/g, ' ').replace(/^\w/, (c) => c.toUpperCase())).join(', ');
const lauf = (n) => `${n} ${n === 1 ? 'Lauf' : 'Läufe'}`;
function usageLine(a) {
  const u = a.usage; if (!u) return '';
  return `<span class="uline"><span>Verbrauch 30 Tage</span><b>${usd(u.cost.t30)}</b><span>${u.runs.t30 ? lauf(u.runs.t30) : 'noch kein Lauf'}</span></span>`;
}
function usageFacts(a) {
  const u = a.usage; if (!u) return '<div class="empty">Keine Verbrauchsdaten.</div>';
  const f = (k, v, sub) => `<div class="fact"><small>${k}</small><b>${v}</b><span>${sub}</span></div>`;
  return `<div class="facts ufacts">${f('Heute', usd(u.cost.heute), lauf(u.runs.heute))}${f('7 Tage', usd(u.cost.t7), lauf(u.runs.t7))}${f('30 Tage', usd(u.cost.t30), lauf(u.runs.t30))}`
    + `${f('Ø je Lauf', u.avg == null ? '–' : usd(u.avg), u.models.length ? esc(mdl(u.models)) : 'noch kein Lauf')}${f('Seit Messbeginn', usd(u.cost.gesamt), lauf(u.runsGesamt))}</div>`;
}
/* Farben je Agent (zusätzlich steht der Name immer im Diagramm, Farbe ist nie das einzige Zeichen) */
const AG_COLOR = { server:'#38E1FF', kontext:'#8B7CFF', pruefer:'#FFB547', dsgvo:'#34F0C2', social:'#FF7AB6', du:'rgba(190,200,230,.42)', sonst:'rgba(190,200,230,.24)' };
const PERIODS = [['heute', 'Heute'], ['t7', '7 Tage'], ['t30', '30 Tage']];
const usdK = (v) => v >= 100 ? '$' + Math.round(v) : v >= 10 ? '$' + v.toFixed(0) : '$' + v.toFixed(2).replace('.', ',');

/* Fortschrittsbalken: Verbrauch auf diesem Server im Vergleich zum Bezugswert je Zeitraum.
   focus = Agenten-Kennung: nur dessen Anteil farbig, der Rest blass; ohne focus: gestapelt nach Agent. */
function usageBars(U, focus) {
  if (!U || !U.rows) return '';
  const B = U.budget || {}, order = ['server', 'kontext', 'pruefer', 'dsgvo', 'social', 'du', 'sonst'];
  const rows = order.map((id) => U.rows.find((r) => r.id === id)).filter(Boolean);
  const bar = ([k, label]) => {
    const total = rows.reduce((x, r) => x + r.cost[k], 0), ref = B[k] > 0 ? B[k] : null;
    const segs = rows.map((r) => ({ r, c: r.cost[k] })).filter((x) => x.c > 0);
    const mine = focus ? (rows.find((r) => r.id === focus) || { cost: { [k]: 0 } }).cost[k] : total;
    const scale = ref || total || 1, over = ref && total > ref;
    const html = !ref ? '' : segs.map(({ r, c }) => `<i title="${esc(r.name)}: ${usd(c)}" style="width:${(100 * c / scale / (over ? total / ref : 1)).toFixed(2)}%;background:${focus && r.id !== focus ? 'rgba(190,200,230,.18)' : AG_COLOR[r.id]}"></i>`).join('');
    const txt = ref ? `${pct(mine / ref)} <span>von ${usd(ref)}</span>` : `${usd(mine)} <span>Bezugswert fehlt</span>`;
    return `<div class="ubar${over ? ' over' : ''}${ref ? '' : ' noref'}"><span class="ul">${label}</span><span class="ut" role="img" aria-label="${esc(label)}: ${esc(txt.replace(/<[^>]+>/g, ''))}">${html}</span><b>${txt}</b></div>`;
  };
  const noRef = PERIODS.every(([k]) => !(B[k] > 0));
  return `<div class="ubars">${PERIODS.map(bar).join('')}</div>`
    + `<div class="det">${noRef ? '<b>Bezugswert noch nicht festgelegt:</b> Die Balken füllen sich, sobald ein Wert gesetzt ist. Am einfachsten kalibrieren: auf claude.ai → Einstellungen → Nutzung den Prozentwert ablesen und <code>node /opt/nestua/ops/leitstand/usage.mjs --kalibrieren t7 &lt;Prozent&gt;</code> ausführen (oder <code>--referenz t7 &lt;Dollar&gt;</code>). '
      : `Bezugswerte gesetzt ${esc(B.gesetzt || '')}${B.quelle ? ' (' + esc(B.quelle) + ')' : ''}. `}Der Bezugswert ist eine eigene Schätzung in Dollar, kein offizieller Wert von Anthropic. Gezählt wird nur, was auf diesem Server gemessen wurde: Nutzung am PC, am Handy und in claude.ai zählt beim echten Kontingent mit, fehlt hier aber.</div>`;
}

/* Liniendiagramm der Kosten je Tag (SVG, ohne Bibliothek). mode: 'tag' oder 'summe'. */
function usageChart(U, ids, mode) {
  if (!U || !U.days || !U.rows) return '';
  const rows = ids.map((id) => U.rows.find((r) => r.id === id)).filter(Boolean);
  const n = U.days.length;
  // linker Rand: erster Tag mit Daten (in irgendeiner Zeile), mindestens 7 Tage Breite
  const first = Math.max(0, Math.min(U.rows.reduce((m, r) => { const i = r.daily.findIndex((v) => v > 0); return i >= 0 && i < m ? i : m; }, n), n - 7));
  const idx = Array.from({ length: n - first }, (_, i) => first + i), m = idx.length;
  const series = rows.map((r) => { let acc = 0; return { r, v: idx.map((i) => { acc += r.daily[i]; return mode === 'summe' ? acc : r.daily[i]; }) }; });
  const W = 720, H = 230, L = 52, R = 16, T = 14, Bt = 30, pw = W - L - R, ph = H - T - Bt;
  const maxV = Math.max(0.01, ...series.flatMap((s) => s.v)), top = (() => { const e = Math.pow(10, Math.floor(Math.log10(maxV))); const f = maxV / e; return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * e; })();
  const x = (i) => L + (m === 1 ? pw / 2 : pw * i / (m - 1)), y = (v) => T + ph - ph * v / top;
  const grid = [0, 0.5, 1].map((f) => `<line x1="${L}" x2="${W - R}" y1="${y(top * f).toFixed(1)}" y2="${y(top * f).toFixed(1)}" class="gl"/><text x="${L - 8}" y="${(y(top * f) + 4).toFixed(1)}" class="gt" text-anchor="end">${usdK(top * f)}</text>`).join('');
  const step = Math.max(1, Math.round(m / 6)), xl = idx.map((di, i) => (i % step === 0 || i === m - 1 ? `<text x="${x(i).toFixed(1)}" y="${H - 8}" class="gt" text-anchor="middle">${dm(U.days[di]).replace(/\.$/, '')}</text>` : '')).join('');
  const one = series.length === 1;
  const paths = series.map((s) => {
    const pts = s.v.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`), c = AG_COLOR[s.r.id] || '#8B7CFF';
    const area = one ? `<path d="M${x(0).toFixed(1)},${y(0).toFixed(1)} L${pts.join(' L')} L${x(m - 1).toFixed(1)},${y(0).toFixed(1)} Z" fill="${c}" opacity=".13"/>` : '';
    const dots = s.v.map((v, i) => (v > 0 && (mode === 'tag' || v !== (s.v[i - 1] || 0)) ? `<circle cx="${x(i).toFixed(1)}" cy="${y(v).toFixed(1)}" r="3.2" fill="${c}"><title>${esc(s.r.name)}, ${dm(U.days[idx[i]])}: ${usd(v)}${mode === 'summe' ? ' (summiert)' : ''}</title></circle>` : '')).join('');
    return `${area}<path d="M${pts.join(' L')}" fill="none" stroke="${c}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>${dots}`;
  }).join('');
  const summary = series.map((s) => `${s.r.name} ${usd(s.r.daily.slice(first).reduce((a, b) => a + b, 0))}`).join(', ');
  const legend = series.length > 1 ? `<div class="uleg">${series.map((s) => `<span><i style="background:${AG_COLOR[s.r.id]}"></i>${esc(s.r.name)}<b>${usd(s.r.daily.slice(first).reduce((a, b) => a + b, 0))}</b></span>`).join('')}</div>` : '';
  return `<svg viewBox="0 0 ${W} ${H}" class="uc" role="img" aria-label="Verbrauch ${mode === 'summe' ? 'summiert' : 'pro Tag'} seit ${dm(U.days[first])}: ${esc(summary)}" preserveAspectRatio="xMidYMid meet">${grid}${xl}${paths}</svg>${legend}`;
}
function chartBlock(U, ids, mode, title) {
  return `<div class="uchead"><h3>${esc(title)}</h3><span class="umode" role="group" aria-label="Darstellung"><button type="button" data-m="tag" aria-pressed="${mode !== 'summe'}">Pro Tag</button><button type="button" data-m="summe" aria-pressed="${mode === 'summe'}">Summiert</button></span></div>`
    + `<div class="uchart" data-ids="${esc(ids.join(','))}">${usageChart(U, ids, mode)}</div>`;
}
function usageBox(M, mode = 'tag') {
  const U = M.usage; if (!U || !U.rows || !U.rows.length) return '';
  const ids = M.agents.map((a) => a.id), ag = ids.map((id) => U.rows.find((r) => r.id === id)).filter(Boolean);
  const top = Math.max(0.01, ...ag.map((r) => r.cost.t30)), du = U.rows.find((r) => r.id === 'du'), so = U.rows.find((r) => r.id === 'sonst');
  const row = (r) => `<div class="urow"><span class="un">${esc(r.name)}</span><span class="ub"><i style="width:${Math.max(r.cost.t30 ? 2 : 0, Math.round(100 * r.cost.t30 / top))}%"></i></span>`
    + `<b>${usd(r.cost.t30)}</b><span class="um">${r.runs.t30 ? lauf(r.runs.t30) : 'kein Lauf'}${r.avg == null ? '' : ' · Ø ' + usd(r.avg)}</span></div>`;
  const share = U.sum30 ? U.sumAgents30 / U.sum30 : 0;
  return `<section class="box glass ubox"><div class="bh"><h2 class="h">Verbrauch der Agenten</h2><span class="pill s-plan"><i></i>Schätzung zu API-Listenpreisen</span></div>
    <div class="grp" style="margin-top:0">Verbrauch im Vergleich zum Bezugswert (alles auf diesem Server)</div>${usageBars(U, null)}
    ${chartBlock(U, ids, mode, 'Verlauf je Agent')}
    <div class="grp">Die letzten 30 Tage je Agent</div>
    <div class="ulist">${ag.map(row).join('')}</div>
    <div class="usum"><div><small>Agenten gesamt</small><b>${usd(U.sumAgents30)}</b></div>
      <div><small>Du, interaktiv</small><b>${usd(du ? du.cost.t30 : 0)}</b></div>
      <div><small>Anteil der Agenten</small><b>${pct(share)}</b></div>
      <div><small>Heute / 7 Tage (alles)</small><b>${usd(U.sumHeute)} / ${usd(U.sum7)}</b></div></div>
    <div class="det">Kosten geschätzt zu API-Listenpreisen (Claude Code, je Sitzung), keine Abrechnung. Dein Abo-Kontingent (5-Stunden- und Wochenlimit) ist von hier aus nicht lesbar: dort zeigt <b>claude.ai → Einstellungen → Nutzung</b> den echten Stand.
      Gemessen seit ${esc(dm(U.since).replace(/\.$/, ''))}. ${so && so.runs.t30 ? `Sonstige Hilfsläufe: ${usd(so.cost.t30)}. ` : ''}Quelle: Transkripte unter ~/.claude/projects, gespeichert in /opt/nestua/ops/leitstand/usage.json.</div></section>`;
}

/* ---------- Daten aufbereiten (reine Funktion, auch in Node testbar) ---------- */
function model(D) {
  const uRow = (id) => ((D.usage && D.usage.rows) || []).find((r) => r.id === id) || null;
  const byId = Object.fromEntries(D.nodes.map((n) => [n.id, n]));
  const chk = (id) => D.checks[id] || { status:'warn', value:'?', label:id, detail:'Prüfung fehlt im Scan' };
  const T = D.tasks || {};
  const du = (T.du || []).map((t) => ({ ...t, who:'du' })), cl = (T.claude || []).map((t) => ({ ...t, who:'Claude' }));
  const agents = D.nodes.filter((n) => n.kind === 'agent').map((n) => {
    const run = n.run || {}, last = run.last || null;
    let st = n.status || 'plan', state = n.value || 'geplant';
    if (st !== 'plan' && last && REP[last.status] && RANK[REP[last.status]] > RANK[st]) { st = REP[last.status]; state = st === 'bad' ? 'Fehler' : 'Hinweise'; }
    if (st !== 'plan' && run.overdue && RANK[st] < RANK.warn) { st = 'warn'; state = 'Lauf fehlt'; }
    const flow = (n.flow || []).map((f) => {
      const node = f.node ? byId[f.node] : null, c = f.check ? chk(f.check) : null;
      const s = f.plan ? 'plan' : node ? (node.status || 'plan') : c ? c.status : 'plan';
      const val = node ? (node.status === 'plan' ? '' : node.value || '') : c ? c.value : '';
      const src = c || (node && node.check ? chk(node.check) : null);
      return { g:f.g, name:f.name || node?.name || c?.label || '?', sub:f.sub || node?.sub || node?.note || '', icon:f.icon || node?.icon || 'pulse', st:s, val,
        detail:src && src.status !== 'ok' ? src.detail || '' : '' };
    });
    const guard = n.guard && byId[n.guard] ? { name:byId[n.guard].name, sub:byId[n.guard].sub || '', st:byId[n.guard].status || 'plan', val:byId[n.guard].value || '' } : null;
    return { id:n.id, name:n.name, sub:n.sub || '', icon:n.icon, phase:n.phase || '', st, state, progress:n.progress || null, last, next:run.next || null, runText:n.runText || '', overdue:!!run.overdue,
      channel:n.channel || '', info:n.info || [], zust:n.zust || [], flow, guard, usage:uRow(n.id),
      builds:(n.builds || []).map((b) => ({ id:b, ...chk(b) })), tasks:[...du, ...cl].filter((t) => t.agent === n.id) };
  });
  const sys = (D.system.ids || []).map((id) => ({ id, ...chk(id) }));
  const tools = D.nodes.filter((n) => n.kind === 'tool').map((n) => ({ name:n.name, st:n.status || 'plan', val:n.value || '' }));
  const today = berlinDay(new Date(D.generated));
  const done = T.done || [];
  const active = agents.filter((a) => a.st !== 'plan');
  const nexts = agents.filter((a) => a.next).sort((a, b) => `${a.next.datum} ${a.next.zeit}`.localeCompare(`${b.next.datum} ${b.next.zeit}`));
  return { usage:D.usage || null, agents, sys, tools, du, cl, done, doneToday:done.filter((t) => t.date === today), active,
    agBad:agents.filter((a) => a.st === 'bad'), agWarn:agents.filter((a) => a.st === 'warn'),
    sysBad:sys.filter((c) => c.status === 'bad'), sysWarn:sys.filter((c) => c.status === 'warn'), next:nexts[0] || null, tasksFile:T.fehlt ? 'fehlt' : T.updated };
}
if (typeof document === 'undefined') { if (typeof module !== 'undefined') module.exports = { model, usageBox, usageLine, usageFacts, usageBars, usageChart, chartBlock }; return; }

/* ---------- Ansichten ---------- */
const home = document.getElementById('vHome'), agentV = document.getElementById('vAgent');
const stateEl = document.getElementById('state'), standEl = document.getElementById('stand');
let D = null, M = null, current = null, busy = false, homeScroll = 0, uMode = 'tag';
const reduce = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const EASE = 'cubic-bezier(.2,.8,.2,1)';
const segs = (n, on, cls = (i) => '') => `<span class="segs">${Array.from({ length:n }, (_, i) => `<i class="${i < on ? cls(i) : 'off'}"></i>`).join('')}</span>`;
const runTxt = (r) => r ? `${dm(r.datum)}, ${r.zeit}` : '';
const taskRow = (t, withAgent) => {
  const a = withAgent && t.agent ? M.agents.find((x) => x.id === t.agent) : null;
  const sub = [a && a.name, t.where].filter(Boolean).join(' · ');
  return `<div class="li ${t.who === 'du' ? 's-warn' : 's-build'}"><i></i><span class="lt">${esc(t.t)}${sub ? `<span class="ag">${esc(sub)}</span>` : ''}</span><span class="who">${t.who}</span></div>`;
};

function renderHome() {
  const m = M, n = m.agents.length, bad = m.agBad.length + m.sysBad.length, warn = m.agWarn.length + m.sysWarn.length;
  const worst = bad ? 'bad' : warn ? 'warn' : 'ok';
  const problems = [...m.agBad, ...m.agWarn].map((a) => a.name).concat([...m.sysBad, ...m.sysWarn].map((c) => c.label));
  const lead = (bad || warn ? `Zu klären: ${problems.join(', ')}. ` : 'Alles ruhig. ') + `${m.active.length} von ${n} Agenten laufen, ${n - m.active.length} sind geplant.`;
  const card = (a) => {
    const p = a.st === 'plan', lastSt = a.last ? REP[a.last.status] : '';
    return `<button class="acard s-${a.st}" data-id="${esc(a.id)}" aria-label="${esc(a.name)} öffnen, ${esc(a.state)}">
      <span class="ahd"><span class="ic">${svg(a.icon)}</span><span class="t"><b>${esc(a.name)}</b><span>${esc(a.sub)}</span></span><span class="pill"><i></i>${esc(a.state)}</span></span>
      <dl class="met"><div><dt>Letzter Lauf</dt><dd class="${a.last ? (lastSt === 'ok' ? '' : lastSt) : 'mut'}">${a.last ? runTxt(a.last) : 'noch keiner'}</dd></div>
        <div><dt>Nächster Lauf</dt><dd class="${a.next ? (a.overdue ? 'warn' : '') : a.runText ? '' : 'mut'}">${a.next ? runTxt(a.next) : esc(a.runText || 'nicht geplant')}</dd></div>
        <div><dt>Befunde</dt><dd class="${a.last ? (a.last.befunde ? lastSt : '') : 'mut'}">${a.last ? a.last.befunde : '–'}</dd></div></dl>
      ${usageLine(a)}
      <span class="build ${a.progress ? (a.progress[0] === a.progress[1] ? 's-ok' : 's-build') : 's-plan'}"><span class="row"><span>Aufbau</span><span>${a.progress ? `${a.progress[0]} von ${a.progress[1]} Bausteinen` : 'noch nicht begonnen'}</span></span>${segs(a.progress ? a.progress[1] : 7, a.progress ? a.progress[0] : 0)}</span>
      <span class="links"><span class="dots">${a.flow.map((l) => `<i class="s-${l.st}"></i>`).join('')}</span><span class="lt">${a.flow.length} Verknüpfungen${a.channel ? ` · Discord ${esc(a.channel)}` : ''}</span><span class="go">Öffnen${svg('arrow')}</span></span>
    </button>`;
  };
  const dots = m.agents.map((a, i) => { const g = (-90 + i * 360 / n) * Math.PI / 180, x = Math.cos(g) * 98, y = Math.sin(g) * 98, c = COLOR[a.st];
    return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="7" fill="${a.st === 'plan' ? '#0C0E22' : c}" stroke="${c}" stroke-width="1.6"/>`; }).join('');
  const failing = m.sys.filter((c) => c.status !== 'ok');
  home.innerHTML = `
    <section class="hero glass s-${worst}">
      <div class="mini"><svg viewBox="-130 -130 260 260" aria-hidden="true">
        <defs><radialGradient id="mc"><stop offset="0" stop-color="#8B7CFF" stop-opacity=".5"/><stop offset="1" stop-color="#5B4BD6" stop-opacity="0"/></radialGradient>
        <radialGradient id="md"><stop offset="0" stop-color="#1B1840"/><stop offset="1" stop-color="#0C0E22"/></radialGradient>
        <linearGradient id="ms" x1="0" x2="1"><stop offset="0" stop-color="#8B7CFF" stop-opacity="0"/><stop offset="1" stop-color="#8B7CFF" stop-opacity=".5"/></linearGradient></defs>
        <circle r="125" fill="url(#mc)"/>
        <g class="spin" style="--d:80s"><circle r="112" fill="none" stroke="#38E1FF" stroke-opacity=".35" stroke-dasharray="26 6 3 6"/></g>
        <g class="spin rev" style="--d:120s"><circle r="98" fill="none" stroke="#8B7CFF" stroke-opacity=".45" stroke-dasharray="1 4"/></g>
        ${dots}
        <circle r="70" fill="url(#md)" stroke="${COLOR[worst === 'ok' ? 'build' : worst]}" stroke-opacity=".75" stroke-width="1.3"/>
        <g class="spin" style="--d:5s"><circle r="70" fill="none"/><path d="M0 0 L70 0 A70 70 0 0 0 53.6 -45 Z" fill="url(#ms)"/></g>
      </svg><div class="lbl"><b>${m.active.length}/${n}</b><span>Agenten aktiv</span></div></div>
      <div class="sum"><h1>Agenten-Kern</h1><p class="lead">${esc(lead)}</p>
        <div class="facts">
          <div class="fact s-${bad ? 'bad' : warn ? 'warn' : 'ok'}"><small>Fehler und Hinweise</small><b>${bad} · ${warn}</b><span>${problems.length ? esc(problems.join(', ')) : 'nichts offen'}</span></div>
          <div class="fact s-${m.sysBad.length ? 'bad' : m.sysWarn.length ? 'warn' : 'ok'}"><small>System</small><b>${m.sys.length - failing.length}/${m.sys.length}</b><span class="segs">${m.sys.map((c) => `<i class="s-${c.status}"></i>`).join('')}</span></div>
          <div class="fact s-warn"><small>Braucht dich</small><b>${m.du.length}</b><span>offene Schritte</span></div>
          <div class="fact"><small>Nächster Lauf</small><b>${m.next ? esc(m.next.next.zeit) : '–'}</b><span>${m.next ? `${esc(m.next.name)}, ${dm(m.next.next.datum)}` : 'kein Lauf geplant'}</span></div>
        </div></div>
    </section>
    <div><h2 class="h" style="margin-bottom:10px">Agenten</h2><div class="agents">${m.agents.map(card).join('')}</div></div>
    ${usageBox(m, uMode)}
    <div class="lower">
      <section class="box glass s-warn"><div class="bh"><h2 class="h">Braucht dich</h2><span class="cnt">${m.du.length}</span></div>
        ${m.du.map((t) => taskRow(t, true)).join('') || '<div class="empty">Nichts offen.</div>'}
        <div class="grp">Claude als Nächstes</div>${m.cl.map((t) => taskRow(t, true)).join('') || '<div class="empty">Nichts offen.</div>'}
        <div class="det">Liste: /opt/nestua/ops/leitstand/aufgaben.json, Stand ${esc(m.tasksFile || '?')}</div></section>
      <section class="box glass s-${m.sysBad.length ? 'bad' : m.sysWarn.length ? 'warn' : 'ok'}"><div class="bh"><h2 class="h">Systemprüfungen</h2><span class="pill"><i></i>${m.sysBad.length ? m.sysBad.length + ' Fehler' : m.sysWarn.length ? m.sysWarn.length + (m.sysWarn.length === 1 ? ' Hinweis' : ' Hinweise') : 'alles grün'}</span></div>
        <div class="checks">${m.sys.map((c) => `<div class="s-${c.status}" title="${esc(c.detail)}"><i></i>${esc(c.label)}<span>${esc(c.value)}</span></div>`).join('')}</div>
        ${failing.map((c) => `<div class="det s-${c.status}"><b>${esc(c.label)}:</b> ${esc(c.detail)}</div>`).join('')}
        <div class="grp">Werkzeuge ohne KI</div><div class="tools">${m.tools.map((t) => `<span class="s-${t.st}"><i></i>${esc(t.name)}<em>${esc(t.val)}</em></span>`).join('')}</div>
        <div class="grp">Erledigt heute: ${m.doneToday.length} ${m.doneToday.length === 1 ? 'Schritt' : 'Schritte'}</div>
        ${[...m.doneToday].reverse().slice(0, 4).map((t) => `<div class="li s-ok"><i></i><span class="lt">${esc(t.t)}</span></div>`).join('')}
        <div class="det">Gemessen vom Leitstand-Scan, ${esc(D.generatedText)} Uhr, in ${D.durationMs} ms.</div></section>
    </div>`;
}

function renderAgent(id) {
  const a = M.agents.find((x) => x.id === id); if (!a) return false;
  const p = a.st === 'plan', ins = a.flow.filter((l) => l.g === 'in'), outs = a.flow.filter((l) => l.g !== 'in');
  const reads = outs.filter((l) => l.g !== 'out'), writes = outs.filter((l) => l.g === 'out');
  let k = 0;
  const nd = (l, cls) => `<div class="nd s-${l.st} ${cls}" style="--k:${k++}" data-st="${l.st}"><span class="ic">${svg(l.icon)}</span><span class="tx"><b>${esc(l.name)}</b>${l.sub ? `<span>${esc(l.sub)}</span>` : ''}${l.detail ? `<em>${esc(l.detail)}</em>` : ''}</span>${l.val ? `<span class="val">${esc(l.val)}</span>` : ''}<span class="dot"></span></div>`;
  const lastSt = a.last ? REP[a.last.status] || 'warn' : 'plan';
  const readHead = reads.some((l) => l.g === 'prüft') ? (reads.some((l) => l.g === 'liest') ? 'prüft und liest' : 'prüft') : 'liest';
  agentV.innerHTML = `
    <div class="ahead s-${a.st}">
      <button class="back" id="back">${svg('back')}Alle Agenten</button>
      <span class="ic">${svg(a.icon)}</span>
      <div><h1>${esc(a.name)}</h1><div class="sub">${esc(a.sub)}${a.phase ? ' · ' + esc(a.phase) : ''} <span class="pill"><i></i>${esc(a.state)}</span></div></div>
      <div class="runs"><div><small>Letzter Lauf</small><b class="${a.last && lastSt !== 'ok' ? lastSt : ''}">${a.last ? runTxt(a.last) : 'noch keiner'}</b></div>
        <div><small>Nächster Lauf</small><b class="${a.overdue ? 'warn' : ''}">${a.next ? runTxt(a.next) : esc(a.runText || 'nicht geplant')}</b></div>
        <div><small>Befunde</small><b class="${a.last && a.last.befunde ? lastSt : ''}">${a.last ? a.last.befunde : '–'}</b></div></div>
    </div>
    <section class="flowbox glass"><div class="bh"><h2 class="h">Verknüpfungen</h2><span>${a.flow.length} insgesamt, Fluss von links nach rechts</span></div>
      <div class="flow" id="flow"><svg class="wires" id="wires" aria-hidden="true"></svg>
        <div class="col"><span class="ch">Auslöser</span>${ins.map((l) => nd(l, 'src')).join('') || '<span class="empty">keiner</span>'}</div>
        <div class="col"><span class="ch">Agent</span><div class="nd hub s-${a.st}" style="--k:${k++}" id="hub"><span class="ic">${svg(a.icon)}</span><b>${esc(a.name)}</b><span class="pill"><i></i>${esc(a.state)}</span></div>
          ${a.guard ? `<span class="guard s-${a.guard.st}">${svg('shield')}${esc(a.guard.name)} ${esc(a.guard.val)}${a.guard.sub ? ': ' + esc(a.guard.sub) : ''}</span>` : ''}</div>
        <div class="col">${reads.length ? `<span class="ch">${readHead}</span>${reads.map((l) => nd(l, 'dst')).join('')}` : ''}
          ${writes.length ? `<span class="ch" style="margin-top:${reads.length ? 8 : 0}px">schreibt und meldet</span>${writes.map((l) => nd(l, 'dst')).join('')}` : ''}</div>
      </div></section>
    <div class="dgrid s-${a.st}">
      <section class="box glass s-${lastSt}"><div class="bh"><h2 class="h">Letzter Lauf</h2></div>
        ${a.overdue ? `<div class="warnline">Der geplante Lauf um ${esc(a.next?.zeit || '')} hat keinen Bericht hinterlassen. Log: /opt/nestua/ops/reports/cron-last.log</div>` : ''}
        ${a.last ? `<div class="rep"><span class="when">${runTxt(a.last)} Uhr <span class="pill"><i></i>${esc(a.last.status)}</span></span><span>${esc(a.last.fazit)}</span>
          ${a.last.befundListe.length ? a.last.befundListe.map((b) => `<div class="li s-${REP[b.status] || 'warn'}"><i></i><span class="lt">${esc(b.label)}: ${esc(b.value)}</span></div>`).join('') : ''}
          ${a.last.ki ? `<div class="ki"><b>KI-Einschätzung (nur Vorschlag)</b>${esc(a.last.ki)}</div>` : ''}<span class="mono">${esc(a.last.file)}</span></div>`
          : `<div class="empty">Noch kein Lauf.${p ? ` Der Agent ist ${esc(a.state)}.` : ''}</div>`}</section>
      <section class="box glass"><div class="bh"><h2 class="h">Steckbrief</h2></div>
        <dl class="kv">${a.info.map(([x, v]) => `<dt>${esc(x)}</dt><dd>${esc(v)}</dd>`).join('')}${a.channel ? `<dt>Discord</dt><dd>${esc(a.channel)}</dd>` : ''}</dl>
        ${a.zust.length ? `<div class="chips">${a.zust.map((z) => `<span>${esc(z)}</span>`).join('')}</div>` : ''}</section>
      <section class="box glass"><div class="bh"><h2 class="h">Aufbau und Aufgaben</h2></div>
        ${a.builds.length ? `<div class="bl">${a.builds.map((b) => `<div class="s-${b.status}" title="${esc(b.detail)}"><i></i>${esc(b.label)}<span>${esc(b.value)}</span></div>${b.status !== 'ok' ? `<div class="det">${esc(b.detail)}</div>` : ''}`).join('')}</div>` : '<div class="empty" style="margin-bottom:10px">Aufbau noch nicht begonnen.</div>'}
        ${a.tasks.length ? a.tasks.map((t) => taskRow(t, false)).join('') : '<div class="empty">Keine offenen Aufgaben.</div>'}</section>
      <section class="box glass ubox1"><div class="bh"><h2 class="h">Verbrauch</h2><span class="pill s-plan"><i></i>Schätzung zu API-Listenpreisen</span></div>
        <div class="grp" style="margin-top:0">Anteil dieses Agenten im Vergleich zum Bezugswert</div>${usageBars(M.usage, a.id)}
        ${usageFacts(a)}
        ${chartBlock(M.usage, [a.id], uMode, 'Verlauf')}
        <div class="det">Aus den Sitzungs-Transkripten von Claude Code. Das Abo-Kontingent selbst zeigt claude.ai → Einstellungen → Nutzung.</div></section>
    </div>`;
  document.getElementById('back').onclick = () => { location.hash = ''; };
  return true;
}

/* Leitungen: waagerecht auf breiten, senkrecht auf schmalen Bildschirmen */
function drawWires() {
  const flow = document.getElementById('flow'), hubEl = document.getElementById('hub'); if (!flow || !hubEl || agentV.hidden) return;
  const W = document.getElementById('wires'), fr = flow.getBoundingClientRect();
  const vertical = getComputedStyle(flow).gridTemplateColumns.split(' ').length < 2;
  const rel = (r) => ({ l:r.left - fr.left, r:r.right - fr.left, t:r.top - fr.top, b:r.bottom - fr.top, cx:r.left - fr.left + r.width / 2, cy:r.top - fr.top + r.height / 2 });
  const H = rel(hubEl.getBoundingClientRect()); let out = '';
  flow.querySelectorAll('.nd.src,.nd.dst').forEach((el) => {
    const n = rel(el.getBoundingClientRect()), st = el.dataset.st, src = el.classList.contains('src'), k = el.style.getPropertyValue('--k');
    let a, b;
    if (!vertical) { a = src ? { x:n.r, y:n.cy } : { x:H.r, y:H.cy }; b = src ? { x:H.l, y:H.cy } : { x:n.l, y:n.cy }; }
    else { a = src ? { x:n.cx, y:n.b } : { x:H.cx, y:H.b }; b = src ? { x:H.cx, y:H.t } : { x:n.l - 8, y:n.cy }; }
    const d = !vertical ? `M${a.x} ${a.y} C${(a.x + b.x) / 2} ${a.y} ${(a.x + b.x) / 2} ${b.y} ${b.x} ${b.y}`
      : src ? `M${a.x} ${a.y} L${b.x} ${b.y}` : `M${a.x} ${a.y} C${a.x} ${b.y} ${a.x} ${b.y} ${b.x} ${b.y}`;
    const len = Math.round(Math.hypot(b.x - a.x, b.y - a.y) * 1.3) + 20;
    out += `<path class="base ${st}" d="${d}" style="--k:${k};--len:${len}"/>` + (st === 'plan' ? '' : `<path class="flowdot ${st}" d="${d}"/>`);
  });
  W.innerHTML = out;
}
let rz; addEventListener('resize', () => { clearTimeout(rz); rz = setTimeout(() => { if (current) drawWires(); }, 120); });

/* Aufklappen und Zurück */
function enter() { agentV.classList.remove('enter'); void agentV.offsetWidth; agentV.classList.add('enter'); }
function sheetFrom(card) {
  const sh = document.createElement('div');
  sh.className = 'sheet ' + ([...card.classList].find((c) => c.startsWith('s-')) || '');
  sh.innerHTML = card.querySelector('.ahd').outerHTML;
  document.body.appendChild(sh); return sh;
}
const box = (r) => ({ left:r.left + 'px', top:r.top + 'px', width:r.width + 'px', height:r.height + 'px', borderRadius:'14px' });
const full = () => ({ left:'0px', top:'0px', width:innerWidth + 'px', height:innerHeight + 'px', borderRadius:'0px' });

async function openAgent(id, animate) {
  if (busy || !M) return; busy = true;
  const card = home.querySelector(`.acard[data-id="${CSS.escape(id)}"]`);
  if (!home.hidden) homeScroll = scrollY;
  const show = () => { if (!renderAgent(id)) { current = null; location.hash = ''; return false; } current = id; home.hidden = true; agentV.hidden = false; scrollTo(0, 0); enter(); requestAnimationFrame(drawWires); return true; };
  try {
    if (!animate || reduce() || !card || home.hidden) { show(); return; }
    const sh = sheetFrom(card), r = card.getBoundingClientRect();
    Object.assign(sh.style, box(r));
    const fade = home.animate([{ opacity:1, transform:'scale(1)' }, { opacity:.25, transform:'scale(.98)' }], { duration:420, easing:EASE, fill:'forwards' });
    await sh.animate([box(r), full()], { duration:520, easing:EASE, fill:'forwards' }).finished;
    fade.cancel(); show();
    sh.animate([{ opacity:1 }, { opacity:0 }], { duration:280, easing:'ease-out', fill:'forwards' }).finished.then(() => sh.remove());
  } finally { busy = false; }
}
async function goHome() {
  if (busy) return; busy = true; const id = current; current = null;
  try {
    renderHome(); home.hidden = false; agentV.hidden = true; scrollTo(0, homeScroll);
    const card = home.querySelector(`.acard[data-id="${CSS.escape(id || '')}"]`);
    if (reduce() || !card) return;
    const r = card.getBoundingClientRect(), sh = sheetFrom(card);
    Object.assign(sh.style, full()); card.style.visibility = 'hidden';
    home.animate([{ opacity:.25, transform:'scale(.98)' }, { opacity:1, transform:'scale(1)' }], { duration:460, easing:EASE });
    await sh.animate([full(), box(r)], { duration:460, easing:EASE, fill:'forwards' }).finished;
    card.style.visibility = '';
    await sh.animate([{ opacity:1 }, { opacity:0 }], { duration:160, fill:'forwards' }).finished; sh.remove();
  } finally { busy = false; }
}
function route(animate) {
  if (!M) return;
  const id = decodeURIComponent(location.hash.slice(1));
  if (id && M.agents.some((a) => a.id === id)) { if (current !== id) openAgent(id, animate); }
  else if (current) goHome();
}
home.addEventListener('click', (e) => { const c = e.target.closest('.acard'); if (c) location.hash = c.dataset.id; });
/* Diagramm umschalten (Pro Tag / Summiert): zeichnet nur die Diagramme neu, merkt sich die Wahl für beide Ansichten */
document.addEventListener('click', (e) => {
  const b = e.target.closest('.umode button'); if (!b || !M) return;
  uMode = b.dataset.m;
  document.querySelectorAll('.uchart').forEach((el) => { el.innerHTML = usageChart(M.usage, el.dataset.ids.split(','), uMode); });
  document.querySelectorAll('.umode button').forEach((x) => x.setAttribute('aria-pressed', String(x.dataset.m === uMode)));
});
addEventListener('hashchange', () => route(true));

/* ---------- Daten laden ---------- */
function showState(title, text) { stateEl.hidden = !title; if (title) stateEl.innerHTML = `<b>${esc(title)}</b><div>${text}</div>`; }
function updateHud() {
  const age = (Date.now() - Date.parse(D.generated)) / 60000;
  standEl.innerHTML = `Stand ${esc(D.generatedText)}. Nur lesend.` + (age > STALE_MIN ? `<span class="stale">${Math.round(age)} Min alt</span>` : '');
}
async function refresh(first) {
  let next;
  try {
    const r = await fetch('data/leitstand.json', { cache:'no-store' });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    next = await r.json();
  } catch (e) {
    if (!D) showState('Keine Daten', `Der Leitstand findet <code>data/leitstand.json</code> nicht. Läuft der Scan? <code>node /opt/nestua/ops/leitstand/scan.mjs</code><br>(${esc(e.message)})`);
    else standEl.innerHTML = `Stand ${esc(D.generatedText)}. <span class="stale">Daten nicht erreichbar</span>`;
    return;
  }
  showState(null);
  const changed = !D || D.generated !== next.generated;
  if (changed) {
    D = next;
    try { M = model(D); } catch (e) { showState('Daten unlesbar', `data/leitstand.json passt nicht zur Oberfläche.<br><code>${esc(e.message)}</code>`); return; }
    if (first) { renderHome(); route(false); }
    else if (!busy) { if (current) { renderAgent(current); requestAnimationFrame(drawWires); } else { const y = scrollY; renderHome(); scrollTo(0, y); } }
  }
  updateHud();
}

const clk = document.getElementById('clk'), fmt = new Intl.DateTimeFormat('de-DE', { timeZone:'Europe/Berlin', hour:'2-digit', minute:'2-digit', second:'2-digit' });
clk.textContent = fmt.format(new Date());
setInterval(() => { clk.textContent = fmt.format(new Date()); if (D) updateHud(); }, 1000);
refresh(true);
setInterval(() => { if (!document.hidden) refresh(false); }, POLL_MS);
})();
