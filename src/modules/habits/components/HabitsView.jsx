// modules/habits/components/HabitsView.jsx
// Habit-Verwaltung: Liste, Erstellen, Bearbeiten, Löschen, Bibliothek
// + Drag & Drop Sortierung via @dnd-kit/core
// + Erinnerungs-UI

import { useState } from 'react';
import SheetShell from '../../../core/components/SheetShell.jsx';
import HabitTemplateLibrary from './HabitTemplateLibrary.jsx';
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
  restoreHabit, loadDeletedHabits, setStatsHidden,
} from '../lib/habData.js';
import {
  HABIT_CATEGORIES, HABIT_UNITS, HABIT_ICONS, TIME_SLOTS,
} from '../lib/habUtils.js';
import {
  catalogEntryByName, goalKind, goalText, qtyStep, formatQty, shiftTime,
} from '../../../core/lib/habitCatalog.js';

const FREQ_LABELS = {
  daily:    'Täglich',
  weekdays: 'Mo – Fr',
  custom:   'Benutzerdefiniert',
};

const DAY_LABELS = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];

const EMPTY_HABIT = {
  name:           '',
  description:    '',
  category:       'Sonstiges',
  categories:     ['Sonstiges'],
  icon:           '⭐',
  frequency:      'daily',
  frequency_days: [0, 1, 2, 3, 4],
  target_count:   1,
  unit:           '',
  goal_time:      '',
  reminder_time:  '',
  time_slot:      'anytime',
  active:         true,
};

