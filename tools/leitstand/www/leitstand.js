// Nestua Leitstand: liest data/leitstand.json (vom Scan alle 5 Minuten) und zeichnet die Fläche.
// Nur lesend: keine Aktion löst etwas am Server aus. Anordnung und Ansicht merkt sich der Browser.
(() => {
const IC = {
  server:'<rect x="3" y="4" width="18" height="7" rx="2"/><rect x="3" y="13" width="18" height="7" rx="2"/><path d="M7 7.5h.01M7 16.5h.01"/>',
  cloud:'<path d="M7 18h10a4 4 0 0 0 .6-7.96A6 6 0 0 0 6.2 9.1 4.5 4.5 0 0 0 7 18z"/>',
  git:'<circle cx="6" cy="6" r="2.2"/><circle cx="6" cy="18" r="2.2"/><circle cx="18" cy="8" r="2.2"/><path d="M6 8.2v7.6M18 10.2c0 4-6 3.5-10.4 6.4"/>',
  shield:'<path d="M12 3 5 6v5c0 4.5 3 8.3 7 10 4-1.7 7-5.5 7-10V6l-7-3z"/>',
  chat:'<path d="M4 5h16v11H9l-5 4z"/>',
  db:'<ellipse cx="12" cy="5.5" rx="7.5" ry="2.5"/><path d="M4.5 5.5v13c0 1.4 3.4 2.5 7.5 2.5s7.5-1.1 7.5-2.5v-13M4.5 12c0 1.4 3.4 2.5 7.5 2.5s7.5-1.1 7.5-2.5"/>',
  box:'<path d="M3 7.5 12 3l9 4.5v9L12 21l-9-4.5z"/><path d="m3 7.5 9 4.5 9-4.5M12 12v9"/>',
  clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  file:'<path d="M14 3H6v18h12V7l-4-4z"/><path d="M14 3v4h4"/>',
  folder:'<path d="M3 6h6l2 2h10v11H3z"/>',
  bell:'<path d="M6 16V11a6 6 0 0 1 12 0v5l2 2H4z"/><path d="M10 20a2 2 0 0 0 4 0"/>',
  key:'<circle cx="8" cy="15" r="4"/><path d="m11 12 9-9M17 6l3 3"/>',
  user:'<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
  check:'<path d="M20 6 9 17l-5-5"/>',
  pulse:'<path d="M3 12h4l3-7 4 14 3-7h4"/>',
  book:'<path d="M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3z"/><path d="M5 17a3 3 0 0 1 3-3h11"/>',
  send:'<path d="M21 3 10 14M21 3l-7 18-4-7-7-4z"/>',
  hdd:'<rect x="3" y="13" width="18" height="7" rx="2"/><path d="M5 13 7.5 5h9L19 13M7 16.5h.01"/>',
  x:'<path d="M18 6 6 18M6 6l12 12"/>'
};
const svg = (n) => `<svg viewBox="0 0 24 24" aria-hidden="true">${IC[n] || IC.pulse}</svg>`;
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;' })[c]);
const WORD = { ok:'läuft', warn:'Hinweis', bad:'fehlt', plan:'geplant', build:'im Aufbau', flow:'aktiv' };
const TITLE = { core:'Agenten-Kern', system:'System', todo:'Braucht dich', done:'Erledigt', gate:'Freigabe' };
const KIND_ICON = { core:'pulse', system:'pulse', todo:'bell', done:'check', gate:'user' };
const NS = 'http://www.w3.org/2000/svg';
const KEY = 'nestua-leitstand-v2';
const POLL_MS = 15000, STALE_MIN = 12;

const stage = document.getElementById('stage'), world = document.getElementById('world');
const gEdges = document.getElementById('edges'), gParts = document.getElementById('parts'), coreG = document.getElementById('coreG');
const stateEl = document.getElementById('state'), standEl = document.getElementById('stand');
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

let D = null;                 // aktuelle Daten
let N = [], byId = {}, edges = [], parts = [];
let V = { x: 0, y: 0, s: 0.6 };
const saved = loadSaved();
const panels = [];

/* ---------- Speicher (nur dieser Browser) ---------- */
function loadSaved() { try { return JSON.parse(localStorage.getItem(KEY) || 'null') || {}; } catch (e) { return {}; } }
function save() { try { localStorage.setItem(KEY, JSON.stringify({ v: V, p: Object.fromEntries(N.map((n) => [n.id, [n.x, n.y]])) })); } catch (e) {} }

/* ---------- Inhalte ---------- */
const chk = (id) => (D.checks[id] || { status: 'warn', value: '?', label: id, detail: 'Prüfung fehlt im Scan' });
const today = () => (D.generated || '').slice(0, 10);
function doneToday() { return (D.tasks.done || []).filter((t) => t.date === today()); }

function nodeHTML(n) {
  if (n.kind === 'core') {
    const ag = N.filter((x) => x.kind === 'agent'), tools = N.filter((x) => x.kind === 'tool');
    const b = ag.filter((x) => x.status === 'build').length, p = ag.filter((x) => x.status === 'plan').length;
    const tOk = tools.filter((x) => x.status === 'ok').length;
    return `<div class="k1">Agenten-Kern</div><div class="k2">${b} im Aufbau, ${p} geplant</div><div class="k3"><span class="pill s-${tOk === tools.length ? 'ok' : 'warn'}"><i></i>${tOk}/${tools.length} Werkzeuge</span></div>`;
  }
  if (n.kind === 'gate') return `<span class="ic s-warn">${svg('user')}</span><span class="gate-l">Freigabe durch dich</span>`;
  if (n.kind === 'system') {
    const s = D.system, ids = s.ids;
    const pillS = s.bad ? 'bad' : s.warn ? 'warn' : 'ok';
    const pillT = s.bad ? `${s.bad} Fehler` : s.warn ? `${s.warn} Hinweise` : 'alles grün';
    return `<div class="hd"><span class="ic s-flow">${svg('pulse')}</span><span class="nt">System</span><span class="pill s-${pillS} live" style="margin-left:auto"><i></i>${pillT}</span></div>
      <div class="big s-${s.ok === s.total ? 'ok' : pillS}"><b>${s.ok}/${s.total}</b><span>Prüfungen grün</span></div>
      <div class="bar">${ids.map((id) => `<i class="s-${chk(id).status}"></i>`).join('')}</div>
      <div class="checks">${ids.map((id) => { const c = chk(id); return `<div class="s-${c.status}"><i></i>${esc(c.label)}<span>${esc(c.value)}</span></div>`; }).join('')}</div>`;
  }
  if (n.kind === 'todo') {
    const du = D.tasks.du || [], cl = D.tasks.claude || [];
    return `<div class="hd"><span class="ic s-warn">${svg('bell')}</span><span class="nt">Braucht dich</span><span class="pill s-warn" style="margin-left:auto">${du.length}</span></div>
      <div class="list">${du.slice(0, 4).map((t) => `<div class="li s-warn"><i></i>${esc(t.t)}<span class="who">du</span></div>`).join('') || '<div class="li">Nichts offen</div>'}</div>
      <div class="grp">Claude als Nächstes</div>
      <div class="list">${cl.slice(0, 2).map((t) => `<div class="li s-build"><i></i>${esc(t.t)}<span class="who">Claude</span></div>`).join('')}</div>`;
  }
  if (n.kind === 'done') {
    const dt = doneToday(), all = D.tasks.done || [];
    const list = (dt.length ? dt : all).slice(-3).reverse();
    return `<div class="hd"><span class="ic s-ok">${svg('check')}</span><span class="nt">${dt.length ? 'Erledigt heute' : 'Zuletzt erledigt'}</span></div>
      <div class="big s-ok"><b>${dt.length || all.length}</b><span>${dt.length ? 'Schritte heute' : 'Schritte'}</span></div>
      <div class="list">${list.map((t) => `<div class="li s-ok"><i></i>${esc(t.t)}</div>`).join('')}</div>`;
  }
  if (n.kind === 'res') return `<span class="ic s-${n.status}">${svg(n.icon)}</span><span class="nt">${esc(n.name)}</span><span class="dot s-${n.status}" title="${WORD[n.status] || ''}"></span>`;
  const prog = n.progress ? `<span class="prog"><b><i style="width:${Math.round(100 * n.progress[0] / n.progress[1])}%"></i></b>${esc(n.phase || '')}</span>` : '';
  return `<span class="ic s-${n.status}">${svg(n.icon)}</span><span class="nb"><span class="nt">${esc(n.name)}</span><span class="ns">${esc(n.sub)}</span>${prog}</span><span class="pill s-${n.status}${n.status === 'build' ? ' live' : ''}"><i></i>${esc(n.value)}</span>`;
}

function depRow(c, extra = '') { return `<div class="dep s-${c.status}"><i></i>${esc(c.label)}<em>${esc(c.value)}</em></div>${c.detail ? `<div class="det">${esc(c.detail)}${extra}</div>` : ''}`; }
function linked(id) { return edges.filter((e) => e.a === id || e.b === id).map((e) => ({ n: byId[e.a === id ? e.b : e.a], s: e.s })); }
function panelBody(n) {
  if (n.kind === 'todo') {
    const row = (t, s) => `<div class="dep s-${s}"><i></i>${esc(t.t)}<em>${esc(t.phase || '')}</em></div>${t.where ? `<div class="det">${esc(t.where)}</div>` : ''}`;
    return `<div><div class="sec">Du</div>${(D.tasks.du || []).map((t) => row(t, 'warn')).join('') || '<div class="sec">Nichts offen</div>'}</div><div><div class="sec">Claude</div>${(D.tasks.claude || []).map((t) => row(t, 'build')).join('')}</div><div class="sec">Liste: /opt/nestua/ops/leitstand/aufgaben.json, Stand ${esc(D.tasks.updated || '?')}</div>`;
  }
  if (n.kind === 'done') return `<div>${[...(D.tasks.done || [])].reverse().map((t) => `<div class="dep s-ok"><i></i>${esc(t.t)}<em>${esc((t.date || '').split('-').reverse().slice(0, 2).join('.'))}</em></div>`).join('')}</div>`;
  if (n.kind === 'system') return `<div>${D.system.ids.map((id) => depRow(chk(id))).join('')}</div><div class="sec">Gemessen vom Leitstand-Scan, ${esc(D.generatedText)} Uhr, in ${D.durationMs} ms.</div>`;
  if (n.kind === 'gate') return `<div class="sec">Auf dem Server fragt jeder Agent vor einer Änderung. Unbeaufsichtigt schlägt er nur vor.</div><dl class="kv"><dt>Server, unbeaufsichtigt</dt><dd>Stufe 1</dd><dt>Server, mit dir</dt><dd>Stufe 2</dd><dt>Cloud</dt><dd>bis Stufe 3</dd></dl>`;
  if (n.kind === 'core') {
    const c = (k) => N.filter((x) => x.kind === k).length;
    return `<dl class="kv"><dt>Agenten</dt><dd>${c('agent')}</dd><dt>Werkzeuge ohne KI</dt><dd>${c('tool')}</dd><dt>Ressourcen</dt><dd>${c('res')}</dd><dt>Prüfungen</dt><dd>${Object.keys(D.checks).length}</dd><dt>Letzter Scan</dt><dd>${esc(D.generatedText)}</dd></dl><div class="sec">Ablauf je Lauf: lesen, prüfen, bewerten, melden. Prüfen macht ein Skript, bewerten die KI.</div>`;
  }
  if (n.kind === 'res') {
    const users = linked(n.id).map((x) => x.n).filter((x) => x.kind === 'agent' || x.kind === 'tool');
    const c = n.check ? chk(n.check) : null;
    return `<dl class="kv"><dt>Status</dt><dd class="s-${n.status}" style="color:var(--c)">${WORD[n.status] || n.status}</dd><dt>Ort</dt><dd style="font-family:var(--f-mono);font-size:11px;overflow-wrap:anywhere">${esc(n.where)}</dd></dl>${n.note ? `<div class="sec">${esc(n.note)}</div>` : ''}${c ? `<div><div class="sec">Prüfung</div>${depRow(c)}</div>` : '<div class="sec">Extern, wird vom Server nicht geprüft.</div>'}<div><div class="sec">Genutzt von</div>${users.map((a) => `<div class="dep s-${a.status}"><i></i>${esc(a.name)}<em>${esc(a.value || WORD[a.status])}</em></div>`).join('') || '<div class="sec">niemand</div>'}</div>`;
  }
  let h = n.info ? `<dl class="kv">${n.info.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join('')}</dl>` : '';
  if (n.check) h += `<div><div class="sec">Prüfung</div>${depRow(chk(n.check))}</div>`;
  if (n.builds) h += `<div><div class="sec">Baut auf (${n.progress[0]} von ${n.progress[1]})</div>${n.builds.map((b) => depRow(chk(b))).join('')}</div>`;
  const deps = linked(n.id).filter((x) => x.n.kind === 'res');
  if (deps.length) h += `<div><div class="sec">Liest und meldet</div>${deps.map((d) => `<div class="dep s-${d.n.status}"><i></i>${esc(d.n.name)}<em>${esc(d.n.value || WORD[d.n.status])}</em></div>`).join('')}</div>`;
  if (n.zust) h += `<div><div class="sec">Zuständig für</div><div class="chips">${n.zust.map((z) => `<span>${esc(z)}</span>`).join('')}</div></div>`;
  if (n.kind === 'agent' && n.status !== 'plan') h += `<div><div class="sec">Läufe</div><div class="sec">Noch keiner. Berichte erscheinen hier ab Phase 3.</div></div>`;
  return h;
}

/* ---------- Aufbau der Fläche ---------- */
function build() {
  const pos = Object.fromEntries(N.map((n) => [n.id, [n.x, n.y]]));
  N.forEach((n) => n.el && n.el.remove());
  [...panels].forEach(closePanel);
  N = D.nodes.map((src) => {
    const n = { ...src };
    const p = pos[n.id] || (saved.p && saved.p[n.id]) || n.pos;
    n.x = p[0]; n.y = p[1];
    const el = document.createElement('div');
    el.tabIndex = 0; el.setAttribute('role', 'button'); el.dataset.id = n.id;
    n.el = el; world.appendChild(el);
    return n;
  });
  byId = Object.fromEntries(N.map((n) => [n.id, n]));
  N.forEach(renderNode);
  N.forEach(place);
  buildEdges();
}
function renderNode(n) {
  const el = n.el;
  const k = ['system', 'todo', 'done'].includes(n.kind) ? 'card ' + n.kind : n.kind;
  el.className = `node ${k}` + (n.status ? ' s-' + n.status : '') + (n.status === 'plan' ? ' plan-node' : '');
  if (n.kind === 'system' || n.kind === 'todo' || n.kind === 'done') el.style.setProperty('--w', n.kind === 'done' ? '250px' : n.kind === 'system' ? '300px' : '290px');
  el.setAttribute('aria-label', (n.name || TITLE[n.kind]) + (n.status ? ', ' + (WORD[n.status] || n.status) : ''));
  el.innerHTML = nodeHTML(n);
}
function buildEdges() {
  edges.forEach((e) => e.p.remove()); parts.forEach((p) => p.c.remove()); parts = [];
  edges = D.edges.filter(([a, b]) => byId[a] && byId[b]).map(([a, b, s]) => {
    const p = document.createElementNS(NS, 'path');
    p.setAttribute('class', 'e ' + s);
    gEdges.insertBefore(p, gEdges.firstChild);
    return { a, b, s, p, curve: (byId[a].kind === 'res' || byId[b].kind === 'res') ? 0.12 : 0 };
  });
  drawEdges();
  const COLORS = { ok: '#34F0C2', flow: '#38E1FF', warn: '#FFB547' };
  if (reduce) return;
  edges.forEach((e) => {
    if (!COLORS[e.s]) return;
    const n = e.s === 'flow' ? 3 : 1;
    for (let i = 0; i < n; i++) {
      const c = document.createElementNS(NS, 'circle');
      c.setAttribute('r', e.s === 'flow' ? 3 : 2.3); c.setAttribute('fill', COLORS[e.s]); c.setAttribute('class', 'pt');
      gParts.appendChild(c);
      parts.push({ e, c, t: (i / n) + Math.random() * 0.2, v: (e.s === 'warn' ? 0.08 : 0.16) * (0.8 + Math.random() * 0.4) });
    }
  });
}
function dPath(A, B, k) {
  if (!k) return `M${A.x},${A.y} L${B.x},${B.y}`;
  const mx = (A.x + B.x) / 2, my = (A.y + B.y) / 2, dx = B.x - A.x, dy = B.y - A.y;
  return `M${A.x},${A.y} Q${mx - dy * k},${my + dx * k} ${B.x},${B.y}`;
}
function drawEdges() { edges.forEach((e) => e.p.setAttribute('d', dPath(byId[e.a], byId[e.b], e.curve))); panels.forEach(drawTether); }
function place(n) { n.el.style.left = n.x + 'px'; n.el.style.top = n.y + 'px'; if (n.kind === 'core') coreG.setAttribute('transform', `translate(${n.x},${n.y})`); }

/* ---------- Daten laden und aktualisieren ---------- */
function showState(title, text) { stateEl.hidden = !title; if (title) stateEl.innerHTML = `<b>${esc(title)}</b><div>${text}</div>`; }
function updateHud() {
  const age = (Date.now() - Date.parse(D.generated)) / 60000;
  standEl.innerHTML = `Stand ${esc(D.generatedText)}. Nur lesend.` + (age > STALE_MIN ? `<span class="stale">${Math.round(age)} Min alt</span>` : '');
}
async function refresh(first) {
  let next;
  try {
    const r = await fetch('data/leitstand.json', { cache: 'no-store' });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    next = await r.json();
  } catch (e) {
    if (!D) showState('Keine Daten', `Der Leitstand findet <code>data/leitstand.json</code> nicht. Läuft der Scan? <code>node /opt/nestua/ops/leitstand/scan.mjs</code><br>(${esc(e.message)})`);
    else standEl.innerHTML = `Stand ${esc(D.generatedText)}. <span class="stale">Daten nicht erreichbar</span>`;
    return;
  }
  showState(null);
  const changed = !D || D.generated !== next.generated;
  const sameNodes = D && D.nodes.map((n) => n.id).join() === next.nodes.map((n) => n.id).join();
  D = next;
  if (first || !sameNodes) {
    if (first && saved.v) V = saved.v;
    build();
    if (first && !saved.v) smartFit(); else applyView();
  } else if (changed) {
    N.forEach((n) => { Object.assign(n, D.nodes.find((x) => x.id === n.id), { x: n.x, y: n.y }); renderNode(n); });
    buildEdges();
    panels.forEach((p) => { p.el.querySelector('.pb').innerHTML = panelBody(p.n); drawTether(p); });
  }
  updateHud();
}

/* ---------- Partikel ---------- */
let last = performance.now();
function tick(now) {
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  const lens = new Map();
  for (const p of parts) {
    let L = lens.get(p.e); if (L === undefined) { L = p.e.p.getTotalLength(); lens.set(p.e, L); }
    p.t = (p.t + p.v * dt * (300 / Math.max(120, L))) % 1;
    const pt = p.e.p.getPointAtLength(p.t * L);
    p.c.setAttribute('cx', pt.x.toFixed(1)); p.c.setAttribute('cy', pt.y.toFixed(1));
    p.c.setAttribute('opacity', (Math.sin(p.t * Math.PI) * 0.9 + 0.1).toFixed(2));
  }
  requestAnimationFrame(tick);
}

/* ---------- Ansicht ---------- */
function applyView() {
  world.style.transform = `translate(${V.x}px,${V.y}px) scale(${V.s})`;
  stage.style.setProperty('--gx', V.x + 'px'); stage.style.setProperty('--gy', V.y + 'px'); stage.style.setProperty('--gs', (28 * V.s) + 'px');
}
function fit(list) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  list.forEach((n) => { const w = n.el.offsetWidth / 2 + 20, h = n.el.offsetHeight / 2 + 20; x0 = Math.min(x0, n.x - w); x1 = Math.max(x1, n.x + w); y0 = Math.min(y0, n.y - h); y1 = Math.max(y1, n.y + h); });
  const W = stage.clientWidth, H = stage.clientHeight, top = 70, bot = 70;
  V.s = Math.max(0.2, Math.min(1.1, Math.min(W / (x1 - x0), (H - top - bot) / (y1 - y0))));
  V.x = W / 2 - ((x0 + x1) / 2) * V.s; V.y = top + (H - top - bot) / 2 - ((y0 + y1) / 2) * V.s;
  applyView(); save();
}
function smartFit() { stage.clientWidth < 720 ? fit(N.filter((n) => ['core', 'agent', 'tool'].includes(n.kind))) : fit(N); }
function zoomAt(f, cx, cy) { const s = Math.max(0.2, Math.min(2.2, V.s * f)); const k = s / V.s; V.x = cx - (cx - V.x) * k; V.y = cy - (cy - V.y) * k; V.s = s; applyView(); }

/* ---------- Fokus ---------- */
function focusOn(id) {
  if (!id) { stage.classList.remove('focus'); edges.forEach((e) => e.p.classList.remove('hot')); N.forEach((n) => n.el.classList.remove('near', 'hot-self')); return; }
  stage.classList.add('focus');
  const near = new Set([id]);
  edges.forEach((e) => { const hot = e.a === id || e.b === id; e.p.classList.toggle('hot', hot); if (hot) { near.add(e.a); near.add(e.b); } });
  N.forEach((n) => { n.el.classList.toggle('near', near.has(n.id)); n.el.classList.toggle('hot-self', n.id === id); });
}

/* ---------- Panels ---------- */
function openPanel(n) {
  const ex = panels.find((p) => p.n.id === n.id);
  if (ex) { closePanel(ex); return; }
  const el = document.createElement('div');
  el.className = 'panel';
  const st = n.status || (n.kind === 'done' ? 'ok' : (n.kind === 'todo' || n.kind === 'gate') ? 'warn' : 'flow');
  el.innerHTML = `<div class="ph"><span class="ic s-${st}">${svg(n.icon || KIND_ICON[n.kind])}</span><span class="nt">${esc(n.name || TITLE[n.kind])}</span><button class="x" aria-label="Schließen">${svg('x')}</button></div><div class="pb">${panelBody(n)}</div>`;
  const w = n.el.offsetWidth;
  const p = { n, el, x: n.x + w / 2 + 40, y: n.y - 60, line: document.createElementNS(NS, 'path') };
  if (n.x > 300) p.x = n.x - w / 2 - 370;
  p.line.setAttribute('class', 'e tether'); gEdges.appendChild(p.line);
  world.appendChild(el); placePanel(p); drawTether(p); panels.push(p);
  el.querySelector('.x').addEventListener('click', (ev) => { ev.stopPropagation(); closePanel(p); n.el.focus(); });
}
function closePanel(p) { p.el.remove(); p.line.remove(); panels.splice(panels.indexOf(p), 1); }
function placePanel(p) { p.el.style.left = p.x + 'px'; p.el.style.top = p.y + 'px'; }
function drawTether(p) { const h = p.el.offsetHeight || 200; const tx = p.x < p.n.x ? p.x + 330 : p.x; p.line.setAttribute('d', `M${p.n.x},${p.n.y} L${tx},${p.y + Math.min(40, h / 2)}`); }

/* ---------- Ziehen, Verschieben, Zoomen ---------- */
const ptrs = new Map(); let drag = null, pinch = null;
const toWorld = (cx, cy) => ({ x: (cx - V.x) / V.s, y: (cy - V.y) / V.s });
stage.addEventListener('pointerdown', (e) => {
  if (e.target.closest('.x')) return;
  ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (ptrs.size === 2) { const [a, b] = [...ptrs.values()]; pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), s: V.s }; if (drag && drag.kind === 'node') drag.n.el.classList.remove('dragging'); stage.classList.remove('panning'); drag = null; return; }
  const ph = e.target.closest('.ph'), nodeEl = e.target.closest('.node');
  const w = toWorld(e.clientX, e.clientY);
  if (ph) { const p = panels.find((q) => q.el.contains(ph)); drag = { kind: 'panel', p, ox: w.x - p.x, oy: w.y - p.y, moved: 0, sx: e.clientX, sy: e.clientY }; }
  else if (nodeEl) { const n = byId[nodeEl.dataset.id]; drag = { kind: 'node', n, ox: w.x - n.x, oy: w.y - n.y, moved: 0, sx: e.clientX, sy: e.clientY }; nodeEl.classList.add('dragging'); }
  else if (e.target.closest('.panel')) { return; }
  else { drag = { kind: 'pan', vx: V.x, vy: V.y, sx: e.clientX, sy: e.clientY, moved: 0 }; stage.classList.add('panning'); }
  stage.setPointerCapture(e.pointerId);
});
stage.addEventListener('pointermove', (e) => {
  if (!ptrs.has(e.pointerId)) { const el = e.target.closest && e.target.closest('.node'); if (!drag && e.pointerType === 'mouse') focusOn(el ? el.dataset.id : null); return; }
  ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (pinch && ptrs.size === 2) { const [a, b] = [...ptrs.values()]; const d = Math.hypot(a.x - b.x, a.y - b.y); zoomAt((pinch.s * d / pinch.d) / V.s, (a.x + b.x) / 2, (a.y + b.y) / 2); return; }
  if (!drag) return;
  drag.moved = Math.max(drag.moved, Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy));
  if (drag.kind === 'pan') { V.x = drag.vx + e.clientX - drag.sx; V.y = drag.vy + e.clientY - drag.sy; applyView(); return; }
  const w = toWorld(e.clientX, e.clientY);
  if (drag.kind === 'node') { drag.n.x = Math.round(w.x - drag.ox); drag.n.y = Math.round(w.y - drag.oy); place(drag.n); drawEdges(); }
  if (drag.kind === 'panel') { drag.p.x = w.x - drag.ox; drag.p.y = w.y - drag.oy; placePanel(drag.p); drawTether(drag.p); }
});
function end(e) {
  ptrs.delete(e.pointerId); if (ptrs.size < 2) pinch = null;
  if (!drag) { save(); return; }
  if (drag.kind === 'node') { drag.n.el.classList.remove('dragging'); if (drag.moved < 5) openPanel(drag.n); }
  stage.classList.remove('panning'); drag = null; save();
}
stage.addEventListener('pointerup', end); stage.addEventListener('pointercancel', end);
stage.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse' && !drag) focusOn(null); });
stage.addEventListener('wheel', (e) => { if (e.target.closest('.pb')) return; e.preventDefault(); zoomAt(Math.exp(-e.deltaY * 0.0015), e.clientX, e.clientY); save(); }, { passive: false });
stage.addEventListener('dblclick', (e) => { if (!e.target.closest('.node,.panel')) smartFit(); });
stage.addEventListener('keydown', (e) => {
  const el = e.target.closest('.node'); if (!el) return; const n = byId[el.dataset.id];
  if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openPanel(n); return; }
  const m = { ArrowLeft: [-12, 0], ArrowRight: [12, 0], ArrowUp: [0, -12], ArrowDown: [0, 12] }[e.key];
  if (m) { e.preventDefault(); n.x += m[0]; n.y += m[1]; place(n); drawEdges(); save(); }
});
stage.addEventListener('focusin', (e) => { const el = e.target.closest('.node'); if (el) focusOn(el.dataset.id); });
stage.addEventListener('focusout', () => focusOn(null));
const cx = () => stage.clientWidth / 2, cy = () => stage.clientHeight / 2;
document.getElementById('zIn').onclick = () => { zoomAt(1.25, cx(), cy()); save(); };
document.getElementById('zOut').onclick = () => { zoomAt(0.8, cx(), cy()); save(); };
document.getElementById('zFit').onclick = smartFit;
document.getElementById('zReset').onclick = () => { if (!D) return; N.forEach((n) => { const src = D.nodes.find((x) => x.id === n.id); [n.x, n.y] = src.pos; place(n); }); [...panels].forEach(closePanel); drawEdges(); smartFit(); };

/* ---------- Uhr und Start ---------- */
const clk = document.getElementById('clk');
const fmt = new Intl.DateTimeFormat('de-DE', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
setInterval(() => { clk.textContent = fmt.format(new Date()); if (D) updateHud(); }, 1000);
clk.textContent = fmt.format(new Date());
refresh(true);
setInterval(() => { if (!document.hidden) refresh(false); }, POLL_MS);
document.addEventListener('visibilitychange', () => { if (!document.hidden) refresh(false); });
if (!reduce) requestAnimationFrame(tick);
})();
