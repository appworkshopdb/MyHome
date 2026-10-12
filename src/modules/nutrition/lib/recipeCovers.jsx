// Rezeptbilder: vorgefertigte, flächige Illustrationen statt Fotos.
//
// Ein Rezept speichert nur einen kurzen Text in nut_recipes.cover:
//   "suppe"        → Motiv Suppe mit der Standardfarbe des Motivs
//   "suppe:blau"   → Motiv Suppe auf blauem Grund
//   null / leer    → automatisch (deriveCover: Name, sonst Mahlzeit-Typ)
// Unbekannte Werte fallen still auf "automatisch" zurück, damit ein
// später entferntes Motiv nie eine leere Karte hinterlässt.
//
// Alle Motive teilen sich eine Zeichenfläche (viewBox 200×85, Motiv mittig)
// und die Farben der App. Dunkelblaue Teile nutzen var(--cv-ink), damit sie
// im Dunkelmodus nicht im Hintergrund verschwinden: sie tragen die Klassen
// cv-ink / cv-soft / cv-soft-s, die nutrition.css auf die Variablen abbildet
// (var() als SVG-Attribut greift nicht zuverlässig).

// Hintergrundfarben (Klassen .rc-tone-* in nutrition.css, hell + dunkel)
export const COVER_TONES = [
  { key: 'ochre', label: 'Gelb' },
  { key: 'rot',   label: 'Rot' },
  { key: 'gruen', label: 'Grün' },
  { key: 'blau',  label: 'Blau' },
  { key: 'lila',  label: 'Lila' },
  { key: 'grau',  label: 'Grau' },
];

const Suppe = () => (
  <>
    <path d="M54 42h92c0 20-16 36-46 36S54 62 54 42z" className="cv-ink" />
    <ellipse cx="100" cy="42" rx="46" ry="9" fill="#D9A94F" />
    <ellipse cx="100" cy="41" rx="38" ry="6" fill="#E9BE6A" />
    <circle cx="86" cy="41" r="3" fill="#E1554C" />
    <circle cx="109" cy="43" r="3.4" fill="#E1554C" />
    <circle cx="98" cy="39" r="2.2" fill="#4FC79B" />
    <g fill="none" className="cv-soft-s" strokeWidth="4" strokeLinecap="round">
      <path d="M84 28c-4-4 4-7 0-11" /><path d="M100 28c-4-4 4-7 0-11" /><path d="M116 28c-4-4 4-7 0-11" />
    </g>
  </>
);

const Topf = () => (
  <>
    <rect x="56" y="34" width="88" height="38" rx="9" className="cv-ink" />
    <rect x="56" y="50" width="88" height="5" fill="#E1554C" />
    <rect x="44" y="44" width="14" height="7" rx="3.5" className="cv-ink" />
    <rect x="142" y="44" width="14" height="7" rx="3.5" className="cv-ink" />
    <rect x="52" y="27" width="96" height="9" rx="4.5" fill="#D9A94F" />
    <circle cx="100" cy="23" r="4.5" fill="#D9A94F" />
    <g fill="none" className="cv-soft-s" strokeWidth="3.5" strokeLinecap="round">
      <path d="M78 22c-3-3 3-5 0-9" /><path d="M122 22c-3-3 3-5 0-9" />
    </g>
  </>
);

const Pizza = () => (
  <>
    <circle cx="100" cy="43" r="36" fill="#D9A94F" />
    <circle cx="100" cy="43" r="30" fill="#F6D58E" />
    <g stroke="#D9A94F" strokeWidth="2" strokeLinecap="round">
      <path d="M100 43L100 13" /><path d="M100 43L126 58" /><path d="M100 43L74 58" />
    </g>
    <circle cx="86" cy="32" r="5.5" fill="#E1554C" />
    <circle cx="116" cy="33" r="5.5" fill="#E1554C" />
    <circle cx="87" cy="55" r="5.5" fill="#E1554C" />
    <circle cx="114" cy="54" r="4.5" fill="#E1554C" />
    <ellipse cx="103" cy="46" rx="5" ry="2.8" transform="rotate(-30 103 46)" fill="#4FC79B" />
  </>
);

const Pasta = () => (
  <>
    <ellipse cx="100" cy="50" rx="56" ry="27" fill="#FFFFFF" />
    <ellipse cx="100" cy="48" rx="44" ry="21" fill="#EEF1F6" />
    <ellipse cx="100" cy="45" rx="27" ry="14" fill="#F5C86B" />
    <g fill="none" stroke="#E6A93A" strokeWidth="3" strokeLinecap="round">
      <path d="M78 45c6-9 38-9 44 0" /><path d="M82 51c8-6 28-6 36 0" /><path d="M88 40c6-3 18-3 24 0" />
    </g>
    <ellipse cx="100" cy="41" rx="13" ry="6.5" fill="#E1554C" />
    <ellipse cx="103" cy="37" rx="5.5" ry="2.8" transform="rotate(-25 103 37)" fill="#4FC79B" />
  </>
);

