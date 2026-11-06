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
const soon = (title, text) => `<h2>${title}</h2><p class="lead soon">${text}</p><div class="card soon"><div class="empty" style="padding:6px 0">Kommt als Nächstes.</div></div>`;
const VIEWS = {
  inv: viewInventory,
  wk: () => soon('Werkstatt', 'Elemente der App anklicken und einzeln oder für alle gleichen Elemente anpassen. Das setzt voraus, dass die Bausteine einheitlich benannt sind.'),
  tok: () => soon('Design Tokens', 'Schriftstufen, Abstände, Ecken und Farben als feste Skala festlegen und live ausprobieren.'),
  doc: () => soon('Doku', 'Jeder Baustein mit allen Varianten und Zuständen, in Hell und Dunkel.'),
};
function show(v) {
  document.querySelectorAll('.nav').forEach((b) => (b.dataset.v === v ? b.setAttribute('aria-current', 'page') : b.removeAttribute('aria-current')));
  $main.innerHTML = VIEWS[v]();
  $main.querySelectorAll('[data-more]').forEach((b) => b.addEventListener('click', () => {
    const list = document.getElementById(b.dataset.more);
    list.insertAdjacentHTML('beforeend', document.getElementById(b.dataset.more + '-t').innerHTML);
    b.remove();
  }));
  history.replaceState(null, '', '#' + v);
}
document.querySelectorAll('.nav').forEach((b) => b.addEventListener('click', () => show(b.dataset.v)));

try {
  const res = await fetch('./generated/inventory.json', { cache: 'no-store' });
  if (res.ok) data = await res.json();
} catch { /* Zählung fehlt, Hinweis erscheint */ }
show(VIEWS[location.hash.slice(1)] ? location.hash.slice(1) : 'inv');
