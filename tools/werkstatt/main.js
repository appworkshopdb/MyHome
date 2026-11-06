// Design-Werkstatt, Schritt 1: Interface Inventory. Die anderen Menüpunkte folgen mit den Tokens.
const $main = document.getElementById('main');
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const nf = new Intl.NumberFormat('de-DE');
let data = null;

function bars(list, limit = 10) {
  const max = list[0]?.count || 1;
  const row = (e) => `<div class="bar" title="${esc(e.files.join(', '))}"><span>${esc(e.value)}</span><i style="width:${(e.count / max) * 100}%"></i><em>${nf.format(e.count)}</em></div>`;
  const id = 'b' + Math.random().toString(36).slice(2, 8);
  const rest = list.slice(limit);
  return `<div class="bars" id="${id}">${list.slice(0, limit).map(row).join('')}</div>` +
    (rest.length ? `<button class="more" data-more="${id}" data-n="${rest.length}">Weitere ${rest.length} zeigen</button><template id="${id}-t">${rest.map(row).join('')}</template>` : '');
}
const card = (title, aside, body) => `<div class="card"><h3>${esc(title)}<span>${aside ?? ''}</span></h3>${body}</div>`;
const stat = (n, text, cls = '') => `<div class="card"><div class="stat ${cls}">${nf.format(n)}<small>${text}</small></div></div>`;

function viewInventory() {
  if (!data) return `<div class="empty">Keine Zählung gefunden. Starte die Werkstatt mit <code>npm run werkstatt</code>, dann wird sie automatisch erzeugt.</div>`;
  const t = data.totals;
  const when = new Date(data.generated).toLocaleString('de-DE');
  return `
  <h2>Interface Inventory</h2>
  <p class="lead">Alles, was im CSS und im Code der App an Gestaltungswerten vorkommt, gezählt: ${t.cssFiles} CSS-Dateien mit ${nf.format(t.cssLines)} Zeilen und ${t.jsxFiles} Komponenten. Stand der Zählung: ${when}. Neu zählen: <code>npm run werkstatt:scan</code> (oder die Werkstatt neu starten).</p>
  <div class="grid">
    ${stat(t.fontSizeNormalized, `verschiedene Schriftgrößen (${t.fontSizeRaw} Schreibweisen, rem in px umgerechnet). Ziel: 6 bis 7 Stufen`, 'bad')}
    ${stat(t.radius, `verschiedene Eckenradien in ${nf.format(t.radiusUses)} Stellen. Ziel: 4 bis 5`, 'bad')}
    ${stat(t.padding, `verschiedene Innenabstände (padding) in ${nf.format(t.paddingUses)} Stellen. Ziel: Skala aus 6 Werten`, 'bad')}
    ${stat(t.gap, `verschiedene Abstände zwischen Elementen (gap)`, 'bad')}
    ${stat(t.hexOutside, `feste Farbwerte außerhalb der Token-Dateien (insgesamt ${t.hexAll} Hex-Werte). Ziel: 0`, 'bad')}
    ${stat(t.buttonClasses, `Klassennamen mit "btn", "button" oder "pill"`, 'bad')}
    ${stat(t.inlineStyles, `Stellen mit <code>style={{ … }}</code> in Komponenten`, 'bad')}
    ${stat(t.shadow, `verschiedene Schatten (box-shadow)`)}
  </div>
  <div class="grid" style="margin-top:12px">
    ${card('Schriftgrößen', 'Treffer, rem umgerechnet', bars(data.fontSize))}
    ${card('Eckenradien', 'Treffer', bars(data.radius))}
    ${card('Abstände (gap)', 'Treffer', bars(data.gap))}
    ${card('Innenabstände (padding)', 'Treffer', bars(data.padding))}
  </div>
  <div class="grid" style="margin-top:12px">
    ${card('Feste Farben außerhalb der Token-Dateien', `${t.hexOutside} verschiedene`, `<div class="swatches">${data.hex.map((e) => `<span class="sw" title="${esc(e.files.join(', '))}"><b style="background:${esc(e.value)}"></b>${esc(e.value)} <em>${e.count}</em></span>`).join('')}</div>`)}
    ${card('Schriftgrößen: Schreibweise', '', `<div class="stat" style="font-size:20px">${t.fontSizePx} px · ${t.fontSizeRem} rem · ${t.fontSizeVar} Variablen<small>Stellen mit font-size. Variablen sind das Ziel.</small></div>`)}
  </div>
  <div class="grid" style="margin-top:12px">
    ${card('Button- und Pill-Klassen', `${t.buttonClasses}`, `<div class="tw"><table><thead><tr><th>Klasse</th><th class="n">Treffer</th><th>Datei</th></tr></thead><tbody>${data.buttonClasses.slice(0, 40).map((e) => `<tr><td><code>${esc(e.value)}</code></td><td class="n">${e.count}</td><td>${esc(e.files.map((f) => f.split('/').pop()).join(', '))}</td></tr>`).join('')}</tbody></table></div>${data.buttonClasses.length > 40 ? `<p class="lead" style="margin:8px 0 0">Die ersten 40 von ${data.buttonClasses.length}.</p>` : ''}`)}
    ${card('CSS-Dateien', 'Zeilen, verschiedene Schriftgrößen', `<div class="tw"><table><thead><tr><th>Datei</th><th class="n">Zeilen</th><th class="n">Schriftgr.</th></tr></thead><tbody>${data.files.map((f) => `<tr><td>${esc(f.path.replace('src/', ''))}</td><td class="n">${nf.format(f.lines)}</td><td class="n">${f.distinctFontSizes}</td></tr>`).join('')}</tbody></table></div>`)}
    ${card('Inline-Styles', 'die 25 Komponenten mit den meisten', `<div class="tw"><table><thead><tr><th>Komponente</th><th class="n">Stellen</th></tr></thead><tbody>${data.inlineByFile.map((f) => `<tr><td>${esc(f.path.replace('src/', ''))}</td><td class="n">${f.count}</td></tr>`).join('')}</tbody></table></div>`)}
  </div>
  <div class="note"><b>Was das heißt:</b> Es gibt noch kein gemeinsames Maß. Die Zahlen zeigen, wo vereinheitlicht werden muss. Die Farben sind schon überwiegend als Tokens angelegt (nur ${t.hexOutside} feste Werte außerhalb der Token-Dateien). Bei Schrift, Abständen und Ecken ist die Streuung groß. Nächster Schritt: Skalen festlegen (Design Tokens).</div>`;
}