const Burger = () => (
  <>
    <path d="M58 38c0-17 19-25 42-25s42 8 42 25z" fill="#E0A44F" />
    <g fill="#FFF3D6">
      <ellipse cx="82" cy="26" rx="3" ry="1.6" transform="rotate(-20 82 26)" />
      <ellipse cx="100" cy="21" rx="3" ry="1.6" />
      <ellipse cx="118" cy="26" rx="3" ry="1.6" transform="rotate(20 118 26)" />
      <ellipse cx="92" cy="31" rx="3" ry="1.6" />
      <ellipse cx="110" cy="31" rx="3" ry="1.6" />
    </g>
    <path d="M54 38h92v3c-6 6-11 0-17 4s-11 0-17 4-11 0-17-4-11 2-17-4-11 0-17-4z" fill="#4FC79B" />
    <rect x="58" y="44" width="84" height="5" fill="#F5B83A" />
    <path d="M62 49h14l-7 8zM124 49h14l-7 8z" fill="#F5B83A" />
    <rect x="56" y="48" width="88" height="9" rx="4.5" fill="#6B3E26" />
    <path d="M58 59h84c0 8-6 12-14 12H72c-8 0-14-4-14-12z" fill="#E0A44F" />
  </>
);

const Wrap = () => (
  <g transform="rotate(-16 100 44)">
    <rect x="52" y="28" width="96" height="34" rx="17" fill="#F2D7A6" />
    <path d="M52 46h96v0a16 16 0 0 1-16 16H68a16 16 0 0 1-16-16z" fill="#E1554C" />
    <ellipse cx="146" cy="45" rx="6" ry="15" fill="#4FC79B" />
    <circle cx="150" cy="38" r="3.5" fill="#E1554C" />
    <circle cx="150" cy="50" r="3" fill="#F5B83A" />
  </g>
);

const Salat = () => (
  <>
    <ellipse cx="76" cy="36" rx="17" ry="9" transform="rotate(-22 76 36)" fill="#4FC79B" />
    <ellipse cx="124" cy="36" rx="17" ry="9" transform="rotate(22 124 36)" fill="#4FC79B" />
    <ellipse cx="100" cy="30" rx="19" ry="10" fill="#2E9E78" />
    <ellipse cx="92" cy="38" rx="14" ry="8" fill="#7FDDB6" />
    <circle cx="86" cy="35" r="6.5" fill="#E1554C" />
    <circle cx="116" cy="33" r="6" fill="#E1554C" />
    <circle cx="104" cy="40" r="5" fill="#F5B83A" />
    <path d="M54 44h92c0 18-16 30-46 30S54 62 54 44z" className="cv-ink" />
    <rect x="54" y="43" width="92" height="4" rx="2" className="cv-soft" />
  </>
);

const Bowl = () => (
  <>
    <path d="M54 42h92c0 20-16 36-46 36S54 62 54 42z" fill="#4C6493" />
    <ellipse cx="100" cy="42" rx="46" ry="10" fill="#FFFFFF" />
    <ellipse cx="100" cy="41" rx="39" ry="7" fill="#F6E7C8" />
    <circle cx="82" cy="39" r="4.6" fill="#7A5BB0" />
    <circle cx="94" cy="43" r="4.2" fill="#E1554C" />
    <circle cx="108" cy="38" r="4.6" fill="#7A5BB0" />
    <circle cx="120" cy="42" r="4" fill="#E1554C" />
    <ellipse cx="101" cy="39" rx="3.4" ry="2" transform="rotate(-30 101 39)" fill="#D9A94F" />
    <ellipse cx="88" cy="45" rx="3.2" ry="1.9" transform="rotate(20 88 45)" fill="#D9A94F" />
    <ellipse cx="113" cy="29" rx="6" ry="3" transform="rotate(-35 113 29)" fill="#4FC79B" />
    <ellipse cx="124" cy="31" rx="5" ry="2.6" transform="rotate(30 124 31)" fill="#2E9E78" />
  </>
);

const Reis = () => (
  <>
    <path d="M64 44c4-24 68-24 72 0z" fill="#FFFFFF" />
    <g fill="#DDE2EB">
      <ellipse cx="88" cy="34" rx="3.4" ry="1.6" transform="rotate(-25 88 34)" />
      <ellipse cx="104" cy="28" rx="3.4" ry="1.6" transform="rotate(15 104 28)" />
      <ellipse cx="116" cy="37" rx="3.4" ry="1.6" transform="rotate(-10 116 37)" />
      <ellipse cx="98" cy="39" rx="3.4" ry="1.6" transform="rotate(30 98 39)" />
    </g>
    <path d="M58 44h84c0 20-16 32-42 32S58 64 58 44z" fill="#E1554C" />
    <rect x="58" y="52" width="84" height="4" fill="#C93E36" />
    <g stroke="#C98B4B" strokeWidth="3.4" strokeLinecap="round">
      <path d="M138 9L112 38" /><path d="M147 13L118 41" />
    </g>
  </>
);

const Fisch = () => (
  <>
    <path d="M124 42l28-17c3-2 6 0 5 4-2 8-2 18 0 26 1 4-2 6-5 4z" fill="#F0837C" />
    <ellipse cx="90" cy="42" rx="40" ry="20" fill="#F0837C" />
    <path d="M84 24c7-9 18-9 24-3-2 8-14 11-24 3z" fill="#E1554C" />
    <g fill="none" stroke="#FFD1CC" strokeWidth="2.2" strokeLinecap="round">
      <path d="M96 32c4 6 4 14 0 20" /><path d="M108 33c3 5 3 12 0 18" /><path d="M120 36c2 4 2 8 0 12" />
    </g>
    <path d="M76 30c5 8 5 16 0 24" fill="none" stroke="#D9544B" strokeWidth="2.4" strokeLinecap="round" />
    <circle cx="64" cy="38" r="5" fill="#FFFFFF" />
    <circle cx="63" cy="38" r="2.6" className="cv-ink" />
    <path d="M52 46c3 2 6 2 9 0" fill="none" stroke="#D9544B" strokeWidth="2" strokeLinecap="round" />
  </>
);

