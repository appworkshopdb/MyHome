// modules/habits/components/StatsView.jsx
// "Statistik" — Cockpit mit Zeitraum- und Gewohnheits-Filter
//
//   1. Filter-Leiste: zwei Pillen (Zeitraum, Gewohnheiten), je ein Sheet
//   2. Hero: Quote + Veränderung zum gleich langen Zeitraum davor
//   3. Verlaufslinie über den gewählten Zeitraum
//   4. Ranking der Gewohnheiten (Tipp filtert) bzw. Streak/Rekord bei Einzelauswahl
//   5. Rhythmus: Woche / Monat / Jahr, jede Kachel = ein Tag
//   6. Badges
//
// Rückblicke zählen jede Gewohnheit für die Tage, an denen sie aktiv war
// (created_at bis Löschtag bzw. Pause) — auch archivierte und pausierte.
// So ändert Löschen/Austauschen die Vergangenheit nicht.

import { useState, useMemo, useEffect } from 'react';
import SheetShell from '../../../core/components/SheetShell.jsx';
import { loadDeletedHabits } from '../lib/habData.js';
import {
  calcStreak, calcLongestStreak, getEarnedBadges, BADGES,
  today, dateRange, toDateStr, isDueHistoric, habitEndDate, weekdayMon,
} from '../lib/habUtils.js';

// ─── Konstanten ───────────────────────────────────────────

const MONTH_ABBR = ['Jan','Feb','Mär','Apr','Mai','Jun','Jul','Aug','Sep','Okt','Nov','Dez'];
const MONTH_NAMES = [
  'Januar','Februar','März','April','Mai','Juni',
  'Juli','August','September','Oktober','November','Dezember',
];
const WD_SHORT = ['Mo','Di','Mi','Do','Fr','Sa','So'];

const PRESETS = [
  { key: '7',    label: '7 Tage',      range: { kind: 'days', days: 7 } },
  { key: '30',   label: '30 Tage',     range: { kind: 'days', days: 30 } },
  { key: '90',   label: '90 Tage',     range: { kind: 'days', days: 90 } },
  { key: '180',  label: '6 Monate',    range: { kind: 'days', days: 180 } },
  { key: 'year', label: 'Dieses Jahr', range: { kind: 'year' } },
  { key: 'all',  label: 'Seit Beginn', range: { kind: 'all' } },
];

function bucketDays(len) {
  if (len <= 14)  return 1;
  if (len <= 45)  return 3;
  if (len <= 120) return 7;
  return 15;
}

// ─── Hilfsfunktionen ──────────────────────────────────────

function parseDate(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function addDays(dateStr, n) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return toDateStr(new Date(y, m - 1, d + n));
}

function fmtShort(dateStr) {
  const [, m, d] = dateStr.split('-').map(Number);
  return `${d}. ${MONTH_ABBR[m - 1]}`;
}

function fmtPct(rate) {
  return rate === null ? '–' : `${Math.round(rate * 100)} %`;
}

function createdDay(habit) {
  return toDateStr(new Date(habit.created_at));
}

function statusOf(habit) {
  if (habit.deleted_at) return 'archiviert';
  if (!habit.active)    return 'pausiert';
  return null;
}

/** Stufe 0–4 aus der Quote, null wenn an dem Tag nichts fällig war. */
function levelOf(rate) {
  if (rate === null) return null;
  if (rate >= 1)     return 4;
  if (rate >= 0.75)  return 3;
  if (rate >= 0.5)   return 2;
  if (rate > 0)      return 1;
  return 0;
}

/** Zählt fällige und erledigte Einheiten über Habits × Tage. */
function countRange(habits, doneIdx, endMap, dates) {
  let due = 0;
  let done = 0;
  for (const d of dates) {
    for (const h of habits) {
      if (!isDueHistoric(h, d, endMap.get(h.id))) continue;
      due++;
      if ((doneIdx.get(`${h.id}|${d}`) ?? 0) >= (h.target_count ?? 1)) done++;
    }
  }
  return { due, done, rate: due > 0 ? done / due : null };
}

