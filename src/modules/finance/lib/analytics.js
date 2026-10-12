// modules/finance/lib/analytics.js
//
// Rechenlogik der Auswertung — reine Funktionen ohne React/Supabase, damit sie
// sich ohne App testen lassen.
//
// Zentrale Regel (gleich wie in OverviewSection/MonthsView): Sparschwein-
// Einzahlungen ("Ersparnisse") sind KEINE Ausgaben, direkte Sparschwein-
// Entnahmen (Einnahme "Sparschwein") sind KEINE Einnahmen. Beides wird als
// "Sparen" geführt:
//   sparen     = Einzahlungen − Entnahmen
//   verfügbar  = Einnahmen − Ausgaben − sparen
// Ausgaben, die mit Zahlungsart "Sparschwein" bezahlt wurden, bleiben normale
// Ausgaben des Monats.
//
// Datums-Hinweis (CLAUDE.md): Hier wird nirgends toISOString() für lokale
// Datums-Strings benutzt. Zeiträume laufen über Monats-Indizes (Jahr*12+Monat-1),
// Tagesvergleiche über lokale Datumskomponenten.

import {
  MONTHS_DE, PAYMENTS, CATEGORIES, INTERVALS, monthlyAmount, templateAppliesTo,
  getContractStatus, getContractEndDate, getTemplateStatus, getTemplateEndDate,
  isSparschweinDeposit, isSparschweinDirectWithdrawal,
} from './finance.js';

export { PAYMENTS };

export const INCOME_CATS  = ['fixeinnahmen', 'sonstige_einnahmen'];
export const EXPENSE_CATS = ['fixkosten', 'variable_kosten', 'sonstige_ausgaben'];
export const ALL_CATS     = [...INCOME_CATS, ...EXPENSE_CATS];
export const TYPES        = ['einnahme', 'ausgabe', 'sparen'];
export const MONTHS_SHORT = MONTHS_DE.map((m) => m.substring(0, 3));

export const PAYMENT_LABEL = {
  Bank: 'Bank', SEPA: 'SEPA-Lastschrift', Paypal: 'PayPal', Bar: 'Bar',
  Klarna: 'Klarna', Gutschein: 'Gutschein', Sparschwein: 'Sparschwein',
};
export const CAT_TAG = { fixkosten: 'Fix', variable_kosten: 'Var.', sonstige_ausgaben: 'Sonst.' };

// ---------------------------------------------------------------------
// Monats-Indizes und Zeiträume
// ---------------------------------------------------------------------

