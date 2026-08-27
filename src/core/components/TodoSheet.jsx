import { useState } from 'react';
import { useAuth } from '../lib/AuthContext';
import { useUi } from '../lib/UiContext';
import { saveTodo } from '../lib/todoData';

// Schlankes Bottom-Sheet zum Anlegen eines neuen ToDos.
// Geöffnet über den "+ Aufgabe"-Button im Hub.
// Props:
//   onClose()       — Sheet schließen
//   onSaved(todo)   — neues Todo wurde gespeichert, Hub aktualisieren
//   editTodo        — optional: bestehendes Todo zum Bearbeiten

export default function TodoSheet({ onClose, onSaved, editTodo = null }) {
  const { session } = useAuth();
  const { showToast } = useUi();

  const [title,    setTitle]    = useState(editTodo?.title    ?? '');
  const [note,     setNote]     = useState(editTodo?.note     ?? '');
  const [dueDate,  setDueDate]  = useState(editTodo?.due_date ?? '');
  const [priority, setPriority] = useState(editTodo?.priority ?? false);
  const [saving,   setSaving]   = useState(false);

  async function submit() {
    if (!title.trim()) return showToast('Bitte einen Titel eingeben');
    setSaving(true);
    try {
      const saved = await saveTodo(session, {
        ...(editTodo?.id ? { id: editTodo.id } : {}),
        title:    title.trim(),
        note:     note.trim() || null,
        due_date: dueDate || null,
        priority,
        done:     editTodo?.done ?? false,
      });
      onSaved(saved);
      onClose();
    } catch (e) {
      console.error('[TodoSheet]', e);
      showToast('Konnte nicht gespeichert werden');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="sheet-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="sheet">
        {/* Header */}
        <div className="sheet-header">
          <span className="sheet-title">{editTodo ? 'Aufgabe bearbeiten' : 'Neue Aufgabe'}</span>
          <button className="sheet-cancel" onClick={onClose}>Abbrechen</button>
        </div>

        <div className="todo-sheet-body">
          {/* Titel */}
          <div className="todo-sheet-field">
            <input
              className="todo-sheet-input todo-sheet-input--title"
              type="text"
              placeholder="Was ist zu tun?"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              autoFocus
              onKeyDown={(e) => e.key === 'Enter' && submit()}
            />
          </div>

          {/* Notiz */}
          <div className="todo-sheet-field">
            <input
              className="todo-sheet-input"
              type="text"
              placeholder="Notiz (optional)"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>

          {/* Fälligkeitsdatum + Priorität */}
          <div className="todo-sheet-row">
            <div className="todo-sheet-field todo-sheet-field--half">
              <label className="todo-sheet-label">Fällig am <span className="todo-sheet-optional">(optional)</span></label>
              <div className="todo-sheet-date-row">
                <input
                  className="todo-sheet-input"
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  style={{ flex: 1 }}
                />
                {dueDate && (
                  <button
                    className="todo-sheet-date-clear"
                    onClick={() => setDueDate('')}
                    type="button"
                    aria-label="Datum entfernen"
                  >×</button>
                )}
              </div>
            </div>

            <button
              className={`todo-priority-toggle ${priority ? 'active' : ''}`}
              onClick={() => setPriority((p) => !p)}
              type="button"
            >
              {priority ? '⬆ Wichtig' : '⬆ Wichtig'}
            </button>
          </div>
        </div>

        {/* Speichern */}
        <button
          className={`sheet-save ${(!title.trim() || saving) ? 'disabled' : ''}`}
          onClick={submit}
          disabled={!title.trim() || saving}
        >
          {saving ? 'Wird gespeichert…' : editTodo ? 'Speichern' : 'Aufgabe hinzufügen'}
        </button>
      </div>
    </div>
  );
}