const Steak = () => (
  <>
    <path d="M50 46c-4-17 10-29 30-31 18-2 42 2 54 15 8 9 6 23-4 29-13 8-41 10-58 6-12-3-20-8-22-19z" fill="#8B4A2F" />
    <path d="M62 44c-2-11 8-18 21-19 14-1 31 2 40 11 6 6 4 15-3 19-10 6-30 7-42 4-10-3-14-7-16-15z" fill="#B85F3A" />
    <g stroke="#6B3820" strokeWidth="3.2" strokeLinecap="round">
      <path d="M76 30l12 22" /><path d="M90 28l12 24" /><path d="M104 28l12 22" />
    </g>
    <circle cx="124" cy="38" r="8.5" fill="#F6E7C8" />
    <circle cx="124" cy="38" r="4" fill="#B85F3A" />
  </>
);

const Haehnchen = () => (
  <>
    <g stroke="#F6E7C8" strokeWidth="8" strokeLinecap="round"><path d="M112 54l34 10" /></g>
    <circle cx="151" cy="60" r="5.4" fill="#F6E7C8" />
    <circle cx="150" cy="70" r="5.4" fill="#F6E7C8" />
    <path d="M52 44c0-17 14-29 33-29 14 0 25 8 27 21 2 11-6 19-19 23l-14 2c-16 3-27-3-27-17z" fill="#D9893B" />
    <path d="M60 42c0-11 9-19 21-19 9 0 16 5 18 12" fill="none" stroke="#EDAF63" strokeWidth="5" strokeLinecap="round" />
    <ellipse cx="72" cy="31" rx="6" ry="3" transform="rotate(-35 72 31)" fill="#FFFFFF" opacity=".35" />
  </>
);

const Gemuese = () => (
  <>
    <path d="M52 68L120 31A9 9 0 0 1 134 44z" fill="#F08A3C" />
    <g stroke="#D9702A" strokeWidth="2.6" strokeLinecap="round">
      <path d="M92 48l5 8" /><path d="M106 40l5 8" /><path d="M78 56l4 6" />
    </g>
    <g fill="#4FC79B">
      <ellipse cx="132" cy="27" rx="13" ry="4.4" transform="rotate(-70 132 27)" />
      <ellipse cx="138" cy="30" rx="13" ry="4.4" transform="rotate(-25 138 30)" />
      <ellipse cx="141" cy="37" rx="12" ry="4.2" transform="rotate(15 141 37)" />
    </g>
    <rect x="150" y="56" width="9" height="13" rx="3.5" fill="#8ED8A8" />
    <circle cx="146" cy="52" r="9.5" fill="#2E9E78" />
    <circle cx="163" cy="52" r="9.5" fill="#2E9E78" />
    <circle cx="154.5" cy="44" r="10" fill="#38B68A" />
  </>
);

const Ei = () => (
  <>
    <circle cx="88" cy="43" r="33" className="cv-ink" />
    <rect x="118" y="38.5" width="54" height="9" rx="4.5" className="cv-ink" />
    <path d="M68 41c1-11 17-16 28-9 10 6 13 17 4 23-9 6-24 6-30-1-3-4-3-8-2-13z" fill="#FFFFFF" />
    <circle cx="87" cy="43" r="9" fill="#F5B83A" />
    <circle cx="84" cy="40" r="2.4" fill="#FBE0A0" />
  </>
);

const Pfannkuchen = () => (
  <>
    <rect x="62" y="52" width="76" height="13" rx="6.5" fill="#E9A855" />
    <rect x="58" y="41" width="84" height="13" rx="6.5" fill="#F0B866" />
    <rect x="64" y="30" width="72" height="13" rx="6.5" fill="#E9A855" />
    <path d="M66 31c0-7 8-9 34-9s34 2 34 9c0 4-3 4-3 8s-3 6-5 0-4-6-7 0-4 6-7 0-4-6-7 0-4 6-7 0-5-6-8 0-4 6-6 0-3-4-3-8z" fill="#A8532A" />
    <rect x="90" y="17" width="20" height="9" rx="2.5" fill="#F5D060" />
    <rect x="93" y="19" width="9" height="2.6" rx="1.3" fill="#FBE79A" />
    <rect x="46" y="64" width="108" height="8" rx="4" fill="#FFFFFF" />
  </>
);

const Kuchen = () => (
  <>
    <rect x="56" y="36" width="88" height="34" rx="5" fill="#A8693A" />
    <rect x="56" y="46" width="88" height="6" fill="#FFF3E0" />
    <rect x="56" y="58" width="88" height="5" fill="#FFF3E0" />
    <path d="M52 36c0-7 6-9 48-9s48 2 48 9c0 4-3 4-3 8s-3 5-5 0-4-5-7 0-4 5-7 0-4-5-7 0-4 5-7 0-5-5-8 0-4 5-6 0-3-4-3-8z" fill="#F0A5A0" />
    <circle cx="100" cy="21" r="6.4" fill="#E1554C" />
    <path d="M100 15c1-4 4-6 8-6" fill="none" stroke="#2E9E78" strokeWidth="2.2" strokeLinecap="round" />
  </>
);

