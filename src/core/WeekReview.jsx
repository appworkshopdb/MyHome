// core/WeekReview.jsx
// Hub → "Statistiken": Wochenrückblick (Mo–So) mit Fortschritt statt Zahlen.
// Route: #/statistiken — dorthin zeigt auch der Sonntags-Push (weekly_recap).
//
// Drei Karten: Gewohnheiten (gleiche Rechnung wie die Statistik im Habits-
// Modul, siehe core/lib/habitStatsMath.js), Training (geplante gegen erledigte
// Einheiten) und Ernährung (erfasste Tage, Ø-Kalorien gegen Ziel, Protein).
// Der Gesamtring oben mittelt die Karten, die in der Woche Daten haben.
//
// Alle Rechnungen in core/lib/weekStats.js (rein, ohne Netzwerk).

import { useEffect, useMemo, useState } from 'react';
import { useAuth } from './lib/AuthContext';
import { useHabitsStore, todayStr } from './lib/habitsStore.js';
import {
  weekBounds, buildHabitsWeek, buildSportWeek, buildNutritionWeek,
  overallRate, weekHeadline, loadWeekExtras,
} from './lib/weekStats.js';
import ModuleTopBar from './components/ModuleTopBar';

const WD = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];

const pct = (rate) => (rate === null || rate === undefined ? '–' : `${Math.round(rate * 100)} %`);
const nf = (n) => Math.round(n).toLocaleString('de-DE');

// ─── Bausteine ────────────────────────────────────────────

function Ring({ rate, size = 84 }) {
  const R = size * 0.405;
  const C = 2 * Math.PI * R;
  const c = size / 2;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={`Wochenquote ${pct(rate)}`}>
      <circle cx={c} cy={c} r={R} fill="none" stroke="var(--data-track)" strokeWidth="9" />
      <circle
        cx={c} cy={c} r={R} fill="none" stroke="var(--data-1)" strokeWidth="9"
        strokeLinecap="round" strokeDasharray={C} strokeDashoffset={C * (1 - (rate ?? 0))}
        transform={`rotate(-90 ${c} ${c})`}
      />
    </svg>
  );
}

function Bar({ rate, tone }) {
  return (
    <div className="wk-bar" role="progressbar" aria-valuemin={0} aria-valuemax={100}
      aria-valuenow={Math.round((rate ?? 0) * 100)}>
      <i className={tone ? `is-${tone}` : ''} style={{ width: `${Math.round(Math.min(1, Math.max(0, rate ?? 0)) * 100)}%` }} />
    </div>
  );
}

function Delta({ cur, prev }) {
  if (cur === null || cur === undefined || prev === null || prev === undefined) return null;
  const pp = Math.round((cur - prev) * 100);
  if (pp > 0) return <span className="wk-delta up">▲ {pp} PP</span>;
  if (pp < 0) return <span className="wk-delta down">▼ {Math.abs(pp)} PP</span>;
  return <span className="wk-delta flat">● ±0</span>;
}

function DayLabel({ date, today }) {
  const wd = (new Date(date + 'T12:00:00').getDay() + 6) % 7;
  return <span className={`wk-day-label${date === today ? ' today' : ''}`}>{WD[wd]}</span>;
}

function Card({ icon, title, delta, onOpen, children }) {
  return (
    <section className="wk-card">
      <button type="button" className="wk-card-head" onClick={onOpen}>
        <span className="wk-card-icon" aria-hidden="true">{icon}</span>
        <span className="wk-card-title">{title}</span>
        {delta}
        <span className="wk-card-chev" aria-hidden="true">›</span>
      </button>
      {children}
    </section>
  );
}

function Empty({ children }) {
  return <div className="wk-empty">{children}</div>;
}

// ─── Karten ───────────────────────────────────────────────

function HabitsCard({ data, today, onOpen }) {
  const ranking = data.ranking.slice(0, 6);
  return (
    <Card icon="✅" title="Gewohnheiten" delta={<Delta cur={data.rate} prev={data.prevRate} />} onOpen={onOpen}>
      {!data.hasData ? (
        <Empty>In dieser Woche war keine Gewohnheit fällig.</Empty>
      ) : (
        <>
          <div className="wk-big"><b>{pct(data.rate)}</b><span>{data.done} von {data.due} erledigt</span></div>
          <Bar rate={data.rate} />

          <div className="wk-strip">
            {data.perDay.map((d) => (
              <div key={d.date} className="wk-day">
                <div className="wk-col">
                  {!d.future && (
                    <i className={d.rate === null ? 'is-none' : ''}
                      style={{ height: `${d.rate === null ? 4 : Math.max(6, Math.round(d.rate * 100))}%` }} />
                  )}
                </div>
                <DayLabel date={d.date} today={today} />
              </div>
            ))}
          </div>

          <div className="wk-list">
            {ranking.map((r) => (
              <div key={r.habit.id} className="wk-row">
                <span className="wk-row-icon">{r.habit.icon}</span>
                <span className="wk-row-name">{r.habit.name}</span>
                <span className="wk-row-pct">{pct(r.rate)}</span>
                <Bar rate={r.rate} />
              </div>
            ))}
            {data.ranking.length > ranking.length && (
              <div className="wk-more">+ {data.ranking.length - ranking.length} weitere</div>
            )}
          </div>
        </>
      )}
    </Card>
  );
}

