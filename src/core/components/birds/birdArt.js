// core/components/birds/birdArt.js
// SVG-Zeichnungen der Vögel (Frontansicht) als Strings — statisch, ohne
// Nutzereingaben, deshalb gefahrlos per dangerouslySetInnerHTML einbindbar.
// Gradients/Filter/Clips liegen einmalig in BirdDefs.jsx (global, ids "nb-*").
//
// Arten:   robin (Rotkehlchen), meise (Blaumeise)
// Stufen:  1 Ei · 2 Küken · 3 Nestling (blasse, kleine Variante des Altvogels)
//          4–7 Altvogel wächst · 8–14 zusätzlich Aura, ab 10 Federschopf,
//          ab 8 Funkeln. Level = Stufe, siehe gamificationData.js.

export const SPECIES = {
  robin: { key: 'robin', name: 'Rotkehlchen', blurb: 'Zutraulich, mit leuchtend oranger Brust.' },
  meise: { key: 'meise', name: 'Blaumeise', blurb: 'Quirlig, mit blauer Kappe und gelbem Bauch.' },
};
export const SPECIES_KEYS = Object.keys(SPECIES);

export const STAGE_NAMES = ['', 'Ei', 'Küken', 'Nestling', 'Ästling', 'Jungvogel', 'Flügge', 'Freiflieger', 'Zugvogel', 'Nachtfalke', 'Adler', 'Kondor', 'Phönix', 'Legendär', 'Unsterblich'];
export const STAGE_BLURB = {
  1: 'Noch ruht alles in der Schale. Jeder erledigte Punkt wärmt das Ei.',
  2: 'Das Küken ist geschlüpft und will gefüttert werden.',
  3: 'Die ersten Federn wachsen. Der Nestling sitzt noch fest im Nest.',
  4: 'Der Ästling hüpft von Zweig zu Zweig und übt das Fliegen.',
  5: 'Das Gefieder ist voll. Der Jungvogel wagt die ersten Flüge.',
  6: 'Flügge: kurze Strecken klappen schon sicher.',
  7: 'Freiflieger. Der Vogel gehört jetzt dem Himmel.',
  8: 'Der Zugvogel plant weite Strecken und leuchtet leicht im Morgenlicht.',
  9: 'Der Nachtfalke ist auch im Dunkeln unterwegs.',
  10: 'Ein stolzer Schopf: der Adler sieht weit.',
  11: 'Der Kondor trägt ruhig und kraftvoll.',
  12: 'Der Phönix steht in warmem Feuerschein.',
  13: 'Legendär: nur wenige kommen so weit.',
  14: 'Unsterblich. Der Vogel strahlt in Gold.',
};
const AURA = { 8: '#9CC7F5', 9: '#7F86E8', 10: '#F3C16B', 11: '#D99A5B', 12: '#FF7A45', 13: '#C58BF0', 14: '#FFD45A' };