function rangeLabel(range) {
  if (range.kind === 'custom') return `${fmtShort(range.from)} – ${fmtShort(range.to)}`;
  if (range.kind === 'year')   return 'Dieses Jahr';
  if (range.kind === 'all')    return 'Seit Beginn';
  return PRESETS.find((p) => p.range.days === range.days)?.label ?? `${range.days} Tage`;
}

// ─── Haupt-Export ─────────────────────────────────────────

export default function StatsView({ habits, entries }) {
  // Gelöschte Gewohnheiten werden nur für die Statistik nachgeladen
  const [archived, setArchived] = useState([]);
  useEffect(() => {
    let alive = true;
    loadDeletedHabits()
      .then((d) => { if (alive) setArchived(d); })
      .catch(() => { /* Statistik funktioniert auch ohne Archiv */ });
    return () => { alive = false; };
  }, []);

  const allHabits = useMemo(() => {
    const byId = new Map();
    for (const h of [...habits, ...archived]) byId.set(h.id, h);
    return [...byId.values()].sort((a, b) =>
      (statusOf(a) ? 1 : 0) - (statusOf(b) ? 1 : 0)
      || (a.sort_order ?? 0) - (b.sort_order ?? 0)
      || a.created_at.localeCompare(b.created_at)
    );
  }, [habits, archived]);

  if (allHabits.length === 0) {
    return (
      <div className="hab-empty" style={{ marginTop: 32 }}>
        <div className="hab-empty-icon">📊</div>
        <div className="hab-empty-title">Noch keine Statistik</div>
        <div className="hab-empty-text">
          Leg Gewohnheiten an und hak sie ab — hier siehst du dann deine Statistiken.
        </div>
      </div>
    );
  }

  return <Cockpit allHabits={allHabits} entries={entries} />;
}

// ─── Cockpit ──────────────────────────────────────────────

