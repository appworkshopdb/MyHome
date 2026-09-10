import { useCallback, useEffect, useState } from 'react';
import { useAuth } from './lib/AuthContext';
import { getMonthSum } from './lib/measurementsData';
import { formatEur } from './lib/format';
import { getSupabase } from './lib/supabaseClient';
import { getTodos, toggleTodo, deleteTodo } from './lib/todoData';
import ModuleTopBar from './components/ModuleTopBar';
import FocusCard from './components/FocusCard';
import PageSection from './components/PageSection';
import TodoSheet from './components/TodoSheet';
import HubCalendar from './components/HubCalendar';
import { fb } from './lib/feedback';
import { useHabitsStore, loadHabitsData, toggleHabitOn, getDueToday, isDone, todayStr as habTodayStr } from './lib/habitsStore.js';
import { awardPoints } from './lib/gamificationData.js';
import { optimisticUpdate, refreshStore } from './lib/gamificationStore.js';

// NEU (UMBAU-PLAN.md Schritt 10): der Hub folgt jetzt derselben Struktur
// wie die fünf Module — Fokuskarte mit dem Jetzt-Zustand, ein bis zwei
// helle Karten, alles Weitere auf eigenen Screens. Auf die Hauptansicht
// passt damit ohne Scrollen: Begrüßung, Saldo-Fokuskarte, "Heute" mit
// zwei Kacheln, "Aufgaben" mit den drei nächsten Punkten.
//
// Verschoben statt entfernt:
//   HubCalendar                → Bereich "Kalender"     (über "Kalender ›")
//   abhakbare Habit-Liste      → Bereich "Gewohnheiten" (über die Kachel)
//   Todo-Filterchips + Liste   → Bereich "Aufgaben"     (über "Alle N ›")
//   vollständige offene Posten → Finanzen, #/finance/offen (Pille "Ansehen")
//
// Die Bereiche laufen NICHT über den Hash: der Hub ist in useRoute.js die
// Route ohne Modul-Id (#/), ein "#/hub/aufgaben" gäbe es dort nicht und
// würde außerdem den aktiven Punkt der Bottom-Nav verwirren. Sie liegen
// deshalb als lokaler `bereich`-Zustand vor — dasselbe Muster, mit dem
// ShoppingModule seine Artikelansicht öffnet.
//
// Habit-Abhaken und Todo-Toggle inklusive awardPoints() bleiben in dieser
// Datei: laut Gamification.md ist der Hub die einzige Stelle, die für
// Gewohnheiten und ToDos Punkte vergibt (die Modul-Chats verdrahten
// awardPoints erst noch). Sie sind nur woanders gerendert.
//
// Der Hub rendert seit diesem Schritt seine eigene ModuleTopBar — sonst
// könnte er auf einem Bereich keinen Zurück-Pfeil zeigen. App.jsx rendert
// die globale TopBar deshalb nur noch für die Profilseite.

// v4: Struktur geändert — openPosten ist jetzt die vollständige Liste
// offener Ausgaben statt der auf drei begrenzten Fixkosten, damit die
// Zahl in der Fokuskarte zu der in Finanzen passt. Ein alter v3-Eintrag
// würde dort eine zu kleine Zahl zeigen, deshalb neuer Schlüssel.
const CACHE_KEY = 'hub-cache-v4';

// Älteres verwerfen: sonst zeigt der Hub am Monatsersten kurz den Saldo
// des Vormonats, und das fällt niemandem auf.
const CACHE_MAX_AGE_MS = 24 * 60 * 60 * 1000;

const BEREICH_TITEL = {
  gewohnheiten: 'Gewohnheiten heute',
  aufgaben:     'Aufgaben',
  kalender:     'Diese Woche',
};

