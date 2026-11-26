// SVG-Pfade 1:1 aus der Original-index.html bzw. den Views übernommen,
// damit die Optik identisch bleibt.
// Bedien-Symbole (Stift, Papierkorb, Kreuz, Pfeile, Haken …) kommen seit dem Redesign aus Icon.jsx;
// die Namen hier bleiben, damit bestehende Aufrufe weiter funktionieren.
import Icon from './Icon';

export const IconMonth = () => (
  <svg viewBox="0 0 24 24">
    <rect x="3" y="4" width="18" height="18" rx="2" stroke="currentColor" strokeWidth="1.8" fill="none" />
    <line x1="3" y1="9" x2="21" y2="9" stroke="currentColor" strokeWidth="1.8" />
    <line x1="8" y1="2" x2="8" y2="6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    <line x1="16" y1="2" x2="16" y2="6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
  </svg>
);

export const IconSummary = () => (
  <svg viewBox="0 0 24 24">
    <polyline points="3,17 9,11 13,15 21,7" stroke="currentColor" strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    <polyline points="14,7 21,7 21,14" stroke="currentColor" strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export const IconContracts = () => (
  <svg viewBox="0 0 24 24">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" stroke="currentColor" strokeWidth="1.8" fill="none" />
    <polyline points="14,2 14,8 20,8" stroke="currentColor" strokeWidth="1.8" fill="none" />
    <line x1="8" y1="13" x2="16" y2="13" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    <line x1="8" y1="17" x2="13" y2="17" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
  </svg>
);

export const IconSettings = () => <Icon name="settings" size={null} />;

export const IconChevronLeft = () => <Icon name="back" size={null} />;

export const IconChevronRight = () => <Icon name="open" size={null} />;

export const IconTrash = ({ size = 16 }) => <Icon name="trash" size={null} style={{ width: size, height: size }} />;

export const IconEdit = () => <Icon name="edit" size={null} />;

export const IconDownload = () => <Icon name="download" size={null} style={{ width: 16, height: 16 }} />;

export const IconUpload = () => <Icon name="upload" size={null} style={{ width: 16, height: 16 }} />;

export const IconFile = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" style={{ width: 16, height: 16 }}>
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <polyline points="14,2 14,8 20,8" />
  </svg>
);

export const IconMenu = () => <Icon name="menu" size={null} />;

export const IconClose = () => <Icon name="close" size={null} />;

export const IconHome = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 11l9-8 9 8" /><path d="M5 10v10a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1V10" />
  </svg>
);

export const IconLock = () => <Icon name="lock" size={null} style={{ width: 15, height: 15 }} />;

export const IconUserRound = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="8" r="4" /><path d="M4 20c0-4 3.5-7 8-7s8 3 8 7" />
  </svg>
);

export const IconBack = () => <Icon name="back" size={null} />;

export const IconBook = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 5.5C4 4.7 4.7 4 5.5 4H12v16H5.5c-.8 0-1.5-.7-1.5-1.5v-13Z" />
    <path d="M20 5.5c0-.8-.7-1.5-1.5-1.5H12v16h6.5c.8 0 1.5-.7 1.5-1.5v-13Z" />
  </svg>
);

export const IconBulb = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 18h6" /><path d="M10 22h4" />
    <path d="M12 2a7 7 0 0 0-4 12.7c.6.5 1 1.3 1 2.3h6c0-1 .4-1.8 1-2.3A7 7 0 0 0 12 2Z" />
  </svg>
);

export const IconCheck = () => <Icon name="check" size={null} strokeWidth={2} />;

export const IconChevronDown = () => <Icon name="expand" size={null} />;

export const IconList = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
    <circle cx="4.5" cy="6" r="1.3" fill="currentColor" stroke="none" />
    <circle cx="4.5" cy="12" r="1.3" fill="currentColor" stroke="none" />
    <circle cx="4.5" cy="18" r="1.3" fill="currentColor" stroke="none" />
    <line x1="9" y1="6" x2="20" y2="6" /><line x1="9" y1="12" x2="20" y2="12" /><line x1="9" y1="18" x2="20" y2="18" />
  </svg>
);

export const IconPlus = () => <Icon name="plus" size={null} />;

export const IconSearch = () => <Icon name="search" size={null} />;

export const IconUtensils = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M7 3v7a2 2 0 0 0 2 2v9" /><path d="M7 3v5" /><path d="M10 3v5" />
    <path d="M17 3c-1.7 0-3 2-3 5s1 5 3 5v8" />
  </svg>
);

export const IconCalendarSmall = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" style={{ width: 14, height: 14 }}>
    <rect x="3" y="4" width="18" height="18" rx="2" />
    <line x1="3" y1="9" x2="21" y2="9" />
    <line x1="8" y1="2" x2="8" y2="6" /><line x1="16" y1="2" x2="16" y2="6" />
  </svg>
);

export const IconDumbbell = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M6.5 6.5v11" /><path d="M17.5 6.5v11" />
    <path d="M4 9v6" /><path d="M20 9v6" />
    <line x1="6.5" y1="12" x2="17.5" y2="12" />
  </svg>
);

export const IconSun = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
    <circle cx="12" cy="12" r="4.2" />
    <line x1="12" y1="2" x2="12" y2="5" />
    <line x1="12" y1="19" x2="12" y2="22" />
    <line x1="4.2" y1="4.2" x2="6.3" y2="6.3" />
    <line x1="17.7" y1="17.7" x2="19.8" y2="19.8" />
    <line x1="2" y1="12" x2="5" y2="12" />
    <line x1="19" y1="12" x2="22" y2="12" />
    <line x1="4.2" y1="19.8" x2="6.3" y2="17.7" />
    <line x1="17.7" y1="6.3" x2="19.8" y2="4.2" />
  </svg>
);

export const IconCart = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="9" cy="21" r="1.4" fill="currentColor" stroke="none" />
    <circle cx="18" cy="21" r="1.4" fill="currentColor" stroke="none" />
    <path d="M2 3h2l2.6 12.2a2 2 0 0 0 2 1.6h8.8a2 2 0 0 0 2-1.6L21 7H6" />
  </svg>
);

export const IconBrain = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9.5 3.5a2.7 2.7 0 0 0-2.7 2.7 2.4 2.4 0 0 0-1.8 2.3c0 .5.15.95.4 1.35A2.5 2.5 0 0 0 4 12c0 1 .55 1.85 1.35 2.3-.1.3-.15.6-.15.95a2.5 2.5 0 0 0 2.5 2.5c.2 0 .4-.02.6-.07A2.6 2.6 0 0 0 11 20.5V6.2A2.7 2.7 0 0 0 9.5 3.5Z" />
    <path d="M14.5 3.5a2.7 2.7 0 0 1 2.7 2.7 2.4 2.4 0 0 1 1.8 2.3c0 .5-.15.95-.4 1.35A2.5 2.5 0 0 1 20 12c0 1-.55 1.85-1.35 2.3.1.3.15.6.15.95a2.5 2.5 0 0 1-2.5 2.5c-.2 0-.4-.02-.6-.07A2.6 2.6 0 0 1 13 20.5V6.2a2.7 2.7 0 0 1 1.5-2.7Z" />
  </svg>
);

export const IconEuro = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 6.2A7 7 0 0 0 8.3 9M8.3 15A7 7 0 0 0 18 17.8" />
    <line x1="4" y1="10.2" x2="14.5" y2="10.2" />
    <line x1="4" y1="13.6" x2="13" y2="13.6" />
  </svg>
);

export const IconInfo = () => <Icon name="info" size={null} />;
