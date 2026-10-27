// Kleine Strichsymbole für die Sport-Auswertung (Kacheln und Erfolge). Reine Darstellung.
const PATHS = {
  list: <path d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01" />,
  check: <><circle cx="12" cy="12" r="8.5" /><path d="M8.5 12.5l2.5 2.5 4.5-5" /></>,
  clock: <><circle cx="12" cy="12" r="8.5" /><path d="M12 7v5l3 2" /></>,
  moon: <path d="M20 14.5A8 8 0 1 1 9.5 4 6.5 6.5 0 0 0 20 14.5z" />,
  flame: <path d="M12 3c1 3 5 5 5 10a5 5 0 0 1-10 0c0-2 1-3 2-4 0 2 1 3 2 3 0-3-1-5 1-9z" />,
  flag: <path d="M5 21V4M5 4h11l-2 4 2 4H5" />,
  dumbbell: <path d="M3 9v6M6.5 6v12M17.5 6v12M21 9v6M6.5 12h11" />,
  bolt: <path d="M13 3L5 14h6l-1 7 8-11h-6z" />,
  medal: <><circle cx="12" cy="15" r="5" /><path d="M8.5 3l3.5 6 3.5-6" /></>,
  trophy: <path d="M8 4h8v5a4 4 0 0 1-8 0zM8 6H5v2a3 3 0 0 0 3 3M16 6h3v2a3 3 0 0 1-3 3M12 13v4M9 20h6M10 17h4" />,
  link: <path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" />,
  calcheck: <><rect x="4" y="5" width="16" height="15" rx="3" /><path d="M4 10h16M9 3v4M15 3v4M9 15l2 2 4-4" /></>,
  repeat: <path d="M17 2l3 3-3 3M20 5H9a5 5 0 0 0-5 5v1M7 22l-3-3 3-3M4 19h11a5 5 0 0 0 5-5v-1" />,
  shield: <path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6zM9 12l2 2 4-4" />,
  shapes: <><path d="M9 3l4 7H5z" /><circle cx="17" cy="7" r="3.5" /><rect x="4" y="14" width="7" height="7" rx="1.5" /><path d="M14 14l3.5 7 3.5-7z" /></>,
  compass: <><circle cx="12" cy="12" r="9" /><path d="M15.5 8.5l-2 5-5 2 2-5z" /></>,
  trend: <path d="M3 17l6-6 4 4 8-8M15 7h6v6" />,
  mountain: <path d="M3 19l6-10 4 6 3-4 5 8z" />,
  rocket: <><path d="M12 3c3 2 5 5 5 9l-2 3H9l-2-3c0-4 2-7 5-9zM9 15l-2 5 4-2M15 15l2 5-4-2" /><circle cx="12" cy="9.5" r="1.5" /></>,
};

export default function SportIcon({ name, size = 22, stroke = 2 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {PATHS[name]}
    </svg>
  );
}
