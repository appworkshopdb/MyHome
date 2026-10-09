import { useCallback, useEffect, useMemo, useState } from 'react';
import { IconChevronLeft, IconChevronRight, IconPlus, IconTrash } from '../../../core/components/Icons';
import { getBodyProfile } from '../../../core/lib/bodyProfileData';
import { computeBody } from '../../../core/lib/bodyCalc';
import { MEAL_TYPES, fmt } from '../lib/nutrition';
import { todayStr, shiftDate, formatDayLabel, sumMeals, formatAmount } from '../lib/meals';
import * as db from '../lib/nutData';

// Bereich "Mahlzeiten": Verlauf dessen, was gegessen wurde — pro Tag mit
// Tagessumme gegen das Tagesziel (aus dem Profil) und pro Mahlzeit mit Nährwerten.
// Einträge kommen aus (a) Mahlzeit-Fotos (Schätzung, mit ≈ gekennzeichnet) und
// (b) eigenen Rezepten. Es ist ein Verlauf aus Momentaufnahmen: spätere
// Änderungen an Rezepten ändern ihn nicht.

const WINDOW_BACK = 30;   // Tage vor dem Zieltag, die mitgeladen werden
const WINDOW_AHEAD = 7;   // Tage danach (Planung/Nachtrag)
const HISTORY_DAYS = 14;  // Länge der Liste "Letzte Tage"

const int = (v) => Math.round(v).toLocaleString('de-DE');

function dedupeById(list) {
  const seen = new Set();
  return list.filter((m) => (seen.has(m.id) ? false : (seen.add(m.id), true)));
}

function MacroBar({ label, value, goal, estimate }) {
  const pct = goal > 0 ? Math.min(100, (value / goal) * 100) : 0;
  return (
    <div className="meals-macro">
      <div className="meals-macro-head">
        <span>{label}</span>
        <span>{estimate ? '≈ ' : ''}{fmt(value)}{goal > 0 ? ` / ${goal}` : ''} g</span>
      </div>
      <div className="meals-bar"><div className="meals-bar-fill" style={{ width: `${pct}%` }} /></div>
    </div>
  );
}