function Cockpit({ allHabits, entries }) {
  const [range, setRange]       = useState({ kind: 'days', days: 30 });
  const [excluded, setExcluded] = useState(() => new Set());
  const [sheet, setSheet]       = useState(null); // 'period' | 'habits' | null

  const todayStr = today();

  // Index "habitId|datum" → count
  const doneIdx = useMemo(() => {
    const m = new Map();
    for (const e of entries) {
      if (e.deleted_at) continue;
      m.set(`${e.habit_id}|${e.logged_on}`, e.count ?? 1);
    }
    return m;
  }, [entries]);

  // Letzter Tag, an dem jede Gewohnheit zählt (null = läuft noch)
  const endMap = useMemo(() => {
    const lastEntry = new Map();
    for (const e of entries) {
      if (e.deleted_at) continue;
      const cur = lastEntry.get(e.habit_id);
      if (!cur || e.logged_on > cur) lastEntry.set(e.habit_id, e.logged_on);
    }
    const m = new Map();
    for (const h of allHabits) m.set(h.id, habitEndDate(h, lastEntry.get(h.id)));
    return m;
  }, [allHabits, entries]);

  const shown = useMemo(() => allHabits.filter((h) => !excluded.has(h.id)), [allHabits, excluded]);

  const firstAll = useMemo(
    () => allHabits.reduce((min, h) => { const c = createdDay(h); return !min || c < min ? c : min; }, null),
    [allHabits]
  );
  const firstDate = useMemo(
    () => shown.reduce((min, h) => { const c = createdDay(h); return !min || c < min ? c : min; }, null) ?? todayStr,
    [shown, todayStr]
  );

  // Zeitraum auflösen. Er beginnt nie vor der ersten Gewohnheit.
  const { periodStart, periodEnd, isClamped } = useMemo(() => {
    let wantedStart;
    let end = todayStr;
    if (range.kind === 'days')        wantedStart = addDays(todayStr, -(range.days - 1));
    else if (range.kind === 'year')   wantedStart = `${todayStr.slice(0, 4)}-01-01`;
    else if (range.kind === 'all')    wantedStart = firstDate;
    else { wantedStart = range.from; end = range.to > todayStr ? todayStr : range.to; }
    const start = firstDate > wantedStart ? firstDate : wantedStart;
    return { periodStart: start, periodEnd: end, isClamped: start !== wantedStart };
  }, [range, todayStr, firstDate]);

  const curDates = useMemo(
    () => (periodStart <= periodEnd ? dateRange(periodStart, periodEnd) : []),
    [periodStart, periodEnd]
  );

  // Vergleichszeitraum nur, wenn er komplett im Datenbestand liegt
  const prevDates = useMemo(() => {
    if (range.kind === 'all' || curDates.length === 0) return [];
    const prevStart = addDays(periodStart, -curDates.length);
    if (prevStart < firstDate) return [];
    return dateRange(prevStart, addDays(periodStart, -1));
  }, [range.kind, periodStart, curDates.length, firstDate]);

  const cur  = useMemo(() => countRange(shown, doneIdx, endMap, curDates),  [shown, doneIdx, endMap, curDates]);
  const prev = useMemo(() => countRange(shown, doneIdx, endMap, prevDates), [shown, doneIdx, endMap, prevDates]);

  const trend = useMemo(() => {
    const size = bucketDays(curDates.length);
    const pts = [];
    for (let i = 0; i < curDates.length; i += size) {
      pts.push(countRange(shown, doneIdx, endMap, curDates.slice(i, i + size)).rate);
    }
    return pts;
  }, [shown, doneIdx, endMap, curDates]);

  // Ranking: nur Gewohnheiten, die im Zeitraum etwas fällig hatten
  const ranking = useMemo(() => {
    if (shown.length === 1) return [];
    return shown
      .map((h) => ({
        habit: h,
        cur:   countRange([h], doneIdx, endMap, curDates),
        prev:  countRange([h], doneIdx, endMap, prevDates),
      }))
      .filter((o) => o.cur.due > 0)
      .sort((a, b) => (b.cur.rate ?? -1) - (a.cur.rate ?? -1));
  }, [shown, doneIdx, endMap, curDates, prevDates]);

  const earnedBadges = useMemo(() => getEarnedBadges(allHabits.filter((h) => h.active && !h.deleted_at), entries), [allHabits, entries]);
  const lockedBadges = BADGES.filter((b) => !earnedBadges.find((e) => e.id === b.id));

  const single = shown.length === 1 ? shown[0] : null;

  function focusHabit(id) {
    setExcluded(new Set(allHabits.filter((h) => h.id !== id).map((h) => h.id)));
  }

  const habitPill =
    shown.length === allHabits.length ? `Alle (${allHabits.length})`
    : shown.length === 1              ? `${shown[0].icon} ${shown[0].name}`
    : `${shown.length} von ${allHabits.length}`;

  const endLabel = periodEnd === todayStr ? 'heute' : fmtShort(periodEnd);
  const rangeLine = curDates.length > 0 ? `${fmtShort(curDates[0])} – ${endLabel}` : null;

  return (
    <div className="hab-stats-view hab-cp">

      {/* Filter-Leiste */}
      <div className="hab-cp-fbar">
        <button type="button" className="hab-cp-fpill" onClick={() => setSheet('period')}>
          <span className="hab-cp-fpill-text"><small>Zeitraum</small><b>{rangeLabel(range)}</b></span>
          <span className="hab-cp-fpill-arrow" aria-hidden="true">▾</span>
        </button>
        <button type="button" className="hab-cp-fpill" onClick={() => setSheet('habits')}>
          <span className="hab-cp-fpill-text"><small>Gewohnheiten</small><b>{habitPill}</b></span>
          <span className="hab-cp-fpill-arrow" aria-hidden="true">▾</span>
        </button>
      </div>

      {shown.length === 0 && (
        <div className="hab-cp-card hab-cp-empty">
          Keine Gewohnheit ausgewählt. Wähle über „Gewohnheiten" mindestens eine aus.
        </div>
      )}

      {shown.length > 0 && (
        <>
          <Hero cur={cur} prev={prev} rangeLine={rangeLine} clamped={isClamped} />

          <div className="hab-cp-card">
            <div className="hab-cp-label">Verlauf <span>Quote in %</span></div>
            <TrendChart
              points={trend}
              startLabel={curDates[0] ? fmtShort(curDates[0]) : ''}
              endLabel={periodEnd === todayStr ? 'Heute' : fmtShort(periodEnd)}
            />
          </div>

          <div className="hab-cp-card">
            <div className="hab-cp-label">
              {single ? `${single.icon} ${single.name}` : 'Gewohnheiten'}
              {!single && <span>antippen zum Filtern</span>}
            </div>
            {single ? (
              <div className="hab-cp-stats3">
                <div className="hab-cp-stat">
                  <b>{single.active && !single.deleted_at ? calcStreak(single, entries) : '–'}</b><span>Streak</span>
                </div>
                <div className="hab-cp-stat">
                  <b>{single.active && !single.deleted_at ? calcLongestStreak(single, entries) : '–'}</b><span>Rekord</span>
                </div>
                <div className="hab-cp-stat"><b>{cur.done}/{cur.due}</b><span>erledigt</span></div>
              </div>
            ) : ranking.length === 0 ? (
              <div className="hab-cp-note">Im Zeitraum war keine der Gewohnheiten fällig.</div>
            ) : (
              ranking.map(({ habit, cur: c, prev: p }) => (
                <button
                  key={habit.id}
                  type="button"
                  className={`hab-cp-row${statusOf(habit) ? ' is-past' : ''}`}
                  onClick={() => focusHabit(habit.id)}
                  aria-label={`Nur ${habit.name} anzeigen`}
                >
                  <span className="hab-cp-row-icon">{habit.icon}</span>
                  <span className="hab-cp-row-name">
                    {habit.name}
                    {statusOf(habit) && <em>{statusOf(habit)}</em>}
                  </span>
                  <span className="hab-cp-row-pct">
                    {fmtPct(c.rate)} <Delta cur={c.rate} prev={p.rate} />
                  </span>
                  <span className="hab-cp-row-bar"><i style={{ width: `${Math.round((c.rate ?? 0) * 100)}%` }} /></span>
                </button>
              ))
            )}
          </div>

          <Rhythm
            habits={shown}
            doneIdx={doneIdx}
            endMap={endMap}
            todayStr={todayStr}
            firstDate={firstDate}
          />
        </>
      )}

      {/* Badges */}
      <div
        className="hab-cp-card"
        style={{ marginBottom: 'calc(var(--nav-height) + 30px + env(safe-area-inset-bottom))' }}
      >
        <div className="hab-cp-label">Badges <span>{earnedBadges.length} von {BADGES.length}</span></div>
        <div className="hab-badges-grid">
          {earnedBadges.map((badge) => (
            <div key={badge.id} className="hab-badge hab-badge--earned" title={badge.desc}>
              <span className="hab-badge-icon">{badge.icon}</span>
              <span className="hab-badge-label t-meta">{badge.label}</span>
            </div>
          ))}
          {lockedBadges.map((badge) => (
            <div key={badge.id} className="hab-badge hab-badge--locked" title={badge.desc}>
              <span className="hab-badge-icon" style={{ filter: 'grayscale(1)', opacity: 0.35 }}>{badge.icon}</span>
              <span className="hab-badge-label t-meta" style={{ opacity: 0.4 }}>{badge.label}</span>
            </div>
          ))}
        </div>
      </div>

      {sheet === 'period' && (
        <PeriodSheet
          range={range}
          firstAll={firstAll}
          todayStr={todayStr}
          onPick={(r) => { setRange(r); setSheet(null); }}
          onClose={() => setSheet(null)}
        />
      )}
      {sheet === 'habits' && (
        <HabitsSheet
          allHabits={allHabits}
          excluded={excluded}
          onChange={setExcluded}
          onClose={() => setSheet(null)}
        />
      )}
    </div>
  );
}

