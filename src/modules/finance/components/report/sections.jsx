// Die zehn Bereiche der Auswertung. Jeder bekommt `ctx` (siehe SummaryView)
// und rechnet nur seinen Teil — eingeklappte oder ausgeblendete Bereiche
// werden gar nicht erst gerendert, also auch nicht berechnet.
//
// Welche Filter ein Bereich beachtet, steht in `scope`/`hint` der Registry
// (SECTIONS unten) und wird in der Kopfzeile des Bereichs angezeigt.

import { useMemo, useState } from 'react';
import FocusCard from '../../../../core/components/FocusCard.jsx';
import { formatEur, formatDate, MONTHS_DE, INTERVALS } from '../../lib/finance.js';
import {
  HONOR, DEFAULT_FILTERS, CAT_TAG, PAYMENT_LABEL, INTERVAL_ADVERB, MONTHS_SHORT,
  applyFilters, inRange, totals, monthlySeries, withForecast, cumulative, chartRange,
  groupExpenses, paymentSplit, buildInsights, buildContractItems, filterContractItems,
  buildDeadlines, activeFilterGroups, quotaAvailable, ratio, classify, toDateStr,
} from '../../lib/analytics.js';
import { MonthBars, StackedBars, LineChart } from './charts.jsx';
import { Delta, eur0, pct0, pct1 } from './ui.jsx';

const NF0 = new Intl.NumberFormat('de-DE', { maximumFractionDigits: 0 });