// Lokales Datum als YYYY-MM-DD. NIE toISOString() dafür nehmen (CLAUDE.md,
// Fehlerquelle 1: rechnet über UTC und verschiebt Tage bei UTC+1/+2).
export function toDateStr(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export const monthIdx = (year, month) => year * 12 + (month - 1);
export const idxToYM  = (idx) => ({ year: Math.floor(idx / 12), month: (idx % 12) + 1 });
export const entryIdx = (e) => monthIdx(e.year, e.month);
export const nowIdx   = (now = new Date()) => monthIdx(now.getFullYear(), now.getMonth() + 1);

export function defaultPeriod(now = new Date(), preset = 'year') {
  const month = now.getMonth() + 1;
  const i = monthIdx(now.getFullYear(), month);
  return {
    preset, year: now.getFullYear(), month, quarter: Math.floor((month - 1) / 3) + 1,
    from: monthIdx(now.getFullYear(), 1), to: i,
  };
}

export function periodRange(p) {
  if (p.preset === 'month') { const i = monthIdx(p.year, p.month); return { from: i, to: i }; }
  if (p.preset === 'quarter') { const i = monthIdx(p.year, (p.quarter - 1) * 3 + 1); return { from: i, to: i + 2 }; }
  if (p.preset === 'custom') return { from: Math.min(p.from, p.to), to: Math.max(p.from, p.to) };
  return { from: monthIdx(p.year, 1), to: monthIdx(p.year, 12) };
}

export function shiftPeriod(p, dir) {
  if (p.preset === 'month') {
    const { year, month } = idxToYM(monthIdx(p.year, p.month) + dir);
    return { ...p, year, month };
  }
  if (p.preset === 'quarter') {
    let q = p.quarter + dir; let y = p.year;
    if (q < 1) { q = 4; y -= 1; } else if (q > 4) { q = 1; y += 1; }
    return { ...p, year: y, quarter: q };
  }
  if (p.preset === 'custom') {
    const r = periodRange(p); const span = r.to - r.from + 1;
    return { ...p, from: r.from + dir * span, to: r.to + dir * span };
  }
  return { ...p, year: p.year + dir };
}

// Wechsel der Zeitraum-Art: der Monat, der "jetzt" am nächsten liegt (innerhalb
// des bisherigen Zeitraums), bleibt der Anker.
export function switchPreset(p, preset, now = new Date()) {
  const r = periodRange(p);
  const ref = idxToYM(Math.min(r.to, Math.max(r.from, nowIdx(now))));
  const next = { ...p, preset, year: ref.year, month: ref.month, quarter: Math.floor((ref.month - 1) / 3) + 1 };
  if (preset === 'custom') { next.from = r.from; next.to = r.to; }
  return next;
}

export function periodLabel(p) {
  if (p.preset === 'month') return `${MONTHS_DE[p.month - 1]} ${p.year}`;
  if (p.preset === 'quarter') return `Q${p.quarter} ${p.year}`;
  if (p.preset === 'custom') {
    const r = periodRange(p); const a = idxToYM(r.from); const b = idxToYM(r.to);
    return `${MONTHS_SHORT[a.month - 1]} ${a.year} – ${MONTHS_SHORT[b.month - 1]} ${b.year}`;
  }
  return String(p.year);
}

// Bis wohin der Zeitraum "echte" Daten haben kann (Zukunft wird abgeschnitten).
export function effectiveRange(range, now = new Date()) {
  const n = nowIdx(now);
  if (range.from > n) return range;
  return { from: range.from, to: Math.min(range.to, n) };
}

export function rangeText(range) {
  const a = idxToYM(range.from); const b = idxToYM(range.to);
  if (range.from === range.to) return `${MONTHS_SHORT[a.month - 1]} ${a.year}`;
  if (a.year === b.year) return `${MONTHS_SHORT[a.month - 1]} – ${MONTHS_SHORT[b.month - 1]} ${b.year}`;
  return `${MONTHS_SHORT[a.month - 1]} ${a.year} – ${MONTHS_SHORT[b.month - 1]} ${b.year}`;
}

// Vergleichszeitraum, gleich lang wie der effektive Zeitraum (Jan–Okt gegen
// Jan–Okt des Vorjahres, nicht gegen das ganze Vorjahr).
export function compareRange(period, mode, now = new Date()) {
  if (mode === 'none') return null;
  const range = periodRange(period);
  const eff = effectiveRange(range, now);
  const len = eff.to - eff.from + 1;
  if (mode === 'year') return { from: range.from - 12, to: range.from - 12 + len - 1 };
  const prev = periodRange(shiftPeriod(period, -1));
  return { from: prev.from, to: prev.from + len - 1 };
}

// Diagramme brauchen mindestens 3 Monate Kontext: bei einem Monat/Quartal-
// Zeitraum zeigen sie die 6 Monate bis zum Ende des Zeitraums.
export function chartRange(range) {
  if (range.to - range.from + 1 >= 3) return range;
  return { from: range.to - 5, to: range.to };
}

export function inRange(entries, range) {
  return entries.filter((e) => { const i = entryIdx(e); return i >= range.from && i <= range.to; });
}

// ---------------------------------------------------------------------
// Einordnung und Filter
// ---------------------------------------------------------------------

// 'einnahme' | 'ausgabe' | 'sparen_ein' | 'sparen_aus' | null (= ausgeblendet)
// savingsMode: 'separat' (Standard) | 'ausgabe' (alte Sicht: Einzahlung = Ausgabe,
// Entnahme = Einnahme) | 'aus' (Sparschwein-Buchungen komplett ignorieren)
export function classify(e, savingsMode = 'separat') {
  const dep = isSparschweinDeposit(e);
  const wd  = isSparschweinDirectWithdrawal(e);
  if (savingsMode === 'aus' && (dep || wd)) return null;
  if (savingsMode === 'separat') {
    if (dep) return 'sparen_ein';
    if (wd)  return 'sparen_aus';
  }
  return INCOME_CATS.includes(e.category) ? 'einnahme' : 'ausgabe';
}

export const DEFAULT_FILTERS = Object.freeze({
  types: TYPES,
  categories: ALL_CATS,
  payments: PAYMENTS,
  status: 'alle',        // alle | bezahlt | offen   (nur Ausgaben)
  origin: 'alle',        // alle | vorlage | manuell
  amountMin: null,
  amountMax: null,
  name: '',
  savingsMode: 'separat',
  compare: 'year',       // none | prev | year
});

// Welche Filtergruppen ein Bereich beachtet. 'types' ist die Art-Auswahl
// (Einnahmen/Ausgaben/Sparen). Bereiche mit "Nur Zeitraum" beachten keine.
const ON  = { types: true,  category: true,  payment: true,  status: true,  origin: true,  amount: true,  name: true };
export const HONOR = {
  all:       ON,
  noPayment: { ...ON, payment: false },
  expenses:  ON,
  none:      { types: false, category: false, payment: false, status: false, origin: false, amount: false, name: false },
};

export function entryMethods(e) {
  if (Array.isArray(e.payments) && e.payments.length > 0) return e.payments.map((p) => p.method).filter(Boolean);
  return e.payment ? [e.payment] : [];
}

export function applyFilters(entries, f, honors = HONOR.all) {
  const q    = (f.name || '').trim().toLowerCase();
  const tset = new Set(f.types);
  const cset = new Set(f.categories);
  const pset = new Set(f.payments);
  const allPay = PAYMENTS.every((p) => pset.has(p));
  return entries.filter((e) => {
    const kind = classify(e, f.savingsMode);
    if (!kind) return false;
    const group = kind.startsWith('sparen') ? 'sparen' : kind;
    if (honors.types && !tset.has(group)) return false;
    if (honors.category && !cset.has(e.category)) return false;
    if (honors.payment && !allPay && !entryMethods(e).some((m) => pset.has(m))) return false;
    // Bezahlt/Offen gibt es nur bei Ausgaben (Einnahmen haben kein Häkchen);
    // Sparschwein-Einzahlungen sind nie "offen".
    if (honors.status && kind === 'ausgabe' && !isSparschweinDeposit(e)) {
      if (f.status === 'bezahlt' && !e.paid) return false;
      if (f.status === 'offen' && e.paid) return false;
    }
    if (honors.origin && f.origin !== 'alle' && (f.origin === 'vorlage') !== !!e.from_template) return false;
    if (honors.amount) {
      const a = Number(e.amount || 0);
      if (f.amountMin != null && a < f.amountMin) return false;
      if (f.amountMax != null && a > f.amountMax) return false;
    }
    if (honors.name && q && !(e.name || '').toLowerCase().includes(q)) return false;
    return true;
  });
}

const sameSet = (a, b) => a.length === b.length && b.every((x) => a.includes(x));

// Welche Filtergruppen weichen vom Standard ab? (für Chips und Zähler)
export function activeFilterGroups(f) {
  const out = [];
  if (!sameSet(f.types, TYPES)) out.push({ key: 'types', label: `Art: ${f.types.length} von 3` });
  if (!sameSet(f.categories, ALL_CATS)) out.push({ key: 'categories', label: `Kategorie: ${f.categories.length} von 5` });
  if (!sameSet(f.payments, PAYMENTS)) out.push({ key: 'payments', label: `Zahlungsart: ${f.payments.length} von ${PAYMENTS.length}` });
  if (f.status !== 'alle') out.push({ key: 'status', label: f.status === 'offen' ? 'Nur offen' : 'Nur bezahlt' });
  if (f.origin !== 'alle') out.push({ key: 'origin', label: f.origin === 'vorlage' ? 'Nur feste Posten' : 'Nur Einzelbuchungen' });
  if (f.amountMin != null || f.amountMax != null) {
    out.push({ key: 'amount', label: `Betrag: ${f.amountMin ?? 0} – ${f.amountMax != null ? f.amountMax : '∞'} €` });
  }
  if ((f.name || '').trim()) out.push({ key: 'name', label: `Name: ${f.name.trim()}` });
  if (f.savingsMode !== 'separat') out.push({ key: 'savingsMode', label: f.savingsMode === 'aus' ? 'Sparschwein ausgeblendet' : 'Sparschwein als Ausgabe' });
  return out;
}

export function resetFilterGroup(f, key) {
  const d = DEFAULT_FILTERS;
  switch (key) {
    case 'types':       return { ...f, types: d.types };
    case 'categories':  return { ...f, categories: d.categories };
    case 'payments':    return { ...f, payments: d.payments };
    case 'status':      return { ...f, status: d.status };
    case 'origin':      return { ...f, origin: d.origin };
    case 'amount':      return { ...f, amountMin: null, amountMax: null };
    case 'name':        return { ...f, name: '' };
    case 'savingsMode': return { ...f, savingsMode: d.savingsMode };
    default:            return f;
  }
}

// ---------------------------------------------------------------------
// Summen
// ---------------------------------------------------------------------

function emptyTotals() {
  return { ein: 0, aus: 0, einzahlung: 0, entnahme: 0, fix: 0, var: 0, sonst: 0, count: 0 };
}

function finalize(t) {
  t.sparen = t.einzahlung - t.entnahme;
  t.verfuegbar = t.ein - t.aus - t.sparen;
  return t;
}

function addEntry(t, e, mode) {
  const kind = classify(e, mode);
  if (!kind) return;
  const a = Number(e.amount || 0);
  t.count += 1;
  if (kind === 'einnahme') t.ein += a;
  else if (kind === 'sparen_ein') t.einzahlung += a;
  else if (kind === 'sparen_aus') t.entnahme += a;
  else {
    t.aus += a;
    if (e.category === 'fixkosten') t.fix += a;
    else if (e.category === 'variable_kosten') t.var += a;
    else t.sonst += a;
  }
}

export function totals(entries, mode = 'separat') {
  const t = emptyTotals();
  for (const e of entries) addEntry(t, e, mode);
  return finalize(t);
}

// Eine Zeile pro Monat im Bereich (auch leere Monate).
export function monthlySeries(entries, range, mode = 'separat') {
  const rows = [];
  const byIdx = new Map();
  for (let i = range.from; i <= range.to; i += 1) {
    const { year, month } = idxToYM(i);
    const row = { idx: i, year, month, label: MONTHS_SHORT[month - 1], ...emptyTotals() };
    rows.push(row); byIdx.set(i, row);
  }
  for (const e of entries) {
    const row = byIdx.get(entryIdx(e));
    if (row) addEntry(row, e, mode);
  }
  return rows.map(finalize);
}

const mean = (xs) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : 0);