export default function MealsView({ session, focusDate, refreshKey, onLogRecipe, showToast }) {
  const [date, setDate]       = useState(focusDate || todayStr());
  const [rows, setRows]       = useState([]);
  const [range, setRange]     = useState(null); // { from, to } bereits geladen
  const [loading, setLoading] = useState(true);
  const [failed, setFailed]   = useState(false);
  const [target, setTarget]   = useState(undefined); // undefined = lädt, null = kein Ziel berechenbar
  const [openId, setOpenId]   = useState(null);

  const today = todayStr();

  // Tagesziel aus dem Profil — fehlt es, zeigt die Ansicht nur Summen
  useEffect(() => {
    let alive = true;
    getBodyProfile(session)
      .then((p) => { if (alive) setTarget(computeBody(p || {})); })
      .catch(() => { if (alive) setTarget(null); });
    return () => { alive = false; };
  }, [session]);

  const load = useCallback(async (centerDate, { replace }) => {
    const from = shiftDate(centerDate, -WINDOW_BACK);
    const to   = shiftDate(centerDate > today ? centerDate : today, WINDOW_AHEAD);
    setFailed(false);
    try {
      const data = await db.getMeals(session, from, to);
      setRows((prev) => (replace ? data : dedupeById([...data, ...prev])));
      setRange((prev) => (replace || !prev
        ? { from, to }
        : { from: from < prev.from ? from : prev.from, to: to > prev.to ? to : prev.to }));
    } catch (e) {
      console.error(e);
      setFailed(true);
      showToast?.('Mahlzeiten konnten nicht geladen werden');
    } finally {
      setLoading(false);
    }
  }, [session, today, showToast]);

  // Erstladen und nach jedem Speichern von außen (refreshKey)
  useEffect(() => { load(date, { replace: true }); }, [refreshKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // Springt der Aufrufer auf ein anderes Datum (nach dem Speichern)
  useEffect(() => { if (focusDate) setDate(focusDate); }, [focusDate, refreshKey]);

  function goTo(next) {
    setDate(next);
    setOpenId(null);
    if (range && (next < range.from || next > range.to)) load(next, { replace: false });
  }

  const dayMeals = useMemo(() => rows.filter((m) => m.eatenOn === date), [rows, date]);
  const total = useMemo(() => sumMeals(dayMeals), [dayMeals]);
  const hasEstimate = total.estimatedKcal > 0;

  const groups = MEAL_TYPES
    .map((t) => ({ ...t, meals: dayMeals.filter((m) => m.mealType === t.key) }))
    .filter((g) => g.meals.length > 0);

  // "Letzte Tage": Tage mit Einträgen im geladenen Zeitraum, neueste zuerst
  const history = useMemo(() => {
    const byDay = new Map();
    for (const m of rows) {
      if (m.eatenOn > today) continue;
      if (!byDay.has(m.eatenOn)) byDay.set(m.eatenOn, []);
      byDay.get(m.eatenOn).push(m);
    }
    return [...byDay.entries()]
      .sort((a, b) => (a[0] < b[0] ? 1 : -1))
      .slice(0, HISTORY_DAYS)
      .map(([day, list]) => ({ day, ...sumMeals(list) }));
  }, [rows, today]);

  async function changeMeal(meal, patch) {
    try {
      const updated = await db.updateMeal(meal.id, patch);
      setRows((prev) => prev.map((m) => (m.id === meal.id ? updated : m)));
      if (patch.eatenOn && patch.eatenOn !== date) setOpenId(null); // Eintrag wandert auf einen anderen Tag
    } catch (e) {
      console.error(e);
      showToast?.('Änderung konnte nicht gespeichert werden');
    }
  }

  async function removeMeal(meal) {
    if (!window.confirm(`„${meal.name}" aus dem Verlauf löschen?`)) return;
    try {
      await db.deleteMeal(meal.id);
      setRows((prev) => prev.filter((m) => m.id !== meal.id));
      setOpenId(null);
    } catch (e) {
      console.error(e);
      showToast?.('Löschen fehlgeschlagen');
    }
  }

  if (loading) return <div className="loading-note">Lädt…</div>;

  const kcalPct = target ? Math.min(100, (total.kcal / target.target) * 100) : 0;
  const over = target && total.kcal > target.target;

  return (
    <div className="meals-view">
      {/* Tagesnavigation */}
      <div className="meals-daynav">
        <button className="btn-icon" aria-label="Vorheriger Tag" onClick={() => goTo(shiftDate(date, -1))}><IconChevronLeft /></button>
        <div className="meals-daynav-center">
          <div className="meals-daynav-label">{formatDayLabel(date, today)}</div>
          {date !== today && <button className="meals-today-link" onClick={() => goTo(today)}>Zu heute</button>}
        </div>
        <button className="btn-icon" aria-label="Nächster Tag" onClick={() => goTo(shiftDate(date, 1))}><IconChevronRight /></button>
      </div>

      {failed && <div className="meal-hint" role="alert">Der Verlauf konnte nicht geladen werden. Bitte später nochmal versuchen.</div>}

      {/* Tageskarte: gegessen vs. Ziel */}
      <div className="card meals-daycard">
        <div className="meals-daycard-head">
          <div>
            <div className="label">Gegessen</div>
            <div className="meals-kcal">
              {hasEstimate ? '≈ ' : ''}{int(total.kcal)}<span> kcal</span>
            </div>
          </div>
          {target && (
            <div className="meals-goal">
              <div className="label">Ziel</div>
              <div className="meals-goal-value">{int(target.target)} kcal</div>
            </div>
          )}
        </div>
        {target && (
          <div className={`meals-bar meals-bar-lg ${over ? 'is-over' : ''}`}>
            <div className="meals-bar-fill" style={{ width: `${kcalPct}%` }} />
          </div>
        )}
        {target && (
          <div className="meals-remaining">
            {over
              ? `${int(total.kcal - target.target)} kcal über dem Ziel`
              : `Noch ${int(target.target - total.kcal)} kcal bis zum Ziel`}
          </div>
        )}
        {hasEstimate && (
          <div className="meals-estimate-note">
            Enthält Schätzungen aus Fotos (≈ {int(total.estimatedKcal)} kcal) — Fotos unterschätzen Kalorien erfahrungsgemäß eher.
          </div>
        )}

        {total.count > 0 && (
          <div className="meals-macros">
            <MacroBar label="Eiweiß" value={total.protein} goal={target?.protein || 0} estimate={hasEstimate} />
            <MacroBar label="Kohlenhydrate" value={total.carbs} goal={target?.carbG || 0} estimate={hasEstimate} />
            <MacroBar label="Fett" value={total.fat} goal={target?.fatG || 0} estimate={hasEstimate} />
          </div>
        )}
        {target === null && (
          <div className="meal-hint">Ergänze deine Körperdaten im Profil, dann siehst du hier dein Tagesziel.</div>
        )}
      </div>

      <div className="meals-actions">
        <button className="btn btn-primary" onClick={onLogRecipe}><IconPlus /> Rezept eintragen</button>
      </div>
      <div className="meal-hint" style={{ marginTop: 0, marginBottom: 14 }}>
        Mahlzeit per Foto: über das Plus unten rechts → „Mahlzeit scannen".
      </div>

      {/* Einträge nach Mahlzeit-Typ */}
      {groups.length === 0 && (
        <div className="empty-state">
          <p>{date === today ? 'Heute noch nichts eingetragen.' : 'An diesem Tag ist nichts eingetragen.'}</p>
        </div>
      )}

      {groups.map((g) => {
        const gk = g.meals.reduce((s, m) => s + m.kcal, 0);
        const gEst = g.meals.some((m) => m.isEstimate);
        return (
          <section key={g.key} className="meals-group">
            <div className="meals-group-head">
              <span>{g.emoji} {g.label}</span>
              <span>{gEst ? '≈ ' : ''}{int(gk)} kcal</span>
            </div>
            <div className="card" style={{ margin: 0, padding: 0 }}>
              {g.meals.map((m, idx) => {
                const open = openId === m.id;
                return (
                  <div key={m.id} className="meals-entry" style={{ borderBottom: idx < g.meals.length - 1 ? '1px solid var(--border)' : 'none' }}>
                    <button className="meals-entry-main" aria-expanded={open} onClick={() => setOpenId(open ? null : m.id)}>
                      <span className="meals-entry-title">
                        {m.name}
                        {m.isEstimate && <span className="meals-badge">Schätzung</span>}
                      </span>
                      <span className="meals-entry-sub">
                        {m.isEstimate ? '≈ ' : ''}{int(m.kcal)} kcal · {fmt(m.protein)} g Eiweiß · {fmt(m.carbs)} g KH · {fmt(m.fat)} g Fett
                      </span>
                      <span className="meals-entry-sub">
                        {m.source === 'recipe'
                          ? `Rezept${m.servings ? ` · ${+m.servings.toFixed(2)} Portion${m.servings === 1 ? '' : 'en'}` : ''}`
                          : 'Foto-Schätzung'}
                      </span>
                    </button>

                    {open && (
                      <div className="meals-entry-detail">
                        {m.isEstimate && m.kcalLow != null && m.kcalHigh != null && m.kcalHigh - m.kcalLow >= 20 && (
                          <div className="meal-hint" style={{ marginTop: 0 }}>Geschätzte Spanne: ≈ {int(m.kcalLow)}–{int(m.kcalHigh)} kcal</div>
                        )}
                        <div className="meals-facts">
                          <span>Zucker {fmt(m.sugar)} g</span>
                          <span>ges. Fett {fmt(m.satfat)} g</span>
                          <span>Ballaststoffe {fmt(m.fiber)} g</span>
                          <span>Salz {fmt(m.salt, 2)} g</span>
                        </div>
                        {m.items.length > 0 && (
                          <ul className="meals-items">
                            {m.items.map((it, i) => (
                              <li key={i}>
                                <span>{it.name}</span>
                                <span>{formatAmount(it)}{it.kcal != null ? ` · ${int(it.kcal)} kcal` : ''}</span>
                              </li>
                            ))}
                          </ul>
                        )}
                        <div className="meals-edit">
                          <label>
                            <span>Mahlzeit</span>
                            <select value={m.mealType} onChange={(e) => changeMeal(m, { mealType: e.target.value })}>
                              {MEAL_TYPES.map((t) => <option key={t.key} value={t.key}>{t.emoji} {t.label}</option>)}
                            </select>
                          </label>
                          <label>
                            <span>Datum</span>
                            <input type="date" value={m.eatenOn} onChange={(e) => e.target.value && changeMeal(m, { eatenOn: e.target.value })} />
                          </label>
                        </div>
                        <button className="btn btn-danger" onClick={() => removeMeal(m)}><IconTrash /> Löschen</button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        );
      })}

      {/* Verlauf: letzte Tage */}
      {history.length > 0 && (
        <section className="meals-history">
          <div className="meals-group-head"><span>Letzte Tage</span></div>
          <div className="card" style={{ margin: 0, padding: 0 }}>
            {history.map((h, idx) => (
              <button
                key={h.day}
                className={`meals-history-row ${h.day === date ? 'is-active' : ''}`}
                style={{ borderBottom: idx < history.length - 1 ? '1px solid var(--border)' : 'none' }}
                onClick={() => { goTo(h.day); window.scrollTo?.({ top: 0 }); }}
              >
                <span>{formatDayLabel(h.day, today)}</span>
                <span className="meals-history-meta">
                  {h.count} Eintr{h.count === 1 ? 'ag' : 'äge'} · {h.estimatedKcal > 0 ? '≈ ' : ''}{int(h.kcal)} kcal
                </span>
              </button>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
