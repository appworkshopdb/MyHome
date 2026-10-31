// modules/shopping/components/ListView.jsx
// "Alle Listen": jede Liste als Karte (Symbol, Name, Fortschritt, Status, Datum), Offene zuerst,
// Erledigte darunter. Umbenennen, Löschen, Datum, Status-Wechsel und "Aus Vorlage" wie bisher.
// Tap auf die Karte → öffnet ItemsView (via onOpenList). Neue Liste läuft über den globalen FAB.

import { useState, useRef, useEffect } from 'react';
import { IconTrash, IconChevronRight, IconEdit } from '../../../core/components/Icons.jsx';
import {
  saveList, deleteList, loadTemplates, loadFromTemplate, updateListStatus,
  releaseListBooking,
} from '../lib/shoData.js';

export default function ListView({ lists, onListsChange, onOpenList }) {
  const [error,       setError]       = useState(null);
  const [deleting,    setDeleting]    = useState(null);
  const [statusBusy,  setStatusBusy]  = useState(null); // id der Liste deren Status gerade gesetzt wird
  const [dateEditId,  setDateEditId]  = useState(null); // id der Liste im Datum-Edit-Modus
  const [editDate,    setEditDate]    = useState('');
  const [editTime,    setEditTime]    = useState('');
  const [dateSaving,  setDateSaving]  = useState(false);

  // Umbenennen
  const [editId,      setEditId]      = useState(null);
  const [editName,    setEditName]    = useState('');
  const [editSaving,  setEditSaving]  = useState(false);

  // Vorlagen
  const [templates,   setTemplates]   = useState([]);
  const [showTmpl,    setShowTmpl]    = useState(false);
  const [tmplLoading, setTmplLoading] = useState(false);
  const [loadingTmpl, setLoadingTmpl] = useState(null); // id der Vorlage die geladen wird

  const editRef    = useRef(null);

  useEffect(() => {
    if (editId) editRef.current?.focus();
  }, [editId]);

  // Neue Liste läuft nur noch über den globalen FAB (ShoppingQuickSheet).


  // ─── Löschen ────────────────────────────────────────────────
  async function handleDelete(e, listId) {
    e.stopPropagation();
    if (!window.confirm('Liste und alle Artikel löschen?')) return;
    setDeleting(listId);
    try {
      await deleteList(listId);
      await onListsChange();
    } catch { setError('Löschen fehlgeschlagen.'); }
    finally { setDeleting(null); }
  }

  // ─── Umbenennen ─────────────────────────────────────────────
  function startEdit(e, list) {
    e.stopPropagation();
    setEditId(list.id);
    setEditName(list.name);
  }

  async function handleRename() {
    const trimmed = editName.trim();
    if (!trimmed) { setEditId(null); return; }
    setEditSaving(true);
    try {
      await saveList({ id: editId, name: trimmed });
      await onListsChange();
      setEditId(null);
    } catch { setError('Umbenennen fehlgeschlagen.'); }
    finally { setEditSaving(false); }
  }

  // ─── Datum bearbeiten ────────────────────────────────────────
  function startDateEdit(e, list) {
    e.stopPropagation();
    setDateEditId(list.id);
    setEditDate(list.due_date || '');
    setEditTime(list.due_time || '');
  }

  async function handleSaveDate(listId) {
    setDateSaving(true);
    try {
      await saveList({ id: listId, name: lists.find((l) => l.id === listId)?.name || '', due_date: editDate || null, due_time: editTime || null });
      await onListsChange();
      setDateEditId(null);
    } catch { setError('Datum konnte nicht gespeichert werden.'); }
    finally { setDateSaving(false); }
  }

  async function handleRemoveDate(e, list) {
    e.stopPropagation();
    try {
      await saveList({ id: list.id, name: list.name, due_date: null, due_time: null });
      await onListsChange();
    } catch { setError('Datum konnte nicht entfernt werden.'); }
  }

  // ─── Status manuell setzen ──────────────────────────────────
  async function handleStatusCycle(e, list) {
    e.stopPropagation();
    // Immer vom gespeicherten status ausgehen — keine Auto-Logik im Cycle.
    // Cycle: offen → im_einkauf → erledigt → offen (beliebig, jederzeit)
    const current = list.status || 'offen';
    const cycle   = { offen: 'im_einkauf', im_einkauf: 'erledigt', erledigt: 'offen' };
    const next    = cycle[current];
    // Wiederöffnen einer gebuchten Liste: die Finanz-Buchung würde sonst
    // stehen bleiben und beim erneuten Abschließen doppelt entstehen.
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
    finally  { setStatusBusy(null); }
  }

  // ─── Vorlagen ────────────────────────────────────────────────
  async function handleShowTemplates() {
    setTmplLoading(true);
    try {
      const data = await loadTemplates();
      setTemplates(data);
      setShowTmpl(true);
    } catch { setError('Vorlagen konnten nicht geladen werden.'); }
    finally { setTmplLoading(false); }
  }

  async function handleLoadTemplate(tmpl) {
    const newName = tmpl.name.replace(' (Vorlage)', '').trim();
    setLoadingTmpl(tmpl.id);
    try {
      const newList = await loadFromTemplate(tmpl.id, newName, tmpl.icon || '🛒');
      await onListsChange();
      setShowTmpl(false);
      onOpenList(newList);
    } catch { setError('Vorlage laden fehlgeschlagen.'); }
    finally { setLoadingTmpl(null); }
  }

  async function handleDeleteTemplate(e, tmplId) {
    e.stopPropagation();
    if (!window.confirm('Vorlage löschen?')) return;
    setDeleting(tmplId);
    try {
      await deleteList(tmplId);
      setTemplates((prev) => prev.filter((t) => t.id !== tmplId));
    } catch { setError('Löschen fehlgeschlagen.'); }
    finally { setDeleting(null); }
  }

  function handleEditKeyDown(e) {
    if (e.key === 'Enter') handleRename();
    if (e.key === 'Escape') setEditId(null);
  }

  // Normale Listen (keine Vorlagen): Offene und "Im Einkauf" zuerst, Erledigte darunter
  const normalLists = lists.filter((l) => !l.is_template);
  const rank = { im_einkauf: 0, offen: 1, erledigt: 2 };
  const sorted = normalLists
    .map((l, i) => ({ l, i }))
    .sort((a, b) => (rank[a.l.status || 'offen'] - rank[b.l.status || 'offen']) || (a.i - b.i))
    .map((x) => x.l);
  const activeLists = sorted.filter((l) => (l.status || 'offen') !== 'erledigt');
  const doneLists   = sorted.filter((l) => (l.status || 'offen') === 'erledigt');

  function renderCard(list) {
    const total = list._total ?? 0;
    const done  = list._done ?? 0;
    const finished = (list.status || 'offen') === 'erledigt';
    const sub = total === 0 ? 'Noch keine Artikel' : done === total ? `Alle ${total} erledigt` : `${done} von ${total} erledigt`;

    if (editId === list.id) {
      return (
        <div key={list.id} className="sho-lcard sho-lcard--edit">
          <input
            ref={editRef}
            className="sho-lcard-input"
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            onKeyDown={handleEditKeyDown}
            onBlur={handleRename}
            maxLength={60}
            aria-label="Name der Liste"
          />
          <button className="btn btn-primary sho-lcard-ok" onClick={handleRename} disabled={editSaving}>
            {editSaving ? '…' : 'OK'}
          </button>
        </div>
      );
    }

    return (
      <div key={list.id} className={`sho-lcard${finished ? ' sho-lcard--done' : ''}`}>
        <button className="sho-lcard-main" onClick={() => onOpenList(list)} disabled={deleting === list.id}>
          <span className="sho-lcard-ic">{list.icon || '🛒'}</span>
          <span className="sho-lcard-body">
            <b>{list.name}</b>
            <small>{sub}</small>
          </span>
          <span className="sho-lcard-chev" aria-hidden="true"><IconChevronRight /></span>
        </button>

        {total > 0 && (
          <div className="sho-lcard-bar" aria-hidden="true">
            <i style={{ width: `${Math.round((done / total) * 100)}%` }} />
          </div>
        )}

        {dateEditId === list.id ? (
          <div className="sho-date-inline">
            <input
              type="date"
              value={editDate}
              onChange={(e) => setEditDate(e.target.value)}
              className="sho-due-input"
              aria-label="Fällig am"
            />
            <select value={editTime} onChange={(e) => setEditTime(e.target.value)} className="sho-unit-select" aria-label="Tageszeit">
              <option value="">Tageszeit</option>
              <option value="morgens">🌅 Morgens</option>
              <option value="mittags">☀️ Mittags</option>
              <option value="nachmittags">🌤️ Nachmittags</option>
              <option value="abends">🌙 Abends</option>
            </select>
            <button className="btn btn-primary sho-lcard-ok" onClick={() => handleSaveDate(list.id)} disabled={dateSaving}>
              {dateSaving ? '…' : 'OK'}
            </button>
            <button className="sho-lcard-x" onClick={() => setDateEditId(null)} aria-label="Abbrechen">✕</button>
          </div>
        ) : (
          <div className="sho-lcard-meta">
            <StatusBadge list={list} busy={statusBusy === list.id} onCycle={(e) => handleStatusCycle(e, list)} />
            {list.due_date ? (
              <span className="sho-date-edit-row">
                <button className="sho-due-badge-btn" onClick={(e) => startDateEdit(e, list)} title="Datum ändern">
                  <DueBadge date={list.due_date} time={list.due_time} />
                </button>
                <button className="sho-date-remove" onClick={(e) => handleRemoveDate(e, list)} title="Datum entfernen" aria-label="Datum entfernen">✕</button>
              </span>
            ) : (
              <button className="sho-date-add" onClick={(e) => startDateEdit(e, list)}>+ Datum</button>
            )}
            <span className="sho-lcard-actions">
              <button className="sho-lcard-icon" onClick={(e) => startEdit(e, list)} aria-label="Umbenennen"><IconEdit size={16} /></button>
              <button className="sho-lcard-icon" onClick={(e) => handleDelete(e, list.id)} aria-label="Liste löschen"><IconTrash size={16} /></button>
            </span>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="sho-lview">
      {error && <div className="sho-lview-error">{error}</div>}

      {/* Empty State */}
      {normalLists.length === 0 && (
        <div className="sho-lempty">
          <div className="sho-lempty-ic">🛒</div>
          <div className="sho-lempty-title">Noch keine Liste</div>
          <div className="sho-lempty-text">Leg eine Einkaufsliste an — z.B. für REWE, Aldi oder den nächsten Grillabend.</div>
        </div>
      )}

      {activeLists.length > 0 && (
        <>
          <div className="sho-lsec">Offen ({activeLists.length})</div>
          <div className="sho-lcards">{activeLists.map(renderCard)}</div>
        </>
      )}
      {doneLists.length > 0 && (
        <>
          <div className="sho-lsec">Erledigt ({doneLists.length})</div>
          <div className="sho-lcards">{doneLists.map(renderCard)}</div>
        </>
      )}

      {/* Aus Vorlage — neue Liste läuft über den globalen FAB */}
      <button className="sho-ltmpl" onClick={handleShowTemplates} disabled={tmplLoading}>
        <span aria-hidden="true">📋</span>
        {tmplLoading ? 'Laden …' : 'Aus Vorlage anlegen'}
      </button>

      {/* Vorlagen-Panel */}
      {showTmpl && (
        <div className="sho-lpanel">
          <div className="sho-lpanel-head">
            <b>Vorlagen</b>
            <button className="sho-lcard-icon" onClick={() => setShowTmpl(false)} aria-label="Schließen">✕</button>
          </div>
          {templates.length === 0 && (
            <div className="sho-lempty-text" style={{ padding: '10px 4px 6px' }}>
              Noch keine Vorlagen vorhanden.
            </div>
          )}
          {templates.map((tmpl) => (
            <div key={tmpl.id} className="sho-lpanel-row">
              <button className="sho-lcard-main" onClick={() => handleLoadTemplate(tmpl)} disabled={loadingTmpl === tmpl.id || deleting === tmpl.id}>
                <span className="sho-lcard-ic">{tmpl.icon || '📋'}</span>
                <span className="sho-lcard-body"><b>{tmpl.name}</b><small>{loadingTmpl === tmpl.id ? 'Wird angelegt …' : 'Als neue Liste anlegen'}</small></span>
              </button>
              <button className="sho-lcard-icon" onClick={(e) => handleDeleteTemplate(e, tmpl.id)} aria-label="Vorlage löschen"><IconTrash size={16} /></button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Status-Badge ─────────────────────────────────────────────────────
// Berechnet den effektiven Status:
//   - Manuell gesetzter Status hat Vorrang
//   - Automatik: offen / im_einkauf / erledigt aus _done/_total
// Tap → Status manuell weiterschalten (Cycle)
function StatusBadge({ list, busy, onCycle }) {
  // Gespeicherter Status ist immer maßgeblich; Tipp schaltet weiter (offen → im Einkauf → erledigt → offen).
  const effective = list.status || 'offen';
  const labels = { offen: 'Offen', im_einkauf: 'Im Einkauf', erledigt: 'Erledigt' };
  return (
    <button
      className={`sho-status-badge sho-status-${effective}`}
      onClick={onCycle}
      disabled={busy}
      title="Status ändern — Tippen zum Wechseln"
    >
      {busy ? '…' : labels[effective]}
    </button>
  );
}

// ─── Fälligkeits-Badge ────────────────────────────────────────────────
const TIME_ICONS = {
  morgens:      '🌅',
  mittags:      '☀️',
  nachmittags:  '🌤️',
  abends:       '🌙',
};

// Lokale Datums-Strings (nie toISOString — das rechnet über UTC und verschiebt
// den Tag in Berlin zwischen 0 und 2 Uhr).
function toDateStr(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function DueBadge({ date, time }) {
  const now      = new Date();
  const today    = toDateStr(now);
  const tomorrow = toDateStr(new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1));

  let label;
  if (date === today)    label = 'Heute';
  else if (date === tomorrow) label = 'Morgen';
  else {
    // Deutsches Datum: TT.MM.JJ
    const [y, m, d] = date.split('-');
    label = `${d}.${m}.${y.slice(2)}`;
  }

  const overdue = date < today;
  const icon    = time ? TIME_ICONS[time] : '📅';

  return (
    <span className={`sho-due-badge ${overdue ? 'sho-due-overdue' : ''}`}>
      {icon} {label}{time ? ` · ${time}` : ''}
    </span>
  );
}