// Prognose für Monate NACH dem aktuellen Monat, in denen noch nichts gebucht
// ist: Festeinnahmen/-kosten aus den Vorlagen (templateAppliesTo) plus der
// Durchschnitt von variablen und sonstigen Ausgaben der letzten bis zu 6
// abgeschlossenen Monate. Ohne Vorlagen oder ohne Vergangenheit: keine Prognose.
export function withForecast(series, templates, now = new Date()) {
  const n = nowIdx(now);
  const closed = series.filter((s) => s.idx < n && s.count > 0).slice(-6);
  if (closed.length === 0) return series;
  const avgVar = mean(closed.map((s) => s.var));
  const avgSonst = mean(closed.map((s) => s.sonst));
  const avgSparen = mean(closed.map((s) => s.sparen));
  return series.map((s) => {
    if (s.idx <= n || s.count > 0) return s;
    let ein = 0; let fix = 0;
    for (const t of templates) {
      if (!templateAppliesTo(t, s.year, s.month)) continue;
      if (t.category === 'fixeinnahmen') ein += Number(t.amount || 0);
      else if (t.category === 'fixkosten') fix += Number(t.amount || 0);
    }
    if (ein === 0 && fix === 0) return s;
    const f = { ...s, ein, fix, var: avgVar, sonst: avgSonst, aus: fix + avgVar + avgSonst, sparen: avgSparen, forecast: true };
    f.verfuegbar = f.ein - f.aus - f.sparen;
    return f;
  });
}