// ───────────────────────── Design Tokens ─────────────────────────
const ROLES = [
  ['caption', 'Überzeile, Marke', 'bisher t-chip, 10 px'],
  ['meta', 'Meta, Hinweis, Legende', 'bisher t-meta, 11 px'],
  ['small', 'Nebentext, Chip, kleiner Knopf', 'bisher t-card-title 12 px und t-body 13 px'],
  ['body', 'Text, Listenzeile, Knopf', 'bisher t-title, 14 px'],
  ['title', 'Kartentitel', 'bisher t-value, 19 px'],
  ['number', 'Zahl, Betrag', 'neu, bisher je Stelle verschieden'],
  ['display', 'Seitentitel', 'bisher t-display, 32 px'],
];
const SPACE_HINT = { 1: 'enge Lücken, Symbol zu Text', 2: 'Lücke in Gruppen', 3: 'Zeilen, Kartenabstand klein', 4: 'Standard: Karteninnenrand, Seitenrand', 5: 'zwischen Gruppen', 6: 'zwischen Abschnitten', 7: 'große Freiflächen' };
const RAD_HINT = { sm: 'Haken, kleine Felder', md: 'Eingabefelder, Kacheln klein', lg: 'Kacheln, Chips-Gruppen', xl: 'Karten', hero: 'Fokuskarte, Tagesplan' };
const SIZE_ROWS = [['hit', 'Mindest-Tippfläche', 'Android empfiehlt 48. Gilt für alles Antippbare.'], ['control', 'Höhe Knopf und Eingabefeld', 'Standardhöhe'], ['controlSm', 'Höhe kleine Elemente (Chip)', 'Die Tippfläche bleibt größer als die sichtbare Höhe']];
const COLOR_PARTS = [['tint', 'Getönte Fläche'], ['ink', 'Text auf getönter Fläche'], ['ac', 'Aktionsfarbe'], ['on', 'Text auf Aktionsfarbe'], ['deep', 'Text/Symbol in Modulfarbe'], ['pill', 'Dunkle Pille']];
const BASE_PARTS = [['surface-page', 'Seitenhintergrund'], ['surface-raised', 'Karte'], ['surface-sunken', 'Eingabefeld, ruhige Fläche'], ['text-primary', 'Text'], ['text-muted', 'Text gedämpft'], ['border-hairline', 'Haarlinie']];
const UI = { mod: 'fin', th: 'light', dev: '360x740', screen: 'hub' };
let T = null, SAVED = null, tokenError = '';

