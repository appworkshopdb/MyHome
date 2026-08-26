// modules/shopping/components/ListView.jsx
// Punkte 9 (Liste leeren ist in ItemsView), 10 (Umbenennen), 11 (Vorlagen).
// Zeigt normale Listen + Vorlagen getrennt.
// Tap auf Liste → öffnet ItemsView (via onOpenList).

import { useState, useRef, useEffect } from 'react';
import { IconPlus, IconTrash, IconChevronRight, IconEdit } from '../../../core/components/Icons.jsx';
import {
  saveList, deleteList, loadTemplates, loadFromTemplate, updateListStatus,
} from '../lib/shoData.js';

const DEFAULT_ICONS = ['🛒', '🥦', '🏠', '🎉', '💊', '🐾', '🧹', '📦'];

export default function ListView({ lists, onListsChange, onOpenList }) {
  const [showForm,    setShowForm]    = useState(false);  // Neue Liste
  const [name,        setName]        = useState('');
  const [icon,        setIcon]        = useState('🛒');
  const [dueDate,     setDueDate]     = useState('');
  const [dueTime,     setDueTime]     = useState('');
  const [saving,      setSaving]      = useState(false);
  const [error,       setError]       = useState(null);
  const [deleting,    setDeleting]    = useState(null);
  const [statusBusy,  setStatusBusy]  = useState(null); // id der Liste deren Status gerade gesetzt wird

  // Umbenennen
  const [editId,      setEditId]      = useState(null);
  const [editName,    setEditName]    = useState('');
  const [editSaving,  setEditSaving]  = useState(false);

  // Vorlagen
  const [templates,   setTemplates]   = useState([]);
  const [showTmpl,    setShowTmpl]    = useState(false);
  const [tmplLoading, setTmplLoading] = useState(false);
  const [loadingTmpl, setLoadingTmpl] = useState(null); // id der Vorlage die geladen wird

  const inputRef   = useRef(null);
  const editRef    = useRef(null);

  useEffect(() => {
    if (showForm) inputRef.current?.focus();
  }, [showForm]);

  useEffect(() => {
    if (editId) editRef.current?.focus();
  }, [editId]);

  // ─── Neue Liste ──────────────────────────────────────────────
  async function handleSave() {
    const trimmed = name.trim();
    if (!trimmed) return;
    setSaving(true); setError(null);
    try {
      await saveList({ name: trimmed, icon, due_date: dueDate || null, due_time: dueTime || null });
      await onListsChange();
      setName(''); setIcon('🛒'); setDueDate(''); setDueTime(''); setShowForm(false);
    } catch { setError('Speichern fehlgeschlagen.'); }
    finally { setSaving(false); }
  }

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

  // ─── Status manuell setzen ──────────────────────────────────
  async function handleStatusCycle(e, list) {
    e.stopPropagation();
    // Effektiven aktuellen Status berechnen (wie in StatusBadge)
    const total  = list._total ?? 0;
    const done   = list._done  ?? 0;
    let auto;
    if (total === 0)         auto = 'offen';
    else if (done === total) auto = 'erledigt';
    else if (done > 0)       auto = 'im_einkauf';
    else                     auto = 'offen';
    const manual    = list.status || 'offen';
    const effective = manual !== 'offen' ? manual : auto;
    // Cycle: offen → im_einkauf → erledigt → offen
    const cycle = { offen: 'im_einkauf', im_einkauf: 'erledigt', erledigt: 'offen' };
    const next  = cycle[effective];
    setStatusBusy(list.id);
    try {
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

  // ─── Key-Handler ─────────────────────────────────────────────
  function handleKeyDown(e) {
    if (e.key === 'Enter') handleSave();
    if (e.key === 'Escape') { setShowForm(false); setName(''); }
  }

  function handleEditKeyDown(e) {
    if (e.key === 'Enter') handleRename();
    if (e.key === 'Escape') setEditId(null);
  }

  // Normale Listen (keine Vorlagen)
  const normalLists = lists.filter((l) => !l.is_template);

  return (
    <div>
      {error && (
        <div style={{ fontSize: '0.85rem', color: 'var(--danger)', marginBottom: 12 }}>
          {error}
        </div>
      )}

      {/* Empty State */}
      {normalLists.length === 0 && !showForm && (
        <div className="sho-empty">
          <div className="sho-empty-icon">🛒</div>
          <div className="sho-empty-title">Noch keine Liste</div>
          <div className="sho-empty-text">
            Leg eine Einkaufsliste an — z.B. für REWE, Aldi oder den nächsten Grillabend.
          </div>
        </div>
      )}

      {/* Listen */}
      {normalLists.length > 0 && (
        <div className="sho-lists">
          {normalLists.map((list) => (
            <div key={list.id} className="sho-list-item-wrap">
              {/* Umbenennen-Modus */}
              {editId === list.id ? (
                <div className="sho-inline-edit">
                  <input
                    ref={editRef}
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    onKeyDown={handleEditKeyDown}
                    onBlur={handleRename}
                    maxLength={60}
                  />
                  <button
                    className="btn btn-primary"
                    onClick={handleRename}
                    disabled={editSaving}
                    style={{ flexShrink: 0, padding: '6px 12px', minHeight: 36 }}
                  >
                    {editSaving ? '…' : 'OK'}
                  </button>
                </div>
              ) : (
                <button
                  className="sho-list-item"
                  onClick={() => onOpenList(list)}
                  disabled={deleting === list.id}
                >
                  <div className="sho-list-icon">{list.icon || '🛒'}</div>
                  <div className="sho-list-info">
                    <div className="sho-list-name">{list.name}</div>
                  {(list.due_date) && (
                    <DueBadge date={list.due_date} time={list.due_time} />
                  )}
                    <StatusBadge
                      list={list}
                      busy={statusBusy === list.id}
                      onCycle={(e) => handleStatusCycle(e, list)}
                    />
                  </div>
                  {/* Umbenennen */}
                  <button
                    className="btn-icon"
                    onClick={(e) => startEdit(e, list)}
                    aria-label="Umbenennen"
                    style={{ marginRight: 0 }}
                  >
                    <IconEdit size={15} />
                  </button>
                  {/* Löschen */}
                  <button
                    className="btn-icon"
                    onClick={(e) => handleDelete(e, list.id)}
                    aria-label="Liste löschen"
                  >
                    <IconTrash size={15} />
                  </button>
                  <div style={{ width: 16, height: 16, color: 'var(--text-muted)', flexShrink: 0 }}>
                    <IconChevronRight />
                  </div>
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Neue-Liste-Formular */}
      {showForm && (
        <div className="sho-new-list-form">
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {DEFAULT_ICONS.map((ic) => (
              <button
                key={ic}
                onClick={() => setIcon(ic)}
                style={{
                  fontSize: '1.4rem', width: 40, height: 40, borderRadius: 0,
                  border: icon === ic ? '2px solid var(--accent)' : '1.5px solid var(--border)',
                  background: icon === ic ? 'var(--accent-light)' : 'var(--bg-card)',
                  cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
              >
                {ic}
              </button>
            ))}
          </div>
          <input
            ref={inputRef}
            type="text"
            placeholder="Name der Liste, z.B. REWE"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={handleKeyDown}
            maxLength={60}
          />

          {/* Fälligkeit */}
          <div className="sho-due-row">
            <div className="sho-due-field">
              <label className="sho-due-label">Fällig am</label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="sho-due-input"
              />
            </div>
            <div className="sho-due-field">
              <label className="sho-due-label">Tageszeit</label>
              <select
                value={dueTime}
                onChange={(e) => setDueTime(e.target.value)}
                className="sho-unit-select"
              >
                <option value="">Optional</option>
                <option value="morgens">🌅 Morgens</option>
                <option value="mittags">☀️ Mittags</option>
                <option value="nachmittags">🌤️ Nachmittags</option>
                <option value="abends">🌙 Abends</option>
              </select>
            </div>
          </div>

          <div className="sho-new-list-actions">
            <button
              className="btn btn-secondary"
              onClick={() => { setShowForm(false); setName(''); setDueDate(''); setDueTime(''); setError(null); }}
            >
              Abbrechen
            </button>
            <button
              className="btn btn-primary"
              onClick={handleSave}
              disabled={saving || !name.trim()}
            >
              {saving ? 'Speichern …' : 'Anlegen'}
            </button>
          </div>
        </div>
      )}

      {/* Buttons: Neue Liste + Aus Vorlage */}
      {!showForm && (
        <div className="sho-bottom-actions">
          <button className="sho-add-btn" onClick={() => setShowForm(true)}>
            <span style={{ display: 'flex', width: 20, height: 20 }}><IconPlus /></span>
            Neue Liste
          </button>
          <button
            className="sho-add-btn sho-tmpl-btn"
            onClick={handleShowTemplates}
            disabled={tmplLoading}
          >
            <span style={{ fontSize: '1rem' }}>📋</span>
            {tmplLoading ? 'Laden …' : 'Aus Vorlage'}
          </button>
        </div>
      )}

      {/* Vorlagen-Panel */}
      {showTmpl && (
        <div className="sho-tmpl-panel">
          <div className="sho-tmpl-header">
            <span className="card-title" style={{ marginBottom: 0 }}>Vorlagen</span>
            <button className="btn-icon" onClick={() => setShowTmpl(false)}>✕</button>
          </div>

          {templates.length === 0 && (
            <div className="sho-empty" style={{ padding: '24px 0' }}>
              <div className="sho-empty-text">
                Noch keine Vorlagen. Öffne eine Liste und tippe auf „Als Vorlage speichern".
              </div>
            </div>
          )}

          {templates.map((tmpl) => (
            <button
              key={tmpl.id}
              className="sho-list-item"
              onClick={() => handleLoadTemplate(tmpl)}
              disabled={loadingTmpl === tmpl.id || deleting === tmpl.id}
            >
              <div className="sho-list-icon">{tmpl.icon || '📋'}</div>
              <div className="sho-list-info">
                <div className="sho-list-name">{tmpl.name}</div>
              </div>
              <button
                className="btn-icon"
                onClick={(e) => handleDeleteTemplate(e, tmpl.id)}
                aria-label="Vorlage löschen"
              >
                <IconTrash size={15} />
              </button>
              <div style={{ width: 16, height: 16, color: 'var(--text-muted)', flexShrink: 0 }}>
                <IconChevronRight />
              </div>
            </button>
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
  const total  = list._total ?? 0;
  const done   = list._done  ?? 0;
  const openLeft = total - done;

  // Automatischer Status aus Item-Counts (nur Startwert wenn noch kein manueller gesetzt)
  let auto;
  if (total === 0)         auto = 'offen';
  else if (done === total) auto = 'erledigt';
  else if (done > 0)       auto = 'im_einkauf';
  else                     auto = 'offen';

  // Manueller Status gewinnt IMMER — auto nur wenn status noch 'offen' (DB-Default)
  // und auto etwas anderes sagt (z.B. alle abgehakt → erledigt)
  const manual    = list.status || 'offen';
  const effective = manual !== 'offen' ? manual : auto;

  const labels = {
    offen:      'Offen',
    im_einkauf: 'Im Einkauf',
    erledigt:   'Erledigt',
  };

  // Artikel-offen-Hinweis in allen Stati anzeigen (außer wenn 0 offen)
  const showHint = openLeft > 0 && total > 0;

  return (
    <span className="sho-status-wrap">
      <button
        className={`sho-status-badge sho-status-${effective}`}
        onClick={onCycle}
        disabled={busy}
        title="Status ändern — Tippen zum Wechseln"
      >
        {busy ? '…' : labels[effective]}
      </button>
      {showHint && (
        <span className="sho-status-hint">{openLeft} offen</span>
      )}
    </span>
  );
}

// ─── Fälligkeits-Badge ────────────────────────────────────────────────
const TIME_ICONS = {
  morgens:      '🌅',
  mittags:      '☀️',
  nachmittags:  '🌤️',
  abends:       '🌙',
};

function DueBadge({ date, time }) {
  const today    = new Date().toISOString().slice(0, 10);
  const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);

  let label;
  if (date === today)    label = 'Heute';
  else if (date === tomorrow) label = 'Morgen';
  else {
    // Deutsches Datum: TT.MM.
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