const Eis = () => (
  <>
    <path d="M82 46h36L100 80z" fill="#D9893B" />
    <g stroke="#B46E25" strokeWidth="1.8" strokeLinecap="round">
      <path d="M88 52l18 18" /><path d="M96 48l16 20" /><path d="M112 52l-18 18" /><path d="M104 48l-16 20" />
    </g>
    <ellipse cx="100" cy="46" rx="19" ry="6" fill="#F0A5A0" />
    <circle cx="100" cy="35" r="16" fill="#F0A5A0" />
    <circle cx="100" cy="20" r="12.5" fill="#F6E7C8" />
    <circle cx="100" cy="7.6" r="4.4" fill="#E1554C" />
    <circle cx="94" cy="33" r="2" fill="#FFFFFF" opacity=".5" />
  </>
);

const Obst = () => (
  <>
    <g transform="translate(46 5) scale(3.1)">
      <path d="M12 8.2C10.6 7 8.6 6.6 7 7.4 4.9 8.4 4 10.8 4.5 13.4c.6 3.3 2.7 7.1 5 7.1 1 0 1.5-.6 2.5-.6s1.5.6 2.5.6c2.3 0 4.4-3.8 5-7.1.5-2.6-.4-5-2.5-6-1.6-.8-3.6-.4-5 .8z" fill="#E1554C" />
      <path d="M12 8.2c0-1.2.3-2.3.9-3.3" fill="none" stroke="#6B3E26" strokeWidth=".9" strokeLinecap="round" />
      <path d="M12.9 5c.1-1.7 1.4-2.7 3.4-2.7.1 1.8-1.2 2.9-3.4 2.7z" fill="#4FC79B" />
      <ellipse cx="8.6" cy="11.4" rx=".9" ry="1.9" transform="rotate(20 8.6 11.4)" fill="#FFFFFF" opacity=".4" />
    </g>
    <circle cx="140" cy="54" r="15" fill="#F08A3C" />
    <path d="M140 40c1-5 5-7 9-6-1 5-4 7-9 6z" fill="#4FC79B" />
    <circle cx="135" cy="50" r="3" fill="#FFFFFF" opacity=".3" />
  </>
);

const Smoothie = () => (
  <>
    <path d="M82 22h36l-5 50a6 6 0 0 1-6 5H93a6 6 0 0 1-6-5z" fill="#FFFFFF" />
    <path d="M83.2 34h33.6L113 72a6 6 0 0 1-6 5H93a6 6 0 0 1-6-5z" fill="#7FDDB6" />
    <circle cx="97" cy="52" r="3" fill="#FFFFFF" opacity=".5" />
    <circle cx="106" cy="62" r="2.2" fill="#FFFFFF" opacity=".5" />
    <path d="M110 8L102 52" stroke="#E1554C" strokeWidth="4.4" strokeLinecap="round" />
    <circle cx="124" cy="24" r="9" fill="#E1554C" />
    <path d="M124 15c1-3 3-4 6-4-1 3-3 4-6 4z" fill="#2E9E78" />
  </>
);

const Kaffee = () => (
  <>
    <ellipse cx="96" cy="78" rx="46" ry="5" fill="#FFFFFF" />
    <path d="M126 40h5a10 10 0 0 1 0 20h-8" fill="none" stroke="#FFFFFF" strokeWidth="5.4" strokeLinecap="round" />
    <path d="M64 34h64v18c0 14-13 24-32 24S64 66 64 52z" fill="#FFFFFF" />
    <ellipse cx="96" cy="34" rx="32" ry="6.5" fill="#6B3E26" />
    <ellipse cx="96" cy="34" rx="11" ry="2.8" fill="#C98B4B" />
    <g fill="none" className="cv-soft-s" strokeWidth="3.6" strokeLinecap="round">
      <path d="M84 24c-3-3 3-5 0-9" /><path d="M98 24c-3-3 3-5 0-9" /><path d="M112 24c-3-3 3-5 0-9" />
    </g>
  </>
);

const Snack = () => (
  <>
    <ellipse cx="62" cy="66" rx="8" ry="4.6" transform="rotate(-25 62 66)" fill="#E9BE6A" />
    <ellipse cx="140" cy="68" rx="8" ry="4.6" transform="rotate(20 140 68)" fill="#E9BE6A" />
    <circle cx="82" cy="54" r="14" fill="#8B5A3A" />
    <circle cx="116" cy="54" r="14" fill="#A8693A" />
    <circle cx="99" cy="33" r="14" fill="#7A4A2E" />
    <g fill="#F6E7C8">
      <ellipse cx="77" cy="50" rx="2.6" ry="1.3" transform="rotate(-30 77 50)" />
      <ellipse cx="87" cy="58" rx="2.6" ry="1.3" transform="rotate(20 87 58)" />
      <ellipse cx="112" cy="50" rx="2.6" ry="1.3" transform="rotate(20 112 50)" />
      <ellipse cx="121" cy="58" rx="2.6" ry="1.3" transform="rotate(-20 121 58)" />
      <ellipse cx="94" cy="29" rx="2.6" ry="1.3" transform="rotate(-20 94 29)" />
      <ellipse cx="104" cy="37" rx="2.6" ry="1.3" transform="rotate(25 104 37)" />
    </g>
  </>
);

// Gemischte Gerichte: Teller in Schrägsicht mit Eiweiß, Beilage und Gemüse
const Platte = () => (
  <>
    <ellipse cx="100" cy="50" rx="64" ry="30" fill="#FFFFFF" />
    <ellipse cx="100" cy="48" rx="52" ry="23" fill="#EEF1F6" />
  </>
);