// Aufsummierter Saldo ab Zeitraumbeginn. Monate nach dem letzten Monat mit
// Daten/Prognose bekommen null (Linie endet dort).
export function cumulative(series, now = new Date()) {
  const n = nowIdx(now);
  let run = 0;
  return series.map((s) => {
    const known = s.count > 0 || s.forecast || s.idx <= n;
    if (!known) return { ...s, cum: null };
    run += s.verfuegbar;
    return { ...s, cum: run };
  });
}

// Anteil an den Einnahmen. null = nicht berechenbar.
export const ratio = (part, ein) => (ein > 0 ? part / ein : null);

// Sparquote/Fixkostenquote teilen durch die Einnahmen. Blendet der Filter
// Einnahmen (oder die nötige Kategorie) aus, wären sie irreführend → "—".
export function quotaAvailable(f) {
  const incomeIn = f.types.includes('einnahme') && INCOME_CATS.every((c) => f.categories.includes(c));
  return {
    sparquote: incomeIn && f.types.includes('sparen') && f.savingsMode === 'separat',
    fixquote: incomeIn && f.types.includes('ausgabe') && f.categories.includes('fixkosten'),
  };
}

// ---------------------------------------------------------------------
// Posten, Zahlungsarten
// ---------------------------------------------------------------------