// ─── Filter-Sheets ────────────────────────────────────────

function PeriodSheet({ range, firstAll, todayStr, onPick, onClose }) {
  const [from, setFrom] = useState(range.kind === 'custom' ? range.from : addDays(todayStr, -29));
  const [to, setTo]     = useState(range.kind === 'custom' ? range.to : todayStr);
  const minDate = firstAll ?? undefined;
  const valid = from && to && from <= to && to <= todayStr;

  const activeKey = range.kind === 'days' ? String(range.days) : range.kind === 'custom' ? null : range.kind;

  return (
    <SheetShell onClose={onClose} labelledBy="hab-cp-period-title">
      <div className="hab-cp-sheet">
        <div className="hab-cp-sheet-head">
          <h2 id="hab-cp-period-title">Zeitraum</h2>
        </div>

        <div className="hab-cp-preset-grid">
          {PRESETS.map((p) => (
            <button
              key={p.key}
              type="button"
              className={`hab-cp-chip${activeKey === p.key ? ' on' : ''}`}
              aria-pressed={activeKey === p.key}
              onClick={() => onPick(p.range)}
            >
              {p.label}
            </button>
          ))}
        </div>

        <div className="hab-cp-group-label">Eigener Zeitraum</div>
        <div className="hab-cp-dates">
          <label>
            Von
            <input type="date" className="form-input" value={from} min={minDate} max={todayStr}
              onChange={(e) => setFrom(e.target.value)} />
          </label>
          <label>
            Bis
            <input type="date" className="form-input" value={to} min={minDate} max={todayStr}
              onChange={(e) => setTo(e.target.value)} />
          </label>
        </div>
        {firstAll && (
          <div className="hab-cp-note">
            Daten ab <b>{fmtShort(firstAll)}</b> (erste Gewohnheit). Frühere Tage zählen nicht.
          </div>
        )}

        <button
          type="button"
          className="btn btn-primary"
          disabled={!valid}
          onClick={() => onPick({ kind: 'custom', from, to })}
        >
          Zeitraum anwenden
        </button>
      </div>
    </SheetShell>
  );
}

