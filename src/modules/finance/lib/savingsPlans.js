// modules/finance/lib/savingsPlans.js
//
// Rechenlogik der Sparpläne — reine Funktionen ohne React/Supabase.
//
// Ein Sparplan (Tabelle fin_savings_plans) hat Raten; jede Rate ist eine Buchung
// in fin_entries mit savings_plan_id (Ausgabe "Sparrate · <Name>", variable_kosten).
// Offen bis zur Einzahlung → offener Posten, zählt im Saldo; bezahlt → im Sparschwein.
// Keine Punkte (Finanzen ruft awardPoints nirgends auf).
//
// Datum: Monate laufen über Indizes (Jahr*12+Monat-1), Tage als lokale
// 'YYYY-MM-DD'-Strings (nie toISOString, CLAUDE.md Fehlerquelle 1).

import { monthlySeries } from './analytics.js';

export const MONTHS_LONG = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
const MONTHS_SHORT = ['Jan.', 'Feb.', 'März', 'Apr.', 'Mai', 'Juni', 'Juli', 'Aug.', 'Sept.', 'Okt.', 'Nov.', 'Dez.'];

const pad = (n) => String(n).padStart(2, '0');
export const r2 = (n) => Math.round(n * 100) / 100;
const sum = (xs) => xs.reduce((a, b) => a + b, 0);

export function isoOf(y, m, d) { return `${y}-${pad(m)}-${pad(d)}`; }
export function parseIsoParts(s) { const [y, m, d] = String(s).slice(0, 10).split('-').map(Number); return { y, m, d }; }
export function monthIdx(s) { const { y, m } = parseIsoParts(s); return y * 12 + m - 1; }
export function idxToYM(i) { return { y: Math.floor(i / 12), m: (i % 12) + 1 }; }
export const daysInMonth = (y, m) => new Date(y, m, 0).getDate();
export function lastDayOfIdx(i) { const { y, m } = idxToYM(i); return isoOf(y, m, daysInMonth(y, m)); }
export function monthLabel(i) { const { y, m } = idxToYM(i); return `${MONTHS_LONG[m - 1]} ${y}`; }
export function monthShortLabel(i) { const { y, m } = idxToYM(i); return `${MONTHS_SHORT[m - 1]} ${y}`; }
export function monthShortName(i) { return MONTHS_SHORT[idxToYM(i).m - 1]; }
export function fmtDay(s) { const { y, m, d } = parseIsoParts(s); return `${pad(d)}.${pad(m)}.${y}`; }
export function fmtDayShort(s) { const { m, d } = parseIsoParts(s); return `${pad(d)}.${pad(m)}.`; }

export const rateName = (planName) => `Sparrate · ${String(planName || '').trim()}`;

// Fälligkeit einer Rate im Monat i. dueDay 31 = Monatsende (auf Monatslänge begrenzt).
// Im laufenden Monat nie vor heute (sonst wäre eine neue Rate sofort überfällig).
export function dueFor(i, dueDay, today) {
  const { y, m } = idxToYM(i);
  const s = isoOf(y, m, Math.min(Number(dueDay) || 1, daysInMonth(y, m)));
  return i === monthIdx(today) && s < today ? today : s;
}

// Gleich große Raten, die letzte gleicht Cent-Rundungen aus
export function evenAmounts(total, n) {
  const r = r2(total / n);
  const a = Array(n).fill(r);
  a[n - 1] = r2(total - r * (n - 1));
  return a;
}

// Feste Rate, die letzte ist der Rest
export function rateAmounts(total, rate) {
  const rr = r2(rate);
  const n = Math.max(1, Math.ceil(total / rr - 1e-9));
  const a = Array(n).fill(rr);
  a[n - 1] = r2(total - rr * (n - 1));
  return a;
}