export default function HabitsView({ habits, onHabitsChange }) {
  const [showForm, setShowForm]       = useState(false);
  const [showLibrary, setShowLibrary] = useState(false);
  const [editHabit, setEditHabit]     = useState(null);
  const [form, setForm]               = useState(EMPTY_HABIT);
  const [saving, setSaving]           = useState(false);
  const [deletingId, setDeletingId]   = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null); // Habit, dessen Löschen bestätigt wird
  const [deleteHideStats, setDeleteHideStats] = useState(false);
  // Name der Vorlage, aus der das Formular stammt: Kategorie und Ziel-Art sind dann fest
  const [lockName, setLockName]       = useState(null);
  const [error, setError]             = useState(null);
  const [showArchive, setShowArchive] = useState(false);
  const [archivedHabits, setArchived] = useState([]);
  const [loadingArchive, setLoadingArchive] = useState(false);
  const [restoringId, setRestoringId] = useState(null);
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

  // openCreate() wurde entfernt — "Neue Gewohnheit" läuft jetzt
  // ausschließlich über den globalen FAB (HabitQuickSheet). openLibrary/
  // applyTemplate bleiben unverändert, das ist ein eigenständiges Feature
  // (Vorlagen durchsuchen), keine manuelle Neuanlage.

  function openEdit(habit) {
    setEditHabit(habit);
    setForm({
      name:           habit.name,
      description:    habit.description ?? '',
      category:       habit.category,
      categories:     habit.category ? [habit.category] : [],
      icon:           habit.icon,
      frequency:      habit.frequency,
      frequency_days: habit.frequency_days ?? [0,1,2,3,4],
      target_count:   habit.target_count ?? 1,
      unit:           habit.unit ?? '',
      goal_time:      habit.goal_time ?? '',
      reminder_time:  habit.reminder_time ?? '',
      time_slot:      habit.time_slot ?? 'anytime',
      active:         habit.active,
    });
    setLockName(habit.name);
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
      goal_time:     template.goal_time ?? '',
      reminder_time: '',
      time_slot:     template.time_slot ?? 'anytime',
    });
    setLockName(template.name);
    setShowLibrary(false);
    setShowForm(true);
    setError(null);
  }

  function cancel() {
    setShowForm(false);
    setShowLibrary(false);
    setEditHabit(null);
    setLockName(null);
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


  function setCategory(cat) {
    setForm((f) => ({ ...f, category: cat, categories: [cat] }));
  }

  // Ziel-Art umschalten (nur bei eigenen Gewohnheiten)
  function setGoalKind(kind) {
    setForm((f) => {
      if (kind === 'check') return { ...f, unit: '', target_count: 1, goal_time: '' };
      if (kind === 'count') return { ...f, unit: f.unit || HABIT_UNITS[0], target_count: 1, goal_time: '' };
      return { ...f, unit: '', target_count: 1, goal_time: f.goal_time || '07:00' };
    });
  }

  function stepTarget(dir) {
    setForm((f) => {
      const step = qtyStep(f.unit);
      const next = Math.round((Number(f.target_count) + dir * step) * 100) / 100;
      return { ...f, target_count: Math.min(100, Math.max(step, next)) };
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
        time_slot:      form.time_slot || 'anytime',
        category:       form.category || 'Sonstiges',
        categories:     [form.category || 'Sonstiges'],
        goal_time:      form.goal_time || null,
        clear_goal_time: !form.goal_time && Boolean(editHabit?.goal_time),
        target_count:   Math.max(qtyStep(form.unit), Number(form.target_count)),
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

  function openDelete(habit) {
    setDeleteHideStats(false); // harmlosere Option vorauswählen
    setDeleteTarget(habit);
  }

  async function handleDelete(habitId, hideFromStats) {
    setDeleteTarget(null);
    setDeletingId(habitId);
    try {
      await deleteHabit(habitId, { hideFromStats });
      await onHabitsChange();
      setLocalOrder(null);
      if (showForm) cancel();
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

  async function openArchive() {
    setLoadingArchive(true);
    setShowArchive(true);
    setShowForm(false);
    setShowLibrary(false);
    try {
      const data = await loadDeletedHabits();
      setArchived(data);
    } catch (e) {
      setError('Archiv konnte nicht geladen werden.');
    } finally {
      setLoadingArchive(false);
    }
  }

  async function handleToggleStatsHidden(habit) {
    setRestoringId(habit.id);
    try {
      await setStatsHidden(habit.id, !habit.stats_hidden);
      setArchived(await loadDeletedHabits());
    } catch (e) {
      setError('Konnte nicht geändert werden. Ist die Migration hab_stats_hidden eingespielt?');
    } finally {
      setRestoringId(null);
    }
  }

  async function handleRestore(habitId) {
    setRestoringId(habitId);
    try {
      await restoreHabit(habitId, { wasHidden: archivedHabits.find((h) => h.id === habitId)?.stats_hidden });
      await onHabitsChange();
      setLocalOrder(null);
      const data = await loadDeletedHabits();
      setArchived(data);
    } catch (e) {
      setError('Wiederherstellen fehlgeschlagen.');
    } finally {
      setRestoringId(null);
    }
  }

  const deleteSheet = deleteTarget && (
    <SheetShell onClose={() => setDeleteTarget(null)} labelledBy="hab-del-title">
      <div className="hab-cp-sheet">
        <div className="hab-cp-sheet-head">
          <h2 id="hab-del-title">„{deleteTarget.name}" löschen?</h2>
        </div>
        <div className="hab-cp-note">
          Soll die Gewohnheit auch aus den Statistiken verschwinden, oder sollen die
          bisherigen Werte dort erhalten bleiben?
        </div>

        <div role="radiogroup" aria-label="Löschen" className="hab-del-opts">
          <button
            type="button"
            role="radio"
            aria-checked={!deleteHideStats}
            className={`hab-del-opt${!deleteHideStats ? ' on' : ''}`}
            onClick={() => setDeleteHideStats(false)}
          >
            <span className="hab-del-radio" />
            <b>Nur aus der Liste löschen</b>
            <span className="hab-del-desc">Die Werte bleiben in der Statistik erhalten.</span>
          </button>
          <button
            type="button"
            role="radio"
            aria-checked={deleteHideStats}
            className={`hab-del-opt danger${deleteHideStats ? ' on' : ''}`}
            onClick={() => setDeleteHideStats(true)}
          >
            <span className="hab-del-radio" />
            <b>Auch aus der Statistik löschen</b>
            <span className="hab-del-desc">Die Gewohnheit zählt in keinem Verlauf mehr.</span>
          </button>
        </div>

        <button
          type="button"
          className={`hab-del-confirm${deleteHideStats ? ' danger' : ''}`}
          onClick={() => handleDelete(deleteTarget.id, deleteHideStats)}
        >
          {deleteHideStats ? 'Überall löschen' : 'Aus der Liste löschen'}
        </button>
        <button type="button" className="hab-cp-link hab-del-cancel" onClick={() => setDeleteTarget(null)}>Abbrechen</button>
      </div>
    </SheetShell>
  );

  // ─── Archiv ──────────────────────────────────────────────
  if (showArchive) {
    return (
      <div className="hab-archive">
        <div className="hab-form-header">
          <button className="hab-back-btn" onClick={() => setShowArchive(false)}>← Zurück</button>
          <h2 className="hab-form-title">Archiv</h2>
        </div>
        {error && <div className="toast toast-error" style={{ margin: '0 0 12px' }}>{error}</div>}
        {loadingArchive && <div className="page-loading">Wird geladen …</div>}
        {!loadingArchive && archivedHabits.length === 0 && (
          <div className="hab-empty">
            <div className="hab-empty-icon">📦</div>
            <div className="hab-empty-title">Archiv ist leer</div>
            <div className="hab-empty-text">Gelöschte Gewohnheiten erscheinen hier und können wiederhergestellt werden.</div>
          </div>
        )}
        {!loadingArchive && archivedHabits.length > 0 && (
          <div className="hab-manage-list">
            {archivedHabits.map((habit) => (
              <div key={habit.id} className="hab-manage-card hab-manage-card--paused">
                <div className="hab-manage-card-left">
                  <span className="hab-item-icon">{habit.icon}</span>
                  <div>
                    <div className="hab-manage-name">{habit.name}</div>
                    <div className="hab-manage-meta">
                      {habit.category} · Gelöscht am {new Date(habit.deleted_at).toLocaleDateString('de-DE')}
                      {habit.stats_hidden ? ' · nicht in Statistik' : ' · in Statistik'}
                    </div>
                  </div>
                </div>
                <div className="hab-manage-card-right">
                  <button
                    className="hab-manage-btn hab-manage-btn--text"
                    onClick={() => handleToggleStatsHidden(habit)}
                    disabled={restoringId === habit.id}
                  >
                    {habit.stats_hidden ? 'In Statistik zeigen' : 'Aus Statistik entfernen'}
                  </button>
                  <button
                    className="hab-manage-btn"
                    onClick={() => handleRestore(habit.id)}
                    disabled={restoringId === habit.id}
                    title="Wiederherstellen"
                  >
                    {restoringId === habit.id ? '…' : '↩️'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // ─── Bibliothek ─────────────────────────────────────────
  if (showLibrary) {
    return (
      <HabitTemplateLibrary
        habits={habits}
        onBack={() => setShowLibrary(false)}
        onPick={applyTemplate}
      />
    );
  }

  // ─── Formular ────────────────────────────────────────────
  if (showForm) {
    const lockEntry = lockName ? catalogEntryByName(lockName) : null; // Vorlage: Kategorie/Ziel-Art fest
    const kind = goalKind(form);
    const timeStep = lockEntry?.goal?.step ?? 10;
    const freqOptions = [
      { key: 'daily',    label: 'Täglich' },
      { key: 'weekdays', label: 'Mo–Fr' },
      { key: 'custom',   label: 'Eigene Tage' },
    ];
    const dayOn = (i) => form.frequency === 'daily'
      || (form.frequency === 'weekdays' ? i < 5 : (form.frequency_days ?? []).includes(i));
    const units = form.unit && !HABIT_UNITS.includes(form.unit) ? [form.unit, ...HABIT_UNITS] : HABIT_UNITS;
    const kindLabels = { check: 'Ja / Nein', count: 'Zähler', time: 'Uhrzeit' };

    return (
      <div className="hab-ef">
        <div className="hab-tl-top">
          <button type="button" className="hab-tl-back" onClick={cancel} aria-label="Zurück">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M19 12H5M11 6l-6 6 6 6" />
            </svg>
          </button>
          <h2>{editHabit ? 'Gewohnheit bearbeiten' : 'Neue Gewohnheit'}</h2>
        </div>

        {error && <div className="toast toast-error" style={{ margin: 0 }}>{error}</div>}

        {/* Grundlagen (die Beschreibung wird nicht mehr abgefragt; vorhandene Werte bleiben beim Speichern erhalten) */}
        <div className="hab-ef-card">
          <div className="hab-ef-ct">Grundlagen</div>
          <div className="hab-ef-namerow">
            <button
              type="button"
              className="hab-ef-iconbtn"
              onClick={() => setIconPicker((v) => !v)}
              aria-label="Symbol wählen"
              aria-expanded={iconPicker}
            >
              {form.icon}
            </button>
            <div className="hab-ef-field">
              <label htmlFor="hab-ef-name">Name *</label>
              <input
                id="hab-ef-name"
                className="hab-ef-in"
                placeholder="z.B. 30 Min spazieren"
                value={form.name}
                onChange={(e) => setField('name', e.target.value)}
                maxLength={60}
              />
            </div>
          </div>
          {iconPicker && (
            <div className="hab-ef-emojis">
              {HABIT_ICONS.map((ic) => (
                <button
                  key={ic}
                  type="button"
                  className={form.icon === ic ? 'on' : ''}
                  onClick={() => { setField('icon', ic); setIconPicker(false); }}
                >
                  {ic}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Rhythmus */}
        <div className="hab-ef-card">
          <div className="hab-ef-ct">Rhythmus</div>
          <div className="hab-ef-seg" role="group" aria-label="Häufigkeit">
            {freqOptions.map((f) => (
              <button
                key={f.key}
                type="button"
                className={form.frequency === f.key ? 'on' : ''}
                aria-pressed={form.frequency === f.key}
                onClick={() => setField('frequency', f.key)}
              >
                {f.label}
              </button>
            ))}
          </div>
          <div className={`hab-ef-days${form.frequency === 'custom' ? '' : ' is-off'}`} role="group" aria-label="Tage">
            {DAY_LABELS.map((label, i) => (
              <button
                key={label}
                type="button"
                className={dayOn(i) ? 'on' : ''}
                disabled={form.frequency !== 'custom'}
                aria-pressed={dayOn(i)}
                onClick={() => toggleDay(i)}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="hab-ef-ct" style={{ marginTop: 2 }}>Wann</div>
          <div className="hab-ef-chips" role="group" aria-label="Tageszeit">
            {TIME_SLOTS.map((slot) => (
              <button
                key={slot.value}
                type="button"
                className={`hab-ef-chip${form.time_slot === slot.value ? ' on' : ''}`}
                aria-pressed={form.time_slot === slot.value}
                onClick={() => setField('time_slot', slot.value)}
              >
                {slot.label}
              </button>
            ))}
          </div>

          <div className="hab-ef-row">
            <div>
              <b>Erinnerung</b>
              <small>{form.reminder_time ? `um ${form.reminder_time} Uhr` : 'Keine Erinnerung'}</small>
            </div>
            <div className="hab-ef-time">
              <input
                type="time"
                value={form.reminder_time}
                onChange={(e) => setField('reminder_time', e.target.value)}
                aria-label="Erinnerungszeit"
              />
              {form.reminder_time && (
                <button type="button" className="hab-ef-link" onClick={() => setField('reminder_time', '')}>
                  Entfernen
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Ziel */}
        <div className="hab-ef-card">
          <div className="hab-ef-ct">Ziel{lockEntry && <span>von der Vorlage festgelegt</span>}</div>
          {lockEntry ? (
            <div className="hab-ef-locked">{kindLabels[kind]}</div>
          ) : (
            <div className="hab-ef-seg" role="group" aria-label="Art">
              {['check', 'count', 'time'].map((k) => (
                <button
                  key={k}
                  type="button"
                  className={kind === k ? 'on' : ''}
                  aria-pressed={kind === k}
                  onClick={() => kind !== k && setGoalKind(k)}
                >
                  {kindLabels[k]}
                </button>
              ))}
            </div>
          )}

          {kind === 'count' && (
            <>
              {/* Vorlagen mit Zähler (Wasser): nur der Zielwert ist änderbar */}
              <div className="hab-ef-row">
                <div>
                  <b>Ziel pro Tag</b>
                  <small>{formatQty(form.target_count)} {form.unit}</small>
                </div>
                <div className="hab-ef-step">
                  <button type="button" aria-label="Weniger" onClick={() => stepTarget(-1)}>−</button>
                  <output>{formatQty(form.target_count)}</output>
                  <button type="button" aria-label="Mehr" onClick={() => stepTarget(1)}>+</button>
                </div>
              </div>
              {!lockEntry && (
                <div className="hab-ef-units" role="group" aria-label="Einheit">
                  {units.map((u) => (
                    <button
                      key={u}
                      type="button"
                      className={`hab-ef-chip${form.unit === u ? ' on' : ''}`}
                      aria-pressed={form.unit === u}
                      onClick={() => setForm((f) => ({
                        ...f,
                        unit: u,
                        // Liter gibt es in halben Schritten, sonst ganze Zahlen
                        target_count: u === 'L' ? f.target_count : Math.max(1, Math.round(Number(f.target_count))),
                      }))}
                    >
                      {u}
                    </button>
                  ))}
                </div>
              )}
            </>
          )}

          {kind === 'time' && (
            <div className="hab-ef-row">
              <div>
                <b>Uhrzeit</b>
                <small>in {timeStep}-Minuten-Schritten</small>
              </div>
              <div className="hab-ef-step">
                <button type="button" aria-label="Früher" onClick={() => setField('goal_time', shiftTime(form.goal_time, -timeStep))}>−</button>
                <output className="hab-ef-timeout">{form.goal_time}</output>
                <button type="button" aria-label="Später" onClick={() => setField('goal_time', shiftTime(form.goal_time, timeStep))}>+</button>
              </div>
            </div>
          )}

          {kind === 'check' && <div className="hab-ef-hint">Einfach abhaken, ohne Menge.</div>}
        </div>

        {/* Kategorie */}
        <div className="hab-ef-card">
          <div className="hab-ef-ct">Kategorie{lockEntry && <span>von der Vorlage festgelegt</span>}</div>
          <div className="hab-ef-chips" role="group" aria-label="Kategorie">
            {(lockEntry ? [form.category] : HABIT_CATEGORIES).map((cat) => {
              const on = form.category === cat;
              return (
                <button
                  key={cat}
                  type="button"
                  className={`hab-ef-chip${on ? ' on' : ''}`}
                  aria-pressed={on}
                  disabled={Boolean(lockEntry)}
                  onClick={() => setCategory(cat)}
                >
                  {cat}
                </button>
              );
            })}
          </div>
        </div>

        <button type="button" className="hab-ef-save" onClick={handleSave} disabled={saving}>
          {saving ? 'Wird gespeichert …' : editHabit ? 'Speichern' : 'Gewohnheit anlegen'}
        </button>
        {editHabit && (
          <button type="button" className="hab-ef-delete" onClick={() => openDelete(editHabit)}>
            Gewohnheit löschen
          </button>
        )}
        {deleteSheet}
      </div>
    );
  }

  // ─── Liste mit Drag & Drop ───────────────────────────────
  return (
    <div className="hab-habits-view">

      <div className="hab-habits-actions">
        <button className="hab-pill-btn" onClick={openLibrary}>Vorlagen</button>
        <button className="hab-archive-btn" onClick={openArchive} title="Archiv" aria-label="Archiv"><span aria-hidden="true">📦</span> Archiv</button>
      </div>

      {showOverloadWarning && (
        <div className="hab-overload-warning">
          <span className="hab-overload-icon">💡</span>
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
            <button className="btn btn-primary" onClick={openLibrary}>Aus Vorlagen</button>
            <div className="hab-empty-fab-hint">oder mit dem <b>＋</b>-Button unten rechts von Grund auf neu</div>
          </div>
        </div>
      )}

      {/* Aktive Habits — sortierbar per Drag & Drop */}
      {activeHabits.length > 0 && (
        <div className="hab-section">
          <div className="hab-section-label">
            Aktiv
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
                    onDelete={() => openDelete(habit)}
                    onToggleActive={() => handleToggleActive(habit)}
                    deleting={deletingId === habit.id}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        </div>
      )}

      {deleteSheet}

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
                onDelete={() => openDelete(habit)}
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
          <svg width="14" height="18" viewBox="0 0 14 18" fill="currentColor" aria-hidden="true">
            <circle cx="4" cy="3" r="1.5" /><circle cx="10" cy="3" r="1.5" />
            <circle cx="4" cy="9" r="1.5" /><circle cx="10" cy="9" r="1.5" />
            <circle cx="4" cy="15" r="1.5" /><circle cx="10" cy="15" r="1.5" />
          </svg>
        </div>
      )}

      <div className="hab-manage-card-left">
        <span className="hab-item-icon hab-item-icon--tile">{habit.icon}</span>
        <div className="hab-manage-text">
          <div className="hab-manage-name">{habit.name}</div>
          <div className="hab-manage-meta">
            {habit.category} · {FREQ_LABELS[habit.frequency] ?? habit.frequency}
            {goalText(habit) && ` · ${goalText(habit)}`}
            {habit.reminder_time && ` · ${habit.reminder_time} Uhr`}
          </div>
        </div>
      </div>

      <div className="hab-manage-card-right">
        <button className="hab-manage-btn" onClick={onToggleActive} title={paused ? 'Aktivieren' : 'Pausieren'} aria-label={paused ? 'Aktivieren' : 'Pausieren'}>
          {paused ? (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
          ) : (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="5" width="4" height="14" rx="1" /><rect x="14" y="5" width="4" height="14" rx="1" /></svg>
          )}
        </button>
        <button className="hab-manage-btn" onClick={onEdit} title="Bearbeiten" aria-label="Bearbeiten">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" /></svg>
        </button>
        <button
          className="hab-manage-btn hab-manage-btn--del"
          onClick={onDelete}
          disabled={deleting}
          title="Löschen"
          aria-label="Löschen"
        >
          {deleting ? '…' : (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18" /><path d="M8 6V4h8v2" /><path d="M19 6l-1 14H6L5 6" /></svg>
          )}
        </button>
      </div>
    </div>
  );
}