function HabitsSheet({ allHabits, excluded, onChange, onClose }) {
  function toggle(id) {
    const next = new Set(excluded);
    if (next.has(id)) next.delete(id); else next.add(id);
    onChange(next);
  }

  const groups = [
    { title: 'Aktiv',      list: allHabits.filter((h) => !statusOf(h)) },
    { title: 'Pausiert',   list: allHabits.filter((h) => statusOf(h) === 'pausiert') },
    { title: 'Archiviert', list: allHabits.filter((h) => statusOf(h) === 'archiviert') },
  ].filter((g) => g.list.length > 0);

  return (
    <SheetShell onClose={onClose} labelledBy="hab-cp-habits-title">
      <div className="hab-cp-sheet">
        <div className="hab-cp-sheet-head">
          <h2 id="hab-cp-habits-title">Gewohnheiten</h2>
          <button type="button" className="hab-cp-link" onClick={() => onChange(new Set())}>Alle wählen</button>
        </div>

        {groups.map((g) => (
          <div key={g.title}>
            <div className="hab-cp-group-label">{g.title}</div>
            {g.list.map((h) => (
              <label key={h.id} className="hab-cp-check">
                <input type="checkbox" checked={!excluded.has(h.id)} onChange={() => toggle(h.id)} />
                <span>{h.icon} {h.name}</span>
                <em>{h.category}</em>
              </label>
            ))}
          </div>
        ))}

        {groups.some((g) => g.title !== 'Aktiv') && (
          <div className="hab-cp-note">
            Pausierte und archivierte Gewohnheiten zählen für die Tage, an denen sie aktiv waren.
            So bleibt der Verlauf stabil, wenn du Gewohnheiten austauschst.
          </div>
        )}

        <button type="button" className="btn btn-primary" onClick={onClose}>Fertig</button>
      </div>
    </SheetShell>
  );
}

// ─── Teilkomponenten ──────────────────────────────────────

function Delta({ cur, prev }) {
  if (cur === null || prev === null) return <span className="hab-cp-delta flat">–</span>;
  const pp = Math.round((cur - prev) * 100);
  if (pp > 0) return <span className="hab-cp-delta up">▲ {pp} PP</span>;
  if (pp < 0) return <span className="hab-cp-delta down">▼ {Math.abs(pp)} PP</span>;
  return <span className="hab-cp-delta flat">● ±0</span>;
}

