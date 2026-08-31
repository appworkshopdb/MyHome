import { useCallback, useEffect, useState } from 'react';
import { useAuth } from './lib/AuthContext';
import { getMonthSum } from './lib/measurementsData';
import { formatEur } from './lib/format';
import { getSupabase } from './lib/supabaseClient';
import { getTodos, toggleTodo, deleteTodo } from './lib/todoData';
import ProgressStat from './components/ProgressStat';
import TodoSheet from './components/TodoSheet';
import HubCalendar from './components/HubCalendar';
import { fb } from './lib/feedback'; // NEU

const CACHE_KEY = 'hub-cache-v2';

function formatDueDate(dueDateStr, todayStr) {
  if (!dueDateStr) return null;
  const diff = Math.round((new Date(dueDateStr) - new Date(todayStr)) / 86400000);
  if (diff < 0)  return '⚠ überfällig';
  if (diff === 0) return 'Heute';
  if (diff === 1) return 'Morgen';
  return new Date(dueDateStr).toLocaleDateString('de-DE', { weekday: 'short', day: 'numeric', month: 'short' });
}

function readCache() {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}
function writeCache(data) {
  try { localStorage.setItem(CACHE_KEY, JSON.stringify({ ...data, savedAt: new Date().toISOString() })); } catch { /* egal */ }
}

async function loadTodayHabits() {
  const sb = getSupabase();
  const todayStr = new Date().toISOString().split('T')[0];
  const { data: habits, error: hErr } = await sb
    .from('hab_habits')
    .select('id, name, icon, active, frequency, frequency_days, target_count, created_at, deleted_at')
    .is('deleted_at', null)
    .eq('active', true);
  if (hErr) throw hErr;
  const { data: entries, error: eErr } = await sb
    .from('hab_entries')
    .select('id, habit_id, count, logged_on, deleted_at')
    .eq('logged_on', todayStr)
    .is('deleted_at', null);
  if (eErr) throw eErr;
  const wd = (new Date().getDay() + 6) % 7;
  const due = (habits ?? []).filter((h) => {
    if (new Date(h.created_at).toISOString().split('T')[0] > todayStr) return false;
    if (h.frequency === 'daily') return true;
    if (h.frequency === 'weekdays') return wd < 5;
    if (h.frequency === 'custom' && Array.isArray(h.frequency_days)) return h.frequency_days.includes(wd);
    return true;
  });
  const entryMap = {};
  for (const e of entries ?? []) { entryMap[e.habit_id] = e; }
  const doneIds = new Set(
    due
      .filter((h) => entryMap[h.id] && entryMap[h.id].count >= h.target_count)
      .map((h) => h.id)
  );
  return { total: due.length, done: doneIds.size, habits: due, entryMap };
}

