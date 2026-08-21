// modules/habits/components/HabitsView.jsx
// Habit-Verwaltung: Liste, Erstellen, Bearbeiten, Löschen, Bibliothek
// + Drag & Drop Sortierung via @dnd-kit/core
// + Erinnerungs-UI

import { useState } from 'react';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

import {
  saveHabit, deleteHabit, toggleHabitActive, updateSortOrder,
} from '../lib/habData.js';
import {
  HABIT_CATEGORIES, HABIT_ICONS, HABIT_LIBRARY,
} from '../lib/habUtils.js';

const FREQ_LABELS = {
  daily:    'Täglich',
  weekdays: 'Mo – Fr',
  custom:   'Benutzerdefiniert',
};

const DAY_LABELS = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];

const UNIT_OPTIONS = [
  { value: '',         label: 'Ja / Nein (kein Zähler)' },
  { value: 'L',        label: 'L — Liter' },
  { value: 'ml',       label: 'ml — Milliliter' },
  { value: 'Glas',     label: 'Glas' },
  { value: 'Min',      label: 'Min — Minuten' },
  { value: 'Std',      label: 'Std — Stunden' },
  { value: '×',        label: '× — Mal / Wiederholungen' },
  { value: 'Seiten',   label: 'Seiten' },
  { value: 'Schritte', label: 'Schritte' },
  { value: 'km',       label: 'km — Kilometer' },
  { value: 'Ding',     label: 'Ding (z.B. 3 Dinge notieren)' },
  { value: 'Portion',  label: 'Portion' },
  { value: 'Mahlzeit', label: 'Mahlzeit' },
  { value: 'Aufgabe',  label: 'Aufgabe' },
  { value: 'Satz',     label: 'Satz (Training)' },
];

const EMPTY_HABIT = {
  name:           '',
  description:    '',
  category:       'Gesundheit',
  icon:           '⭐',
  frequency:      'daily',
  frequency_days: [0, 1, 2, 3, 4],
  target_count:   1,
  unit:           '',
  reminder_time:  '',
  active:         true,
};