function Hero({ cur, prev, rangeLine, clamped }) {
  const R = 34;
  const C = 2 * Math.PI * R;
  const offset = C * (1 - (cur.rate ?? 0));

  return (
    <div className="hab-cp-card hab-cp-hero">
      <svg width="84" height="84" viewBox="0 0 84 84" role="img" aria-label={`Quote ${fmtPct(cur.rate)}`}>
        <circle cx="42" cy="42" r={R} fill="none" stroke="var(--data-track)" strokeWidth="9" />
        <circle
          cx="42" cy="42" r={R} fill="none" stroke="var(--data-1)" strokeWidth="9"
          strokeLinecap="round" strokeDasharray={C} strokeDashoffset={offset}
          transform="rotate(-90 42 42)"
        />
      </svg>
      <div>
        <div className="hab-cp-hero-num">{fmtPct(cur.rate)}</div>
        <div className="hab-cp-hero-sub">{cur.done} von {cur.due} erledigt</div>
        {rangeLine && (
          <div className="hab-cp-hero-sub">
            {rangeLine}{clamped ? ' · ab erster Gewohnheit' : ''}
          </div>
        )}
        <div className="hab-cp-hero-delta">
          <Delta cur={cur.rate} prev={prev.rate} />
          <span className="hab-cp-hero-sub">
            {prev.rate === null ? ' noch kein Vergleich möglich' : ' zum Zeitraum davor'}
          </span>
        </div>
      </div>
    </div>
  );
}

function TrendChart({ points, startLabel, endLabel }) {
  const W = 300, H = 104, L = 26, R = 8, T = 8, B = 18;
  const n  = points.length;
  const xs = (k) => L + (n <= 1 ? 0 : (k * (W - L - R)) / (n - 1));
  const ys = (r) => T + (1 - r) * (H - T - B);

  let line = '';
  let first = null;
  let last = null;
  points.forEach((r, k) => {
    if (r === null) return;
    line += `${line ? 'L' : 'M'}${xs(k).toFixed(1)} ${ys(r).toFixed(1)}`;
    if (first === null) first = k;
    last = k;
  });
  const area = line
    ? `${line}L${xs(last).toFixed(1)} ${ys(0)}L${xs(first).toFixed(1)} ${ys(0)}Z`
    : '';

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="Verlauf der Quote" className="hab-cp-chart">
      {[0, 0.5, 1].map((g) => (
        <g key={g}>
          <line x1={L} x2={W - R} y1={ys(g)} y2={ys(g)} className="hab-cp-grid" />
          <text x={L - 5} y={ys(g) + 3} textAnchor="end">{Math.round(g * 100)}</text>
        </g>
      ))}
      {area && <path d={area} className="hab-cp-area" />}
      {line && <path d={line} className="hab-cp-line" />}
      {last !== null && <circle cx={xs(last)} cy={ys(points[last])} r="4" className="hab-cp-end" />}
      <text x={L} y={H - 4}>{startLabel}</text>
      <text x={W - R} y={H - 4} textAnchor="end">{endLabel}</text>
    </svg>
  );
}

// ─── Rhythmus ─────────────────────────────────────────────