function formatDueDate(dueDateStr, todayStr) {
  if (!dueDateStr) return null;
  const diff = Math.round((new Date(dueDateStr) - new Date(todayStr)) / 86400000);
  if (diff < 0)  return '⚠ überfällig';
  if (diff === 0) return 'Heute';
  if (diff === 1) return 'Morgen';
  return new Date(dueDateStr).toLocaleDateString('de-DE', { weekday: 'short', day: 'numeric', month: 'short' });
}

// Kurzform für die Statusspalte der Aufgaben-Karte auf der Übersicht
function todoStatus(todo, todayStr) {
  if (!todo.due_date) return todo.priority ? 'Wichtig' : null;
  if (todo.due_date < todayStr)   return 'überfällig';
  if (todo.due_date === todayStr) return 'Heute';
  return formatDueDate(todo.due_date, todayStr);
}

function greeting() {
  const h = new Date().getHours();
  if (h < 5)  return 'Gute Nacht';
  if (h < 11) return 'Guten Morgen';
  if (h < 18) return 'Guten Tag';
  return 'Guten Abend';
}

function readCache({ ignoreAge = false } = {}) {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!ignoreAge && data.savedAt) {
      if (Date.now() - new Date(data.savedAt).getTime() > CACHE_MAX_AGE_MS) return null;
    }
    return data;
  } catch { return null; }
}
function writeCache(data) {
  try { localStorage.setItem(CACHE_KEY, JSON.stringify({ ...data, savedAt: new Date().toISOString() })); } catch { /* egal */ }
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

// Offene Posten des laufenden Monats — dieselbe Abgrenzung wie im
// Finanzen-Modul ("nicht bezahlt, keine Einnahme"), damit Hub und
// Finanzen nicht zwei verschiedene Zahlen für dasselbe zeigen. Früher
// waren es nur Fixkosten/Sonstiges, begrenzt auf drei Zeilen — die
// vollständige Liste steht jetzt ohnehin unter #/finance/offen.
async function loadOpenPosten() {
  const sb = getSupabase();
  const now = new Date();
  const { data, error } = await sb
    .from('fin_entries')
    .select('id, name, amount, category, paid')
    .eq('year', now.getFullYear())
    .eq('month', now.getMonth() + 1)
    .eq('paid', false)
    .in('category', ['fixkosten', 'variable_kosten', 'sonstige_ausgaben'])
    .is('deleted_at', null)
    .order('amount', { ascending: false });
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

export default function Hub({ onOpenModule, hasWarnings }) {
  const { session } = useAuth();

  // Beim ersten Rendern gleich aus dem Cache füllen (stale-while-revalidate):
  // sichtbarer Hub sofort, frische Zahlen ersetzen ihn ein paar hundert
  // Millisekunden später. Nur wenn nichts Brauchbares im Cache liegt, wird
  // das Skelett gezeigt.
  const [initialCache] = useState(() => readCache());
  const [status, setStatus]       = useState(initialCache ? 'daten' : 'laedt');
  const [income, setIncome]       = useState(initialCache?.income ?? 0);
  const [expense, setExpense]     = useState(initialCache?.expense ?? 0);
  const [cacheZeit, setCacheZeit] = useState(null);

  // Welcher Bereich als Vollbild-Screen offen ist (null = Übersicht)
  const [bereich, setBereich] = useState(null);

  // Gemeinsamer Habits-Store — dieselben Daten wie im Habits-Modul.
  // Abhaken hier ist sofort im Modul sichtbar und umgekehrt.
  const { habits: allHabits, entries: habEntries } = useHabitsStore();
  const habHabits = getDueToday(allHabits, habEntries);
  const habTotal  = habHabits.length;
  const habDone   = habHabits.filter(
    (h) => isDone(habEntries, h.id, habTodayStr(), h.target_count)
  ).length;

  const [todaySport, setTodaySport] = useState(initialCache?.todaySport ?? []);
  const [openPosten, setOpenPosten] = useState(initialCache?.openPosten ?? []);
  const [todos, setTodos]           = useState(initialCache?.todos ?? []);
  const [todoSheet, setTodoSheet]   = useState(false);
  const [editTodo, setEditTodo]     = useState(null);
  const [todoView, setTodoView]     = useState('alle');

  const load = useCallback(async (opts = {}) => {
    // Beim Hintergrund-Aktualisieren bleibt der gecachte Stand stehen —
    // sonst würde der sichtbare Hub kurz durch das Skelett ersetzt, was
    // schlechter aussieht als vorher.
    if (!opts.imHintergrund) setStatus('laedt');
    const now = new Date();
    try {
      const [inc, exp, , sport, posten, todoList] = await Promise.all([
        getMonthSum(session, 'finance.income',  now.getFullYear(), now.getMonth() + 1),
        getMonthSum(session, 'finance.expense', now.getFullYear(), now.getMonth() + 1),
        // Habits kommen aus dem gemeinsamen Store (force = frischer Stand)
        loadHabitsData({ force: true }).catch(() => null),
        loadTodaySport(),
        loadOpenPosten(),
        getTodos(session),
      ]);
      setIncome(inc);
      setExpense(exp);
      setTodaySport(sport);
      setOpenPosten(posten);
      setTodos(todoList);
      writeCache({ income: inc, expense: exp, todaySport: sport, openPosten: posten, todos: todoList });
      setCacheZeit(null);
      setStatus(inc > 0 || exp > 0 || sport.length > 0 || todoList.length > 0 ? 'daten' : 'leer');
    } catch (e) {
      console.error('[Hub] Laden fehlgeschlagen:', e);
      // Mit gecachtem Stand auf dem Schirm ist ein Fehlerscreen die falsche
      // Antwort — dann bleibt das Bild stehen und bekommt oben nur einen
      // Hinweis, dass es nicht der aktuelle Stand ist.
      if (opts.imHintergrund) {
        setCacheZeit(initialCache?.savedAt ?? null);
        setStatus('veraltet');
      } else {
        setStatus('fehler');
      }
    }
  }, [session, initialCache]);

  useEffect(() => {
    let aktiv = true;
    load({ imHintergrund: Boolean(initialCache) }).catch(() => {
      if (aktiv) setStatus(initialCache ? 'veraltet' : 'fehler');
    });
    return () => { aktiv = false; };
  }, [load]);

  function letztenStandAnsehen() {
    const cached = readCache({ ignoreAge: true });
    if (!cached) return;
    setIncome(cached.income ?? 0);
    setExpense(cached.expense ?? 0);
    setTodaySport(cached.todaySport ?? []);
    setOpenPosten(cached.openPosten ?? []);
    setTodos(cached.todos ?? []);
    setCacheZeit(cached.savedAt);
    setStatus('veraltet');
  }

  const saldo = income - expense;
  const monatsname = new Date().toLocaleDateString('de-DE', { month: 'long' });
  const datumLang  = new Date().toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' });

  // ── Habit-Toggle ──
  // Läuft über den gemeinsamen Store — das Habits-Modul sieht die
  // Änderung sofort, ohne Reload.
  async function handleToggleHabit(habit) {
    const wasDone = isDone(habEntries, habit.id, habTodayStr(), habit.target_count);
    try {
      await toggleHabitOn(habit);
      // Feedback nur beim Abhaken, nicht beim Rückgängigmachen
      if (!wasDone) {
        if (habDone + 1 === habTotal) fb.habitAllDone();
        else                          fb.habitCheck();

        // ── Gamification ──
        // habit_check: 5 Punkte, max 8x täglich, Dedup über entity_id=habit.id
        awardPoints('habit_check', habit.id)
          .then((result) => {
            if (result.awarded) {
              optimisticUpdate(result);
              refreshStore();
              // Bonus wenn alle Habits des Tages erledigt
              if (habDone + 1 === habTotal) {
                awardPoints('habit_all_done_bonus', `bonus_${habTodayStr()}`)
                  .then((r) => { if (r.awarded) { optimisticUpdate(r); refreshStore(); } })
                  .catch(() => {});
              }
            }
          })
          .catch(() => {}); // Gamification-Fehler nie die Haupt-Funktion blockieren
      }
    } catch (e) {
      console.error('[Hub] Habit-Toggle fehlgeschlagen:', e);
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
        fb.todoAllDone(); // ziel_erreicht.mp3 — alle erledigt
      } else {
        fb.todoCheck();   // click.mp3 — einzelnes ToDo
      }

      // ── Gamification ──
      // todo_check: 5 Punkte, max 8x täglich, Dedup über entity_id=todo.id
      awardPoints('todo_check', id)
        .then((result) => {
          if (result.awarded) {
            optimisticUpdate(result);
            refreshStore();
          }
        })
        .catch(() => {}); // Gamification-Fehler nie die Haupt-Funktion blockieren
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

  // Die drei nächsten Punkte für die Übersicht: fällig zuerst (frühestes
  // Datum vorn), bei gleichem Datum wichtige zuerst, Undatiertes zuletzt.
  const naechsteTodos = todosAlle.slice().sort((a, b) => {
    const da = a.due_date ?? '9999-99-99';
    const db = b.due_date ?? '9999-99-99';
    if (da !== db) return da.localeCompare(db);
    return (b.priority ? 1 : 0) - (a.priority ? 1 : 0);
  }).slice(0, 3);

  const restToday    = todaySport.some((w) => w.is_rest);
  const doneToday    = todaySport.filter((w) => !w.is_rest && w.status === 'done');
  const plannedToday = todaySport.filter((w) => !w.is_rest && w.status === 'planned');
  const sportKachel =
    restToday               ? { icon: '–', text: 'Restday' } :
    doneToday.length > 0    ? { icon: '✓', text: sportLabel(doneToday[0]) } :
    plannedToday.length > 0 ? { icon: '·', text: sportLabel(plannedToday[0]) } :
                              { icon: '·', text: 'Nichts geplant' };

  const offeneSumme = openPosten.reduce((s, p) => s + Number(p.amount || 0), 0);

  // ---- Ladestate ----
  if (status === 'laedt') {
    return (
      <>
        <ModuleTopBar hasWarnings={hasWarnings} />
        <div className="hub with-topbar-space">
          <div className="hub-skeleton-block" style={{ width: 168, height: 24 }} />
          <div className="hub-skeleton-block" style={{ width: 132, height: 11, marginTop: 8 }} />
          <div className="hub-skeleton-block" style={{ width: '100%', height: 150, marginTop: 18, borderRadius: 18 }} />
          <div style={{ display: 'flex', gap: 12, marginTop: 22 }}>
            <div className="hub-skeleton-block" style={{ flex: 1, height: 86, borderRadius: 18 }} />
            <div className="hub-skeleton-block" style={{ flex: 1, height: 86, borderRadius: 18 }} />
          </div>
          <div className="hub-skeleton-block" style={{ width: '100%', height: 156, marginTop: 22, borderRadius: 18 }} />
        </div>
      </>
    );
  }

  // ---- Fehlerstate ----
  if (status === 'fehler') {
    return (
      <>
        <ModuleTopBar hasWarnings={hasWarnings} />
        <div className="hub with-topbar-space">
          <div className="hub-error">
            <div className="hub-error-headline">{monatsname} lässt sich gerade nicht laden.</div>
            <p className="hub-error-sub">Keine Verbindung zur Datenbank. Deine Daten sind da — sie kommen hier nur nicht an.</p>
            <div className="auth-actions" style={{ marginTop: 20 }}>
              <button className="btn btn-primary btn-block" onClick={load}>Nochmal versuchen</button>
              {readCache({ ignoreAge: true }) && (
                <button className="btn-outline-block" onClick={letztenStandAnsehen}>Letzten Stand ansehen</button>
              )}
            </div>
            <div className="hub-empty-note" style={{ marginTop: 18 }}>
              Liegt&apos;s am Gerät? Prüf kurz die Internetverbindung — an den Daten selbst hat sich nichts geändert.
            </div>
          </div>
        </div>
      </>
    );
  }

  // ── Bereich: Gewohnheiten heute (abhakbar, vergibt Punkte) ──────
  if (bereich === 'gewohnheiten') {
    return (
      <>
        <ModuleTopBar onBack={() => setBereich(null)} title={BEREICH_TITEL.gewohnheiten} hasWarnings={hasWarnings} />
        <div className="hub with-topbar-space">
          <div className="hub-hab-block">
            <div className="hub-hab-header">
              <span className="hub-quick-card-label">Heute fällig</span>
              <span className="hub-hab-count">{habDone} / {habTotal}</span>
            </div>
            <div className="hub-hab-progress">
              <div
                className="hub-hab-bar"
                style={{ width: `${habTotal > 0 ? (habDone / habTotal) * 100 : 0}%` }}
              />
            </div>
            <div className="hub-hab-list">
              {habHabits.length === 0 && (
                <div className="hub-todo-empty">Heute ist keine Gewohnheit fällig.</div>
              )}
              {habHabits.map((h) => {
                const erledigt = isDone(habEntries, h.id, habTodayStr(), h.target_count);
                return (
                  <button
                    key={h.id}
                    className={`hub-hab-row ${erledigt ? 'done' : ''}`}
                    onClick={() => handleToggleHabit(h)}
                  >
                    <span className={`hub-hab-check ${erledigt ? 'checked' : ''}`}>
                      {erledigt && '✓'}
                    </span>
                    <span className="hub-hab-icon">{h.icon}</span>
                    <span className="hub-hab-name">{h.name}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <button className="hub-area-link" onClick={() => onOpenModule('habits')}>
            Alle Gewohnheiten verwalten ›
          </button>
        </div>
      </>
    );
  }

  // ── Bereich: Kalender ───────────────────────────────────────────
  if (bereich === 'kalender') {
    return (
      <>
        <ModuleTopBar onBack={() => setBereich(null)} title={BEREICH_TITEL.kalender} hasWarnings={hasWarnings} />
        <div className="hub with-topbar-space">
          <HubCalendar />
        </div>
      </>
    );
  }

  // ── Bereich: Aufgaben (Filterchips + vollständige Liste) ────────
  if (bereich === 'aufgaben') {
    return (
      <>
        <ModuleTopBar onBack={() => setBereich(null)} title={BEREICH_TITEL.aufgaben} hasWarnings={hasWarnings} />
        <div className="hub with-topbar-space">
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
        </div>

        {todoSheet && (
          <TodoSheet
            onClose={() => setTodoSheet(false)}
            onSaved={handleTodoSaved}
            editTodo={editTodo}
          />
        )}
      </>
    );
  }

  // ── Übersicht ───────────────────────────────────────────────────
  return (
    <>
      <ModuleTopBar hasWarnings={hasWarnings} />
      <div className="hub with-topbar-space">
        {status === 'veraltet' && (
          <div className="hub-stale-bar">
            <span className="hub-stale-dot" />
            <span>Stand von {cacheZeit ? new Date(cacheZeit).toLocaleString('de-DE', { hour: '2-digit', minute: '2-digit' }) : '—'} — gerade nicht aktualisierbar</span>
            <button className="hub-stale-login" onClick={() => load()}>Neu laden</button>
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
              <button className="hub-empty-step" onClick={() => onOpenModule('finance/vertraege')}>
                <div>
                  <div className="hub-empty-step-title">Fixkosten anlegen</div>
                  <div className="hub-empty-step-sub">Miete, Handy, Abos — einmal, dann jeden Monat automatisch</div>
                </div>
                <span className="hub-empty-step-arrow">›</span>
              </button>
              <button className="hub-empty-step" onClick={() => onOpenModule('finance/einstellungen')}>
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
            <h1 className="overview-page-title">{greeting()}</h1>
            <div className="hub-date">{datumLang}</div>

            {/* Fokuskarte: Saldo des laufenden Monats */}
            <FocusCard>
              <FocusCard.Eyebrow>Saldo {monatsname}</FocusCard.Eyebrow>
              <FocusCard.Value>{formatEur(saldo)}</FocusCard.Value>
              <FocusCard.Meta>
                <span>Ein <b>{formatEur(income)}</b></span>
                <span>Aus <b>{formatEur(expense)}</b></span>
              </FocusCard.Meta>
              {openPosten.length > 0 && (
                <FocusCard.Footer>
                  <span>{openPosten.length} offene Posten · {formatEur(offeneSumme)}</span>
                  <FocusCard.Pill onPress={() => onOpenModule('finance/offen')}>Ansehen</FocusCard.Pill>
                </FocusCard.Footer>
              )}
            </FocusCard>

            {/* Heute — zwei Kacheln */}
            <PageSection
              title="Heute"
              action={{ label: 'Kalender ›', onPress: () => setBereich('kalender') }}
            >
              <div className="hub-tiles">
                <button className="hub-tile" onClick={() => setBereich('gewohnheiten')}>
                  <span className="hub-tile-value">
                    {habTotal > 0 ? `${habDone}/${habTotal}` : '–'}
                  </span>
                  <span className="hub-tile-label">Gewohnheiten</span>
                  <span className="hub-tile-bar">
                    <span
                      className="hub-tile-bar-fill"
                      style={{ width: `${habTotal > 0 ? (habDone / habTotal) * 100 : 0}%` }}
                    />
                  </span>
                </button>

                <button className="hub-tile" onClick={() => onOpenModule('sport')}>
                  <span className={`hub-tile-value ${sportKachel.icon === '✓' ? 'hub-tile-value--done' : ''}`}>
                    {sportKachel.icon}
                  </span>
                  <span className="hub-tile-label">Training</span>
                  <span className="hub-tile-sub">{sportKachel.text}</span>
                </button>
              </div>
            </PageSection>

            {/* Aufgaben — die drei nächsten Punkte, direkt abhakbar */}
            <PageSection
              title="Aufgaben"
              action={todosAlle.length > 0
                ? { label: `Alle ${todosAlle.length} ›`, onPress: () => setBereich('aufgaben') }
                : undefined}
            >
              <div className="hub-task-card">
                {naechsteTodos.length === 0 && (
                  <div className="hub-task-empty">Keine offenen Aufgaben.</div>
                )}
                {naechsteTodos.map((todo) => {
                  const label = todoStatus(todo, todayStr);
                  const kritisch = Boolean(todo.due_date && todo.due_date < todayStr);
                  return (
                    <div key={todo.id} className="hub-task-row">
                      <button
                        className="hub-task-check"
                        onClick={() => handleToggleTodo(todo.id, todo.done)}
                        aria-label="Erledigt"
                      />
                      <span className="hub-task-title" onClick={() => openEditTodo(todo)}>
                        {todo.title}
                      </span>
                      {label && (
                        <span className={`hub-task-status ${kritisch ? 'hub-task-status--critical' : ''}`}>
                          {label}
                        </span>
                      )}
                    </div>
                  );
                })}
                <button className="hub-task-row hub-task-add" onClick={openNewTodo}>
                  <span className="hub-task-add-plus">+</span>
                  <span className="hub-task-title">Neue Aufgabe</span>
                </button>
              </div>
            </PageSection>
          </>
        )}
      </div>

      {todoSheet && (
        <TodoSheet
          onClose={() => setTodoSheet(false)}
          onSaved={handleTodoSaved}
          editTodo={editTodo}
        />
      )}
    </>
  );
}