const HaehnchenTeller = () => (
  <>
    <Platte />
    <ellipse cx="76" cy="53" rx="16" ry="10" fill="#F6E7C8" />
    <g fill="#E9D3A4">
      <ellipse cx="70" cy="50" rx="2.6" ry="1.2" transform="rotate(-25 70 50)" />
      <ellipse cx="80" cy="48" rx="2.6" ry="1.2" transform="rotate(20 80 48)" />
      <ellipse cx="76" cy="56" rx="2.6" ry="1.2" transform="rotate(-10 76 56)" />
      <ellipse cx="86" cy="54" rx="2.6" ry="1.2" transform="rotate(30 86 54)" />
    </g>
    <rect x="98" y="40" width="5" height="9" rx="2.5" fill="#8ED8A8" />
    <circle cx="94" cy="36" r="7" fill="#2E9E78" />
    <circle cx="108" cy="36" r="7" fill="#2E9E78" />
    <circle cx="101" cy="30" r="7.5" fill="#38B68A" />
    <path d="M138 55l12 4" stroke="#F6E7C8" strokeWidth="5" strokeLinecap="round" fill="none" />
    <circle cx="152.5" cy="59" r="3.6" fill="#F6E7C8" />
    <ellipse cx="124" cy="49" rx="17" ry="12" transform="rotate(-18 124 49)" fill="#D9893B" />
    <ellipse cx="119" cy="45" rx="7" ry="3.2" transform="rotate(-30 119 45)" fill="#FFFFFF" opacity=".3" />
  </>
);

const SteakTeller = () => (
  <>
    <Platte />
    <path d="M60 52c-2-10 6-17 18-17 11 0 23 3 29 10 4 6 3 13-3 16-8 4-23 5-32 2-7-2-11-6-12-11z" fill="#8B4A2F" />
    <path d="M67 51c-1-7 5-11 13-11 8 0 17 3 21 8 3 4 2 8-2 10-6 3-18 4-25 2-4-1-6-4-7-9z" fill="#B85F3A" />
    <g stroke="#6B3820" strokeWidth="2.6" strokeLinecap="round">
      <path d="M76 42l7 14" /><path d="M86 41l7 14" /><path d="M96 42l6 12" />
    </g>
    <circle cx="124" cy="39" r="7" fill="#2E9E78" />
    <circle cx="135" cy="42" r="6.5" fill="#38B68A" />
    <circle cx="127" cy="33" r="6" fill="#38B68A" />
    <rect x="109" y="56" width="22" height="6" rx="3" transform="rotate(-12 120 59)" fill="#F08A3C" />
    <rect x="124" y="58" width="20" height="6" rx="3" transform="rotate(10 134 61)" fill="#F08A3C" />
    <circle cx="142" cy="52" r="5" fill="#E1554C" />
    <circle cx="112" cy="46" r="4.4" fill="#E1554C" />
  </>
);

const FischTeller = () => (
  <>
    <Platte />
    <path d="M58 48c4-9 25-14 41-7 7 3 9 8 6 12-4 6-23 10-39 6-8-2-12-6-8-11z" fill="#F0837C" />
    <g fill="none" stroke="#FFD1CC" strokeWidth="2.2" strokeLinecap="round">
      <path d="M72 42c3 4 3 10 0 14" /><path d="M84 40c3 5 3 12 0 17" /><path d="M96 41c2 4 2 9 0 13" />
    </g>
    <circle cx="128" cy="36" r="11" fill="#F5D060" />
    <circle cx="128" cy="36" r="8" fill="#FBE79A" />
    <g stroke="#F5D060" strokeWidth="1.6"><path d="M128 28v16" /><path d="M120 36h16" /><path d="M122.5 30.5l11 11" /><path d="M133.5 30.5l-11 11" /></g>
    <circle cx="122" cy="58" r="6" fill="#E9BE6A" />
    <circle cx="135" cy="55" r="6.4" fill="#E9BE6A" />
    <circle cx="121" cy="56.5" r="1.1" fill="#C98B4B" /><circle cx="137" cy="53.5" r="1.1" fill="#C98B4B" />
    <g stroke="#2E9E78" strokeWidth="3.6" strokeLinecap="round">
      <path d="M108 60l14-6" /><path d="M110 65l16-5" />
    </g>
  </>
);

// Gemischter Teller von oben: Gemüse (Hälfte), Eiweiß, Beilage
const Mix = () => (
  <>
    <circle cx="100" cy="43" r="37" fill="#FFFFFF" />
    <path d="M100 14A29 29 0 0 0 100 72z" fill="#7FDDB6" />
    <path d="M100 14A29 29 0 0 1 129 43H100z" fill="#E58A6B" />
    <path d="M129 43A29 29 0 0 1 100 72V43z" fill="#F6D58E" />
    <g stroke="#FFFFFF" strokeWidth="2.6" strokeLinecap="round"><path d="M100 14V72" /><path d="M100 43H129" /></g>
    <circle cx="82" cy="31" r="4.6" fill="#E1554C" />
    <circle cx="90" cy="55" r="4.2" fill="#E1554C" />
    <circle cx="78" cy="44" r="5.6" fill="#2E9E78" />
    <circle cx="88" cy="40" r="4.6" fill="#38B68A" />
    <ellipse cx="116" cy="29" rx="7" ry="3.6" transform="rotate(-25 116 29)" fill="#B85F3A" />
    <g fill="#E9BE6A">
      <circle cx="110" cy="52" r="1.8" /><circle cx="118" cy="58" r="1.8" /><circle cx="121" cy="50" r="1.8" /><circle cx="112" cy="63" r="1.8" />
    </g>
  </>
);