async function loadTodaySport() {
  const sb = getSupabase();
  const todayStr = new Date().toISOString().split('T')[0];
  const { data, error } = await sb
    .from('spo_workouts')
    .select('id, type_key, title, duration_min, status, is_rest')
    .eq('occurred_on', todayStr)
    .is('deleted_at', null)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

async function loadOpenFixCosts() {
  const sb = getSupabase();
  const now = new Date();
  const { data, error } = await sb
    .from('fin_entries')
    .select('id, name, amount, category, paid')
    .eq('year', now.getFullYear())
    .eq('month', now.getMonth() + 1)
    .eq('paid', false)
    .in('category', ['fixkosten', 'sonstige_ausgaben'])
    .is('deleted_at', null)
    .order('amount', { ascending: false })
    .limit(3);
  if (error) throw error;
  return data ?? [];
}

function sportLabel(w) {
  if (w.is_rest) return 'Restday';
  if (w.title) return w.title;
  if (!w.type_key || w.type_key === 'sonstiges') return 'Training';
  const parts = w.type_key.split('.');
  const last = parts[parts.length - 1];
  return last.charAt(0).toUpperCase() + last.slice(1);
}

export default function Hub({ onOpenModule }) {
  const { session } = useAuth();
  const [status, setStatus]     = useState('laedt');
  const [income, setIncome]     = useState(0);
  const [expense, setExpense]   = useState(0);
  const [cacheZeit, setCacheZeit] = useState(null);

  const [habTotal, setHabTotal]       = useState(0);
  const [habDone, setHabDone]         = useState(0);
  const [habHabits, setHabHabits]     = useState([]);
  const [habEntryMap, setHabEntryMap] = useState({});

  const [todaySport, setTodaySport] = useState([]);
  const [openFix, setOpenFix]       = useState([]);
  const [todos, setTodos]           = useState([]);
  const [todoSheet, setTodoSheet]   = useState(false);
  const [editTodo, setEditTodo]     = useState(null);
  const [todoView, setTodoView]     = useState('alle');

  const load = useCallback(async () => {
    setStatus('laedt');
    const now = new Date();
    try {
      const [inc, exp, todayHab, sport, fix, todoList] = await Promise.all([
        getMonthSum(session, 'finance.income',  now.getFullYear(), now.getMonth() + 1),
        getMonthSum(session, 'finance.expense', now.getFullYear(), now.getMonth() + 1),
        loadTodayHabits(),
        loadTodaySport(),
        loadOpenFixCosts(),
        getTodos(session),
      ]);
      setIncome(inc);
      setExpense(exp);
      setHabTotal(todayHab.total);
      setHabDone(todayHab.done);
      setHabHabits(todayHab.habits);
      setHabEntryMap(todayHab.entryMap ?? {});
      setHabEntryMap(todayHab.entryMap);
      setTodaySport(sport);
      setOpenFix(fix);
      setTodos(todoList);
      writeCache({ income: inc, expense: exp });
      setStatus(inc > 0 || exp > 0 || todayHab.total > 0 || sport.length > 0 || todoList.length > 0 ? 'daten' : 'leer');
    } catch (e) {
      console.error('[Hub] Laden fehlgeschlagen:', e);
      setStatus('fehler');
    }
  }, [session]);

  useEffect(() => {
    let aktiv = true;
    load().catch(() => { if (aktiv) setStatus('fehler'); });
    return () => { aktiv = false; };
  }, [load]);

  function letztenStandAnsehen() {
    const cached = readCache();
    if (!cached) return;
    setIncome(cached.income);
    setExpense(cached.expense);
    setCacheZeit(cached.savedAt);
    setStatus('veraltet');
  }

  const saldo = income - expense;
  const monatsname = new Date().toLocaleDateString('de-DE', { month: 'long' });
  const habAllDone = habTotal > 0 && habDone === habTotal;

  // ── Habit-Toggle direkt im Hub ──
  async function handleToggleHabit(habit) {
    const sb       = getSupabase();
    const todayStr = new Date().toISOString().split('T')[0];
    const existing = habEntryMap[habit.id];
    const wasDone  = existing && existing.count >= habit.target_count;

    // Optimistisch updaten
    const nextMap  = { ...habEntryMap };
    const nextDone = wasDone ? habDone - 1 : habDone + 1;
    setHabDone(nextDone);

    try {
      if (existing) {
        if (wasDone) {
          await sb.from('hab_entries').update({ deleted_at: new Date().toISOString() }).eq('id', existing.id);
          delete nextMap[habit.id];
        } else {
          await sb.from('hab_entries').update({ deleted_at: null, count: habit.target_count }).eq('id', existing.id);
          nextMap[habit.id] = { ...existing, deleted_at: null, count: habit.target_count };
        }
      } else {
        const { data } = await sb.from('hab_entries')
          .insert({ habit_id: habit.id, logged_on: todayStr, count: habit.target_count })
          .select().single();
        if (data) nextMap[habit.id] = data;
      }
      setHabEntryMap(nextMap);

      // Feedback — nur beim Abhaken, nicht beim Rückgängig
      if (!wasDone) {
        const nowAllDone = nextDone === habTotal;
        if (nowAllDone) {
          fb.habitAllDone(); // Dreiklang + Doppel-Puls
        } else {
          fb.habitCheck();   // Einzelnes Ding + kurzer Pulse
        }
      }
    } catch (e) {
      console.error('[Hub] Habit-Toggle fehlgeschlagen:', e);
      setHabDone(habDone);
      setHabEntryMap(habEntryMap);
    }
  }

  // ── Todo-Handler ──
  async function handleToggleTodo(id, currentDone) {
    const next = !currentDone;
    const updatedTodos = todos.map((t) => t.id === id ? { ...t, done: next, done_at: next ? new Date().toISOString() : null } : t);
    setTodos(updatedTodos);
    if (!currentDone) {
      const offeneNachToggle = updatedTodos.filter((t) => !t.done);
      if (offeneNachToggle.length === 0) {
        fb.todoAllDone(); // ziel_erreicht.wav — alle erledigt
      } else {
        fb.todoCheck();   // click.mp3 — einzelnes ToDo
      }
    }
    try { await toggleTodo(id, next); }
    catch { setTodos((prev) => prev.map((t) => t.id === id ? { ...t, done: currentDone } : t)); }
  }

  async function handleDeleteTodo(id) {
    setTodos((prev) => prev.filter((t) => t.id !== id));
    try { await deleteTodo(id); }
    catch { const all = await getTodos(session); setTodos(all); }
  }

  function openNewTodo() { setEditTodo(null); setTodoSheet(true); }
  function openEditTodo(todo) { setEditTodo(todo); setTodoSheet(true); }

  function handleTodoSaved(saved) {
    setTodos((prev) => {
      const exists = prev.find((t) => t.id === saved.id);
      if (exists) return prev.map((t) => t.id === saved.id ? saved : t);
      return [...prev, saved].sort((a, b) => {
        if (!a.due_date && !b.due_date) return 0;
        if (!a.due_date) return 1;
        if (!b.due_date) return -1;
        const dateDiff = a.due_date.localeCompare(b.due_date);
        if (dateDiff !== 0) return dateDiff;
        return b.priority - a.priority;
      });
    });
  }

  const todayStr = new Date().toISOString().split('T')[0];
  const todosHeute = todos.filter((t) => !t.done && (
    (t.due_date && t.due_date <= todayStr) ||
    (!t.due_date && t.priority)
  ));
  const todosAlle     = todos.filter((t) => !t.done);
  const todosWichtig  = todos.filter((t) => !t.done && t.priority);
  const todosErledigt = todos.filter((t) => t.done);
  const visibleTodos =
    todoView === 'heute'    ? todosHeute   :
    todoView === 'wichtig'  ? todosWichtig :
    todoView === 'erledigt' ? todosErledigt :
    todosAlle;

  const restToday    = todaySport.some((w) => w.is_rest);
  const doneToday    = todaySport.filter((w) => !w.is_rest && w.status === 'done');
  const plannedToday = todaySport.filter((w) => !w.is_rest && w.status === 'planned');

  // ---- Ladestate ----
  if (status === 'laedt') {
    return (
      <div className="hub">
        <div className="hub-skeleton-block" style={{ width: 112, height: 9 }} />
        <div className="hub-skeleton-block" style={{ width: 212, height: 38, marginTop: 8 }} />
        <div style={{ display: 'flex', gap: 14, marginTop: 12 }}>
          <div className="hub-skeleton-block" style={{ width: 96, height: 11 }} />
          <div className="hub-skeleton-block" style={{ width: 96, height: 11 }} />
        </div>
        <div className="hub-skeleton-block" style={{ width: '100%', height: 10, marginTop: 14 }} />
        <div className="hub-skeleton-block" style={{ width: 78, height: 10, marginTop: 24 }} />
        {[0, 1].map((i) => (
          <div key={i} className="hub-skeleton-row">
            <div>
              <div className="hub-skeleton-block" style={{ width: 124, height: 11 }} />
              <div className="hub-skeleton-block" style={{ width: 80, height: 9, marginTop: 6 }} />
            </div>
            <div className="hub-skeleton-block" style={{ width: 62, height: 11 }} />
          </div>
        ))}
      </div>
    );
  }

  // ---- Fehlerstate ----
  if (status === 'fehler') {
    return (
      <div className="hub">
        <div className="hub-error">
          <div className="hub-error-headline">{monatsname} lässt sich gerade nicht laden.</div>
          <p className="hub-error-sub">Keine Verbindung zur Datenbank. Deine Daten sind da — sie kommen hier nur nicht an.</p>
          <div className="auth-actions" style={{ marginTop: 20 }}>
            <button className="btn btn-primary btn-block" onClick={load}>Nochmal versuchen</button>
            {readCache() && (
              <button className="btn-outline-block" onClick={letztenStandAnsehen}>Letzten Stand ansehen</button>
            )}
          </div>
          <div className="hub-empty-note" style={{ marginTop: 18 }}>
            Liegt's am Gerät? Prüf kurz die Internetverbindung — an den Daten selbst hat sich nichts geändert.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="hub">
      {status === 'veraltet' && (
        <div className="hub-stale-bar">
          <span className="hub-stale-dot" />
          <span>Stand von {cacheZeit ? new Date(cacheZeit).toLocaleString('de-DE', { hour: '2-digit', minute: '2-digit' }) : '—'} — Sitzung abgelaufen</span>
          <button className="hub-stale-login" onClick={() => window.location.reload()}>Anmelden</button>
        </div>
      )}

      {status === 'leer' && (
        <>
          <div className="hub-empty-headline">{monatsname} ist noch leer.</div>
          <p className="hub-empty-sub">Trag eine Ausgabe ein — den Rest baut die App daraus. Zwei Sekunden, kein Formular.</p>
          <div className="hub-empty-steps">
            <button className="hub-empty-step" onClick={() => onOpenModule('finance')}>
              <div>
                <div className="hub-empty-step-title">Erste Ausgabe eintragen</div>
                <div className="hub-empty-step-sub">Betrag, Name, fertig</div>
              </div>
              <span className="hub-empty-step-arrow">›</span>
            </button>
            <button className="hub-empty-step" onClick={() => onOpenModule('finance')}>
              <div>
                <div className="hub-empty-step-title">Fixkosten anlegen</div>
                <div className="hub-empty-step-sub">Miete, Handy, Abos — einmal, dann jeden Monat automatisch</div>
              </div>
              <span className="hub-empty-step-arrow">›</span>
            </button>
            <button className="hub-empty-step" onClick={() => onOpenModule('finance')}>
              <div>
                <div className="hub-empty-step-title">Alte Daten importieren</div>
                <div className="hub-empty-step-sub">JSON oder XLSX</div>
              </div>
              <span className="hub-empty-step-arrow" style={{ color: 'var(--text-muted)' }}>›</span>
            </button>
          </div>
          <div className="hub-empty-note">
            <b>Warum leer und nicht Beispieldaten:</b> geschönte Zahlen fühlen sich beim ersten Löschen wie Arbeit an. Drei Wege raus sind ehrlicher.
          </div>
        </>
      )}

      {(status === 'daten' || status === 'veraltet') && (
        <>
          {/* ── Finanz-Leitzahl ── */}
          <div className="hub-eyebrow">Saldo {monatsname}</div>
          <div
            className="hub-lead-stat"
            style={{ color: status === 'veraltet' ? 'var(--text-secondary)' : undefined }}
          >
            {formatEur(saldo)}
          </div>
          <div
            className="hub-lead-substats"
            style={{ color: status === 'veraltet' ? 'var(--text-muted)' : undefined }}
          >
            <span>Ein <b style={status === 'veraltet' ? { color: 'var(--text-secondary)' } : undefined}>{formatEur(income)}</b></span>
            <span>Aus <b style={status === 'veraltet' ? { color: 'var(--text-secondary)' } : undefined}>{formatEur(expense)}</b></span>
          </div>

          <div className="hub-divider" />

          {/* ── Kalender ── */}
          <div className="hub-section-label" style={{ marginTop: 0 }}>Diese Woche</div>
          <HubCalendar />

          <div className="hub-divider" />

          {/* ── Gewohnheiten ── */}
          {habTotal > 0 && (
            <div className="hub-hab-block">
              <div className="hub-hab-header">
                <span className="hub-quick-card-label">Gewohnheiten heute</span>
                <span className="hub-hab-count">{habDone} / {habTotal}</span>
              </div>
              <div className="hub-hab-progress">
                <div
                  className="hub-hab-bar"
                  style={{ width: `${habTotal > 0 ? (habDone / habTotal) * 100 : 0}%` }}
                />
              </div>
              <div className="hub-hab-list">
                {habHabits.map((h) => {
                  const entry  = habEntryMap[h.id];
                  const isDone = entry && entry.count >= h.target_count;
                  return (
                    <button
                      key={h.id}
                      className={`hub-hab-row ${isDone ? 'done' : ''}`}
                      onClick={() => handleToggleHabit(h)}
                    >
                      <span className={`hub-hab-check ${isDone ? 'checked' : ''}`}>
                        {isDone && '✓'}
                      </span>
                      <span className="hub-hab-icon">{h.icon}</span>
                      <span className="hub-hab-name">{h.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div className="hub-divider" />

          {/* ── Sport heute ── */}
          <button className="hub-quick-card" onClick={() => onOpenModule('sport')}>
            <div className="hub-quick-card-label">Sport heute</div>
            <div className="hub-quick-card-value">
              {restToday ? (
                <span className="hub-quick-muted">Restday</span>
              ) : doneToday.length > 0 ? (
                <>
                  {doneToday.map((w, i) => (
                    <span key={w.id}>
                      {i > 0 && <span className="hub-quick-sep"> · </span>}
                      {sportLabel(w)}
                      {w.duration_min ? ` ${w.duration_min} min` : ''}
                      <span className="hub-quick-done"> ✓</span>
                    </span>
                  ))}
                </>
              ) : plannedToday.length > 0 ? (
                <>
                  {plannedToday.map((w, i) => (
                    <span key={w.id}>
                      {i > 0 && <span className="hub-quick-sep"> · </span>}
                      {sportLabel(w)}
                      {w.duration_min ? ` ${w.duration_min} min` : ''}
                      <span className="hub-quick-planned"> geplant</span>
                    </span>
                  ))}
                </>
              ) : (
                <span className="hub-quick-muted">Restday</span>
              )}
            </div>
          </button>

          <div className="hub-divider" />

          {/* ── Offene Fixkosten ── */}
          {openFix.length > 0 && (
            <>
              <button className="hub-quick-card" onClick={() => onOpenModule('finance')}>
                <div className="hub-quick-card-label">Offen diesen Monat</div>
                {openFix.map((f) => (
                  <div key={f.id} className="hub-fix-row">
                    <span className="hub-fix-name">{f.name}</span>
                    <span className="hub-fix-amount">{formatEur(f.amount)}</span>
                  </div>
                ))}
              </button>
              <div className="hub-divider" />
            </>
          )}

          {/* ── Aufgaben ── */}
          <div className="hub-section-label" style={{ marginTop: 0 }}>Aufgaben</div>

          <div className="hub-todo-chips">
            {[
              { key: 'alle',     label: 'Alle',     count: todosAlle.length     },
              { key: 'heute',    label: 'Heute',    count: todosHeute.length    },
              { key: 'wichtig',  label: 'Wichtig',  count: todosWichtig.length  },
              { key: 'erledigt', label: 'Erledigt', count: todosErledigt.length },
            ].map(({ key, label, count }) => (
              <button
                key={key}
                className={`hub-todo-chip${todoView === key ? ' active' : ''}`}
                onClick={() => setTodoView(key)}
              >
                {label}
                {count > 0 && (
                  <span className="hub-todo-chip-badge">{count}</span>
                )}
              </button>
            ))}
          </div>

          <button className="hub-todo-add-bar" onClick={openNewTodo}>
            <span className="hub-todo-add-plus">+</span>
            <span>Neue Aufgabe</span>
          </button>

          {todoView !== 'erledigt' && visibleTodos.length === 0 && (
            <div className="hub-todo-empty">
              {todoView === 'heute'   ? 'Nichts für heute — gut so.' :
               todoView === 'wichtig' ? 'Keine wichtigen Aufgaben.' :
               'Keine offenen Aufgaben.'}
            </div>
          )}

          {todoView !== 'erledigt' && (
            <div className="hub-todo-list">
              {visibleTodos.map((todo) => (
                <div key={todo.id} className="hub-todo-row">
                  <button
                    className={`hub-todo-check ${todo.done ? 'checked' : ''}`}
                    onClick={() => handleToggleTodo(todo.id, todo.done)}
                    aria-label="Erledigt"
                  />
                  <div className="hub-todo-content" onClick={() => openEditTodo(todo)}>
                    <span className={`hub-todo-title ${todo.priority ? 'important' : ''}`}>
                      {todo.title}
                      {todo.priority && <span className="hub-todo-prio">!</span>}
                    </span>
                    {(todo.due_date || todo.note) && (
                      <span className="hub-todo-meta">
                        {todo.due_date && formatDueDate(todo.due_date, todayStr)}
                        {todo.due_date && todo.note && ' · '}
                        {todo.note}
                      </span>
                    )}
                  </div>
                  <button
                    className="hub-todo-delete"
                    onClick={() => handleDeleteTodo(todo.id)}
                    aria-label="Löschen"
                  >×</button>
                </div>
              ))}
            </div>
          )}

          {todoView === 'erledigt' && (
            <div className="hub-todo-list">
              {todosErledigt.length === 0 ? (
                <div className="hub-todo-empty">Noch nichts erledigt.</div>
              ) : (
                todosErledigt.map((todo) => (
                  <div key={todo.id} className="hub-todo-row done">
                    <button
                      className="hub-todo-check checked"
                      onClick={() => handleToggleTodo(todo.id, todo.done)}
                      aria-label="Wiederherstellen"
                    />
                    <div className="hub-todo-content" onClick={() => openEditTodo(todo)}>
                      <span className="hub-todo-title done">{todo.title}</span>
                      {todo.due_date && (
                        <span className="hub-todo-meta">{formatDueDate(todo.due_date, todayStr)}</span>
                      )}
                    </div>
                    <button
                      className="hub-todo-delete"
                      onClick={() => handleDeleteTodo(todo.id)}
                      aria-label="Löschen"
                    >×</button>
                  </div>
                ))
              )}
            </div>
          )}
        </>
      )}

      {todoSheet && (
        <TodoSheet
          onClose={() => setTodoSheet(false)}
          onSaved={handleTodoSaved}
          editTodo={editTodo}
        />
      )}
    </div>
  );
}
