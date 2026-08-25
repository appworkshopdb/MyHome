import { useCallback, useEffect, useState } from 'react';
import { useAuth } from './lib/AuthContext';
import { getMonthSum, getRecentMeasurements, getPeriodSummary, lastNDaysRange } from './lib/measurementsData';
import { formatEur, formatRelativeDate } from './lib/format';
import { getModule } from './modules';
import { getSupabase } from './lib/supabaseClient';
import ProgressStat from './components/ProgressStat';

const METRIC_LABELS = {
  'finance.income':  'Einnahme',
  'finance.expense': 'Ausgabe',
  'hab.checkin':     'Gewohnheit erledigt',
};

const CACHE_KEY = 'hub-cache-v1';

function readCache() {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}
function writeCache(data) {
  try { localStorage.setItem(CACHE_KEY, JSON.stringify({ ...data, savedAt: new Date().toISOString() })); } catch { /* egal */ }
}

// Habits-Tagesdaten direkt aus hab_habits + hab_entries laden
// (core darf nicht aus modules/ importieren — eigene Abfrage hier)
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
    .select('habit_id, count, logged_on, deleted_at')
    .eq('logged_on', todayStr)
    .is('deleted_at', null);
  if (eErr) throw eErr;

  // Welche Habits sind heute fällig?
  const wd = (new Date().getDay() + 6) % 7; // Mo=0..So=6
  const due = (habits ?? []).filter((h) => {
    if (new Date(h.created_at).toISOString().split('T')[0] > todayStr) return false;
    if (h.frequency === 'daily') return true;
    if (h.frequency === 'weekdays') return wd < 5;
    if (h.frequency === 'custom' && Array.isArray(h.frequency_days)) return h.frequency_days.includes(wd);
    return true;
  });

  const doneIds = new Set(
    (entries ?? [])
      .filter((e) => {
        const habit = due.find((h) => h.id === e.habit_id);
        return habit && e.count >= habit.target_count;
      })
      .map((e) => e.habit_id)
  );

  return { total: due.length, done: doneIds.size, habits: due };
}

export default function Hub({ onOpenModule }) {
  const { session } = useAuth();
  const [status, setStatus]     = useState('laedt');
  const [income, setIncome]     = useState(0);
  const [expense, setExpense]   = useState(0);
  const [activity, setActivity] = useState([]);
  const [cacheZeit, setCacheZeit] = useState(null);
  const [week, setWeek] = useState({});

  // Habits-Kachel
  const [habTotal, setHabTotal] = useState(0);
  const [habDone, setHabDone]   = useState(0);
  const [habHabits, setHabHabits] = useState([]);

  const load = useCallback(async () => {
    setStatus('laedt');
    const now = new Date();
    try {
      const { from, to } = lastNDaysRange(7);
      const [inc, exp, recent, todayHab, weekSummary] = await Promise.all([
        getMonthSum(session, 'finance.income',  now.getFullYear(), now.getMonth() + 1),
        getMonthSum(session, 'finance.expense', now.getFullYear(), now.getMonth() + 1),
        getRecentMeasurements(session, 5),
        loadTodayHabits(),
        getPeriodSummary(session, from, to),
      ]);
      setIncome(inc);
      setExpense(exp);
      setActivity(recent);
      setHabTotal(todayHab.total);
      setHabDone(todayHab.done);
      setHabHabits(todayHab.habits);
      setWeek(weekSummary);
      writeCache({ income: inc, expense: exp, activity: recent });
      setStatus(recent.length > 0 || inc > 0 || exp > 0 || todayHab.total > 0 ? 'daten' : 'leer');
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
    setActivity(cached.activity);
    setCacheZeit(cached.savedAt);
    setStatus('veraltet');
  }

  const saldo = income - expense;
  const monatsname = new Date().toLocaleDateString('de-DE', { month: 'long' });

  const habAllDone = habTotal > 0 && habDone === habTotal;

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
          {/* Finanz-Leitzahl */}
          <div className="hub-eyebrow">Saldo diesen Monat</div>
          <div className="hub-lead-stat" style={{ color: status === 'veraltet' ? 'var(--text-secondary)' : undefined }}>
            {formatEur(saldo)}
          </div>
          <div className="hub-lead-substats" style={{ color: status === 'veraltet' ? 'var(--text-muted)' : undefined }}>
            <span>Ein <b style={status === 'veraltet' ? { color: 'var(--text-secondary)' } : undefined}>{formatEur(income)}</b></span>
            <span>Aus <b style={status === 'veraltet' ? { color: 'var(--text-secondary)' } : undefined}>{formatEur(expense)}</b></span>
          </div>

          <div className="hub-divider" />

          {/* Habits-Kachel — nur anzeigen wenn Habits vorhanden */}
          {habTotal > 0 && (
            <ProgressStat
              variant="card"
              celebrate={habAllDone}
              label={habAllDone ? '🏆 Alle Gewohnheiten erledigt!' : 'Gewohnheiten heute'}
              value={habDone}
              target={habTotal}
              onClick={() => onOpenModule('habits')}
              sublabel={
                habHabits.length > 0
                  ? habHabits.slice(0, 6).map((h) => h.icon).join('  ') + (habHabits.length > 6 ? `  +${habHabits.length - 6}` : '')
                  : undefined
              }
            />
          )}

          {Object.keys(week).length > 0 && (
            <>
              <div className="hub-section-label">Diese Woche</div>
              <div className="hub-week-list">
                {Object.entries(week).map(([moduleId, data]) => {
                  const mod = getModule(moduleId);
                  let netEur = null;
                  for (const [key, m] of Object.entries(data.byMetric)) {
                    if (m.unit === 'EUR') {
                      const sign = key.endsWith('.expense') ? -1 : 1;
                      netEur = (netEur ?? 0) + sign * m.sum;
                    }
                  }
                  return (
                    <div className="hub-week-row" key={moduleId}>
                      <span className="hub-week-dot" style={{ background: mod?.color || 'var(--text-muted)' }} />
                      <span className="hub-week-name">{mod?.name || moduleId}</span>
                      <span className="hub-week-value">
                        {data.count} {data.count === 1 ? 'Eintrag' : 'Einträge'}
                        {netEur !== null && ` · ${formatEur(netEur)}`}
                      </span>
                    </div>
                  );
                })}
              </div>
            </>
          )}

          <div className="hub-section-label">Aktivität</div>
          <div className="hub-activity-list">
            {activity
              .filter((m) => m.metric_key !== 'hab.checkin') // Habit-Check-ins nicht in der Aktivitätsliste
              .map((m) => {
                const mod = getModule(m.source_module);
                const isIncome = m.metric_key.endsWith('.income');
                const signedValue = m.metric_key.endsWith('.expense') ? -Math.abs(m.value) : m.value;
                return (
                  <div className="hub-activity-row" key={m.id}>
                    <div>
                      <div className="hub-activity-title">{METRIC_LABELS[m.metric_key] || m.metric_key}</div>
                      <div className="hub-activity-time">{mod?.name || m.source_module} · {formatRelativeDate(m.created_at)}</div>
                    </div>
                    <div className="hub-activity-value">
                      {isIncome && <span className="hub-activity-value-dot" />}
                      {m.unit === 'EUR' ? formatEur(signedValue) : `${signedValue} ${m.unit}`}
                    </div>
                  </div>
                );
              })}
            {activity.filter((m) => m.metric_key !== 'hab.checkin').length === 0 && (
              <div className="fin-row-empty">Noch keine Aktivität.</div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