export const normName = (n) => (n || '').trim().toLowerCase().replace(/\s+/g, ' ');

// Ausgaben gruppiert nach Name (zusammengefasst) oder Kategorie.
export function groupExpenses(entries, mode = 'separat', by = 'name') {
  const map = new Map();
  let total = 0;
  for (const e of entries) {
    if (classify(e, mode) !== 'ausgabe') continue;
    const a = Number(e.amount || 0);
    total += a;
    const key = by === 'category' ? e.category : (normName(e.name) || '(ohne name)');
    let g = map.get(key);
    if (!g) {
      g = { key, label: by === 'category' ? CATEGORIES[e.category] : ((e.name || '').trim() || 'Ohne Name'), labelTs: -1, sum: 0, count: 0, cats: {} };
      map.set(key, g);
    }
    g.sum += a; g.count += 1; g.cats[e.category] = (g.cats[e.category] || 0) + a;
    const ts = e.created_at ? new Date(e.created_at).getTime() : 0;
    if (by !== 'category' && ts >= g.labelTs && (e.name || '').trim()) { g.label = e.name.trim(); g.labelTs = ts; }
  }
  const rows = [...map.values()].map((g) => {
    const cat = Object.entries(g.cats).sort((x, y) => y[1] - x[1])[0][0];
    return { key: g.key, label: g.label, sum: g.sum, count: g.count, avg: g.sum / g.count, cat, share: total > 0 ? g.sum / total : 0 };
  }).sort((x, y) => y.sum - x.sum);
  return { rows, total };
}

// Verteilung der Ausgaben auf Zahlungsarten. Geteilte Zahlungen zählen mit
// dem Teilbetrag bei ihrer Zahlungsart. open = noch nicht bezahlter Anteil.
export function paymentSplit(entries, mode = 'separat') {
  const map = new Map();
  let total = 0;
  for (const e of entries) {
    if (classify(e, mode) !== 'ausgabe') continue;
    const amount = Number(e.amount || 0);
    let parts;
    if (Array.isArray(e.payments) && e.payments.length > 0) {
      const withAmt = e.payments.filter((p) => p.amount != null && p.amount !== '');
      parts = withAmt.length === e.payments.length
        ? e.payments.map((p) => ({ method: p.method, amount: Number(p.amount) }))
        : e.payments.map((p) => ({ method: p.method, amount: amount / e.payments.length }));
    } else {
      parts = [{ method: e.payment || 'Bank', amount }];
    }
    for (const p of parts) {
      const m = p.method || 'Bank';
      const g = map.get(m) || { method: m, sum: 0, open: 0 };
      g.sum += p.amount; if (!e.paid) g.open += p.amount;
      map.set(m, g); total += p.amount;
    }
  }
  const rows = [...map.values()].sort((a, b) => b.sum - a.sum).map((g) => ({ ...g, share: total > 0 ? g.sum / total : 0 }));
  return { rows, total };
}

// ---------------------------------------------------------------------
// Auffälligkeiten (feste Regeln, keine KI)
// ---------------------------------------------------------------------

