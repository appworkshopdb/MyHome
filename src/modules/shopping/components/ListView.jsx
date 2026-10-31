// modules/shopping/components/ListView.jsx
// "Alle Listen" (Variante B): oben die Fokus-Karte (Liste "Im Einkauf", sonst nächster Termin),
// darunter Filter (Offen / Erledigt / Alle) und kompakte Zeilen mit Fortschritts-Ring.
// In "Offen" sind die Listen nach Zeit gruppiert (Überfällig, Heute, Diese Woche, Später, Ohne Datum).
// Status, Fälligkeit, Name und Löschen stecken hinter "•••" (Sheet). Tap auf die Zeile → ItemsView
// (via onOpenList). Neue Listen (auch aus einer Vorlage) entstehen nur über den globalen Plus-Knopf
// (ShoppingQuickSheet).

import { useState } from 'react';
import FocusCard from '../../../core/components/FocusCard.jsx';
import SheetShell from '../../../core/components/SheetShell.jsx';
import {
  saveList, deleteList, updateListStatus, releaseListBooking, pickActiveList,
} from '../lib/shoData.js';
import { DAY_PARTS } from '../lib/data/stores.js';

const STATUS = [
  { key: 'offen',      label: 'Offen' },
  { key: 'im_einkauf', label: 'Im Einkauf' },
  { key: 'erledigt',   label: 'Erledigt' },
];
const RANK = { im_einkauf: 0, offen: 1, erledigt: 2 };
const WEEKDAYS = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];

// Lokale Datums-Strings (nie toISOString — das rechnet über UTC und verschiebt den Tag).
function toDateStr(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
const addDays = (n) => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n); };

// Tage von heute bis zum Fälligkeitsdatum (negativ = überfällig), null ohne Datum
function dayOffset(dateStr) {
  if (!dateStr) return null;
  const [y, m, d] = dateStr.split('-').map(Number);
  const t = new Date();
  return Math.round((new Date(y, m - 1, d) - new Date(t.getFullYear(), t.getMonth(), t.getDate())) / 86400000);
}

function dueText(list) {
  const off = dayOffset(list.due_date);
  if (off == null) return '';
  let t;
  if (off === 0) t = 'Heute';
  else if (off === 1) t = 'Morgen';
  else if (off === -1) t = 'Gestern';
  else if (off > 1 && off < 7) t = WEEKDAYS[addDays(off).getDay()];
  else { const [, m, d] = list.due_date.split('-'); t = `${d}.${m}.`; }
  return list.due_time ? `${t} · ${list.due_time}` : t;
}

function progressText(l) {
  const total = l._total ?? 0, done = l._done ?? 0;
  if (total === 0) return 'Noch keine Artikel';
  return done === total ? `Alle ${total} erledigt` : `${done} von ${total} erledigt`;
}

// Liste für die Fokus-Karte: "Im Einkauf" zuerst, sonst nächster Termin, sonst die erste offene
function pickFocus(open) {
  const active = pickActiveList(open);
  if (active && active.status === 'im_einkauf') return active;
  const dated = open.filter((l) => l.due_date).sort((a, b) => dayOffset(a.due_date) - dayOffset(b.due_date));
  return dated[0] || active || open[0] || null;
}

function Ring({ list }) {
  const total = list._total ?? 0, done = list._done ?? 0;
  const r = 15, c = 2 * Math.PI * r, p = total ? done / total : 0;
  return (
    <span className="sho-lring" aria-hidden="true">
      <svg viewBox="0 0 38 38">
        <circle cx="19" cy="19" r={r} className="track" />
        <circle cx="19" cy="19" r={r} className="val" strokeDasharray={`${(c * p).toFixed(1)} ${c.toFixed(1)}`} />
      </svg>
      <span>{total ? `${done}/${total}` : '–'}</span>
    </span>
  );
}

const GROUPS = [
  ['Überfällig',  (o) => o != null && o < 0],
  ['Heute',       (o) => o === 0],
  ['Diese Woche', (o) => o != null && o >= 1 && o <= 6],
  ['Später',      (o) => o != null && o >= 7],
  ['Ohne Datum',  (o) => o == null],
];