async function loadTokens() {
  try { const r = await fetch('./api/tokens'); if (r.ok) { T = await r.json(); SAVED = JSON.parse(JSON.stringify(T)); return; } } catch { /* unten */ }
  tokenError = 'Die Tokens konnten nicht geladen werden. Starte die Werkstatt mit npm run werkstatt (Entwicklungsserver nötig).';
}
const clone = (o) => JSON.parse(JSON.stringify(o));
const hexOf = (v) => (typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v) ? v.toLowerCase() : /^#([0-9a-f]{3})$/i.test(v || '') ? '#' + [...v.slice(1)].map((x) => x + x).join('').toLowerCase() : '#000000');
function colorOf(th, group, part) {
  const o = T.colors?.[th]?.[group]?.[part];
  if (o) return o;
  const set = data.colors[th];
  return group === 'base' ? set.base[part] : set.families[group][part];
}
const lum = (hex) => { const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
const ratio = (a, b) => { const [x, y] = [lum(hexOf(a)), lum(hexOf(b))].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };

function applyTokens() {
  const set = (el, k, v) => el.style.setProperty(k, v);
  for (const el of document.querySelectorAll('.tk, .pv')) {
    for (const [k, v] of Object.entries(T.type)) { set(el, `--fs-${k}`, v.size + 'px'); set(el, `--fw-${k}`, v.weight); set(el, `--lh-${k}`, v.lh); }
    for (const [k, v] of Object.entries(T.space)) set(el, `--sp-${k}`, v + 'px');
    for (const [k, v] of Object.entries(T.radius)) set(el, `--rad-${k}`, v + 'px');
    set(el, '--hit-min', T.size.hit + 'px'); set(el, '--ctl-h', T.size.control + 'px'); set(el, '--ctl-h-sm', T.size.controlSm + 'px');
  }
  const pv = document.getElementById('pv');
  if (pv) {
    const m = UI.mod, th = UI.th;
    const map = { '--pg': ['base', 'surface-page'], '--sf': ['base', 'surface-raised'], '--sk': ['base', 'surface-sunken'], '--tx': ['base', 'text-primary'], '--tm': ['base', 'text-muted'], '--hl': ['base', 'border-hairline'], '--tint': [m, 'tint'], '--ink': [m, 'ink'], '--ac': [m, 'ac'], '--on': [m, 'on'], '--deep': [m, 'deep'], '--pill': [m, 'pill'] };
    for (const [k, [g, p]] of Object.entries(map)) pv.style.setProperty(k, colorOf(th, g, p));
    pv.dataset.th = th;
  }
  const dirty = JSON.stringify(T) !== JSON.stringify(SAVED);
  const st = document.getElementById('tkState');
  if (st) { st.textContent = dirty ? 'Ungespeicherte Änderungen' : (T.status === 'Beschlossen' ? 'Beschlossen und gespeichert' : 'Gespeichert (Vorschlag)'); st.className = 'st ' + (dirty ? 'dirty' : 'ok'); }
  const sv = document.getElementById('tkSave'); if (sv) sv.disabled = !dirty;
  const rs = document.getElementById('tkReset'); if (rs) rs.disabled = !dirty;
  document.querySelectorAll('[data-chk]').forEach((el) => { const [grp, key, sub] = el.dataset.chk.split('.'); const a = sub ? T[grp][key][sub] : T[grp][key]; const b = sub ? SAVED[grp][key][sub] : SAVED[grp][key]; el.classList.toggle('on', a !== b); });
}

function sizeRow(grp, key, label, hint, min, max, step, unit = 'px') {
  return `<div class="row"><div class="lb">${label}<small>${hint}</small></div><div class="ctl"><span class="dot" data-chk="${grp}.${key}"></span><input type="range" min="${min}" max="${max}" step="${step}" value="${T[grp][key]}" data-g="${grp}.${key}" aria-label="${label}"><output>${T[grp][key]}${unit}</output></div></div>`;
}
function viewTokens() {
  if (tokenError) return `<h2>Design Tokens</h2><div class="note">${esc(tokenError)}</div>`;
  const typeRows = ROLES.map(([k, name, was]) => {
    const t = T.type[k];
    return `<div class="row"><div class="lb">${name}<small>${was}</small></div><div class="ctl"><span class="dot" data-chk="type.${k}.size"></span><input type="range" min="9" max="44" step="1" value="${t.size}" data-t="${k}.size" aria-label="Größe ${name}"><output data-o="${k}.size">${t.size}px</output><select data-t="${k}.weight" aria-label="Stärke ${name}">${[500, 600, 700, 800, 900].map((w) => `<option value="${w}"${w === t.weight ? ' selected' : ''}>${w}</option>`).join('')}</select><input type="number" step="0.05" min="0.9" max="2" value="${t.lh}" data-t="${k}.lh" aria-label="Zeilenhöhe ${name}" title="Zeilenhöhe"></div><div class="smp" style="font-size:var(--fs-${k});font-weight:var(--fw-${k});line-height:var(--lh-${k})">Aa · So sieht diese Stufe aus</div></div>`;
  }).join('');
  const spaceRows = Object.keys(T.space).map((k) => sizeRow('space', k, `Abstand ${k}`, SPACE_HINT[k], 0, 64, 2)).join('');
  const radRows = Object.keys(T.radius).map((k) => `<div class="row"><div class="lb">Ecke ${k}<small>${RAD_HINT[k]}</small></div><div class="ctl"><div class="rad" style="border-radius:var(--rad-${k})"></div><span class="dot" data-chk="radius.${k}"></span><input type="range" min="0" max="40" step="1" value="${T.radius[k]}" data-g="radius.${k}" aria-label="Ecke ${k}"><output>${T.radius[k]}px</output></div></div>`).join('');
  const sizeRows = SIZE_ROWS.map(([k, l, h]) => sizeRow('size', k, l, h, 28, 72, 2)).join('');
  const legacy = data.legacy;
  const oldSpace = ['space-1', 'space-2', 'space-3', 'space-4', 'space-5', 'space-6', 'space-7', 'space-8'].map((k) => `${legacy[k]}`).join(' · ');
  return `<div class="tk">
  <h2>Design Tokens</h2>
  <p class="lead">Die Grundwerte, aus denen die ganze App gebaut werden soll. Stelle sie hier ein, rechts siehst du sofort die Wirkung auf einen Beispielbildschirm. "Speichern" schreibt <code>design/tokens.json</code> (und daraus <code>design/tokens.css</code>). Die App liest diese Dateien noch nicht, das passiert erst bei der Umstellung. Die Werte sind ein <b>Vorschlag</b>, abgeleitet aus den häufigsten bisherigen Werten und aus Android-Richtlinien.</p>
  <div class="bar2">
    <div class="seg" role="group" aria-label="Darstellung"><button data-th="light" aria-pressed="${UI.th === 'light'}">Hell</button><button data-th="dark" aria-pressed="${UI.th === 'dark'}">Dunkel</button></div>
    <select class="sel" id="tkMod" aria-label="Modul">${data.colors.families.map(([k, n]) => `<option value="${k}"${k === UI.mod ? ' selected' : ''}>${n}</option>`).join('')}</select>
    <select class="sel" id="tkDev" aria-label="Gerät"><option value="360x740">Android 360 × 740</option><option value="412x860">Pixel 8 412 × 860</option><option value="320x600">Schmal 320 × 600</option></select>
    <span class="st ok" id="tkState">Gespeichert (Vorschlag)</span>
    <span class="sp"></span>
    <span class="msg" id="tkMsg"></span>
    <button class="btn" id="tkReset">Zurücksetzen</button>
    <button class="btn pri" id="tkSave">Speichern</button>
  </div>
  <div class="grid">
    <div class="card"><h3>Schriftstufen <span>Größe · Stärke · Zeilenhöhe</span></h3>${typeRows}</div>
    <div class="card"><h3>Abstände <span>4er-Raster</span></h3>${spaceRows}<p class="msg" style="margin:8px 0 0">Bisher: ${oldSpace} (14, 18 und 44 liegen neben dem Raster).</p></div>
    <div class="card"><h3>Ecken <span>Radien</span></h3>${radRows}<p class="msg" style="margin:8px 0 0">Dazu: Pille (voll rund) und Kreis (50 %), die bleiben.</p></div>
    <div class="card"><h3>Größen <span>Tippflächen</span></h3>${sizeRows}</div>
    <div class="card" id="colorsCard"></div>
    <div class="card"><h3>Bisher → Vorschlag <span>Schrift</span></h3><div class="tw"><table><thead><tr><th>Bisher</th><th class="n">Stellen</th><th>Vorschlag</th></tr></thead><tbody>
      ${data.typeRoles.map((r) => `<tr><td><code>${r.cls}</code> ${r.size} px</td><td class="n">${r.uses}</td><td>${{ 't-chip': 'caption 11', 't-meta': 'meta 12', 't-card-title': 'small 14', 't-body': 'small 14', 't-title': 'body 16', 't-value': 'title 20', 't-display': 'display 32' }[r.cls] ?? ''}</td></tr>`).join('')}
    </tbody></table></div><p class="msg" style="margin:8px 0 0">Die Zeile "Stellen" zählt nur die t-Klassen im Code. Dazu kommen die vielen festen Größen im CSS (siehe Inventory).</p></div>
    <div class="card"><h3>Bisher → Vorschlag <span>Abstände und Ecken</span></h3><div class="tw"><table><thead><tr><th>Bisher</th><th>Vorschlag</th></tr></thead><tbody>
      <tr><td>4 · 8 · 12 px</td><td>Abstand 1 · 2 · 3</td></tr><tr><td>14 · 18 px</td><td>16 (Abstand 4), 18 teils 16 oder 24</td></tr><tr><td>24 · 32 px</td><td>Abstand 5 · 6</td></tr><tr><td>44 px</td><td>48 (Abstand 7)</td></tr>
      <tr><td>Radius 6 · 8 px</td><td>sm 8</td></tr><tr><td>Radius 12 px</td><td>md 12</td></tr><tr><td>Radius 14 px</td><td>md 12 oder lg 16</td></tr><tr><td>Radius 24 px (Karte, Kachel)</td><td>xl 24</td></tr><tr><td>Radius 28 px (Fokuskarte)</td><td>hero 28</td></tr>
    </tbody></table></div></div>
    <div class="card"><h3>Schon vorhanden <span>bleibt vorerst</span></h3><div class="tw"><table><tbody>
      ${['shadow-card', 'shadow-float', 'shadow-nav', 'shadow-fab', 'motion-fast', 'motion-calm', 'touch-target'].map((k) => `<tr><td><code>--${k}</code></td><td>${esc(legacy[k] ?? '')}</td></tr>`).join('')}
    </tbody></table></div><p class="msg" style="margin:8px 0 0">Schatten und Bewegung sind schon Tokens. Die Tippfläche ist bisher 44 und soll 48 werden.</p></div>
  </div></div>`;
}
function buildColors() {
  const th = UI.th, m = UI.mod;
  const fam = data.colors.families.find(([k]) => k === m)[1];
  const row = (g, p, label) => { const v = hexOf(colorOf(th, g, p)); const changed = !!T.colors?.[th]?.[g]?.[p]; return `<div class="row"><div class="lb">${label}<small>${esc(p)}</small></div><div class="ctl"><span class="dot${changed ? ' on' : ''}"></span><input type="color" value="${v}" data-c="${g}.${p}" aria-label="${label}"><code>${v}</code></div></div>`; };
  const pairs = [['Text auf Aktionsfarbe', colorOf(th, m, 'on'), colorOf(th, m, 'ac')], ['Text auf getönter Fläche', colorOf(th, m, 'ink'), colorOf(th, m, 'tint')], ['Modulfarbe als Text auf Karte', colorOf(th, m, 'deep'), colorOf(th, 'base', 'surface-raised')], ['Text auf Seitenhintergrund', colorOf(th, 'base', 'text-primary'), colorOf(th, 'base', 'surface-page')]];
  document.getElementById('colorsCard').innerHTML = `<h3>Farben <span>${fam} · ${th === 'light' ? 'Hell' : 'Dunkel'}</span></h3>
    <div class="sub">Modulfarben</div>${COLOR_PARTS.map(([p, l]) => row(m, p, l)).join('')}
    <div class="sub">Grundfarben</div>${BASE_PARTS.map(([p, l]) => row('base', p, l)).join('')}
    <div class="sub">Kontrast (Ziel: mindestens 4,5)</div>
    ${pairs.map(([l, a, b]) => { const r = ratio(a, b); return `<div class="row"><div class="lb">${l}</div><div class="ctl"><span class="ratio ${r >= 4.5 ? 'ok' : 'off'}">${r.toFixed(1)} : 1 ${r >= 4.5 ? '✓' : 'zu niedrig'}</span></div></div>`; }).join('')}
    <p class="msg" style="margin:8px 0 0">Farbänderungen werden als Abweichungen in <code>tokens.json</code> gespeichert. Der Verlauf der Fokuskarte ist noch nicht einstellbar.</p>`;
  document.querySelectorAll('#colorsCard [data-c]').forEach((inp) => inp.addEventListener('input', () => {
    const [g, p] = inp.dataset.c.split('.');
    ((T.colors[th] ??= {})[g] ??= {})[p] = inp.value;
    inp.nextElementSibling.textContent = inp.value;
    applyTokens();
  }));
  document.querySelectorAll('#colorsCard [data-c]').forEach((inp) => inp.addEventListener('change', buildColors));
}
const SCREENS = {
  hub: () => `<div><div class="cap2">Dienstag, 27. Oktober</div><h1>Guten Tag</h1></div>
    <div class="c"><div class="cap2">Saldo Oktober</div><div class="num">70,63 €</div><div class="small">Ein 1.753,60 € · Aus 1.682,97 €</div><div class="pr"><i></i></div><div class="brow"><button class="b">Ansehen</button><button class="b s">Später</button><button class="b g">Details</button></div></div>
    <div class="chs"><span class="chip on">Alle</span><span class="chip">Offen</span><span class="chip">Fix</span><span class="chip">Ein</span></div>
    <div class="c"><h3>Dein Tagesplan</h3><div><div class="li"><span class="ck"></span><b>Zahnarzt-Termin buchen</b><span class="tag">Aufgabe</span></div><div class="li"><span class="ck"></span><b>Wasser trinken</b></div><div class="li"><span class="ck"></span><b>Handyrechnung</b><span class="tag">Zahlung</span></div></div></div>
    <div class="tl"><div class="t"><b>3</b>Einheiten</div><div class="t"><b>1</b>Erledigt</div></div>`,
  list: () => `<div><div class="cap2">Alle Listen</div><h1>Einkauf</h1></div>
    ${['Wocheneinkauf|11 Artikel|Im Einkauf', 'Drogerie|2 Artikel|Offen', 'Geburtstag Samstag|12 Artikel|Offen'].map((x) => { const [a, b, c] = x.split('|'); return `<div class="c" style="flex-direction:row;align-items:center"><span class="ic">${a[0]}</span><div style="flex:1;min-width:0"><h3>${a}</h3><div class="meta">${b}</div></div><span class="tag">${c}</span></div>`; }).join('')}
    <div class="c"><div class="cap2">Fortschritt</div><div class="pr"><i></i></div><div class="small">4 von 11 erledigt</div></div>`,
  form: () => `<div><div class="cap2">Neue Gewohnheit</div><h1>Anlegen</h1></div>
    <div class="c"><div><label>Name</label><div class="in">Wasser trinken</div></div><div><label>Häufigkeit</label><div class="in">Täglich</div></div><div><label>Ziel pro Tag</label><div class="in err">0</div><div class="err" style="margin-top:4px">Bitte mindestens 1 eingeben</div></div>
    <div class="brow"><button class="b">Speichern</button><button class="b s">Abbrechen</button></div></div>`,
};
function buildStage() {
  const st = document.getElementById('stage');
  st.innerHTML = `<div class="seg" role="group" aria-label="Beispielbildschirm">${[['hub', 'Hub'], ['list', 'Liste'], ['form', 'Formular']].map(([k, n]) => `<button data-s="${k}" aria-pressed="${UI.screen === k}">${n}</button>`).join('')}</div>
    <div class="cap" id="cap"></div><div class="phone" id="phone"><div class="pv" id="pv" data-th="${UI.th}">${SCREENS[UI.screen]()}</div></div>
    <div class="cap">Beispielbildschirm aus den Tokens. Die echte App folgt, sobald sie die Tokens nutzt.</div>`;
  st.querySelectorAll('[data-s]').forEach((b) => b.addEventListener('click', () => { UI.screen = b.dataset.s; buildStage(); applyTokens(); fit(); }));
}
function fit() {
  const ph = document.getElementById('phone'), pv = document.getElementById('pv'); if (!ph) return;
  const [w, h] = UI.dev.split('x').map(Number);
  pv.style.setProperty('--w', w + 'px'); pv.style.setProperty('--h', h + 'px');
  const s = Math.min(1, (document.getElementById('stage').clientWidth - 24) / (w + 20), (innerHeight - 140) / (h + 20));
  ph.style.transform = `scale(${s})`; ph.style.marginBottom = -((h + 20) * (1 - s)) + 'px';
  document.getElementById('cap').textContent = `Vorschau · ${w} × ${h}`;
}
function wireTokens() {
  const main = document.getElementById('main');
  main.querySelectorAll('[data-t]').forEach((el) => el.addEventListener('input', () => {
    const [k, f] = el.dataset.t.split('.'); const v = Number(el.value); T.type[k][f] = v;
    const o = main.querySelector(`[data-o="${k}.${f}"]`); if (o) o.textContent = v + 'px';
    applyTokens();
  }));
  main.querySelectorAll('[data-g]').forEach((el) => el.addEventListener('input', () => {
    const [g, k] = el.dataset.g.split('.'); T[g][k] = Number(el.value); el.nextElementSibling.textContent = el.value + 'px'; applyTokens();
  }));
  main.querySelectorAll('.bar2 [data-th]').forEach((b) => b.addEventListener('click', () => {
    UI.th = b.dataset.th; main.querySelectorAll('.bar2 [data-th]').forEach((x) => x.setAttribute('aria-pressed', x === b)); buildColors(); applyTokens();
  }));
  document.getElementById('tkMod').addEventListener('change', (e) => { UI.mod = e.target.value; buildColors(); applyTokens(); });
  const dev = document.getElementById('tkDev'); dev.value = UI.dev; dev.addEventListener('change', () => { UI.dev = dev.value; fit(); });
  document.getElementById('tkReset').addEventListener('click', () => { T = clone(SAVED); show('tok'); });
  document.getElementById('tkSave').addEventListener('click', async () => {
    const msg = document.getElementById('tkMsg');
    try {
      const r = await fetch('./api/tokens', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ tokens: T }) });
      const j = await r.json();
      if (!r.ok || !j.ok) throw new Error(j.error || 'Fehler');
      T = j.tokens; SAVED = clone(T); msg.textContent = 'Gespeichert: design/tokens.json und design/tokens.css'; applyTokens();
    } catch (e) { msg.textContent = 'Speichern fehlgeschlagen: ' + e.message; }
  });
}
function afterTokens() {
  if (tokenError) return;
  buildStage(); buildColors(); wireTokens(); applyTokens(); fit();
}