const Auflauf = () => (
  <>
    <rect x="52" y="40" width="96" height="30" rx="8" fill="#E1554C" />
    <rect x="46" y="44" width="10" height="7" rx="3.5" fill="#E1554C" />
    <rect x="144" y="44" width="10" height="7" rx="3.5" fill="#E1554C" />
    <rect x="50" y="36" width="100" height="8" rx="4" fill="#C93E36" />
    <path d="M56 38c0-11 20-14 44-14s44 3 44 14z" fill="#E9A855" />
    <g fill="#C97A2A"><ellipse cx="80" cy="32" rx="5" ry="2.6" /><ellipse cx="108" cy="29" rx="6" ry="2.8" /><ellipse cx="126" cy="34" rx="4.6" ry="2.4" /></g>
    <g fill="#4FC79B"><circle cx="94" cy="35" r="1.8" /><circle cx="118" cy="35" r="1.8" /><circle cx="70" cy="36" r="1.6" /></g>
    <g fill="none" stroke="#97A6C2" strokeWidth="3.4" strokeLinecap="round"><path d="M84 20c-3-3 3-5 0-9" /><path d="M104 18c-3-3 3-5 0-9" /><path d="M122 20c-3-3 3-5 0-9" /></g>
  </>
);

const Wok = () => (
  <>
    <rect x="140" y="43" width="42" height="8" rx="4" className="cv-ink" />
    <path d="M44 44h104c0 18-18 28-52 28S44 62 44 44z" className="cv-ink" />
    <circle cx="68" cy="38" r="8" fill="#2E9E78" />
    <circle cx="80" cy="36" r="7" fill="#38B68A" />
    <rect x="90" y="32" width="16" height="8" rx="4" transform="rotate(25 98 36)" fill="#F08A3C" />
    <rect x="108" y="30" width="18" height="8" rx="4" transform="rotate(-20 117 34)" fill="#E1554C" />
    <rect x="124" y="35" width="16" height="10" rx="5" fill="#F2D7A6" />
    <rect x="62" y="43" width="14" height="8" rx="4" fill="#F2D7A6" />
    <g fill="#4FC79B"><circle cx="100" cy="43" r="2.4" /><circle cx="108" cy="46" r="2.4" /><circle cx="90" cy="46" r="2.4" /></g>
    <g fill="none" className="cv-soft-s" strokeWidth="3.4" strokeLinecap="round"><path d="M74 24c-3-3 3-5 0-9" /><path d="M100 22c-3-3 3-5 0-9" /><path d="M126 24c-3-3 3-5 0-9" /></g>
  </>
);

const PowerBowl = () => (
  <>
    <path d="M54 44h92c0 19-16 33-46 33S54 63 54 44z" className="cv-ink" />
    <ellipse cx="100" cy="44" rx="46" ry="8" fill="#FFFFFF" />
    <path d="M60 44c0-15 22-16 26 0z" fill="#F6E7C8" />
    <ellipse cx="140" cy="39" rx="12" ry="8.5" fill="#7A5BB0" />
    <path d="M90 44c0-11 8-17 17-12 4 2 4 9-2 12z" fill="#4FC79B" />
    <path d="M94 43c0-6 4-9 9-7 2 1 2 4-1 7z" fill="#C8EDA0" />
    <circle cx="114" cy="33" r="6.4" fill="#E1554C" />
    <g fill="#E9BE6A"><circle cx="76" cy="31" r="3.2" /><circle cx="84" cy="27" r="3.2" /><circle cx="70" cy="38" r="3.2" /></g>
    <ellipse cx="127" cy="42" rx="6" ry="2.6" transform="rotate(-20 127 42)" fill="#F08A3C" />
  </>
);

const Sandwich = () => (
  <>
    <rect x="56" y="58" width="88" height="14" rx="6" fill="#E0A44F" />
    <rect x="61" y="60" width="78" height="7" rx="3.5" fill="#F6E2B0" />
    <rect x="54" y="52" width="92" height="7" rx="3.5" fill="#F0A5A0" />
    <rect x="58" y="47" width="84" height="6" fill="#F5B83A" />
    <path d="M60 53h12l-6 7zM128 53h12l-6 7z" fill="#F5B83A" />
    <ellipse cx="82" cy="44" rx="13" ry="4" fill="#E1554C" />
    <ellipse cx="118" cy="44" rx="13" ry="4" fill="#E1554C" />
    <path d="M54 44h92v1c-5 5-10 0-15 3s-10 0-15 3-10 0-15-3-10 2-15-3-10 0-15-3z" fill="#4FC79B" />
    <rect x="56" y="24" width="88" height="20" rx="9" fill="#E0A44F" />
    <rect x="62" y="28" width="76" height="9" rx="4.5" fill="#F0B866" />
    <path d="M100 6v26" stroke="#C98B4B" strokeWidth="2.4" strokeLinecap="round" fill="none" />
    <path d="M100 6l12 4-12 4z" fill="#E1554C" />
  </>
);