// all = alle Buchungen (Sparschwein-Modus wird beachtet, Filter nicht),
// range = effektiver Zeitraum. Rückgabe: [{ tone, lead, text, sub }]
export function buildInsights({ all, range, now = new Date(), mode = 'separat', formatEur }) {
  const out = [];
  const series = monthlySeries(inRange(all, range), range, mode).filter((s) => s.count > 0);
  const n = nowIdx(now);

  // 1) Ausreißer bei variablen Kosten
  const vars = series.filter((s) => s.idx !== n);
  if (vars.length >= 3) {
    const avg = mean(vars.map((s) => s.var));
    const top = vars.reduce((a, b) => (b.var > a.var ? b : a));
    if (avg > 0 && top.var >= avg * 1.4 && top.var - avg >= 100) {
      const biggest = all
        .filter((e) => e.year === top.year && e.month === top.month && e.category === 'variable_kosten' && classify(e, mode) === 'ausgabe')
        .sort((a, b) => Number(b.amount) - Number(a.amount))[0];
      out.push({
        tone: 'bad', lead: `${MONTHS_DE[top.month - 1]}:`,
        text: `Variable Kosten ${formatEur(top.var)} – ${Math.round((top.var / avg - 1) * 100)} % über deinem Schnitt`,
        sub: biggest ? `Größter Posten: ${biggest.name} ${formatEur(biggest.amount)}` : null,
      });
    }
  }

  // 2) Offene Festposten im laufenden Monat
  if (n >= range.from && n <= range.to) {
    const { year, month } = idxToYM(n);
    const open = all.filter((e) => e.year === year && e.month === month && !e.paid && e.from_template
      && classify(e, mode) === 'ausgabe' && !isSparschweinDeposit(e));
    if (open.length > 0) {
      const names = open.slice(0, 3).map((e) => e.name).join(', ');
      out.push({
        tone: 'warn', lead: `${MONTHS_DE[month - 1]}:`,
        text: `${open.length} ${open.length === 1 ? 'Festposten' : 'Festposten'} noch nicht bezahlt`,
        sub: `${names}${open.length > 3 ? ' …' : ''} · ${formatEur(open.reduce((s, e) => s + Number(e.amount || 0), 0))}`,
      });
    }
  }

  // 3) Größter Anstieg eines Postens gegenüber dem Vorjahr (gleiche Monate)
  const prev = { from: range.from - 12, to: range.to - 12 };
  const cur = groupExpenses(inRange(all, range), mode).rows;
  const old = groupExpenses(inRange(all, prev), mode).rows;
  if (old.length > 0) {
    const oldMap = new Map(old.map((r) => [r.key, r]));
    const ups = cur.map((r) => { const o = oldMap.get(r.key); return o ? { r, o, diff: r.sum - o.sum, pct: (r.sum / o.sum - 1) * 100 } : null; })
      .filter((x) => x && x.o.sum > 0 && x.pct >= 5 && x.diff >= 50)
      .sort((a, b) => b.diff - a.diff);
    if (ups[0]) {
      out.push({
        tone: 'bad', lead: ups[0].r.label,
        text: `+${Math.round(ups[0].pct)} % gegenüber Vorjahr`,
        sub: `${formatEur(ups[0].r.sum)} statt ${formatEur(ups[0].o.sum)} im selben Zeitraum`,
      });
    }
  }

  // 4) Sparquote über die Monate
  if (mode === 'separat') {
    const withIncome = series.filter((s) => s.ein > 0 && s.idx !== n);
    if (withIncome.length >= 3) {
      const good = withIncome.filter((s) => s.sparen / s.ein >= 0.05).length;
      const low = withIncome.reduce((a, b) => (b.sparen / b.ein < a.sparen / a.ein ? b : a));
      out.push({
        tone: good >= withIncome.length * 0.7 ? 'good' : 'warn', lead: 'Sparquote',
        text: `in ${good} von ${withIncome.length} Monaten über 5 %`,
        sub: low.sparen < 0 ? `Ausreißer: ${MONTHS_DE[low.month - 1]} – Entnahme aus dem Sparschwein` : null,
      });
    }
  }
  return out;
}

// ---------------------------------------------------------------------
// Verträge und Fristen
// ---------------------------------------------------------------------

const STATUS_KEY = { active: 'aktiv', expiring: 'aus', expired: 'abg' };
export const INTERVAL_ADVERB = { monthly: 'monatlich', quarterly: 'vierteljährlich', biannually: 'halbjährlich', annually: 'jährlich' };