// ---------------------------------------------------------------------
// Durchschnitt für die Vorschläge
// ---------------------------------------------------------------------
// Nutzungsdauer = Monate vom ersten Monat mit Buchungen bis heute.
//   weniger als 3 abgeschlossene Monate → alle Monate inkl. laufendem: "Dein aktueller Durchschnitt"
//   3 bis 5 abgeschlossene Monate       → letzte 3 abgeschlossene:    "Dein Durchschnitt · letzte 3 Monate"
//   ab 6 abgeschlossenen Monaten        → letzte 6 abgeschlossene:    "Dein Durchschnitt · letzte 6 Monate"
// Einnahmen/Ausgaben ohne Sparschwein-Buchungen (analytics.classify, Modus "separat").
export function averages(entries, today) {
  const cur = monthIdx(today);
  const idxs = (entries || []).filter((e) => e.year && e.month).map((e) => e.year * 12 + e.month - 1).filter((i) => i <= cur);
  if (!idxs.length) return { ein: 0, aus: 0, uebrig: 0, months: 0, label: 'Dein aktueller Durchschnitt', enough: false };
  const first = Math.min(...idxs);
  const closed = cur - first; // abgeschlossene Monate seit Beginn
  let range; let label;
  if (closed >= 6) { range = { from: cur - 6, to: cur - 1 }; label = 'Dein Durchschnitt · letzte 6 Monate'; }
  else if (closed >= 3) { range = { from: cur - 3, to: cur - 1 }; label = 'Dein Durchschnitt · letzte 3 Monate'; }
  else { range = { from: first, to: cur }; label = 'Dein aktueller Durchschnitt'; }
  const rows = monthlySeries(entries, range, 'separat');
  const n = rows.length || 1;
  const ein = sum(rows.map((r) => r.ein)) / n;
  const aus = sum(rows.map((r) => r.aus)) / n;
  return { ein, aus, uebrig: ein - aus, months: rows.length, label, enough: ein > 0 };
}

// ---------------------------------------------------------------------
// Vorschläge
// ---------------------------------------------------------------------
// input: { target, mode: 'date'|'nodate', date, firstIdx, avail }
// Ergebnis: Optionen { key, title, months[], amounts[], rhythm, rate, share, extra },
// aufsteigend nach Rate sortiert (günstigste oben).
function mkOpt(key, title, months, amounts, rhythm, avail, extra = '') {
  const rate = amounts[0];
  const share = avail > 0 ? Math.round((rate / avail) * 100) : null;
  return { key, title, months, amounts, rhythm, rate, share, extra };
}

export function suggestions({ target, mode, date, firstIdx, avail }) {
  const out = { opts: [], note: null };
  if (!(target > 0)) return out;
  if (mode === 'date') {
    if (!date) return out;
    const N = monthIdx(date) - firstIdx + 1;
    if (N < 1) return out;
    const months = Array.from({ length: N }, (_, k) => firstIdx + k);
    out.opts.push(mkOpt('even', 'Monatlich gleich', months, evenAmounts(target, N), 'monthly', avail));
    if (N >= 4) {
      const q = months.filter((_, k) => k % 3 === 0);
      out.opts.push(mkOpt('quarter', 'Quartalsweise', q, evenAmounts(target, q.length), 'quarterly', avail));
      const p = months.slice(0, N - 2);
      out.opts.push(mkOpt('buffer', 'Mit Puffer', p, evenAmounts(target, p.length), 'monthly', avail, ', zwei Monate früher'));
    }
  } else if (!(avail > 0)) {
    out.note = 'Im Schnitt bleibt nichts übrig. Lege eine eigene Rate fest.';
  } else {
    [['easy', 'Locker', 0.25], ['mid', 'Ausgewogen', 0.5], ['hard', 'Ehrgeizig', 0.75]].forEach(([k, t, f]) => {
      let rate = Math.max(5, Math.round((avail * f) / 5) * 5);
      if (rate > target) rate = target;
      const am = rateAmounts(target, rate);
      out.opts.push(mkOpt(k, t, am.map((_, j) => firstIdx + j), am, 'monthly', avail));
    });
    // gleiche Raten (kleines Ziel) nur einmal zeigen
    out.opts = out.opts.filter((o, i, a) => a.findIndex((x) => x.rate === o.rate) === i);
  }
  out.opts.sort((a, b) => a.rate - b.rate);
  return out;
}

export function customOption({ target, rate, rhythm, firstIdx, avail, mode, date }) {
  if (!(rate > 0) || !(target > 0)) return null;
  const am = rateAmounts(target, rate);
  const step = rhythm === 'quarterly' ? 3 : 1;
  const o = mkOpt('custom', 'Eigener Plan', am.map((_, j) => firstIdx + j * step), am, rhythm, avail);
  if (mode === 'date' && date && o.months[o.months.length - 1] > monthIdx(date)) o.late = true;
  return o;
}

