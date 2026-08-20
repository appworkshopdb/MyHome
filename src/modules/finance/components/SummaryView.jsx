import { useEffect, useState } from 'react';
import { Bar, Line, Doughnut } from 'react-chartjs-2';
import {
  Chart as ChartJS, CategoryScale, LinearScale, BarElement, LineElement,
  PointElement, ArcElement, Tooltip, Legend,
} from 'chart.js';
import { useAuth } from '../../../core/lib/AuthContext';
import { useUi } from '../../../core/lib/UiContext';
import { getAllEntries, getSavingsByYear } from '../lib/finData';
import { MONTHS_DE, formatEur } from '../lib/finance';

ChartJS.register(CategoryScale, LinearScale, BarElement, LineElement, PointElement, ArcElement, Tooltip, Legend);

function sum(entries, cat) {
  return entries.filter((e) => e.category === cat).reduce((s, e) => s + Number(e.amount || 0), 0);
}

// Liest die aktiven Theme-Variablen direkt aus dem DOM, damit Diagramme
// zu jeder Palette und jedem Modus passen (wie im Original).
function getChartColors() {
  const cs = getComputedStyle(document.documentElement);
  const v = (n) => cs.getPropertyValue(n).trim();
  return {
    grid: v('--border'), tick: v('--text-muted'),
    einnahmen: v('--success'), ausgaben: v('--danger'),
    verfuegbar: v('--accent'), fixkosten: v('--warning'),
    variable: v('--accent'), sonstige: v('--danger'),
  };
}