export default function ListView({ lists, onListsChange, onOpenList }) {
  const [error,   setError]   = useState(null);
  const [filter,  setFilter]  = useState('offen');
  const [statusBusy, setStatusBusy] = useState(null);

  // "•••"-Sheet
  const [sheetId, setSheetId] = useState(null);
  const [sName,   setSName]   = useState('');
  const [sDue,    setSDue]    = useState('');
  const [sTime,   setSTime]   = useState('');
  const [sBusy,   setSBusy]   = useState(false);
  const [delAsk,  setDelAsk]  = useState(false);

  const normal = lists.filter((l) => !l.is_template);
  const isDone = (l) => (l.status || 'offen') === 'erledigt';
  const open = normal.filter((l) => !isDone(l));
  const done = normal.filter(isDone);
  const focus = pickFocus(open);
  const sheetList = sheetId ? normal.find((l) => l.id === sheetId) : null;

  // ─── Status ──────────────────────────────────────────────────
  async function changeStatus(list, next) {
    const current = list.status || 'offen';
    if (next === current) return;
    // Wiederöffnen einer gebuchten Liste: die Finanz-Buchung würde sonst stehen bleiben und beim
    // erneuten Abschließen doppelt entstehen.
    const hasBooking = Boolean(list.fin_entry_id || list.fin_entry_id_open);
    if (current === 'erledigt' && hasBooking
        && !window.confirm('Die Liste wurde ins Finanzmodul gebucht. Beim Wiederöffnen wird diese Buchung storniert. Fortfahren?')) {
      return;
    }
    setStatusBusy(list.id);
    try {
      if (current === 'erledigt' && hasBooking) await releaseListBooking(list.id);
      await updateListStatus(list.id, next);
      await onListsChange();
    } catch { setError('Status konnte nicht gesetzt werden.'); }
    finally { setStatusBusy(null); }
  }

  // ─── "•••"-Sheet ─────────────────────────────────────────────
  function openSheet(list) {
    setSheetId(list.id);
    setSName(list.name);
    setSDue(list.due_date || '');
    setSTime(list.due_time || '');
    setDelAsk(false);
  }

  async function saveSheet() {
    if (!sheetList) return;
    setSBusy(true); setError(null);
    try {
      await saveList({
        id: sheetList.id,
        name: sName.trim() || sheetList.name,
        due_date: sDue || null,
        due_time: sDue ? (sTime || null) : null,
      });
      await onListsChange();
      setSheetId(null);
    } catch { setError('Speichern fehlgeschlagen.'); }
    finally { setSBusy(false); }
  }

  async function deleteFromSheet() {
    if (!sheetList) return;
    if (!delAsk) { setDelAsk(true); return; }
    setSBusy(true); setError(null);
    try {
      await deleteList(sheetList.id);
      setSheetId(null);
      await onListsChange();
    } catch { setError('Löschen fehlgeschlagen.'); }
    finally { setSBusy(false); }
  }

  // ─── Darstellung ─────────────────────────────────────────────
  function renderRow(l) {
    const fin = isDone(l);
    const due = !fin ? dueText(l) : '';
    return (
      <div key={l.id} className={`sho-lrow${fin ? ' sho-lrow--done' : ''}`}>
        <button className="sho-lrow-open" onClick={() => onOpenList(l)}>
          <span className="sho-lrow-ic">{l.icon || '🛒'}</span>
          <span className="sho-lrow-t">
            <b>{l.name}</b>
            <small>
              {l.status === 'im_einkauf' && <em>Im Einkauf · </em>}
              {progressText(l)}{due ? ` · ${due}` : ''}
            </small>
          </span>
        </button>
        <Ring list={l} />
        <button className="sho-lmore" onClick={() => openSheet(l)} aria-label={`Aktionen für ${l.name}`} disabled={statusBusy === l.id}>•••</button>
      </div>
    );
  }

  const sortByDue = (a, b) => (dayOffset(a.due_date) ?? 0) - (dayOffset(b.due_date) ?? 0);
  const groups = GROUPS
    .map(([title, test]) => ({ title, items: open.filter((l) => test(dayOffset(l.due_date))).sort(sortByDue) }))
    .filter((g) => g.items.length > 0);

  const allSorted = normal
    .map((l, i) => ({ l, i }))
    .sort((a, b) => (RANK[a.l.status || 'offen'] - RANK[b.l.status || 'offen']) || (a.i - b.i))
    .map((x) => x.l);

  let body;
  if (normal.length === 0) {
    body = (
      <div className="sho-lempty">
        <div className="sho-lempty-ic">🛒</div>
        <div className="sho-lempty-title">Noch keine Liste</div>
        <div className="sho-lempty-text">Tippe unten rechts auf das Plus — z.B. für REWE, Aldi oder den nächsten Grillabend.</div>
      </div>
    );
  } else if (filter === 'offen') {
    body = open.length === 0
      ? <div className="sho-lempty-text sho-lnone">Keine offenen Listen.</div>
      : groups.map((g) => (
        <div key={g.title}>
          <div className="sho-lsec"><span>{g.title}</span><span>{g.items.length}</span></div>
          <div className="sho-lrows">{g.items.map(renderRow)}</div>
        </div>
      ));
  } else {
    const shown = filter === 'erledigt' ? done : allSorted;
    body = shown.length === 0
      ? <div className="sho-lempty-text sho-lnone">Keine Listen in dieser Ansicht.</div>
      : <div className="sho-lrows sho-lrows--flat">{shown.map(renderRow)}</div>;
  }

  return (
    <div className="sho-lview">
      {error && <div className="sho-lview-error">{error}</div>}

      {/* Fokus */}
      <FocusCard>
        {focus ? (
          <>
            <FocusCard.Eyebrow>{focus.status === 'im_einkauf' ? 'Im Einkauf' : 'Als Nächstes'}</FocusCard.Eyebrow>
            <div className="sho-focus-title">{focus.name}</div>
            <FocusCard.Progress value={(focus._total ?? 0) > 0 ? (focus._done ?? 0) / focus._total : 0} />
            <FocusCard.Footer divider={false}>
              <span>{progressText(focus)}{dueText(focus) ? ` · ${dueText(focus)}` : ''}</span>
              <FocusCard.Pill onPress={() => onOpenList(focus)}>{focus.status === 'im_einkauf' ? 'Weiter einkaufen' : 'Öffnen'}</FocusCard.Pill>
            </FocusCard.Footer>
          </>
        ) : (
          <>
            <FocusCard.Eyebrow>Keine offene Liste</FocusCard.Eyebrow>
            <div className="sho-focus-title">Tippe auf das Plus, um deine erste Liste anzulegen</div>
          </>
        )}
      </FocusCard>

      {/* Filter */}
      {normal.length > 0 && (
        <div className="sho-lseg" role="group" aria-label="Filter">
          {[['offen', `Offen (${open.length})`], ['erledigt', `Erledigt (${done.length})`], ['alle', 'Alle']].map(([k, label]) => (
            <button key={k} aria-pressed={filter === k} onClick={() => setFilter(k)}>{label}</button>
          ))}
        </div>
      )}

      {body}

      {/* "•••": Status, Fälligkeit, Name, Löschen */}
      {sheetList && (
        <SheetShell onClose={() => setSheetId(null)} labelledBy="sho-lsheet-title">
          <div className="sho-lsheet">
            <div className="sho-lsheet-head">
              <span className="sho-lrow-ic">{sheetList.icon || '🛒'}</span>
              <h3 id="sho-lsheet-title">{sheetList.name}</h3>
            </div>

            <div className="sho-lsheet-l">Status</div>
            <div className="sho-lopts" role="group" aria-label="Status">
              {STATUS.map((s) => (
                <button key={s.key} aria-pressed={(sheetList.status || 'offen') === s.key} disabled={statusBusy === sheetList.id} onClick={() => changeStatus(sheetList, s.key)}>{s.label}</button>
              ))}
            </div>

            <div className="sho-lsheet-l">Fällig</div>
            <div className="sho-lopts" role="group" aria-label="Fällig">
              {[['Heute', toDateStr(addDays(0))], ['Morgen', toDateStr(addDays(1))], ['Wochenende', toDateStr(addDays((6 - new Date().getDay() + 7) % 7))], ['Kein Datum', '']].map(([label, val]) => (
                <button key={label} aria-pressed={sDue === val} onClick={() => setSDue(val)}>{label}</button>
              ))}
            </div>
            <input type="date" className="sho-lfield" value={sDue} onChange={(e) => setSDue(e.target.value)} aria-label="Anderes Datum" />
            {sDue && (
              <div className="sho-lopts" role="group" aria-label="Tageszeit">
                {DAY_PARTS.map((d) => (
                  <button key={d.value} aria-pressed={sTime === d.value} onClick={() => setSTime(sTime === d.value ? '' : d.value)}>{d.icon} {d.label}</button>
                ))}
              </div>
            )}

            <div className="sho-lsheet-l">Name</div>
            <input className="sho-lfield" value={sName} onChange={(e) => setSName(e.target.value)} maxLength={60} aria-label="Name der Liste" />

            <div className="sho-lsheet-btns">
              <button className="sho-lbtn danger" onClick={deleteFromSheet} disabled={sBusy}>{delAsk ? 'Wirklich löschen?' : 'Liste löschen'}</button>
              <button className="sho-lbtn primary" onClick={saveSheet} disabled={sBusy}>{sBusy ? '…' : 'Fertig'}</button>
            </div>
          </div>
        </SheetShell>
      )}
    </div>
  );
}