// Einordnung eines Vorschlags gemessen am Übrig
export function fitLevel(share) {
  if (share == null) return { key: 'z', text: 'Im Schnitt bleibt nichts übrig' };
  if (share <= 40) return { key: 'g', text: 'passt gut' };
  if (share <= 70) return { key: 'm', text: 'machbar' };
  if (share <= 100) return { key: 'k', text: 'knapp' };
  return { key: 'z', text: 'mehr als dein Übrig' };
}

// Raten (Monat, Betrag) → Buchungsdaten mit Fälligkeit
export function scheduleRates(months, amounts, dueDay, today) {
  return months.map((i, k) => {
    const due = dueFor(i, dueDay, today);
    const { y, m } = parseIsoParts(due);
    return { year: y, month: m, due_date: due, amount: amounts[k] };
  });
}

// ---------------------------------------------------------------------
// Stand eines Plans
// ---------------------------------------------------------------------
const rateDue = (r) => String(r.due_date || isoOf(r.year, r.month, 1)).slice(0, 10);

export function planInfo(plan, rates, today) {
  const cur = monthIdx(today);
  const list = (rates || []).slice().sort((a, b) => (rateDue(a) < rateDue(b) ? -1 : 1));
  const paidList = list.filter((r) => r.paid);
  const open = list.filter((r) => !r.paid);
  const paid = r2(sum(paidList.map((r) => Number(r.amount))));
  const target = Number(plan.target_amount);
  const overdue = open.filter((r) => rateDue(r) < today);
  const dueNow = open.filter((r) => rateDue(r) >= today && monthIdx(rateDue(r)) === cur);
  const payable = open.filter((r) => monthIdx(rateDue(r)) <= cur);
  const soll = sum(list.filter((r) => rateDue(r) <= today).map((r) => Number(r.amount)));
  const lastDue = list.length ? rateDue(list[list.length - 1]) : null;
  return {
    list, paid, target, open, overdue, dueNow, payable,
    next: open[0] || null,
    overdueSum: r2(sum(overdue.map((r) => Number(r.amount)))),
    payableSum: r2(sum(payable.map((r) => Number(r.amount)))),
    rest: Math.max(0, r2(target - paid)),
    done: paid >= target - 0.004,
    pct: target > 0 ? Math.min(100, Math.round((paid / target) * 100)) : 0,
    sollPct: target > 0 ? Math.min(100, (soll / target) * 100) : 0,
    lastDue,
    paidCount: paidList.length,
  };
}

export function rateState(r, today) {
  const due = rateDue(r);
  if (r.paid) return { key: 'paid', text: 'eingezahlt' };
  if (due < today) return { key: 'late', text: 'überfällig' };
  if (monthIdx(due) === monthIdx(today)) return { key: 'open', text: 'fällig' };
  return { key: 'plan', text: 'geplant' };
}
export { rateDue };

// "Rest verteilen": offene Raten fallen weg, der Rest verteilt sich gleich auf
// die Monate von jetzt bis zum Zieldatum.
export function spreadRest(plan, info, today) {
  const cur = monthIdx(today);
  const last = Math.max(cur, monthIdx(plan.target_date));
  const months = Array.from({ length: last - cur + 1 }, (_, k) => cur + k);
  const amounts = evenAmounts(info.rest, months.length);
  return { rate: amounts[0], rates: scheduleRates(months, amounts, plan.due_day, today) };
}

// "Ziel verschieben" / "Hinten anhängen": überfällige Raten fallen weg, künftige
// bleiben, der Rest kommt mit der bisherigen Rate ans Ende.
export function extendPlan(plan, info, today) {
  const keep = info.open.filter((r) => rateDue(r) >= today);
  const keepSum = sum(keep.map((r) => Number(r.amount)));
  const remaining = r2(info.target - info.paid - keepSum);
  const step = plan.rhythm === 'quarterly' ? 3 : 1;
  const lastM = keep.reduce((mx, r) => Math.max(mx, monthIdx(rateDue(r))), monthIdx(today) - step);
  const am = remaining > 0 ? rateAmounts(remaining, Number(plan.rate)) : [];
  const added = scheduleRates(am.map((_, j) => lastM + step * (j + 1)), am, plan.due_day, today);
  const kept = keep.map((r) => ({ year: r.year, month: r.month, due_date: rateDue(r), amount: Number(r.amount) }));
  const rates = kept.concat(added);
  const newLast = rates.length ? rates.map((r) => r.due_date).sort().slice(-1)[0] : plan.target_date;
  return { rates, targetDate: plan.target_date ? newLast : null };
}