export default function HabitsView({ habits, onHabitsChange }) {
  const [showForm, setShowForm]       = useState(false);
  const [showLibrary, setShowLibrary] = useState(false);
  const [editHabit, setEditHabit]     = useState(null);
  const [form, setForm]               = useState(EMPTY_HABIT);
  const [saving, setSaving]           = useState(false);
  const [deletingId, setDeletingId]   = useState(null);
  const [error, setError]             = useState(null);
  const [iconPicker, setIconPicker]   = useState(false);

  // Lokale Reihenfolge für optimistisches UI beim Drag & Drop
  const [localOrder, setLocalOrder]   = useState(null);

  const activeHabits   = (localOrder ?? habits).filter((h) => h.active && !h.deleted_at);
  const inactiveHabits = (localOrder ?? habits).filter((h) => !h.active && !h.deleted_at);

  const showOverloadWarning = activeHabits.length >= 5;

  // dnd-kit sensors — PointerSensor für Desktop, TouchSensor für Mobile
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor,   { activationConstraint: { delay: 200, tolerance: 5 } }),
  );

  async function handleDragEnd(event) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = activeHabits.findIndex((h) => h.id === active.id);
    const newIndex = activeHabits.findIndex((h) => h.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    // Optimistisches Update — sofort zeigen
    const reordered = arrayMove(activeHabits, oldIndex, newIndex);
    const allHabits = [...reordered, ...inactiveHabits];
    setLocalOrder(allHabits);

    // In DB persistieren
    try {
      await updateSortOrder(reordered.map((h, i) => ({ id: h.id, sort_order: i })));
    } catch (e) {
      setError('Reihenfolge konnte nicht gespeichert werden.');
      setLocalOrder(null); // Rollback
    }
  }

  function openCreate() {
    setEditHabit(null);
    setForm({ ...EMPTY_HABIT });
    setShowForm(true);
    setShowLibrary(false);
    setError(null);
    setLocalOrder(null);
  }

  function openEdit(habit) {
    setEditHabit(habit);
    setForm({
      name:           habit.name,
      description:    habit.description ?? '',
      category:       habit.category,
      icon:           habit.icon,
      frequency:      habit.frequency,
      frequency_days: habit.frequency_days ?? [0,1,2,3,4],
      target_count:   habit.target_count ?? 1,
      unit:           habit.unit ?? '',
      reminder_time:  habit.reminder_time ?? '',
      active:         habit.active,
    });
    setShowForm(true);
    setShowLibrary(false);
    setError(null);
  }

  function openLibrary() {
    setShowLibrary(true);
    setShowForm(false);
  }

  function applyTemplate(template) {
    setEditHabit(null);
    setForm({
      ...EMPTY_HABIT,
      ...template,
      unit:          template.unit ?? '',
      reminder_time: '',
    });
    setShowLibrary(false);
    setShowForm(true);
    setError(null);
  }

  function cancel() {
    setShowForm(false);
    setShowLibrary(false);
    setEditHabit(null);
    setError(null);
    setIconPicker(false);
  }

  function setField(key, value) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function toggleDay(day) {
    setForm((f) => {
      const days = f.frequency_days ?? [];
      return {
        ...f,
        frequency_days: days.includes(day)
          ? days.filter((d) => d !== day)
          : [...days, day].sort(),
      };
    });
  }

  async function handleSave() {
    if (!form.name.trim()) { setError('Name ist erforderlich.'); return; }
    setSaving(true);
    setError(null);
    try {
      await saveHabit({
        ...(editHabit ? { id: editHabit.id } : {}),
        ...form,
        unit:           form.unit.trim() || null,
        description:    form.description.trim() || null,
        reminder_time:  form.reminder_time || null,
        target_count:   Math.max(1, Number(form.target_count)),
        frequency_days: form.frequency === 'custom' ? form.frequency_days : null,
        sort_order:     editHabit ? editHabit.sort_order : activeHabits.length,
      });
      await onHabitsChange();
      setLocalOrder(null);
      cancel();
    } catch (e) {
      setError('Speichern fehlgeschlagen. Bitte erneut versuchen.');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(habitId) {
    if (!window.confirm('Gewohnheit und alle Einträge löschen?')) return;
    setDeletingId(habitId);
    try {
      await deleteHabit(habitId);
      await onHabitsChange();
      setLocalOrder(null);
    } catch (e) {
      setError('Löschen fehlgeschlagen.');
    } finally {
      setDeletingId(null);
    }
  }

  async function handleToggleActive(habit) {
    try {
      await toggleHabitActive(habit.id, !habit.active);
      await onHabitsChange();
      setLocalOrder(null);
    } catch (e) {
      setError('Status konnte nicht geändert werden.');
    }
  }

  // ─── Bibliothek ─────────────────────────────────────────
  if (showLibrary) {
    const grouped = HABIT_LIBRARY.reduce((acc, t) => {
      if (!acc[t.category]) acc[t.category] = [];
      acc[t.category].push(t);
      return acc;
    }, {});

    return (
      <div className="hab-library">
        <div className="hab-library-header">
          <button className="hab-back-btn" onClick={() => setShowLibrary(false)}>← Zurück</button>
          <h2 className="hab-library-title">Vorlagen</h2>
        </div>
        <p className="hab-library-sub">Wähle eine Vorlage als Startpunkt — du kannst alles anpassen.</p>
        {Object.entries(grouped).map(([cat, templates]) => (
          <div key={cat} className="hab-library-group">
            <div className="hab-library-cat">{cat}</div>
            <div className="hab-library-items">
              {templates.map((t, i) => (
                <button key={i} className="hab-library-item" onClick={() => applyTemplate(t)}>
                  <span className="hab-library-item-icon">{t.icon}</span>
                  <span className="hab-library-item-name">{t.name}</span>
                  {t.target_count > 1 && (
                    <span className="hab-library-item-meta">{t.target_count}× {t.unit}</span>
                  )}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  }

  // ─── Formular ────────────────────────────────────────────
  if (showForm) {
    return (
      <div className="hab-form-wrap">
        <div className="hab-form-header">
          <button className="hab-back-btn" onClick={cancel}>← Zurück</button>
          <h2 className="hab-form-title">
            {editHabit ? 'Gewohnheit bearbeiten' : 'Neue Gewohnheit'}
          </h2>
        </div>

        {error && <div className="toast toast-error" style={{ margin: '0 0 12px' }}>{error}</div>}

        <div className="hab-form">
          {/* Icon + Name */}
          <div className="hab-form-row">
            <button
              className="hab-icon-btn"
              onClick={() => setIconPicker((v) => !v)}
              type="button"
              title="Icon wählen"
            >
              {form.icon}
            </button>
            <div className="hab-form-field" style={{ flex: 1 }}>
              <label className="form-label">Name *</label>
              <input
                className="form-input"
                placeholder="z.B. 30 Min spazieren"
                value={form.name}
                onChange={(e) => setField('name', e.target.value)}
                maxLength={60}
              />
            </div>
          </div>

          {iconPicker && (
            <div className="hab-icon-picker">
              {HABIT_ICONS.map((ic) => (
                <button
                  key={ic}
                  className={`hab-icon-option ${form.icon === ic ? 'selected' : ''}`}
                  onClick={() => { setField('icon', ic); setIconPicker(false); }}
                  type="button"
                >
                  {ic}
                </button>
              ))}
            </div>
          )}

          {/* Beschreibung */}
          <div className="hab-form-field">
            <label className="form-label">Beschreibung (optional)</label>
            <input
              className="form-input"
              placeholder="Kurze Notiz zu dieser Gewohnheit"
              value={form.description}
              onChange={(e) => setField('description', e.target.value)}
              maxLength={120}
            />
          </div>

          {/* Kategorie */}
          <div className="hab-form-field">
            <label className="form-label">Kategorie</label>
            <select
              className="form-input"
              value={form.category}
              onChange={(e) => setField('category', e.target.value)}
            >
              {HABIT_CATEGORIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          {/* Frequenz */}
          <div className="hab-form-field">
            <label className="form-label">Häufigkeit</label>
            <div className="hab-freq-tabs">
              {Object.entries(FREQ_LABELS).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  className={`hab-freq-tab ${form.frequency === key ? 'active' : ''}`}
                  onClick={() => setField('frequency', key)}
                >
                  {label}
                </button>
              ))}
            </div>
            {form.frequency === 'custom' && (
              <div className="hab-day-picker">
                {DAY_LABELS.map((label, i) => (
                  <button
                    key={i}
                    type="button"
                    className={`hab-day-btn ${(form.frequency_days ?? []).includes(i) ? 'active' : ''}`}
                    onClick={() => toggleDay(i)}
                  >
                    {label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Ziel-Anzahl / Einheit */}
          <div className="hab-form-row" style={{ gap: 12 }}>
            {form.unit !== '' && (
            <div className="hab-form-field" style={{ flex: 1 }}>
              <label className="form-label">Ziel-Anzahl</label>
              <input
                className="form-input"
                type="number"
                min={1}
                max={100}
                value={form.target_count}
                onChange={(e) => setField('target_count', e.target.value)}
              />
            </div>
            )}
            <div className="hab-form-field" style={{ flex: 2 }}>
              <label className="form-label">Einheit</label>
              <select
                className="form-input"
                value={form.unit}
                onChange={(e) => {
                  const val = e.target.value;
                  setField('unit', val);
                  // Bei Ja/Nein: Ziel-Anzahl auf 1 zurücksetzen
                  if (val === '') setField('target_count', 1);
                }}
              >
                {UNIT_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Erinnerung */}
          <div className="hab-form-field">
            <label className="form-label">
              Erinnerung <span className="hab-form-label-hint">(optional)</span>
            </label>
            <div className="hab-reminder-wrap">
              <input
                className="form-input"
                type="time"
                value={form.reminder_time}
                onChange={(e) => setField('reminder_time', e.target.value)}
                style={{ flex: 1 }}
              />
              {form.reminder_time && (
                <button
                  type="button"
                  className="hab-reminder-clear"
                  onClick={() => setField('reminder_time', '')}
                  title="Erinnerung entfernen"
                >
                  ✕
                </button>
              )}
            </div>
            {form.reminder_time && (
              <div className="hab-reminder-hint">
                ⏰ Erinnerung um {form.reminder_time} Uhr gespeichert.
                Push-Benachrichtigungen kommen in einem späteren Update.
              </div>
            )}
          </div>

          <button
            className="btn btn-primary"
            style={{ marginTop: 8 }}
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? 'Wird gespeichert …' : editHabit ? 'Speichern' : 'Gewohnheit anlegen'}
          </button>
        </div>
      </div>
    );
  }

  // ─── Liste mit Drag & Drop ───────────────────────────────
  return (
    <div className="hab-habits-view">

      <div className="hab-habits-actions">
        <button className="btn btn-primary" onClick={openCreate}>+ Neue Gewohnheit</button>
        <button className="btn btn-secondary" onClick={openLibrary}>Vorlagen</button>
      </div>

      {showOverloadWarning && (
        <div className="hab-overload-warning">
          <span>💡</span>
          <span>Du hast {activeHabits.length} aktive Gewohnheiten. Für nachhaltigen Erfolg empfehlen Experten max. 3–5.</span>
        </div>
      )}

      {error && <div className="toast toast-error" style={{ margin: '0 0 12px' }}>{error}</div>}

      {habits.filter((h) => !h.deleted_at).length === 0 && (
        <div className="hab-empty">
          <div className="hab-empty-icon">🌱</div>
          <div className="hab-empty-title">Noch keine Gewohnheiten</div>
          <div className="hab-empty-text">Starte mit 1–3 Gewohnheiten. Weniger ist am Anfang mehr.</div>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
            <button className="btn btn-primary" onClick={openCreate}>Selbst erstellen</button>
            <button className="btn btn-secondary" onClick={openLibrary}>Aus Vorlagen</button>
          </div>
        </div>
      )}

      {/* Aktive Habits — sortierbar per Drag & Drop */}
      {activeHabits.length > 0 && (
        <div className="hab-section">
          <div className="hab-section-label">
            Aktiv
            <span className="hab-section-label-hint"> · ziehen zum Sortieren</span>
          </div>
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={activeHabits.map((h) => h.id)}
              strategy={verticalListSortingStrategy}
            >
              <div className="hab-manage-list">
                {activeHabits.map((habit) => (
                  <SortableHabitCard
                    key={habit.id}
                    habit={habit}
                    onEdit={() => openEdit(habit)}
                    onDelete={() => handleDelete(habit.id)}
                    onToggleActive={() => handleToggleActive(habit)}
                    deleting={deletingId === habit.id}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        </div>
      )}

      {/* Pausierte Habits */}
      {inactiveHabits.length > 0 && (
        <div className="hab-section" style={{ marginTop: 24 }}>
          <div className="hab-section-label">Pausiert</div>
          <div className="hab-manage-list">
            {inactiveHabits.map((habit) => (
              <SortableHabitCard
                key={habit.id}
                habit={habit}
                onEdit={() => openEdit(habit)}
                onDelete={() => handleDelete(habit.id)}
                onToggleActive={() => handleToggleActive(habit)}
                deleting={deletingId === habit.id}
                paused
                noSort
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Sortierbare Habit-Karte ──────────────────────────────

function SortableHabitCard({ habit, onEdit, onDelete, onToggleActive, deleting, paused, noSort }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: habit.id, disabled: noSort });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex:  isDragging ? 10 : 'auto',
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`hab-manage-card ${paused ? 'hab-manage-card--paused' : ''} ${isDragging ? 'hab-manage-card--dragging' : ''}`}
    >
      {/* Drag-Handle */}
      {!noSort && (
        <div className="hab-drag-handle" {...attributes} {...listeners} title="Ziehen zum Sortieren">
          ⠿
        </div>
      )}

      <div className="hab-manage-card-left">
        <span className="hab-item-icon">{habit.icon}</span>
        <div>
          <div className="hab-manage-name">{habit.name}</div>
          <div className="hab-manage-meta">
            {habit.category} · {FREQ_LABELS[habit.frequency] ?? habit.frequency}
            {habit.target_count > 1 && ` · ${habit.target_count}× ${habit.unit ?? ''}`}
            {habit.reminder_time && ` · ⏰ ${habit.reminder_time}`}
          </div>
        </div>
      </div>

      <div className="hab-manage-card-right">
        <button className="hab-manage-btn" onClick={onToggleActive} title={paused ? 'Aktivieren' : 'Pausieren'}>
          {paused ? '▶' : '⏸'}
        </button>
        <button className="hab-manage-btn" onClick={onEdit} title="Bearbeiten">✏️</button>
        <button
          className="hab-manage-btn hab-manage-btn--del"
          onClick={onDelete}
          disabled={deleting}
          title="Löschen"
        >
          {deleting ? '…' : '🗑'}
        </button>
      </div>
    </div>
  );
}
