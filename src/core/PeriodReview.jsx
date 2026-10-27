// core/PeriodReview.jsx
// Hub → Statistiken → Wochenüberblick / Monatsüberblick: Fortschritt statt Zahlen.
// Routen: #/statistiken/woche und #/statistiken/monat — dorthin zeigen auch die
// Montags- bzw. Monatsersten-Pushes (weekly_recap, monthly_recap).
//
// Drei Karten: Gewohnheiten (gleiche Rechnung wie die Statistik im Habits-
// Modul, siehe core/lib/habitStatsMath.js), Training (geplante gegen erledigte
// Einheiten) und Ernährung (erfasste Tage, Ø-Kalorien gegen Ziel, Protein).
// Der Gesamtring oben mittelt die Karten, die im Zeitraum Daten haben.
//
// Wochenansicht: ein Tag je Spalte. Monatsansicht: eine Kalenderwoche je Spalte.
// Alle Rechnungen in core/lib/periodStats.js (rein, ohne Netzwerk).

import { useEffect, useMemo, useState } from 'react';
import { useAuth } from './lib/AuthContext';
import { useHabitsStore, todayStr } from './lib/habitsStore.js';
import {
  periodBounds, buildHabitsPeriod, buildSportPeriod, buildNutritionPeriod,
  overallRate, periodHeadline, loadPeriodExtras,
} from './lib/periodStats.js';
import ModuleTopBar from './components/ModuleTopBar';

const pct = (rate) => (rate === null || rate === undefined ? '–' : `${Math.round(rate * 100)} %`);
const nf = (n) => Math.round(n).toLocaleString('de-DE');
const barHeight = (rate) => Math.max(6, Math.round(Math.min(1, rate) * 100));

const COPY = {
  week: {
    title: 'Wochenüberblick',
    ringLabel: 'Wochenquote',
    now: 'Diese Woche', last: 'Letzte Woche', ago: (n) => `vor ${n} Wochen`,
    prevAria: 'Vorherige Woche', nextAria: 'Nächste Woche',
    noHabit: 'In dieser Woche war keine Gewohnheit fällig.',
    noSport: 'In dieser Woche war kein Training geplant.',
    noMeals: 'In dieser Woche wurden noch keine Mahlzeiten erfasst.',
    error: 'Die Woche lässt sich gerade nicht laden.',
    running: () => 'Die Woche läuft noch — bis Sonntag ist Zeit.',
    done: 'Woche abgeschlossen.',
  },
  month: {
    title: 'Monatsüberblick',
    ringLabel: 'Monatsquote',
    now: 'Dieser Monat', last: 'Letzter Monat', ago: (n) => `vor ${n} Monaten`,
    prevAria: 'Vorheriger Monat', nextAria: 'Nächster Monat',
    noHabit: 'In diesem Monat war keine Gewohnheit fällig.',
    noSport: 'In diesem Monat war kein Training geplant.',
    noMeals: 'In diesem Monat wurden noch keine Mahlzeiten erfasst.',
    error: 'Der Monat lässt sich gerade nicht laden.',
    running: (left) => `Der Monat läuft noch — noch ${left} ${left === 1 ? 'Tag' : 'Tage'}.`,
    done: 'Monat abgeschlossen.',
  },
};

// ─── Bausteine ────────────────────────────────────────────

function Ring({ rate, label, size = 84 }) {
  const R = size * 0.405;
  const C = 2 * Math.PI * R;
  const c = size / 2;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={`${label} ${pct(rate)}`}>
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
  if (pp > 0) return <span className="wk-delta up">▲ {pp} Pkt.</span>;
  if (pp < 0) return <span className="wk-delta down">▼ {Math.abs(pp)} Pkt.</span>;
  return <span className="wk-delta flat">● ±0</span>;
}

/**
 * Kleine Verlaufsgrafik: eine Spalte je Tag (Woche) bzw. Kalenderwoche (Monat).
 * cols: [{ key, label, node }] — node ist der Inhalt der Spalte (Balken/Punkt).
 * dot: Spalten mittig statt am Boden (Trainingspunkte).
 */