function SportCard({ data, today, onOpen }) {
  return (
    <Card icon="💪" title="Training" delta={data && <Delta cur={data.rate} prev={data.prevRate} />} onOpen={onOpen}>
      {!data ? (
        <Empty>Training konnte nicht geladen werden.</Empty>
      ) : !data.hasData ? (
        <Empty>In dieser Woche war kein Training geplant.</Empty>
      ) : (
        <>
          <div className="wk-big">
            <b>{data.done} von {data.total}</b>
            <span>Einheiten{data.minutes > 0 ? ` · ${nf(data.minutes)} Min` : ''}</span>
          </div>
          <Bar rate={data.rate} />

          <div className="wk-strip">
            {data.perDay.map((d) => {
              const state = d.rest && d.planned === 0 ? 'rest'
                : d.planned === 0 ? 'none'
                : d.done >= d.planned ? 'done'
                : d.done > 0 ? 'part'
                : 'open';
              return (
                <div key={d.date} className="wk-day">
                  <div className="wk-col wk-col--dot">
                    <span className={`wk-dot is-${state}`}>
                      {state === 'done' ? '✓' : state === 'rest' ? '–' : ''}
                    </span>
                  </div>
                  <DayLabel date={d.date} today={today} />
                </div>
              );
            })}
          </div>
        </>
      )}
    </Card>
  );
}

function NutritionCard({ data, today, onOpen }) {
  const goal = data?.goal;
  return (
    <Card icon="🍽️" title="Ernährung" onOpen={onOpen}>
      {!data ? (
        <Empty>Mahlzeiten konnten nicht geladen werden.</Empty>
      ) : !data.hasData ? (
        <Empty>In dieser Woche wurden noch keine Mahlzeiten erfasst.</Empty>
      ) : (
        <>
          <div className="wk-big">
            <b>{data.loggedDays} von {data.elapsedDays}</b>
            <span>Tagen erfasst</span>
          </div>
          <Bar rate={data.rate} />

          <div className="wk-strip">
            {goal && <div className="wk-goal-line" aria-hidden="true" />}
            {data.perDay.map((d) => {
              const ratio = d.kcalRatio;
              const height = !d.logged ? 4
                : ratio === null ? 60
                : Math.max(6, Math.round((Math.min(ratio, 1.2) / 1.2) * 100));
              return (
                <div key={d.date} className="wk-day">
                  <div className="wk-col">
                    {!d.future && (
                      <i className={!d.logged ? 'is-none' : ratio !== null && ratio > 1.1 ? 'is-over' : ''}
                        style={{ height: `${height}%` }} />
                    )}
                  </div>
                  <DayLabel date={d.date} today={today} />
                </div>
              );
            })}
          </div>

          {goal ? (
            <div className="wk-list">
              <div className="wk-meter">
                <div className="wk-meter-top">
                  <span>Ø Kalorien an erfassten Tagen</span>
                  <b>{data.hasEstimate ? '≈ ' : ''}{nf(data.avgKcal)} / {nf(goal.kcal)} kcal</b>
                </div>
                <Bar rate={data.avgKcal / goal.kcal} tone={data.avgKcal / goal.kcal > 1.1 ? 'over' : ''} />
              </div>
              <div className="wk-meter">
                <div className="wk-meter-top">
                  <span>Protein-Ziel</span>
                  <b>an {data.proteinDays} von {data.loggedDays} Tagen</b>
                </div>
                <Bar rate={data.loggedDays > 0 ? data.proteinDays / data.loggedDays : 0} />
              </div>
            </div>
          ) : (
            <div className="wk-more">Mit vollständigem Körperprofil siehst du hier auch Kalorien- und Protein-Ziel.</div>
          )}
        </>
      )}
    </Card>
  );
}

// ─── Seite ────────────────────────────────────────────────