const Teller = () => (
  <>
    <circle cx="100" cy="43" r="31" fill="#FFFFFF" />
    <circle cx="100" cy="43" r="22" fill="#EEF1F6" />
    <g className="cv-ink">
      <rect x="45" y="14" width="3.4" height="17" rx="1.7" />
      <rect x="51.3" y="14" width="3.4" height="17" rx="1.7" />
      <rect x="57.6" y="14" width="3.4" height="17" rx="1.7" />
      <rect x="45" y="25" width="16" height="8" rx="4" />
      <rect x="50.4" y="30" width="5.2" height="41" rx="2.6" />
      <path d="M146 71V15c10 3 14 14 12 29h-6v27z" />
    </g>
  </>
);

// Motive in Anzeigereihenfolge der Auswahl. `tone`: Standardfarbe,
// `words`: Teilwörter (klein) für die automatische Zuordnung über den Namen.
export const COVER_MOTIFS = [
  { key: 'haehnchenteller', label: 'Hähnchen-Teller', tone: 'ochre', Art: HaehnchenTeller, words: [] },
  { key: 'steakteller',     label: 'Steak-Teller',    tone: 'rot',   Art: SteakTeller,     words: [] },
  { key: 'fischteller',     label: 'Fisch-Teller',    tone: 'blau',  Art: FischTeller,     words: [] },
  { key: 'mix',             label: 'Gemischter Teller', tone: 'gruen', Art: Mix,           words: ['teller', 'menü', 'menue', 'gemischt'] },
  { key: 'auflauf',         label: 'Auflauf',         tone: 'rot',   Art: Auflauf,         words: ['auflauf', 'gratin', 'ofen', 'überbacken', 'ueberbacken'] },
  { key: 'wok',             label: 'Pfannengericht',  tone: 'gruen', Art: Wok,             words: ['pfanne', 'wok', 'stir', 'gebraten'] },
  { key: 'buddha',          label: 'Power Bowl',      tone: 'gruen', Art: PowerBowl,       words: ['buddha', 'power', 'poke'] },
  { key: 'bowl',            label: 'Müsli-Bowl',      tone: 'lila',  Art: Bowl,            words: ['bowl', 'müsli', 'muesli', 'porridge', 'oats', 'skyr'] },
  { key: 'suppe',           label: 'Suppe',           tone: 'ochre', Art: Suppe,           words: ['suppe', 'brühe', 'bruehe'] },
  { key: 'topf',            label: 'Eintopf',         tone: 'ochre', Art: Topf,            words: ['eintopf', 'gulasch', 'chili', 'ragout', 'curry', 'topf'] },
  { key: 'pasta',           label: 'Pasta',           tone: 'rot',   Art: Pasta,           words: ['pasta', 'nudel', 'spaghetti', 'lasagne', 'penne', 'gnocchi'] },
  { key: 'pizza',           label: 'Pizza',           tone: 'rot',   Art: Pizza,           words: ['pizza', 'flammkuchen', 'quiche'] },
  { key: 'burger',          label: 'Burger',          tone: 'ochre', Art: Burger,          words: ['burger'] },
  { key: 'sandwich',        label: 'Sandwich',        tone: 'ochre', Art: Sandwich,        words: ['sandwich', 'toast', 'stulle', 'brötchen', 'broetchen', 'belegt'] },
  { key: 'wrap',            label: 'Wrap',            tone: 'gruen', Art: Wrap,            words: ['wrap', 'taco', 'burrito', 'döner', 'doener', 'fajita'] },
  { key: 'salat',           label: 'Salat',           tone: 'gruen', Art: Salat,           words: ['salat', 'rohkost', 'dip'] },
  { key: 'reis',            label: 'Reis',            tone: 'gruen', Art: Reis,            words: ['reis', 'risotto', 'sushi', 'quinoa'] },
  { key: 'fisch',           label: 'Fisch',           tone: 'blau',  Art: Fisch,           words: ['fisch', 'lachs', 'thunfisch', 'forelle', 'garnele', 'kabeljau'] },
  { key: 'steak',           label: 'Fleisch',         tone: 'rot',   Art: Steak,           words: ['steak', 'rind', 'schwein', 'fleisch', 'braten', 'schnitzel', 'hack', 'lamm'] },
  { key: 'haehnchen',       label: 'Hähnchen',        tone: 'ochre', Art: Haehnchen,       words: ['hähnchen', 'haehnchen', 'huhn', 'pute', 'geflügel', 'gefluegel', 'chicken'] },
  { key: 'gemuese',         label: 'Gemüse',          tone: 'gruen', Art: Gemuese,         words: ['gemüse', 'gemuese', 'möhre', 'karotte', 'brokkoli', 'spinat', 'spargel'] },
  { key: 'ei',              label: 'Ei',              tone: 'gruen', Art: Ei,              words: ['rührei', 'ruehrei', 'spiegelei', 'omelett', 'eier', ' ei '] },
  { key: 'pfannkuchen',     label: 'Pfannkuchen',     tone: 'ochre', Art: Pfannkuchen,     words: ['pfannkuchen', 'pancake', 'waffel', 'crêpe', 'crepe'] },
  { key: 'kuchen',          label: 'Kuchen',          tone: 'rot',   Art: Kuchen,          words: ['kuchen', 'torte', 'muffin', 'brownie', 'dessert'] },
  { key: 'eis',             label: 'Eis',             tone: 'blau',  Art: Eis,             words: [' eis', 'sorbet', 'frozen'] },
  { key: 'obst',            label: 'Obst',            tone: 'rot',   Art: Obst,            words: ['obst', 'apfel', 'beere', 'frucht', 'banane'] },
  { key: 'smoothie',        label: 'Smoothie',        tone: 'gruen', Art: Smoothie,        words: ['smoothie', 'shake', 'saft', 'drink'] },
  { key: 'kaffee',          label: 'Kaffee',          tone: 'blau',  Art: Kaffee,          words: ['kaffee', 'latte', 'kakao', 'tee', 'cappuccino'] },
  { key: 'snack',           label: 'Snack',           tone: 'ochre', Art: Snack,           words: ['energie', 'ball', 'riegel', 'nuss', 'nüsse', 'snack'] },
  { key: 'teller',          label: 'Gedeck',          tone: 'grau',  Art: Teller,          words: [] },
];

