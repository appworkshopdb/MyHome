// modules/shopping/components/ListView.jsx
// Übersicht aller Einkaufslisten + Neue-Liste-Formular + Löschen.
// Tap auf eine Liste → öffnet ItemsView (via onOpenList).

import { useState, useRef, useEffect } from 'react';
import { IconPlus, IconTrash, IconChevronRight } from '../../../core/components/Icons.jsx';
import { saveList, deleteList } from '../lib/shoData.js';

const DEFAULT_ICONS = ['🛒', '🥦', '🏠', '🎉', '💊', '🐾', '🧹', '📦'];

export default function ListView({ lists, onListsChange, onOpenList }) {
  const [showForm, setShowForm] = useState(false);
  const [name,     setName]     = useState('');
  const [icon,     setIcon]     = useState('🛒');
  const [saving,   setSaving]   = useState(false);
  const [error,    setError]    = useState(null);
  const [deleting, setDeleting] = useState(null);
  const inputRef = useRef(null);

  useEffect(() => {
    if (showForm) inputRef.current?.focus();
  }, [showForm]);

  async function handleSave() {
    const trimmed = name.trim();
    if (!trimmed) return;
    setSaving(true);
    setError(null);
    try {
      await saveList({ name: trimmed, icon });
      await onListsChange();
      setName('');
      setIcon('🛒');
      setShowForm(false);
    } catch (e) {
      setError('Speichern fehlgeschlagen.');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(e, listId) {
    e.stopPropagation();
    if (!window.confirm('Liste und alle Artikel löschen?')) return;
    setDeleting(listId);
    try {
      await deleteList(listId);
      await onListsChange();
    } catch (e) {
      setError('Löschen fehlgeschlagen.');
    } finally {
      setDeleting(null);
    }
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter') handleSave();
    if (e.key === 'Escape') { setShowForm(false); setName(''); }
  }

  return (
    <div>
      {/* Empty State */}
      {lists.length === 0 && !showForm && (
        <div className="sho-empty">
          <div className="sho-empty-icon">🛒</div>
          <div className="sho-empty-title">Noch keine Liste</div>
          <div className="sho-empty-text">
            Leg eine Einkaufsliste an — z.B. für REWE, Aldi oder den nächsten Grillabend.
          </div>
        </div>
      )}

      {/* Listenübersicht */}
      {lists.length > 0 && (
        <div className="sho-lists">
          {lists.map((list) => (
            <button
              key={list.id}
              className="sho-list-item"
              onClick={() => onOpenList(list)}
              disabled={deleting === list.id}
            >
              <div className="sho-list-icon">{list.icon || '🛒'}</div>
              <div className="sho-list-info">
                <div className="sho-list-name">{list.name}</div>
              </div>
              <button
                className="btn-icon"
                onClick={(e) => handleDelete(e, list.id)}
                aria-label="Liste löschen"
                style={{ marginRight: 4 }}
              >
                <IconTrash size={16} />
              </button>
              <div style={{ width: 16, height: 16, color: 'var(--text-muted)', flexShrink: 0 }}>
                <IconChevronRight />
              </div>
            </button>
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
                  fontSize: '1.4rem',
                  width: 40,
                  height: 40,
                  border: icon === ic ? '2px solid var(--accent)' : '1.5px solid var(--border)',
                  background: icon === ic ? 'var(--accent-light)' : 'var(--bg-card)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: 0,
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

          {error && (
            <div style={{ fontSize: '0.85rem', color: 'var(--danger)' }}>{error}</div>
          )}

          <div className="sho-new-list-actions">
            <button
              className="btn btn-secondary"
              onClick={() => { setShowForm(false); setName(''); setError(null); }}
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

      {/* + Neue Liste */}
      {!showForm && (
        <button className="sho-add-btn" onClick={() => setShowForm(true)}>
          <span style={{ display: 'flex', width: 20, height: 20 }}><IconPlus /></span>
          Neue Liste
        </button>
      )}
    </div>
  );
}