export default function WeekReview({ onOpenModule, hasWarnings }) {
  const { session } = useAuth();
  const { habits, entries, loaded } = useHabitsStore();
  const [offset, setOffset] = useState(0);
  const [extras, setExtras] = useState(null); // null = lädt
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0); // erhöhen = erneut laden

  // Lokales Datum (kein toISOString) — ändert sich nur über Mitternacht
  const todayKey = todayStr();

  const week = useMemo(() => weekBounds(offset, todayKey), [offset, todayKey]);
  const prevWeek = useMemo(() => weekBounds(offset - 1, todayKey), [offset, todayKey]);

  useEffect(() => {
    let alive = true;
    setExtras(null);
    setFailed(false);
    loadWeekExtras(session, week, prevWeek)
      .then((x) => { if (alive) setExtras(x); })
      .catch((e) => {
        console.error('[WeekReview] Laden fehlgeschlagen:', e);
        if (alive) setFailed(true);
      });
    return () => { alive = false; };
  }, [session, week, prevWeek, attempt]);

  const view = useMemo(() => {
    if (!extras || !loaded) return null;
    // Aktive/pausierte Gewohnheiten aus dem Store plus archivierte
    const byId = new Map();
    for (const h of [...habits, ...extras.archived]) byId.set(h.id, h);
    const habitsWeek = buildHabitsWeek({ habits: [...byId.values()], entries, week, prevWeek, today: todayKey });
    const sport = extras.workouts
      ? buildSportWeek({ workouts: extras.workouts, week, prevWeek, today: todayKey })
      : null;
    const nutrition = extras.meals
      ? buildNutritionWeek({ meals: extras.meals, target: extras.target, week, today: todayKey })
      : null;
    return { habits: habitsWeek, sport, nutrition, overall: overallRate([habitsWeek, sport, nutrition]) };
  }, [extras, loaded, habits, entries, week, prevWeek, todayKey]);

  const running = week.isCurrent && todayKey < week.end;
  const topBar = (
    <ModuleTopBar title="Statistiken" hasWarnings={hasWarnings} onBack={() => onOpenModule(null)} />
  );

  if (failed) {
    return (
      <>
        {topBar}
        <div className="hub with-topbar-space">
          <div className="hub-error">
            <div className="hub-error-headline">Die Woche lässt sich gerade nicht laden.</div>
            <p className="hub-error-sub">Keine Verbindung zur Datenbank. Deine Daten sind da — sie kommen hier nur nicht an.</p>
            <div className="auth-actions" style={{ marginTop: 20 }}>
              <button className="btn btn-primary btn-block" onClick={() => setAttempt((n) => n + 1)}>Nochmal versuchen</button>
            </div>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      {topBar}
      <div className="hub with-topbar-space wk-page">
        <h1 className="overview-page-title">Wochenrückblick</h1>

        <div className="wk-nav">
          <button type="button" className="wk-nav-btn" onClick={() => setOffset((o) => o - 1)} aria-label="Vorherige Woche">‹</button>
          <div className="wk-nav-label">
            <b>{week.label}</b>
            <span>{week.isCurrent ? 'Diese Woche' : offset === -1 ? 'Letzte Woche' : `vor ${-offset} Wochen`}</span>
          </div>
          <button type="button" className="wk-nav-btn" onClick={() => setOffset((o) => Math.min(0, o + 1))}
            disabled={offset >= 0} aria-label="Nächste Woche">›</button>
        </div>

        {!view ? (
          <>
            <div className="hub-skeleton-block" style={{ width: '100%', height: 120, marginTop: 16, borderRadius: 18 }} />
            <div className="hub-skeleton-block" style={{ width: '100%', height: 200, marginTop: 14, borderRadius: 18 }} />
            <div className="hub-skeleton-block" style={{ width: '100%', height: 160, marginTop: 14, borderRadius: 18 }} />
          </>
        ) : (
          <>
            <section className="wk-card wk-hero">
              <Ring rate={view.overall} />
              <div>
                <div className="wk-hero-num">{pct(view.overall)}</div>
                <div className="wk-hero-title">{weekHeadline(view.overall)}</div>
                <div className="wk-hero-sub">
                  {view.overall === null
                    ? 'Sobald du abhakst, trainierst oder isst, erscheint hier dein Fortschritt.'
                    : running ? 'Die Woche läuft noch — bis Sonntag ist Zeit.' : 'Woche abgeschlossen.'}
                </div>
              </div>
            </section>

            <HabitsCard data={view.habits} today={todayKey} onOpen={() => onOpenModule('habits/statistik')} />
            <SportCard data={view.sport} today={todayKey} onOpen={() => onOpenModule('sport')} />
            <NutritionCard data={view.nutrition} today={todayKey} onOpen={() => onOpenModule('nutrition/mahlzeiten')} />
          </>
        )}
      </div>
    </>
  );
}
