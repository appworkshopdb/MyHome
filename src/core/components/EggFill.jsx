// core/components/EggFill.jsx
// Ei im Nest, das sich von unten nach oben mit Farbe füllt (Registrierungs-
// Wizard: 20 / 40 / 60 / 80 % je Schritt). Leere Schale = graublau, die Füllung
// hat eine Wellenkante und gesprenkelte Punkte. Reine Zeichnung ohne Logik;
// level 0–1. Das fertige Ei am Ende ist das echte Vogel-Ei (<Bird stage={1}>).

import { useId } from 'react';

const SHAPE = 'M120 22 C160 22 180 74 180 112 C180 148 154 168 120 168 C86 168 60 148 60 112 C60 74 80 22 120 22 Z';
const SPECKLES = [[138, 70, 3], [152, 104, 3.5], [104, 122, 3], [132, 136, 2.5], [86, 96, 2.5], [120, 58, 2], [148, 132, 2], [86, 140, 2.5], [150, 90, 2]];

export default function EggFill({ level = 0, height = 120, className = '' }) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '');
  const lv = Math.max(0, Math.min(1, level));
  const top = 168 - 146 * lv; // Oberkante der Füllung in Ei-Koordinaten
  const wave = `M-10 ${top} Q20 ${top - 7} 50 ${top} T110 ${top} T170 ${top} T230 ${top} T290 ${top} V210 H-10 Z`;

  return (
    <svg className={`eggfill ${className}`.trim()} viewBox="0 0 240 200" style={{ height, width: 'auto' }} aria-hidden="true">
      <defs>
        <linearGradient id={`${uid}f`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#FBEBCB" /><stop offset="1" stopColor="#E9B468" /></linearGradient>
        <linearGradient id={`${uid}n`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#9A7656" /><stop offset="1" stopColor="#5A412E" /></linearGradient>
        <clipPath id={`${uid}s`}><path d={SHAPE} /></clipPath>
        <clipPath id={`${uid}l`}><path d={wave} /></clipPath>
      </defs>
      <ellipse cx="120" cy="184" rx="96" ry="10" fill="#1B2A4A" opacity=".10" />
      <ellipse cx="120" cy="150" rx="100" ry="38" fill={`url(#${uid}n)`} />
      <g fill="none" stroke="#7B5A3F" strokeWidth="3" strokeLinecap="round">
        <path d="M30 140 C60 124 90 130 120 126" /><path d="M210 140 C180 124 150 130 120 126" /><path d="M42 156 C80 140 110 150 150 138" />
      </g>
      <path d={SHAPE} fill="#E3E8EF" stroke="#C9D1DE" strokeWidth="2" />
      <g clipPath={`url(#${uid}s)`}>
        <g clipPath={`url(#${uid}l)`}>
          <rect x="0" y="0" width="240" height="200" fill={`url(#${uid}f)`} />
          <g fill="#D9957A" opacity=".8">
            {SPECKLES.map(([cx, cy, r]) => <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r={r} />)}
          </g>
        </g>
      </g>
      <ellipse cx="96" cy="64" rx="11" ry="21" fill="#fff" opacity=".55" transform="rotate(18 96 64)" />
      <path d="M26 150 C70 188 170 188 214 150 C214 176 170 194 120 194 C70 194 26 176 26 150 Z" fill={`url(#${uid}n)`} />
      <g fill="none" stroke="#6E5039" strokeWidth="3" strokeLinecap="round">
        <path d="M34 160 C70 150 100 158 130 152" /><path d="M206 160 C170 150 150 158 118 154" /><path d="M52 172 C90 162 130 172 182 160" />
      </g>
    </svg>
  );
}
