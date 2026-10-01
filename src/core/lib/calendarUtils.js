// Gemeinsame Helfer für den Hub-Kalender (Datum, Quelle/Farbe, Filter-Keys).

// WICHTIG: NICHT d.toISOString() verwenden — das rechnet in UTC um und
// verschiebt Termine bei UTC+1/+2 auf den falschen Tag. Immer lokale
// Komponenten (siehe CLAUDE.md).
export function toDateStr(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
// 'YYYY-MM-DD' → lokales Date (Mitternacht), ohne UTC-Umweg.
export function parseDateStr(str) {
  const [y, m, d] = str.split('-').map(Number);
  return new Date(y, m - 1, d);
}
export function addDays(date, n) {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}
export function addDaysStr(str, n) {
  return toDateStr(addDays(parseDateStr(str), n));
}
// Tage zwischen zwei Datums-Strings (b - a), DST-sicher über Math.round.
export function diffDays(a, b) {
  return Math.round((parseDateStr(b) - parseDateStr(a)) / 86400000);
}
export function startOfWeek(date) {
  const d = new Date(date);
  const dow = (d.getDay() + 6) % 7; // 0 = Mo
  d.setDate(d.getDate() - dow);
  return d;
}
export function startOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}
// Monatsraster: Mo der ersten Woche bis So der letzten, immer volle Wochen.
export function monthGridDays(date) {
  const gridStart = startOfWeek(startOfMonth(date));
  return Array.from({ length: 42 }, (_, i) => addDays(gridStart, i));
}

export const WEEKDAYS_SHORT = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];
export const MONTH_NAMES = [
  'Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
  'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember',
];

// Icon je Quelle (Emoji-Platzhalter, Ersatz durch Icon-Set geplant).
export const SOURCE_ICON = {
  sport: '💪', shopping: '🛒', todo: '✓', finance: '€', google: '📅',
};

// App-Kategorien (eigene Daten). Google-Termine werden über die Farbe ihres
// Google-Kalenders gefärbt, nicht über diese Map.
export const APP_CATEGORIES = {
  sport:    { label: 'Sport',    color: 'var(--action-primary)' },
  shopping: { label: 'Einkauf',  color: 'var(--status-positive)' },
  todo:     { label: 'Aufgaben', color: 'var(--text-muted)' },
  finance:  { label: 'Finanzen', color: 'var(--status-caution)' },
};
export const GOOGLE_FALLBACK_COLOR = '#4285f4';

// Filter-Schlüssel eines Termins: 'app:<modul>' oder 'google:<kalenderId>'.
export function filterKey(ev) {
  return ev.source_module === 'google'
    ? `google:${ev.google_calendar_id ?? ''}`
    : `app:${ev.source_module}`;
}

// Darstellungsdaten (Farbe, Quelle, Label) für Zeile, Chip, Punkte, Sheet.
export function describeEvent(ev, calMap) {
  if (ev.source_module === 'google') {
    const cal = calMap[ev.google_calendar_id];
    return { isGoogle: true, color: cal?.color || GOOGLE_FALLBACK_COLOR, sourceLabel: 'Google', detail: cal?.summary ?? null };
  }
  const cat = APP_CATEGORIES[ev.source_module];
  return { isGoogle: false, color: cat?.color ?? 'var(--text-muted)', sourceLabel: 'App', detail: cat?.label ?? ev.source_module };
}

// Todo (Tabelle `todos`) → Kalender-Termin. Ganztägig am Fälligkeitstag.
// Todos werden live aus dem Hub-State gespeichert, NICHT aus calendar_events,
// damit Abhaken in Kalender und Aufgabenliste immer dieselbe Zeile ist.
export function todoToEvent(t) {
  return {
    id: `todo-${t.id}`,
    todoId: t.id,
    source_module: 'todo',
    title: t.title,
    event_date: t.due_date,
    event_date_end: null,
    event_time: null,
    event_time_end: null,
    done: Boolean(t.done),
    priority: Boolean(t.priority),
  };
}

export function isAllDay(ev) { return !ev.event_time; }

// Zeitangabe je Tag-Instanz. Mehrtägige Termine tragen _dayIndex/_spanLen
// (siehe expandMultiDay in calendarData.js).
export function formatTimeRange(ev) {
  const multi = (ev._spanLen ?? 1) > 1;
  const start = ev.event_time ? ev.event_time.slice(0, 5) : null;
  const end = ev.event_time_end ? ev.event_time_end.slice(0, 5) : null;
  const dayInfo = multi ? ` · Tag ${ev._dayIndex + 1}/${ev._spanLen}` : '';
  if (multi && start) {
    if (ev._dayIndex === 0) return `ab ${start} Uhr${dayInfo}`;
    if (ev._dayIndex === ev._spanLen - 1) return (end ? `bis ${end} Uhr` : 'Ganztägig') + dayInfo;
    return `Ganztägig${dayInfo}`;
  }
  if (!start) return `Ganztägig${dayInfo}`;
  return end && end !== start ? `${start}–${end} Uhr` : `${start} Uhr`;
}

// Sortierung innerhalb eines Tages: Ganztägiges zuerst, dann nach Uhrzeit.
export function sortDay(list) {
  return list.slice().sort((a, b) => {
    const ta = a.event_time ?? '', tb = b.event_time ?? '';
    if (!ta !== !tb) return ta ? 1 : -1;
    return ta.localeCompare(tb) || a.title.localeCompare(b.title);
  });
}
