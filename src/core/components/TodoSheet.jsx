// src/core/components/TodoSheet.jsx
// Neue Aufgabe / Aufgabe bearbeiten — ein Schritt im gemeinsamen Wizard-Rahmen
// (core/components/wizard/WizardKit.jsx). Fällig am ist ein Datum-Button mit Kalender.
import { useRef, useState } from 'react';
import { useAuth } from '../lib/AuthContext';
import { useUi } from '../lib/UiContext';
import { saveTodo } from '../lib/todoData';
import { fb } from '../lib/feedback';
import SheetShell from './SheetShell';
import { DateButton, WizardFoot, WizardFrame, WzIconStar, missingHint } from './wizard/WizardKit';

export default function TodoSheet({ onClose, onSaved, editTodo = null }) {
  const { session } = useAuth();
  const { showToast } = useUi();
  const titleRef = useRef(null);

  const [title,    setTitle]    = useState(editTodo?.title    ?? '');
  const [note,     setNote]     = useState(editTodo?.note     ?? '');
  const [dueDate,  setDueDate]  = useState(editTodo?.due_date ?? '');
  const [priority, setPriority] = useState(editTodo?.priority ?? false);
  const [showNote, setShowNote] = useState(Boolean(editTodo?.note));
  const [saving,   setSaving]   = useState(false);

  const valid = Boolean(title.trim());

  // keepOpen: "Speichern & neu" — Aufgabe speichern, Formular leeren, offen lassen
  async function submit(keepOpen = false) {
    if (!valid) return showToast('Bitte einen Titel eingeben');
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
      // Feedback: nur beim Neu-Anlegen, nicht beim Bearbeiten
      if (!editTodo?.id) {
        fb.todoCreate();
      }
      onSaved?.(saved);
      if (keepOpen) {
        showToast('Aufgabe gespeichert');
        setTitle(''); setNote(''); setDueDate(''); setPriority(false); setShowNote(false);
        titleRef.current?.focus();
      } else {
        onClose();
      }
    } catch (e) {
      console.error('[TodoSheet]', e);
      showToast('Konnte nicht gespeichert werden');
      fb.error();
    } finally {
      setSaving(false);
    }
  }

  const footer = (
    <WizardFoot one={Boolean(editTodo)} hint={valid ? '' : missingHint([['Aufgabe', true]])}>
      {!editTodo && (
        <button type="button" className="btn btn-secondary" disabled={!valid || saving} onClick={() => submit(true)}>
          Speichern &amp; neu
        </button>
      )}
      <button type="button" className="btn btn-primary" disabled={!valid || saving} onClick={() => submit(false)}>
        {saving ? 'Wird gespeichert…' : 'Speichern'}
      </button>
    </WizardFoot>
  );

  return (
    <SheetShell onClose={onClose} wizard>
      <WizardFrame title={editTodo ? 'Aufgabe bearbeiten' : 'Neue Aufgabe'} onClose={onClose} footer={footer}>
        <label className="wz-lbl" htmlFor="wz-todo-title">Aufgabe</label>
        <input
          id="wz-todo-title"
          ref={titleRef}
          className="wz-input hero"
          type="text"
          placeholder="Was ist zu tun?"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          autoFocus
          autoComplete="off"
          enterKeyHint="done"
          onKeyDown={(e) => e.key === 'Enter' && submit(false)}
        />

        <div className="wz-lbl">Fällig am <span className="opt">optional</span></div>
        <DateButton value={dueDate} onChange={setDueDate} optional placeholder="Datum wählen" label="Fällig am" />

        <div className="wz-lbl">Markierung</div>
        <div className="wz-chips">
          <button type="button" className={`wz-chip${priority ? ' on' : ''}`} aria-pressed={priority} onClick={() => setPriority((p) => !p)}>
            <WzIconStar />Wichtig
          </button>
        </div>

        {showNote ? (
          <>
            <label className="wz-lbl" htmlFor="wz-todo-note">Notiz <span className="opt">optional</span></label>
            <textarea id="wz-todo-note" className="wz-input" placeholder="Notiz" value={note} onChange={(e) => setNote(e.target.value)} />
          </>
        ) : (
          <button type="button" className="wz-link" onClick={() => setShowNote(true)}>＋ Notiz hinzufügen</button>
        )}
      </WizardFrame>
    </SheetShell>
  );
}