function Chips({ options, value, onPick, label }) {
  return (
    <div className="rp-chiprow" role="group" aria-label={label}>
      {options.map((o) => (
        <button
          key={o.key} type="button"
          className={`rp-chip ${value === o.key ? 'is-on' : ''}`}
          aria-pressed={value === o.key}
          onClick={() => onPick(o.key)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function Empty({ children }) {
  return <div className="rp-empty">{children}</div>;
}

function Readout({ children }) {
  return <div className="rp-read">{children}</div>;
}

// ── 1. Kennzahlen ──────────────────────────────────────────────────────
function KpiSection({ ctx }) {
  const { filters: f, mode, eff, cmp, allEntries, now } = ctx;
  const cur = useMemo(
    () => totals(applyFilters(inRange(allEntries, eff), f, HONOR.all), mode),
    [allEntries, eff, f, mode],
  );
  const prev = useMemo(
    () => (cmp ? totals(applyFilters(inRange(allEntries, cmp), f, HONOR.all), mode) : null),
    [allEntries, cmp, f, mode],
  );
  const open = useMemo(() => {
    const rows = applyFilters(inRange(allEntries, eff), { ...f, status: 'alle' }, HONOR.all)
      .filter((e) => classify(e, mode) === 'ausgabe' && !e.paid);
    const today = toDateStr(now);
    const dues = rows.map((e) => e.due_date).filter((d) => d && d >= today).sort();
    return { count: rows.length, sum: rows.reduce((s, e) => s + Number(e.amount || 0), 0), next: dues[0] || null };
  }, [allEntries, eff, f, mode, now]);

  const q = quotaAvailable(f);
  const nMonths = eff.to - eff.from + 1;
  const nPrev = cmp ? cmp.to - cmp.from + 1 : 0;
  const sparq = q.sparquote ? ratio(cur.sparen, cur.ein) : null;
  const fixq = q.fixquote ? ratio(cur.fix, cur.ein) : null;
  const sparqP = prev && q.sparquote ? ratio(prev.sparen, prev.ein) : null;
  const fixqP = prev && q.fixquote ? ratio(prev.fix, prev.ein) : null;
  const cmpLabel = f.compare === 'year' ? 'ggü. Vorjahr' : 'ggü. Vorperiode';

  // Aufteilung von 100 € Einnahmen: Ausgaben | gespart | übrig
  const parts = [Math.max(0, cur.aus), Math.max(0, cur.sparen), Math.max(0, cur.verfuegbar)];
  const sum = parts.reduce((a, b) => a + b, 0) || 1;
  const pc = parts.map((p) => (p / sum) * 100);

  return (
    <>
      <FocusCard>
        <FocusCard.Eyebrow>Verfügbar · {ctx.effText}</FocusCard.Eyebrow>
        <FocusCard.Value>{formatEur(cur.verfuegbar)}</FocusCard.Value>
        <FocusCard.Meta>
          <span>+ <b>{eur0(cur.ein)}</b> Einnahmen</span>
          <span>− <b>{eur0(cur.aus)}</b> Ausgaben</span>
        </FocusCard.Meta>
        {cur.ein > 0 && (
          <>
            <div className="rp-split" role="img"
              aria-label={`Von 100 Euro Einnahmen: ${Math.round(pc[0])} Ausgaben, ${Math.round(pc[1])} gespart, ${Math.round(pc[2])} übrig`}>
              {pc[0] > 0 && <i style={{ width: `${pc[0]}%`, background: 'var(--raw-grey-300)' }} />}
              {pc[1] > 0 && <i style={{ width: `${pc[1]}%`, background: 'var(--raw-green-300)' }} />}
              {pc[2] > 0 && <i style={{ width: `${pc[2]}%`, background: 'var(--raw-paper-000)' }} />}
            </div>
            <div className="rp-split-leg">
              <span><i style={{ background: 'var(--raw-grey-300)' }} />Ausgaben {Math.round(pc[0])} %</span>
              <span><i style={{ background: 'var(--raw-green-300)' }} />Gespart {Math.round(pc[1])} %</span>
              <span><i style={{ background: 'var(--raw-paper-000)' }} />Übrig {Math.round(pc[2])} %</span>
            </div>
          </>
        )}
      </FocusCard>

      <div className="rp-kpis">
        <div className="rp-kpi">
          <div className="rp-kpi-l">Sparquote</div>
          <div className="rp-kpi-v">{sparq === null ? '—' : pct1(sparq)}</div>
          <div className="rp-kpi-d">
            {sparq === null ? <span className="rp-delta rp-delta--flat">Filter blendet Einnahmen aus</span>
              : <Delta value={sparq} base={sparqP} unit="pp" goodWhen="up" label={cmpLabel} />}
          </div>
        </div>
        <div className="rp-kpi">
          <div className="rp-kpi-l">Fixkostenquote</div>
          <div className="rp-kpi-v">{fixq === null ? '—' : pct1(fixq)}</div>
          <div className="rp-kpi-d">
            {fixq === null ? <span className="rp-delta rp-delta--flat">Filter blendet Einnahmen aus</span>
              : <Delta value={fixq} base={fixqP} unit="pp" goodWhen="down" label={cmpLabel} />}
          </div>
        </div>
        <div className="rp-kpi">
          <div className="rp-kpi-l">Ø Ausgaben / Mo.</div>
          <div className="rp-kpi-v">{eur0(cur.aus / nMonths)}</div>
          <div className="rp-kpi-d">
            {prev && <Delta value={cur.aus / nMonths} base={prev.aus / (nPrev || 1)} goodWhen="down" label={cmpLabel} />}
          </div>
        </div>
        <div className="rp-kpi">
          <div className="rp-kpi-l">Offene Posten</div>
          <div className="rp-kpi-v">{open.count === 0 ? '0' : `${open.count} · ${eur0(open.sum)}`}</div>
          <div className="rp-kpi-d">
            <span className="rp-delta rp-delta--flat">
              {open.count === 0 ? 'alles bezahlt' : open.next ? `nächste: ${open.next.slice(8, 10)}.${open.next.slice(5, 7)}.` : 'ohne Fälligkeit'}
            </span>
          </div>
        </div>
      </div>
    </>
  );
}

// ── 2. Einnahmen und Ausgaben pro Monat ────────────────────────────────
function MonatSection({ ctx }) {
  const { filters: f, mode, range, allEntries, templates, now, eff } = ctx;
  const [picked, setPicked] = useState(null);
  const cr = useMemo(() => chartRange(range), [range]);
  const series = useMemo(() => {
    const base = monthlySeries(applyFilters(inRange(allEntries, cr), f, HONOR.all), cr, mode);
    // Prognose nur ohne einschränkende Filter — sonst wäre sie nicht vergleichbar
    return activeFilterGroups(f).length === 0 ? withForecast(base, templates, now) : base;
  }, [allEntries, cr, f, mode, templates, now]);

  const defaultSel = Math.min(Math.max(eff.to, cr.from), cr.to);
  const sel = picked !== null && series.some((s) => s.idx === picked) ? picked : defaultSel;
  const s = series.find((x) => x.idx === sel) || series[series.length - 1];
  const hasForecast = series.some((x) => x.forecast);
  const noData = series.every((x) => x.count === 0 && !x.forecast);

  if (noData) return <Empty>Für diesen Zeitraum gibt es mit den aktuellen Filtern keine Buchungen.</Empty>;
  return (
    <>
      <div className="rp-sub">
        {mode === 'separat' ? 'Ohne Sparschwein-Transfers' : 'Mit Sparschwein-Buchungen'}
        {hasForecast ? ' · Umriss = Prognose' : ''}
      </div>
      <div className="rp-legend">
        <span><i className="rp-sw rp-sw--ein" />Einnahmen</span>
        <span><i className="rp-sw rp-sw--aus" />Ausgaben</span>
        {hasForecast && <span><i className="rp-sw rp-sw--fc" />Prognose</span>}
      </div>
      <MonthBars series={series} selected={sel} onSelect={setPicked} label="Einnahmen und Ausgaben je Monat" />
      {s && (
        <Readout>
          <b>{MONTHS_DE[s.month - 1]} {s.year}{s.forecast ? ' (Prognose)' : ''}</b>
          <span>Ein <b>{eur0(s.ein)}</b></span>
          <span>Aus <b>{eur0(s.aus)}</b></span>
          <span>Saldo <b className={s.verfuegbar >= 0 ? 'rp-good' : 'rp-bad'}>{s.verfuegbar >= 0 ? '+ ' : '− '}{eur0(Math.abs(s.verfuegbar))}</b></span>
        </Readout>
      )}
    </>
  );
}

// ── 3. Verfügbar im Verlauf ────────────────────────────────────────────
function VerlaufSection({ ctx }) {
  const { mode, range, allEntries, templates, now } = ctx;
  const cr = useMemo(() => chartRange(range), [range]);
  const points = useMemo(() => {
    const base = monthlySeries(inRange(allEntries, cr), cr, mode);
    const cum = cumulative(withForecast(base, templates, now), now);
    return cum.map((s) => ({ idx: s.idx, year: s.year, label: s.label, value: s.cum, forecast: !!s.forecast }));
  }, [allEntries, cr, mode, templates, now]);
  const known = points.filter((p) => p.value !== null);
  if (known.length === 0 || allEntries.length === 0) return <Empty>Noch keine Daten im Zeitraum.</Empty>;
  const hasFc = points.some((p) => p.forecast);
  const last = [...known].reverse().find((p) => !p.forecast) || known[known.length - 1];
  return (
    <>
      <div className="rp-sub">Aufsummierter Saldo nach Sparen seit {MONTHS_SHORT[cr.from % 12]}{hasFc ? ' · gestrichelt = Prognose' : ''}</div>
      <LineChart
        points={points}
        label={`Verlauf des verfügbaren Betrags, zuletzt ${eur0(last.value)} im ${last.label}`}
      />
    </>
  );
}

// ── 4. Auffälligkeiten ─────────────────────────────────────────────────
const TONE_ICON = { bad: '▲', warn: '●', good: '✓', neutral: '•' };
function InsightsSection({ ctx }) {
  const { allEntries, eff, now, mode } = ctx;
  const items = useMemo(
    () => buildInsights({ all: allEntries, range: eff, now, mode, formatEur: eur0 }),
    [allEntries, eff, now, mode],
  );
  if (items.length === 0) return <Empty>Noch nichts Auffälliges – dafür braucht es ein paar Monate Daten.</Empty>;
  return (
    <ul className="rp-insights">
      {items.map((it, i) => (
        <li key={i} className="rp-insight">
          <span className={`rp-insight-ic rp-insight-ic--${it.tone}`} aria-hidden="true">{TONE_ICON[it.tone]}</span>
          <div>
            <p><b>{it.lead}</b> {it.text}</p>
            {it.sub && <small>{it.sub}</small>}
          </div>
        </li>
      ))}
    </ul>
  );
}

// ── 5. Monatstabelle ───────────────────────────────────────────────────
function TabelleSection({ ctx }) {
  const { filters: f, mode, eff, allEntries } = ctx;
  const [all, setAll] = useState(false);
  const rows = useMemo(
    () => monthlySeries(applyFilters(inRange(allEntries, eff), f, HONOR.all), eff, mode).filter((s) => s.count > 0),
    [allEntries, eff, f, mode],
  );
  const total = useMemo(() => totals(applyFilters(inRange(allEntries, eff), f, HONOR.all), mode), [allEntries, eff, f, mode]);
  if (rows.length === 0) return <Empty>Keine Buchungen mit den aktuellen Filtern.</Empty>;
  const shown = all ? rows : rows.slice(-4);
  const showEin = f.types.includes('einnahme'); const showAus = f.types.includes('ausgabe'); const showSp = f.types.includes('sparen') && mode === 'separat';
  const saldo = (v) => <td className={v >= 0 ? 'rp-good' : 'rp-bad'}>{v >= 0 ? '+ ' : '− '}{NF0.format(Math.abs(v))}</td>;
  return (
    <>
      <div className="rp-table-wrap">
        <table className="rp-table">
          <thead>
            <tr>
              <th scope="col">Monat</th>
              {showEin && <th scope="col">Einnahmen</th>}
              {showAus && <th scope="col">Ausgaben</th>}
              {showSp && <th scope="col">Sparen</th>}
              <th scope="col">Saldo</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((s) => (
              <tr key={s.idx}>
                <th scope="row">{MONTHS_DE[s.month - 1]}{eff.from !== eff.to && s.year !== ctx.effEndYear ? ` ${s.year}` : ''}</th>
                {showEin && <td>{NF0.format(s.ein)}</td>}
                {showAus && <td>{NF0.format(s.aus)}</td>}
                {showSp && <td>{NF0.format(s.sparen)}</td>}
                {saldo(s.verfuegbar)}
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <th scope="row">Gesamt</th>
              {showEin && <td>{NF0.format(total.ein)}</td>}
              {showAus && <td>{NF0.format(total.aus)}</td>}
              {showSp && <td>{NF0.format(total.sparen)}</td>}
              {saldo(total.verfuegbar)}
            </tr>
          </tfoot>
        </table>
      </div>
      {rows.length > 4 && (
        <button type="button" className="rp-more" onClick={() => setAll((v) => !v)}>
          {all ? 'Weniger anzeigen' : `Alle ${rows.length} Monate anzeigen`}
        </button>
      )}
    </>
  );
}

// ── 6. Monat für Monat (Ausgaben nach Kategorie) ───────────────────────
function KategorienSection({ ctx }) {
  const { filters: f, mode, range, allEntries } = ctx;
  const [picked, setPicked] = useState(null);
  const cr = useMemo(() => chartRange(range), [range]);
  const series = useMemo(
    () => monthlySeries(applyFilters(inRange(allEntries, cr), f, HONOR.all), cr, mode),
    [allEntries, cr, f, mode],
  );
  if (!f.types.includes('ausgabe')) return <Empty>Ausgaben sind per Filter ausgeblendet.</Empty>;
  if (series.every((s) => s.aus === 0)) return <Empty>Keine Ausgaben mit den aktuellen Filtern.</Empty>;
  const withData = series.filter((s) => s.aus > 0);
  const defaultSel = withData[withData.length - 1].idx;
  const sel = picked !== null && series.some((s) => s.idx === picked) ? picked : defaultSel;
  const s = series.find((x) => x.idx === sel);
  return (
    <>
      <div className="rp-sub">Ausgaben je Kategorie · Linie = Monatsschnitt</div>
      <div className="rp-legend">
        <span><i className="rp-sw rp-sw--fix" />Fix</span>
        <span><i className="rp-sw rp-sw--var" />Variabel</span>
        <span><i className="rp-sw rp-sw--sonst" />Sonstige</span>
      </div>
      <StackedBars series={series} selected={sel} onSelect={setPicked} label="Ausgaben je Monat und Kategorie" />
      {s && (
        <Readout>
          <b>{MONTHS_DE[s.month - 1]} {s.year}</b>
          <span>Fix <b>{eur0(s.fix)}</b></span>
          <span>Var. <b>{eur0(s.var)}</b></span>
          <span>Sonst. <b>{eur0(s.sonst)}</b></span>
          <span>Σ <b>{eur0(s.aus)}</b></span>
        </Readout>
      )}
    </>
  );
}

// ── 7. Größte Posten ───────────────────────────────────────────────────
function PostenSection({ ctx }) {
  const { filters: f, mode, eff, cmp, allEntries, local, setLocal } = ctx;
  const [all, setAll] = useState(false);
  const by = local.postenBy;
  const cur = useMemo(
    () => groupExpenses(applyFilters(inRange(allEntries, eff), f, HONOR.all), mode, by),
    [allEntries, eff, f, mode, by],
  );
  const prevMap = useMemo(() => {
    if (!cmp) return null;
    return new Map(groupExpenses(applyFilters(inRange(allEntries, cmp), f, HONOR.all), mode, by).rows.map((r) => [r.key, r]));
  }, [allEntries, cmp, f, mode, by]);

  const rows = all ? cur.rows : cur.rows.slice(0, 5);
  const max = cur.rows[0]?.sum || 1;
  return (
    <>
      <div className="rp-posten-head">
        <div className="rp-sub">{by === 'name' ? 'Gleiche Namen werden zusammengefasst' : 'Ausgaben nach Kategorie'}</div>
        <Chips
          label="Gruppieren nach" value={by} onPick={(k) => setLocal({ postenBy: k })}
          options={[{ key: 'name', label: 'Name' }, { key: 'category', label: 'Kategorie' }]}
        />
      </div>
      {cur.rows.length === 0 ? <Empty>Keine Ausgaben mit den aktuellen Filtern.</Empty> : (
        <ul className="rp-rank">
          {rows.map((r) => {
            const p = prevMap?.get(r.key);
            return (
              <li key={r.key} className="rp-rank-row">
                <div className="rp-rank-top">
                  <span className="rp-rank-n">{r.label}{by === 'name' && <span className="rp-tag">{CAT_TAG[r.cat]}</span>}</span>
                  <span className="rp-rank-v">{eur0(r.sum)} <small>· {pct1(r.share)}</small></span>
                </div>
                <div className="rp-track"><i style={{ width: `${(r.sum / max) * 100}%` }} /></div>
                <div className="rp-rank-m">
                  <span>{r.count} {r.count === 1 ? 'Buchung' : 'Buchungen'} · Ø {eur0(r.avg)}</span>
                  {p && <Delta value={r.sum} base={p.sum} goodWhen="down" label={f.compare === 'year' ? 'ggü. Vorjahr' : 'ggü. Vorperiode'} />}
                </div>
              </li>
            );
          })}
        </ul>
      )}
      {cur.rows.length > 5 && (
        <button type="button" className="rp-more" onClick={() => setAll((v) => !v)}>
          {all ? 'Weniger anzeigen' : `Alle ${cur.rows.length} Posten anzeigen`}
        </button>
      )}
    </>
  );
}

// ── 8. Verträge nach Monatskosten ──────────────────────────────────────
const STATUS_UI = {
  aktiv: { cls: 'ok', text: '✓ aktiv' },
  aus:   { cls: 'warn', text: '! läuft aus' },
  abg:   { cls: 'crit', text: '× abgelaufen' },
};
const INTERVAL_OPTIONS = [
  { key: 'alle', label: 'Alle' },
  ...Object.entries(INTERVALS).map(([key, v]) => ({ key, label: v.label.replace(/ \(.*\)/, '') })),
];

function VertraegeSection({ ctx }) {
  const { filters: f, contracts, templates, local, setLocal } = ctx;
  const [all, setAll] = useState(false);
  const items = useMemo(() => buildContractItems(contracts, templates), [contracts, templates]);
  const base = useMemo(() => filterContractItems(items, { ...local, vStatus: 'alle' }, f), [items, local, f]);
  const list = local.vStatus === 'alle' ? base : base.filter((i) => i.status === local.vStatus);
  const count = (k) => base.filter((i) => i.status === k).length;
  const monthlySum = list.filter((i) => i.status !== 'abg').reduce((s, i) => s + i.monthly, 0);
  const max = list[0]?.monthly || 1;
  const shown = all ? list : list.slice(0, 6);

  if (items.length === 0) return <Empty>Noch keine Verträge oder Festposten angelegt.</Empty>;
  return (
    <>
      <div className="rp-localfilter">
        <div className="rp-lf-l">Status</div>
        <Chips
          label="Vertragsstatus" value={local.vStatus} onPick={(k) => setLocal({ vStatus: k })}
          options={[
            { key: 'alle', label: `Alle ${base.length}` }, { key: 'aktiv', label: `Aktiv ${count('aktiv')}` },
            { key: 'aus', label: `Läuft aus ${count('aus')}` }, { key: 'abg', label: `Abgelaufen ${count('abg')}` },
          ]}
        />
        <div className="rp-lf-l">Intervall</div>
        <Chips label="Zahlungsintervall" value={local.vInterval} onPick={(k) => setLocal({ vInterval: k })} options={INTERVAL_OPTIONS} />
      </div>
      <div className="rp-sub rp-sub--row">
        <span>Auf 1 Monat umgerechnet</span>
        <b>{eur0(monthlySum)} / Mo.</b>
      </div>
      {list.length === 0 ? <Empty>Keine Verträge mit dieser Auswahl.</Empty> : (
        <ul className="rp-rank">
          {shown.map((it) => (
            <li key={it.id} className="rp-rank-row">
              <div className="rp-rank-top">
                <span className="rp-rank-n">{it.name}<span className="rp-tag">{INTERVAL_ADVERB[it.interval]}</span></span>
                <span className="rp-rank-v">{eur0(it.monthly)} <small>/ Mo.</small></span>
              </div>
              <div className="rp-track"><i style={{ width: `${(it.monthly / max) * 100}%` }} /></div>
              <div className="rp-rank-m">
                <span>
                  {it.interval !== 'monthly' ? `${eur0(it.amount)} ${INTERVAL_ADVERB[it.interval]} · ` : ''}
                  {it.end ? `${it.status === 'abg' ? 'endete' : 'endet'} ${formatDate(it.end)}` : 'unbefristet'}
                  {it.source === 'Festposten' ? ' · Festposten' : ''}
                </span>
                <span className={`rp-st rp-st--${STATUS_UI[it.status].cls}`}>{STATUS_UI[it.status].text}</span>
              </div>
            </li>
          ))}
        </ul>
      )}
      {list.length > 6 && (
        <button type="button" className="rp-more" onClick={() => setAll((v) => !v)}>
          {all ? 'Weniger anzeigen' : `${list.length - 6} weitere anzeigen`}
        </button>
      )}
    </>
  );
}

// ── 9. Fristen im Blick ────────────────────────────────────────────────
function FristenSection({ ctx }) {
  const { filters: f, contracts, templates, local, setLocal, now } = ctx;
  const items = useMemo(() => buildContractItems(contracts, templates), [contracts, templates]);
  // Nur der Name-Filter gilt hier; Fristen hängen am Datum, nicht an Zeitraum/Kategorie.
  const named = useMemo(
    () => filterContractItems(items, { vStatus: 'alle', vInterval: 'alle' }, { ...DEFAULT_FILTERS, name: f.name }),
    [items, f.name],
  );
  const list = useMemo(() => buildDeadlines(named, local.horizon, now), [named, local.horizon, now]);
  const when = (d) => (d === 0 ? 'heute' : d === 1 ? 'morgen' : `in ${d} Tagen`);
  return (
    <>
      <div className="rp-localfilter">
        <div className="rp-lf-l">Vorausschau</div>
        <Chips
          label="Vorausschau" value={local.horizon} onPick={(k) => setLocal({ horizon: k })}
          options={[{ key: 30, label: '30 Tage' }, { key: 90, label: '90 Tage' }, { key: 180, label: '6 Monate' }]}
        />
      </div>
      {list.length === 0 ? (
        <Empty>Keine auslaufenden Verträge in den nächsten {local.horizon === 180 ? '6 Monaten' : `${local.horizon} Tagen`}.</Empty>
      ) : (
        <ul className="rp-deadlines">
          {list.map((it) => (
            <li key={it.id} className="rp-deadline">
              <div className="rp-date"><b>{it.endDay.getDate()}.</b><small>{MONTHS_SHORT[it.endDay.getMonth()]}</small></div>
              <div>
                <p><b>{it.name}</b> {it.source === 'Vertrag' ? 'endet' : 'läuft aus'}</p>
                <small>
                  {when(it.days)}
                  {it.cancellation ? ` · Kündigungsfrist: ${it.cancellation}` : ''}
                  {` · danach entfallen ${eur0(it.monthly)} / Mo.`}
                </small>
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

// ── 10. Womit wurde bezahlt? ───────────────────────────────────────────
function ZahlungSection({ ctx }) {
  const { filters: f, mode, eff, allEntries } = ctx;
  const split = useMemo(
    () => paymentSplit(applyFilters(inRange(allEntries, eff), f, HONOR.noPayment), mode),
    [allEntries, eff, f, mode],
  );
  if (split.rows.length === 0) return <Empty>Keine Ausgaben mit den aktuellen Filtern.</Empty>;
  const max = split.rows[0].sum || 1;
  return (
    <>
      <div className="rp-sub">Ausgaben {ctx.effText} · zeigt immer alle Zahlungsarten</div>
      <ul className="rp-rank">
        {split.rows.map((r) => (
          <li key={r.method} className="rp-rank-row">
            <div className="rp-rank-top">
              <span className="rp-rank-n">{PAYMENT_LABEL[r.method] || r.method}</span>
              <span className="rp-rank-v">{eur0(r.sum)} <small>· {pct0(r.share)}</small></span>
            </div>
            <div className="rp-track"><i style={{ width: `${(r.sum / max) * 100}%` }} /></div>
            {r.open > 0.005 && <div className="rp-rank-m"><span>davon noch offen: {eur0(r.open)}</span></div>}
          </li>
        ))}
      </ul>
    </>
  );
}

// ── Registry ───────────────────────────────────────────────────────────
// scope: Hinweis in der Kopfzeile. warn=true markiert Bereiche, die NICHT alle
// globalen Filter beachten; hint erklärt dann, was gilt.
export const SECTIONS = {
  kpi:        { title: 'Kennzahlen', scope: 'Alle Filter', Component: KpiSection },
  monat:      { title: 'Einnahmen und Ausgaben pro Monat', scope: 'Alle Filter', Component: MonatSection },
  verlauf:    {
    title: 'Verfügbar im Verlauf', scope: 'Nur Zeitraum', warn: true, Component: VerlaufSection,
    hint: 'Ein aufsummierter Saldo ist gefiltert nur eine Teilsumme. Hier gilt nur der Zeitraum.',
  },
  insights:   {
    title: 'Auffälligkeiten', scope: 'Nur Zeitraum', warn: true, Component: InsightsSection,
    hint: 'Feste Regeln über alle Buchungen im Zeitraum, unabhängig von den Filtern.',
  },
  tabelle:    { title: 'Monatstabelle', scope: 'Alle Filter', Component: TabelleSection },
  kategorien: { title: 'Monat für Monat', scope: 'Alle Filter', Component: KategorienSection },
  posten:     { title: 'Größte Posten', scope: 'Alle Filter', Component: PostenSection },
  vertraege:  {
    title: 'Verträge nach Monatskosten', scope: 'Eigene Filter', warn: true, Component: VertraegeSection,
    hint: 'Zeitraum, Vergleich, Status und Herkunft gelten hier nicht (Verträge sind keine Buchungen). Zahlungsart, Betrag, Name und Kategorie wirken.',
  },
  fristen:    {
    title: 'Fristen im Blick', scope: 'Eigene Filter', warn: true, Component: FristenSection,
    hint: 'Schaut immer ab heute nach vorn. Von den globalen Filtern gilt nur der Name.',
  },
  zahlung:    {
    title: 'Womit wurde bezahlt?', scope: 'Ohne Zahlungsart', warn: true, Component: ZahlungSection,
    hint: 'Der Zahlungsart-Filter wird ignoriert, sonst bliebe nur ein 100-%-Balken.',
  },
};
