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

/* ---------- Daten aufbereiten (reine Funktion, auch in Node testbar) ---------- */
function model(D) {
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
    return { id:n.id, name:n.name, sub:n.sub || '', icon:n.icon, phase:n.phase || '', st, state, progress:n.progress || null, last, next:run.next || null, overdue:!!run.overdue,
      channel:n.channel || '', info:n.info || [], zust:n.zust || [], flow, guard,
      builds:(n.builds || []).map((b) => ({ id:b, ...chk(b) })), tasks:[...du, ...cl].filter((t) => t.agent === n.id) };
  });
  const sys = (D.system.ids || []).map((id) => ({ id, ...chk(id) }));
  const tools = D.nodes.filter((n) => n.kind === 'tool').map((n) => ({ name:n.name, st:n.status || 'plan', val:n.value || '' }));
  const today = berlinDay(new Date(D.generated));
  const done = T.done || [];
  const active = agents.filter((a) => a.st !== 'plan');
  const nexts = agents.filter((a) => a.next).sort((a, b) => `${a.next.datum} ${a.next.zeit}`.localeCompare(`${b.next.datum} ${b.next.zeit}`));
  return { agents, sys, tools, du, cl, done, doneToday:done.filter((t) => t.date === today), active,
    agBad:agents.filter((a) => a.st === 'bad'), agWarn:agents.filter((a) => a.st === 'warn'),
    sysBad:sys.filter((c) => c.status === 'bad'), sysWarn:sys.filter((c) => c.status === 'warn'), next:nexts[0] || null, tasksFile:T.fehlt ? 'fehlt' : T.updated };
}
if (typeof document === 'undefined') { if (typeof module !== 'undefined') module.exports = { model }; return; }

/* ---------- Ansichten ---------- */
const home = document.getElementById('vHome'), agentV = document.getElementById('vAgent');
const stateEl = document.getElementById('state'), standEl = document.getElementById('stand');
let D = null, M = null, current = null, busy = false, homeScroll = 0;
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
        <div><dt>Nächster Lauf</dt><dd class="${a.next ? (a.overdue ? 'warn' : '') : 'mut'}">${a.next ? runTxt(a.next) : 'nicht geplant'}</dd></div>
        <div><dt>Befunde</dt><dd class="${a.last ? (a.last.befunde ? lastSt : '') : 'mut'}">${a.last ? a.last.befunde : '–'}</dd></div></dl>
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
        <g class="spin" style="--d:5s"><path d="M0 0 L70 0 A70 70 0 0 0 53.6 -45 Z" fill="url(#ms)"/></g>
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
        <div><small>Nächster Lauf</small><b class="${a.overdue ? 'warn' : ''}">${a.next ? runTxt(a.next) : 'nicht geplant'}</b></div>
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