// Verträge (fin_contracts) und Fixkosten-Vorlagen (fin_fixtemplates) in einer
// Liste. Einnahmen-Vorlagen gehören nicht hierher (Monatskosten).
export function buildContractItems(contracts, templates) {
  const items = [];
  for (const c of contracts) {
    const iv = c.interval ?? (c.quarterly ? 'quarterly' : 'monthly');
    items.push({
      id: `c:${c.id}`, source: 'Vertrag', name: c.name, interval: iv, amount: Number(c.amount || 0),
      monthly: monthlyAmount(c.amount, iv), payment: c.payment || null, status: STATUS_KEY[getContractStatus(c)],
      end: getContractEndDate(c), cancellation: c.cancellation || null,
    });
  }
  for (const t of templates) {
    if (t.category !== 'fixkosten') continue;
    const iv = t.interval ?? (t.quarterly ? 'quarterly' : 'monthly');
    items.push({
      id: `t:${t.id}`, source: 'Festposten', name: t.name, interval: iv, amount: Number(t.amount || 0),
      monthly: monthlyAmount(t.amount, iv), payment: t.payment || null, status: STATUS_KEY[getTemplateStatus(t)],
      end: getTemplateEndDate(t), cancellation: null, fixcat: true,
    });
  }
  return items.sort((a, b) => b.monthly - a.monthly);
}

export function filterContractItems(items, local, f) {
  const q = (f.name || '').trim().toLowerCase();
  const pset = new Set(f.payments);
  const allPay = PAYMENTS.every((p) => pset.has(p));
  return items.filter((it) => {
    if (local.vStatus !== 'alle' && it.status !== local.vStatus) return false;
    if (local.vInterval !== 'alle' && it.interval !== local.vInterval) return false;
    if (!allPay && it.payment && !pset.has(it.payment)) return false;
    if (it.fixcat && !f.categories.includes('fixkosten')) return false;
    if (f.amountMin != null && it.monthly < f.amountMin) return false;
    if (f.amountMax != null && it.monthly > f.amountMax) return false;
    if (q && !it.name.toLowerCase().includes(q)) return false;
    return true;
  });
}

const dayStart = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

// Enden innerhalb der nächsten `days` Tage (heute eingeschlossen), nach Datum.
export function buildDeadlines(items, days, now = new Date()) {
  const today = dayStart(now);
  const out = [];
  for (const it of items) {
    if (!it.end || isNaN(it.end)) continue;
    const end = dayStart(it.end);
    const diff = Math.round((end - today) / 86400000);
    if (diff < 0 || diff > days) continue;
    out.push({ ...it, endDay: end, days: diff });
  }
  return out.sort((a, b) => a.days - b.days);
}

// ---------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------

export function entriesToCsv(entries) {
  const esc = (v) => {
    const s = String(v ?? '');
    return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const num = (v) => String(Number(v || 0)).replace('.', ',');
  const head = ['Jahr', 'Monat', 'Kategorie', 'Name', 'Betrag', 'Zahlungsart', 'Bezahlt', 'Feste Buchung', 'Notiz'];
  const rows = entries
    .slice()
    .sort((a, b) => entryIdx(a) - entryIdx(b))
    .map((e) => [
      e.year, e.month, CATEGORIES[e.category] || e.category, e.name, num(e.amount),
      entryMethods(e).join(' + '), e.paid ? 'ja' : 'nein', e.from_template ? 'ja' : 'nein', e.note || '',
    ].map(esc).join(';'));
  return `﻿${[head.join(';'), ...rows].join('\r\n')}`;
}

// Hilfen für Diagramm-Achsen: runde Obergrenze + 3 gleich große Schritte
export function niceAxis(maxValue) {
  const max = Math.max(1, maxValue);
  const raw = max / 3;
  const pow = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * pow).find((s) => s >= raw) || raw;
  return { step, top: step * 3, ticks: [step, step * 2, step * 3] };
}

export function compactEur(v) {
  if (Math.abs(v) >= 1000) return `${String(Math.round(v / 100) / 10).replace('.', ',')}K`;
  return String(Math.round(v));
}

export { INTERVALS };