const soon = (title, text) => `<h2>${title}</h2><p class="lead soon">${text}</p><div class="card soon"><div class="empty" style="padding:6px 0">Kommt als Nächstes.</div></div>`;
const VIEWS = {
  inv: viewInventory,
  wk: () => soon('Werkstatt', 'Elemente der App anklicken und einzeln oder für alle gleichen Elemente anpassen. Das setzt voraus, dass die Bausteine einheitlich benannt sind.'),
  tok: viewTokens,
  doc: () => soon('Doku', 'Jeder Baustein mit allen Varianten und Zuständen, in Hell und Dunkel.'),
};
function show(v) {
  document.querySelectorAll('.nav').forEach((b) => (b.dataset.v === v ? b.setAttribute('aria-current', 'page') : b.removeAttribute('aria-current')));
  const stage = document.getElementById('stage');
  const withStage = v === 'tok' && !tokenError;
  stage.hidden = !withStage; document.querySelector('.app').classList.toggle('has-stage', withStage);
  $main.innerHTML = VIEWS[v]();
  $main.querySelectorAll('[data-more]').forEach((b) => b.addEventListener('click', () => {
    const list = document.getElementById(b.dataset.more);
    list.insertAdjacentHTML('beforeend', document.getElementById(b.dataset.more + '-t').innerHTML);
    b.remove();
  }));
  if (v === 'tok') afterTokens();
  history.replaceState(null, '', '#' + v);
}
document.querySelectorAll('.nav').forEach((b) => b.addEventListener('click', () => show(b.dataset.v)));

try {
  const res = await fetch('./generated/inventory.json', { cache: 'no-store' });
  if (res.ok) data = await res.json();
} catch { /* Zählung fehlt, Hinweis erscheint */ }
await loadTokens();
addEventListener('resize', fit);
show(VIEWS[location.hash.slice(1)] ? location.hash.slice(1) : 'inv');