function rng(seed) { return function () { seed |= 0; seed = seed + 0x6D2B79F5 | 0; var t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

function barbs(seed, x0, y0, x1, y1, n, len, ang, spread, curve, lightOp, darkOp, dark) {
  const r = rng(seed); let L = ''; let D = '';
  for (let i = 0; i < n; i++) {
    const x = x0 + r() * (x1 - x0); const y = y0 + r() * (y1 - y0);
    const a = (ang + (r() - 0.5) * spread) * Math.PI / 180; const l = len * (0.6 + r() * 0.6);
    const ex = x + Math.cos(a) * l; const ey = y + Math.sin(a) * l;
    const d = `M${x.toFixed(1)} ${y.toFixed(1)}Q${((x + ex) / 2 + curve * (r() - 0.3)).toFixed(1)} ${((y + ey) / 2).toFixed(1)} ${ex.toFixed(1)} ${ey.toFixed(1)}`;
    if (r() > 0.5) L += d; else D += d;
  }
  return `<path d="${L}" stroke="#fff" stroke-opacity="${lightOp}" stroke-width=".9" fill="none" stroke-linecap="round"/>` +
    `<path d="${D}" stroke="${dark || '#2A1608'}" stroke-opacity="${darkOp}" stroke-width=".9" fill="none" stroke-linecap="round"/>`;
}
const mirror = (s) => `<g transform="translate(240 0) scale(-1 1)">${s}</g>`;

const ROBIN_BARBS = barbs(7, 48, 56, 192, 232, 640, 8, 90, 140, 3, 0.22, 0.26);
const MEISE_BARBS = barbs(13, 60, 60, 180, 230, 520, 8, 90, 130, 3, 0.24, 0.2, '#6B4A00');
const CHICK_BARBS = barbs(11, 50, 70, 190, 220, 420, 12, 90, 360, 4, 0.22, 0.24);

const NEST = (() => {
  const r = rng(5); let s = '';
  for (let i = 0; i < 52; i++) {
    const x = 20 + r() * 200; const y = 214 + r() * 40; const a = (r() - 0.5) * 1.2; const l = 30 + r() * 40;
    s += `<path d="M${x.toFixed(1)} ${y.toFixed(1)} q${(l / 2 * Math.cos(a)).toFixed(1)} ${(-6 + r() * 6).toFixed(1)} ${(l * Math.cos(a)).toFixed(1)} ${(l * Math.sin(a) * 0.25).toFixed(1)}" stroke-width="${(1.2 + r() * 1.8).toFixed(1)}" stroke-opacity="${(0.55 + r() * 0.4).toFixed(2)}"/>`;
  }
  return `<g stroke="#5A3E2B" stroke-linecap="round" fill="none">${s}</g>`;
})();
const NEST_FRONT = '<g stroke="#5A3E2B" stroke-linecap="round" fill="none"><path d="M40 236 q80 26 160 0" stroke-width="3.4"/><path d="M52 246 q68 16 136 -2" stroke-width="2.6"/></g>';

const BRANCH = '<ellipse cx="120" cy="250" rx="70" ry="6" fill="#000" opacity=".16" filter="url(#nb-soft)"/>' +
  '<path d="M-14 250 Q120 240 254 250 L254 268 Q120 260 -14 270 Z" fill="url(#nb-branch)"/><path d="M10 254 q40 -4 80 0 M150 256 q40 -4 80 0" stroke="#2B1D14" stroke-opacity=".35" stroke-width="1.3" fill="none"/>';

// ---------- Altvögel ----------
function robinAdult(extra = '') {
  const wing = '<g filter="url(#nb-fuzz)"><path d="M58 122 C38 160 44 208 74 228 C70 192 72 158 82 126 Z" fill="url(#nb-rWing)"/></g>' +
    '<path d="M62 150 C56 176 60 200 70 214 M70 140 C66 168 68 190 76 208" stroke="#2D1D14" stroke-opacity=".5" stroke-width="1.3" fill="none" stroke-linecap="round"/>';
  const eye = (cx) => `<g class="eye"><circle cx="${cx}" cy="102" r="10.5" fill="#C6764A" opacity=".35"/><circle cx="${cx}" cy="102" r="7.4" fill="#120A06"/><circle cx="${cx - 2.4}" cy="99.4" r="2.5" fill="#fff"/><circle cx="${cx + 2}" cy="105" r="1" fill="#fff" opacity=".7"/></g>`;
  const legs = '<path d="M106 230 L104 249 M134 230 L136 249" stroke="#6A4A3A" stroke-width="3.2" stroke-linecap="round"/><path d="M95 251 L104 248 L113 251 M127 251 L136 248 L145 251" stroke="#6A4A3A" stroke-width="2.8" stroke-linecap="round" fill="none"/>';
  const body = '<g class="tilt">' +
    '<g filter="url(#nb-fuzz)"><path d="M120 58 C74 60 50 108 52 160 C54 206 86 232 120 232 C154 232 186 206 188 160 C190 108 166 58 120 58 Z" fill="url(#nb-rBack)"/></g>' +
    '<path d="M120 76 C90 76 68 100 70 132 C72 164 92 188 120 192 C148 188 168 164 170 132 C172 100 150 76 120 76 Z" fill="none" stroke="#8C99A3" stroke-width="9" opacity=".55" filter="url(#nb-soft)"/>' +
    '<g filter="url(#nb-fuzz)"><path d="M120 76 C90 76 68 100 70 132 C72 164 92 188 120 192 C148 188 168 164 170 132 C172 100 150 76 120 76 Z" fill="url(#nb-rOrange)"/><ellipse cx="120" cy="212" rx="42" ry="24" fill="url(#nb-rBelly)"/></g>' +
    `<g clip-path="url(#nb-clipR)">${ROBIN_BARBS}</g>` +
    `<g class="wingL">${wing}</g><g class="wingR">${mirror(wing)}</g>` +
    '<ellipse cx="120" cy="82" rx="26" ry="9" fill="#fff" opacity=".12" filter="url(#nb-soft2)"/>' +
    eye(100) + eye(140) +
    '<path d="M113 110 Q120 105 127 110 L120 127 Z" fill="#3A2A22"/><path d="M116 111 Q120 108.5 124 111 L120 117 Z" fill="#6A5042"/>' +
    extra + '</g>';
  return { legs, body };
}

function meiseAdult(extra = '') {
  const wing = '<g filter="url(#nb-fuzz)"><path d="M70 126 C52 160 58 206 84 224 C80 190 82 158 92 130 Z" fill="url(#nb-bWing)"/></g><path d="M66 160 C62 184 68 204 78 216" stroke="#fff" stroke-opacity=".55" stroke-width="2" fill="none" stroke-linecap="round"/>';
  const eye = (cx) => `<g class="eye"><circle cx="${cx}" cy="99" r="6.4" fill="#0A0D14"/><circle cx="${cx - 2}" cy="96.8" r="2.1" fill="#fff"/></g>`;
  const legs = '<path d="M108 228 L106 249 M132 228 L134 249" stroke="#5A6577" stroke-width="3.2" stroke-linecap="round"/><path d="M97 251 L106 248 L115 251 M125 251 L134 248 L143 251" stroke="#5A6577" stroke-width="2.8" stroke-linecap="round" fill="none"/>';
  const body = '<g class="tilt">' +
    '<g filter="url(#nb-fuzz)"><path d="M120 62 C80 64 62 108 66 156 C70 204 94 230 120 230 C146 230 170 204 174 156 C178 108 160 64 120 62Z" fill="url(#nb-bYellow)"/></g>' +
    `<g clip-path="url(#nb-clipB)">${MEISE_BARBS}</g>` +
    '<path d="M118.5 140 Q120 138 121.5 140 L121 214 Q120 218 119 214 Z" fill="#1C2230" opacity=".85"/>' +
    `<g class="wingL">${wing}</g><g class="wingR">${mirror(wing)}</g>` +
    '<g filter="url(#nb-fuzz)"><circle cx="120" cy="96" r="42" fill="url(#nb-bCheek)"/></g>' +
    '<g filter="url(#nb-fuzz)"><path d="M79 92 C78 64 98 52 120 52 C142 52 162 64 161 92 C150 82 136 77 120 77 C104 77 90 82 79 92Z" fill="url(#nb-bBlue)"/></g>' +
    '<path d="M86 114 Q120 142 154 114" stroke="#243050" stroke-opacity=".55" stroke-width="3" fill="none" stroke-linecap="round"/>' +
    '<path d="M104 128 C108 142 132 142 136 128 C132 121 108 121 104 128Z" fill="#1C2230"/>' +
    '<path d="M82 100 Q96 101 112 101 M128 101 Q144 101 158 100" stroke="#1C2230" stroke-width="3.6" fill="none" stroke-linecap="round"/>' +
    eye(103) + eye(137) +
    '<path d="M114.5 106 Q120 102 125.5 106 L120 120 Z" fill="#2A2A2E"/><path d="M117 107 Q120 105 123 107 L120 112 Z" fill="#5A5A60"/>' +
    extra + '</g>';
  return { legs, body };
}

// ---------- Ei und Küken ----------
function egg(species) {
  const r = rng(species === 'robin' ? 9 : 19); let sp = '';
  const n = species === 'robin' ? 40 : 70;
  for (let i = 0; i < n; i++) {
    const x = 84 + r() * 72; const y = species === 'robin' ? 70 + r() * 110 : 70 + r() * 70;
    sp += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${(0.8 + r() * 1.7).toFixed(1)}" fill="${species === 'robin' ? '#7A4B2C' : '#B5452F'}" opacity="${(0.25 + r() * 0.35).toFixed(2)}"/>`;
  }
  return NEST + '<g class="tilt"><ellipse cx="122" cy="226" rx="42" ry="8" fill="#000" opacity=".18" filter="url(#nb-soft)"/>' +
    `<ellipse cx="120" cy="156" rx="42" ry="56" fill="url(#nb-${species === 'robin' ? 'eRobin' : 'eMeise'})"/>` +
    `<g clip-path="url(#nb-clipEgg)">${sp}</g>` +
    '<ellipse cx="104" cy="124" rx="9" ry="18" fill="url(#nb-glow)" transform="rotate(18 104 124)"/></g>' + NEST_FRONT;
}
function chick(species) {
  const tint = species === 'robin' ? 'nb-cRobin' : 'nb-cMeise';
  const tuft = species === 'robin' ? '' : '<path d="M108 100 Q104 86 96 82 Q112 86 120 100Z" fill="#E7C95B" opacity=".9"/>';
  return NEST + '<g class="tilt"><g filter="url(#nb-fuzz)"><circle cx="120" cy="164" r="58" fill="url(#' + tint + ')"/></g>' +
    `<g clip-path="url(#nb-clipChick)">${CHICK_BARBS}</g>` + tuft +
    '<path d="M104 150 Q120 138 136 150 L120 186 Z" fill="#B8402F"/><path d="M100 148 Q120 132 140 148 Q120 156 100 148Z" fill="#F2C14E"/>' +
    '<g class="eye"><path d="M92 136 q8 -6 16 0 M132 136 q8 -6 16 0" stroke="#2A1A10" stroke-width="3" fill="none" stroke-linecap="round"/></g>' +
    '<path d="M64 168 q-8 12 4 22 M176 168 q8 12 -4 22" stroke="#B59862" stroke-width="7" fill="none" stroke-linecap="round" opacity=".8"/></g>' + NEST_FRONT;
}

// ---------- Zusammensetzen ----------
let uidCounter = 0;
const sparkle = (x, y, s, i) => `<path class="spark" style="animation-delay:${(i * 0.45).toFixed(2)}s" d="M${x} ${y - s} Q${x} ${y} ${x + s} ${y} Q${x} ${y} ${x} ${y + s} Q${x} ${y} ${x - s} ${y} Q${x} ${y} ${x} ${y - s}Z" fill="#FFF3C4"/>`;
const SPARKS = [[40, 70, 9], [200, 90, 8], [30, 170, 6], [212, 170, 7], [120, 22, 7]];

export function birdSvg({ species = 'robin', stage = 1, head = false }) {
  const st = Math.max(1, Math.min(14, stage));
  const sp = species === 'meise' ? 'meise' : 'robin';
  const uid = `a${uidCounter++}`;
  let inner = '';
  let vb = '0 0 240 275';

  if (st === 1) { inner = egg(sp); if (head) vb = '40 80 160 160'; }
  else if (st === 2) { inner = chick(sp); if (head) vb = '40 90 160 160'; }
  else {
    const scale = st === 3 ? 0.66 : Math.min(1, 0.84 + (st - 4) * 0.053);
    let aura = '';
    if (st >= 8) {
      aura = `<defs><radialGradient id="nb-aura-${uid}" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="${AURA[st]}" stop-opacity=".55"/><stop offset=".6" stop-color="${AURA[st]}" stop-opacity=".18"/><stop offset="1" stop-color="${AURA[st]}" stop-opacity="0"/></radialGradient></defs>` +
        `<circle class="aura" cx="120" cy="150" r="128" fill="url(#nb-aura-${uid})"/>`;
    }
    // Federschopf ab Stufe 10 — sitzt im .tilt-Teil, wippt also mit dem Kopf
    const plumeY = sp === 'robin' ? 0 : -6;
    const plumeFill = sp === 'robin' ? '#E5762F' : '#3E6FB8';
    const plume = st >= 10
      ? `<g transform="translate(0 ${plumeY})"><path d="M112 62 Q106 36 94 28 Q116 38 120 60 Q124 30 146 22 Q134 40 128 62 Q120 24 112 62Z" fill="${plumeFill}" opacity=".95"/></g>` : '';
    const a = sp === 'robin' ? robinAdult(plume) : meiseAdult(plume);
    const pale = st === 3 ? ' style="filter:saturate(.55) brightness(1.08)"' : '';
    let sparks = '';
    if (st >= 8) { const n = Math.min(5, st - 7); for (let i = 0; i < n; i++) sparks += sparkle(SPARKS[i][0], SPARKS[i][1], SPARKS[i][2], i); }
    const bottom = st === 3 ? NEST + NEST_FRONT : BRANCH;
    inner = aura + bottom +
      `<g transform="translate(120 250) scale(${scale.toFixed(3)}) translate(-120 -250)"><g${pale}>${a.legs}${a.body}</g></g>` + sparks;
    if (head) vb = '44 36 152 152';
  }
  return `<svg class="nbird-svg" viewBox="${vb}" role="img" aria-label="${SPECIES[sp].name}, ${STAGE_NAMES[st]}" focusable="false">${inner}</svg>`;
}