const MOTIF_BY_KEY = Object.fromEntries(COVER_MOTIFS.map((m) => [m.key, m]));
const TONE_KEYS = new Set(COVER_TONES.map((t) => t.key));

// Standardmotiv je Mahlzeit-Typ, falls der Name nichts hergibt
const MEAL_DEFAULT = { fruehstueck: 'bowl', mittag: 'mix', abend: 'mix', snack: 'snack' };

// "suppe" | "suppe:blau" → { motif, tone } oder null (= automatisch)
export function parseCover(cover) {
  if (!cover || typeof cover !== 'string') return null;
  const [m, t] = cover.split(':');
  const motif = MOTIF_BY_KEY[m];
  if (!motif) return null;
  return { motif, tone: TONE_KEYS.has(t) ? t : motif.tone };
}

export function formatCover(motifKey, toneKey) {
  const motif = MOTIF_BY_KEY[motifKey];
  if (!motif) return null;
  return toneKey && toneKey !== motif.tone ? `${motifKey}:${toneKey}` : motifKey;
}

// Gerichte (Form der Mahlzeit) schlagen einzelne Zutaten: "Linsen-Gemüse-Eintopf"
// ist ein Eintopf, nicht Gemüse. Nur ohne Gericht-Treffer zählen Zutaten.
const DISH_KEYS = new Set(['buddha', 'bowl', 'suppe', 'topf', 'pasta', 'pizza', 'burger', 'sandwich', 'wrap', 'salat',
  'auflauf', 'wok', 'pfannkuchen', 'kuchen', 'eis', 'smoothie', 'kaffee']);
const SAVORY_KEYS = ['haehnchen', 'steak', 'fisch', 'gemuese', 'reis', 'ei'];
const PROTEIN_PLATE = { haehnchen: 'haehnchenteller', steak: 'steakteller', fisch: 'fischteller' };

// Auswahl für ein Rezept: gespeichertes Cover, sonst Treffer im Namen,
// sonst Standard nach Mahlzeit-Typ. Liefert immer ein Motiv.
export function resolveCover(recipe) {
  const saved = parseCover(recipe?.cover);
  if (saved) return saved;
  const name = ` ${(recipe?.name || '').toLowerCase()} `;
  const hits = COVER_MOTIFS.filter((m) => m.words.some((w) => name.includes(w)));
  const keys = new Set(hits.map((h) => h.key));
  const savory = SAVORY_KEYS.filter((k) => keys.has(k));
  const protein = ['haehnchen', 'steak', 'fisch'].find((k) => keys.has(k));

  let motif;
  if (keys.has('bowl') && savory.length > 0) motif = MOTIF_BY_KEY.buddha; // herzhafte Bowl
  else if (hits.find((h) => DISH_KEYS.has(h.key))) motif = hits.find((h) => DISH_KEYS.has(h.key));
  else if (protein && (savory.length > 1 || /( mit | und |&|,)/.test(name))) motif = MOTIF_BY_KEY[PROTEIN_PLATE[protein]]; // z. B. "Lachs mit Gemüse"
  else if (savory.length > 2) motif = MOTIF_BY_KEY.mix;
  else {
    // mehrere Zutaten ohne Eiweiß: die zuerst genannte gibt das Bild ("Rührei mit Spinat" → Ei)
    const pos = (m) => Math.min(...m.words.map((w) => name.indexOf(w)).filter((i) => i >= 0));
    const first = [...hits].sort((a, b) => pos(a) - pos(b))[0];
    motif = first || MOTIF_BY_KEY[MEAL_DEFAULT[recipe?.category]] || MOTIF_BY_KEY.teller;
  }
  return { motif, tone: motif.tone };
}

// Zeichenfläche für ein Motiv. className/style kommen vom Aufrufer
// (Größe, Radius); Hintergrund und Farben setzt nutrition.css.
// fit: 'slice' füllt die Fläche (Karten, ähnliches Seitenverhältnis),
// 'meet' zeigt das ganze Motiv (breite Flächen wie Vorschau und Dialog).
export function CoverArt({ motif, tone, className = '', style, fit = 'slice' }) {
  const Art = motif.Art;
  return (
    <span className={`recipe-cover rc-tone-${tone} ${className}`.trim()} style={style} aria-hidden="true">
      <svg viewBox="0 0 200 85" preserveAspectRatio={`xMidYMid ${fit}`} width="100%" height="100%">
        <Art />
      </svg>
    </span>
  );
}

export function RecipeCover({ recipe, className, style, fit }) {
  const { motif, tone } = resolveCover(recipe);
  return <CoverArt motif={motif} tone={tone} className={className} style={style} fit={fit} />;
}