function Rhythm({ habits, doneIdx, endMap, todayStr, firstDate }) {
  const [mode, setMode]   = useState('Monat');
  const [selDay, setSel]  = useState(todayStr);

  const todayDate = parseDate(todayStr);
  const [weekStart, setWeekStart] = useState(() => addDays(todayStr, -weekdayMon(todayStr)));
  const [monthRef, setMonthRef]   = useState({ y: todayDate.getFullYear(), m: todayDate.getMonth() });
  const [year, setYear]           = useState(todayDate.getFullYear());

  const firstYear = parseDate(firstDate).getFullYear();

  /** Status eines Tages: null = nichts fällig, sonst {due, done, rate} */
  function dayStat(dateStr) {
    const c = countRange(habits, doneIdx, endMap, [dateStr]);
    return c.due > 0 ? c : null;
  }

  function cellClass(dateStr) {
    if (dateStr > todayStr) return 'is-future';
    const lv = levelOf(dayStat(dateStr)?.rate ?? null);
    return lv === null ? 'is-none' : `lv${lv}`;
  }

  // ── Navigation ──
  const weekFirst = addDays(firstDate, -weekdayMon(firstDate));
  const canPrev = mode === 'Woche' ? weekStart > weekFirst
    : mode === 'Monat' ? monthRef.y * 12 + monthRef.m > firstYear * 12 + parseDate(firstDate).getMonth()
    : year > firstYear;
  const canNext = mode === 'Woche' ? addDays(weekStart, 7) <= todayStr
    : mode === 'Monat' ? monthRef.y * 12 + monthRef.m < todayDate.getFullYear() * 12 + todayDate.getMonth()
    : year < todayDate.getFullYear();

  function step(dir) {
    if (mode === 'Woche') setWeekStart((w) => addDays(w, 7 * dir));
    else if (mode === 'Monat') {
      setMonthRef(({ y, m }) => {
        const d = new Date(y, m + dir, 1);
        return { y: d.getFullYear(), m: d.getMonth() };
      });
    } else setYear((y) => y + dir);
  }

  const title =
    mode === 'Woche' ? `${fmtShort(weekStart)} – ${fmtShort(addDays(weekStart, 6))}`
    : mode === 'Monat' ? `${MONTH_NAMES[monthRef.m]} ${monthRef.y}`
    : String(year);
  const hint =
    mode === 'Jahr' ? 'eine Zeile = ein Monat, jede Kachel = ein Tag' : 'jede Kachel = ein Tag';

  return (
    <div className="hab-cp-card">
      <div className="hab-cp-label">Rhythmus <span>Anteil erledigt pro Tag</span></div>

      <div className="hab-cp-seg" role="group" aria-label="Ansicht">
        {['Woche', 'Monat', 'Jahr'].map((m) => (
          <button
            key={m}
            type="button"
            className={mode === m ? 'on' : ''}
            aria-pressed={mode === m}
            onClick={() => setMode(m)}
          >
            {m}
          </button>
        ))}
      </div>

      <div className="hab-cp-rnav">
        <button type="button" className="hab-cp-navb" onClick={() => step(-1)} disabled={!canPrev} aria-label="Zurück">‹</button>
        <div>{title}<small>{hint}</small></div>
        <button type="button" className="hab-cp-navb" onClick={() => step(1)} disabled={!canNext} aria-label="Weiter">›</button>
      </div>

      {mode === 'Woche' && (
        <div className="hab-cp-week">
          {[0, 1, 2, 3, 4, 5, 6].map((k) => {
            const d = addDays(weekStart, k);
            const st = d > todayStr ? null : dayStat(d);
            return (
              <button
                key={d}
                type="button"
                disabled={d > todayStr}
                className={`hab-cp-tile ${cellClass(d)}${selDay === d ? ' sel' : ''}`}
                onClick={() => setSel(d)}
                aria-label={`${WD_SHORT[k]} ${fmtShort(d)}`}
              >
                <span className="w">{WD_SHORT[k]}</span>
                <span className="n">{parseDate(d).getDate()}</span>
                <span className="c">{st ? `${st.done}/${st.due}` : d > todayStr ? '' : '–'}</span>
              </button>
            );
          })}
        </div>
      )}

      {mode === 'Monat' && (
        <MonthGrid
          y={monthRef.y} m={monthRef.m} todayStr={todayStr}
          cellClass={cellClass} selDay={selDay} onSelect={setSel}
        />
      )}

      {mode === 'Jahr' && (
        <YearGrid
          year={year} todayStr={todayStr} cellClass={cellClass}
          onMonth={(m) => { setMonthRef({ y: year, m }); setMode('Monat'); }}
        />
      )}

      {mode !== 'Jahr' && (
        <DayDetail habits={habits} doneIdx={doneIdx} endMap={endMap} dateStr={selDay} />
      )}

      <div className="hab-cp-legend">
        <div><i className="hab-cp-sw lv4" /><b>100 %</b> alle fälligen erledigt</div>
        <div><i className="hab-cp-sw lv3" /><b>75–99 %</b></div>
        <div><i className="hab-cp-sw lv2" /><b>50–74 %</b></div>
        <div><i className="hab-cp-sw lv1" /><b>1–49 %</b></div>
        <div><i className="hab-cp-sw lv0" /><b>0 %</b> fällig, nichts erledigt</div>
        <div><i className="hab-cp-sw is-none" />keine Gewohnheit fällig</div>
      </div>
    </div>
  );
}