export default function SummaryView() {
  const { session } = useAuth();
  const { mode } = useUi();
  const [year, setYear] = useState(new Date().getFullYear());
  const [monthData, setMonthData] = useState(null);
  const [colors, setColors] = useState(getChartColors);

  // Diagrammfarben nachziehen, wenn die Palette gewechselt wird
  useEffect(() => { setColors(getChartColors()); }, [mode]);

  useEffect(() => {
    (async () => {
      const [allEntries, savings] = await Promise.all([
        getAllEntries(session),
        getSavingsByYear(session, year),
      ]);
      const entries = allEntries.filter((e) => e.year === year);

      setMonthData(MONTHS_DE.map((name, i) => {
        const m = i + 1;
        const me = entries.filter((e) => e.month === m);
        const totalEin = sum(me, 'fixeinnahmen') + sum(me, 'sonstige_einnahmen');
        const fixKost = sum(me, 'fixkosten');
        const varKost = sum(me, 'variable_kosten');
        const sonstAus = sum(me, 'sonstige_ausgaben');
        const totalAus = fixKost + varKost + sonstAus;
        const gespart = savings.filter((s) => s.month === m).reduce((a, x) => a + Number(x.amount || 0), 0);
        return { name, totalEin, fixKost, varKost, sonstAus, totalAus, verfuegbar: totalEin - totalAus - gespart, gespart };
      }));
    })();
  }, [session, year]);

  if (!monthData) return <div className="loading-note">Lädt…</div>;

  const totEin = monthData.reduce((s, m) => s + m.totalEin, 0);
  const totFix = monthData.reduce((s, m) => s + m.fixKost, 0);
  const totVar = monthData.reduce((s, m) => s + m.varKost, 0);
  const totSonst = monthData.reduce((s, m) => s + m.sonstAus, 0);
  const totAus = monthData.reduce((s, m) => s + m.totalAus, 0);
  const totGespart = monthData.reduce((s, m) => s + m.gespart, 0);
  const balance = totEin - totAus;

  const labels = MONTHS_DE.map((m) => m.substring(0, 3));
  const base = {
    responsive: true, maintainAspectRatio: false,
    plugins: { legend: { labels: { color: colors.tick, font: { size: 12 }, boxWidth: 12, padding: 12 } } },
  };

  return (
    <>
      <div className="page-header">
        <select
          value={year} onChange={(e) => setYear(Number(e.target.value))}
          style={{ width: 'auto', fontSize: '0.9rem', padding: '6px 28px 6px 10px' }}
        >
          {Array.from({ length: 11 }, (_, i) => 2020 + i).map((y) => <option key={y} value={y}>{y}</option>)}
        </select>
      </div>

      <div className="summary-row">
        <div className="summary-chip"><div className="label">Einnahmen gesamt</div><div className="value">{formatEur(totEin)}</div></div>
        <div className="summary-chip negative"><div className="label">Ausgaben gesamt</div><div className="value">{formatEur(totAus)}</div></div>
        <div className={`summary-chip ${balance >= 0 ? 'positive' : 'negative'}`}><div className="label">Bilanz</div><div className="value">{formatEur(balance)}</div></div>
        <div className="summary-chip neutral"><div className="label">Erspartes gesamt</div><div className="value">{formatEur(totGespart)}</div></div>
      </div>

      <div className="card">
        <div className="card-title">Monatsübersicht</div>
        <div style={{ overflowX: 'auto' }}>
          <table className="entry-table">
            <thead>
              <tr>
                <th>Monat</th>
                <th style={{ textAlign: 'right' }}>Einnahmen</th>
                <th style={{ textAlign: 'right' }}>Fix-Kosten</th>
                <th style={{ textAlign: 'right' }}>Var. Kosten</th>
                <th style={{ textAlign: 'right' }}>Sonst. Ausg.</th>
                <th style={{ textAlign: 'right' }}>Ausg. Ges.</th>
                <th style={{ textAlign: 'right' }}>Verfügbar</th>
                <th style={{ textAlign: 'right' }}>Erspart</th>
              </tr>
            </thead>
            <tbody>
              {monthData.map((m) => (
                <tr key={m.name}>
                  <td style={{ fontWeight: 500 }}>{m.name}</td>
                  <td className="amount" style={{ color: 'var(--success)' }}>{m.totalEin > 0 ? formatEur(m.totalEin) : '—'}</td>
                  <td className="amount">{m.fixKost > 0 ? formatEur(m.fixKost) : '—'}</td>
                  <td className="amount">{m.varKost > 0 ? formatEur(m.varKost) : '—'}</td>
                  <td className="amount">{m.sonstAus > 0 ? formatEur(m.sonstAus) : '—'}</td>
                  <td className="amount" style={{ color: 'var(--danger)' }}>{m.totalAus > 0 ? formatEur(m.totalAus) : '—'}</td>
                  <td className="amount" style={{ color: m.verfuegbar >= 0 ? 'var(--success)' : 'var(--danger)' }}>
                    {(m.totalEin > 0 || m.totalAus > 0) ? formatEur(m.verfuegbar) : '—'}
                  </td>
                  <td className="amount" style={{ color: 'var(--accent)' }}>{m.gespart > 0 ? formatEur(m.gespart) : '—'}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td style={{ fontWeight: 600, fontSize: '0.82rem', color: 'var(--text-muted)' }}>Gesamt</td>
                <td className="amount" style={{ color: 'var(--success)' }}>{formatEur(totEin)}</td>
                <td className="amount">{formatEur(totFix)}</td>
                <td className="amount">{formatEur(totVar)}</td>
                <td className="amount">{formatEur(totSonst)}</td>
                <td className="amount" style={{ color: 'var(--danger)' }}>{formatEur(totAus)}</td>
                <td className="amount" style={{ color: balance >= 0 ? 'var(--success)' : 'var(--danger)' }}>{formatEur(balance)}</td>
                <td className="amount" style={{ color: 'var(--accent)' }}>{formatEur(totGespart)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      <div className="card">
        <div className="card-title">Einnahmen vs. Ausgaben</div>
        <div className="chart-box" style={{ height: 260 }}>
          <Bar
            options={{
              ...base,
              scales: {
                x: { ticks: { color: colors.tick }, grid: { color: colors.grid } },
                y: { ticks: { color: colors.tick, callback: (v) => v + ' €' }, grid: { color: colors.grid } },
              },
            }}
            data={{
              labels,
              datasets: [
                { label: 'Einnahmen', data: monthData.map((m) => m.totalEin), backgroundColor: colors.einnahmen + 'CC', borderRadius: 4, borderSkipped: false },
                { label: 'Ausgaben', data: monthData.map((m) => m.totalAus), backgroundColor: colors.ausgaben + 'CC', borderRadius: 4, borderSkipped: false },
              ],
            }}
          />
        </div>
      </div>

      <div className="card">
        <div className="card-title">Verfügbares Kapital</div>
        <div className="chart-box" style={{ height: 220 }}>
          <Line
            options={{
              ...base,
              scales: {
                x: { ticks: { color: colors.tick, font: { size: 11 } }, grid: { color: colors.grid } },
                y: { ticks: { color: colors.tick, callback: (v) => v + ' €', font: { size: 11 } }, grid: { color: colors.grid } },
              },
            }}
            data={{
              labels,
              datasets: [{
                label: 'Verfügbar',
                data: monthData.map((m) => (m.totalEin > 0 || m.totalAus > 0 ? m.verfuegbar : null)),
                borderColor: colors.verfuegbar,
                backgroundColor: colors.verfuegbar + '22',
                fill: true, tension: 0.4, pointRadius: 4,
                pointBackgroundColor: colors.verfuegbar, spanGaps: false,
              }],
            }}
          />
        </div>
      </div>

      <div className="card">
        <div className="card-title">Ausgaben-Kategorien</div>
        <div className="chart-box" style={{ height: 260 }}>
          <Doughnut
            options={{
              ...base, cutout: '62%',
              plugins: { legend: { position: 'bottom', labels: { color: colors.tick, font: { size: 12 }, boxWidth: 12, padding: 10 } } },
            }}
            data={{
              labels: ['Fixkosten', 'Variable', 'Sonstige'],
              datasets: [{
                data: [totFix, totVar, totSonst],
                backgroundColor: [colors.fixkosten + 'CC', colors.variable + 'CC', colors.sonstige + 'CC'],
                borderColor: [colors.fixkosten, colors.variable, colors.sonstige],
                borderWidth: 1.5, hoverOffset: 6,
              }],
            }}
          />
        </div>
      </div>
    </>
  );
}