function Strip({ cols, today, days, dot, goalLine }) {
  return (
    <div className="wk-strip">
      {goalLine && <div className="wk-goal-line" aria-hidden="true" />}
      {cols.map((c) => {
        const isToday = days[c.key]?.includes(today);
        return (
          <div key={c.key} className="wk-day">
            <div className={`wk-col${dot ? ' wk-col--dot' : ''}`}>{c.node}</div>
            <span className={`wk-day-label${isToday ? ' today' : ''}`}>{c.label}</span>
          </div>
        );
      })}
    </div>
  );
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

function HabitsCard({ data, period, today, copy, onOpen }) {
  const ranking = data.ranking.slice(0, 6);
  const cols = data.cols.map((c) => ({
    key: c.key,
    label: c.label,
    node: c.future ? null : (
      <i className={c.rate === null ? 'is-none' : ''}
        style={{ height: `${c.rate === null ? 4 : barHeight(c.rate)}%` }} />
    ),
  }));
  return (
    <Card icon="✅" title="Gewohnheiten" delta={<Delta cur={data.rate} prev={data.prevRate} />} onOpen={onOpen}>
      {!data.hasData ? (
        <Empty>{copy.noHabit}</Empty>
      ) : (
        <>
          <div className="wk-big"><b>{pct(data.rate)}</b><span>{data.done} von {data.due} erledigt</span></div>
          <Bar rate={data.rate} />
          <Strip cols={cols} today={today} days={period.dayMap} />

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

function SportCard({ data, period, today, copy, onOpen }) {
  const month = period.kind === 'month';
  const cols = data?.cols.map((c) => {
    if (month) {
      // Monat: Balken = erledigter Anteil der Einheiten in der Kalenderwoche
      return {
        key: c.key,
        label: c.label,
        node: c.future ? null : (
          <i className={c.planned === 0 ? 'is-none' : ''}
            style={{ height: `${c.planned === 0 ? 4 : barHeight(c.done / c.planned)}%` }} />
        ),
      };
    }
    // Woche: ein Punkt je Tag
    const state = c.rest && c.planned === 0 ? 'rest'
      : c.planned === 0 ? 'none'
      : c.done >= c.planned ? 'done'
      : c.done > 0 ? 'part'
      : 'open';
    return {
      key: c.key,
      label: c.label,
      node: <span className={`wk-dot is-${state}`}>{state === 'done' ? '✓' : state === 'rest' ? '–' : ''}</span>,
    };
  });
  return (
    <Card icon="💪" title="Training" delta={data && <Delta cur={data.rate} prev={data.prevRate} />} onOpen={onOpen}>
      {!data ? (
        <Empty>Training konnte nicht geladen werden.</Empty>
      ) : !data.hasData ? (
        <Empty>{copy.noSport}</Empty>
      ) : (
        <>
          <div className="wk-big">
            <b>{data.done} von {data.total}</b>
            <span>Einheiten{data.minutes > 0 ? ` · ${nf(data.minutes)} Min` : ''}</span>
          </div>
          <Bar rate={data.rate} />
          <Strip cols={cols} today={today} days={period.dayMap} dot={!month} />
        </>
      )}
    </Card>
  );
}

function NutritionCard({ data, period, today, copy, onOpen }) {
  const month = period.kind === 'month';
  const goal = data?.goal;
  const cols = data?.cols.map((c) => {
    let node = null;
    if (!c.future) {
      if (month) {
        // Monat: Balken = Anteil der Tage mit erfassten Mahlzeiten in der Kalenderwoche
        const share = c.elapsedDays > 0 ? c.loggedDays / c.elapsedDays : 0;
        node = <i className={c.loggedDays === 0 ? 'is-none' : ''}
          style={{ height: `${c.loggedDays === 0 ? 4 : barHeight(share)}%` }} />;
      } else {
        // Woche: Kalorien des Tages gegen das Tagesziel (100 % Balken = 120 % vom Ziel)
        const ratio = c.kcalRatio;
        const height = !c.logged ? 4
          : ratio === null ? 60
          : Math.max(6, Math.round((Math.min(ratio, 1.2) / 1.2) * 100));
        node = <i className={!c.logged ? 'is-none' : ratio !== null && ratio > 1.1 ? 'is-over' : ''}
          style={{ height: `${height}%` }} />;
      }
    }
    return { key: c.key, label: c.label, node };
  });
  return (
    <Card icon="🍽️" title="Ernährung" onOpen={onOpen}>
      {!data ? (
        <Empty>Mahlzeiten konnten nicht geladen werden.</Empty>
      ) : !data.hasData ? (
        <Empty>{copy.noMeals}</Empty>
      ) : (
        <>
          <div className="wk-big">
            <b>{data.loggedDays} von {data.elapsedDays}</b>
            <span>Tagen erfasst</span>
          </div>
          <Bar rate={data.rate} />
          <Strip cols={cols} today={today} days={period.dayMap} goalLine={!month && !!goal} />

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

/**
 * kind: 'week' | 'month'
 * onBack: zurück zur Statistiken-Auswahl · onOpenModule: Sprung in ein Modul
 */
export default function PeriodReview({ kind, onBack, onOpenModule, hasWarnings }) {
  const copy = COPY[kind];
  const { session } = useAuth();
  const { habits, entries, loaded } = useHabitsStore();
  const [offset, setOffset] = useState(0);
  const [extras, setExtras] = useState(null); // null = lädt
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0); // erhöhen = erneut laden

  // Lokales Datum (kein toISOString) — ändert sich nur über Mitternacht
  const todayKey = todayStr();

  const period = useMemo(() => {
    const p = periodBounds(kind, offset, todayKey);
    // Tag → Spalte (zum Hervorheben der heutigen Spalte)
    return { ...p, dayMap: Object.fromEntries(p.columns.map((c) => [c.key, c.days])) };
  }, [kind, offset, todayKey]);
  const prevPeriod = useMemo(() => periodBounds(kind, offset - 1, todayKey), [kind, offset, todayKey]);

  useEffect(() => {
    let alive = true;
    setExtras(null);
    setFailed(false);
    loadPeriodExtras(session, period, prevPeriod)
      .then((x) => { if (alive) setExtras(x); })
      .catch((e) => {
        console.error('[PeriodReview] Laden fehlgeschlagen:', e);
        if (alive) setFailed(true);
      });
    return () => { alive = false; };
  }, [session, period, prevPeriod, attempt]);

  const view = useMemo(() => {
    if (!extras || !loaded) return null;
    // Aktive/pausierte Gewohnheiten aus dem Store plus archivierte
    const byId = new Map();
    for (const h of [...habits, ...extras.archived]) byId.set(h.id, h);
    const habitsData = buildHabitsPeriod({ habits: [...byId.values()], entries, period, prevPeriod, today: todayKey });
    const sport = extras.workouts
      ? buildSportPeriod({ workouts: extras.workouts, period, prevPeriod, today: todayKey })
      : null;
    const nutrition = extras.meals
      ? buildNutritionPeriod({ meals: extras.meals, target: extras.target, period, today: todayKey })
      : null;
    return { habits: habitsData, sport, nutrition, overall: overallRate([habitsData, sport, nutrition]) };
  }, [extras, loaded, habits, entries, period, prevPeriod, todayKey]);

  const running = period.isCurrent && todayKey < period.end;
  const daysLeft = period.days.filter((d) => d > todayKey).length;
  const topBar = <ModuleTopBar title="Statistiken" hasWarnings={hasWarnings} onBack={onBack} />;

  if (failed) {
    return (
      <>
        {topBar}
        <div className="hub with-topbar-space">
          <div className="hub-error">
            <div className="hub-error-headline">{copy.error}</div>
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
        <h1 className="overview-page-title">{copy.title}</h1>

        <div className="wk-nav">
          <button type="button" className="wk-nav-btn" onClick={() => setOffset((o) => o - 1)} aria-label={copy.prevAria}>‹</button>
          <div className="wk-nav-label">
            <b>{period.label}</b>
            <span>{period.isCurrent ? copy.now : offset === -1 ? copy.last : copy.ago(-offset)}</span>
          </div>
          <button type="button" className="wk-nav-btn" onClick={() => setOffset((o) => Math.min(0, o + 1))}
            disabled={offset >= 0} aria-label={copy.nextAria}>›</button>
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
              <Ring rate={view.overall} label={copy.ringLabel} />
              <div>
                <div className="wk-hero-num">{pct(view.overall)}</div>
                <div className="wk-hero-title">{periodHeadline(view.overall, kind)}</div>
                <div className="wk-hero-sub">
                  {view.overall === null
                    ? 'Sobald du abhakst, trainierst oder isst, erscheint hier dein Fortschritt.'
                    : running ? copy.running(daysLeft) : copy.done}
                </div>
              </div>
            </section>

            <HabitsCard data={view.habits} period={period} today={todayKey} copy={copy}
              onOpen={() => onOpenModule('habits/statistik')} />
            <SportCard data={view.sport} period={period} today={todayKey} copy={copy}
              onOpen={() => onOpenModule('sport')} />
            <NutritionCard data={view.nutrition} period={period} today={todayKey} copy={copy}
              onOpen={() => onOpenModule('nutrition/mahlzeiten')} />
          </>
        )}
      </div>
    </>
  );
}