function MonthGrid({ y, m, todayStr, cellClass, selDay, onSelect }) {
  const lead = (new Date(y, m, 1).getDay() + 6) % 7;
  const days = new Date(y, m + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < lead; i++) cells.push(<span key={`b${i}`} />);
  for (let d = 1; d <= days; d++) {
    const s = toDateStr(new Date(y, m, d));
    cells.push(
      <button
        key={s}
        type="button"
        disabled={s > todayStr}
        className={`hab-cp-tile hab-cp-tile--day ${cellClass(s)}${selDay === s ? ' sel' : ''}`}
        onClick={() => onSelect(s)}
        aria-label={fmtShort(s)}
      >
        {d}
      </button>
    );
  }
  return (
    <div className="hab-cp-month">
      {WD_SHORT.map((w) => <div key={w} className="hab-cp-month-wd">{w}</div>)}
      {cells}
    </div>
  );
}

function YearGrid({ year, todayStr, cellClass, onMonth }) {
  const ticks = [1, 5, 10, 15, 20, 25, 31];
  return (
    <div className="hab-cp-year">
      <span />
      <div className="hab-cp-year-ticks">
        {Array.from({ length: 31 }, (_, i) => <span key={i}>{ticks.includes(i + 1) ? i + 1 : ''}</span>)}
      </div>
      {MONTH_ABBR.map((name, m) => {
        const dim = new Date(year, m + 1, 0).getDate();
        return (
          <FragmentRow key={name} name={name} onClick={() => onMonth(m)}>
            {Array.from({ length: 31 }, (_, i) => {
              if (i + 1 > dim) return <i key={i} className="blank" />;
              const s = toDateStr(new Date(year, m, i + 1));
              return <i key={i} className={cellClass(s)} title={s} />;
            })}
          </FragmentRow>
        );
      })}
    </div>
  );
}

function FragmentRow({ name, onClick, children }) {
  return (
    <>
      <button type="button" className="hab-cp-year-month" onClick={onClick}>{name}</button>
      <div className="hab-cp-year-days">{children}</div>
    </>
  );
}

function DayDetail({ habits, doneIdx, endMap, dateStr }) {
  const d = parseDate(dateStr);
  const head = `${WD_SHORT[(d.getDay() + 6) % 7]} ${fmtShort(dateStr)}`;
  const rows = habits.map((h) => {
    const due = isDueHistoric(h, dateStr, endMap.get(h.id));
    const done = due && (doneIdx.get(`${h.id}|${dateStr}`) ?? 0) >= (h.target_count ?? 1);
    return { h, due, done };
  });
  const due = rows.filter((r) => r.due).length;
  const done = rows.filter((r) => r.done).length;

  if (due === 0) {
    return (
      <div className="hab-cp-detail">
        <b>{head}</b>
        <div className="hab-cp-note">An diesem Tag war keine Gewohnheit fällig.</div>
      </div>
    );
  }
  return (
    <div className="hab-cp-detail">
      <b>{head} · {done} von {due} erledigt</b>
      <ul>
        {rows.map(({ h, due: isDue, done: isDone }) => (
          <li key={h.id}>
            <span className={isDone ? 'ok' : isDue ? 'no' : 'na'}>{isDone ? '✓' : isDue ? '✕' : '–'}</span>
            <span>{h.icon} {h.name}{!isDue && <span className="hab-cp-note"> nicht fällig</span>}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
