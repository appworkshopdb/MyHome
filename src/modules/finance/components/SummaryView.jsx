import { useEffect, useState } from 'react';
import { Bar, Line, Doughnut } from 'react-chartjs-2';
import {
  Chart as ChartJS, CategoryScale, LinearScale, BarElement, LineElement,
  PointElement, ArcElement, Tooltip, Legend,
} from 'chart.js';
import { useAuth } from '../../../core/lib/AuthContext';
import { useUi } from '../../../core/lib/UiContext';
import { getAllEntries, getSparschweinLedger } from '../lib/finData';
import { MONTHS_DE, formatEur } from '../lib/finance';

ChartJS.register(CategoryScale, LinearScale, BarElement, LineElement, PointElement, ArcElement, Tooltip, Legend);

function sum(entries, cat) {
  return entries.filter((e) => e.category === cat).reduce((s, e) => s + Number(e.amount || 0), 0);
}

// Liest die semantischen Token-Farben aus dem DOM — passt sich automatisch
// an Hell/Dunkel und zukünftige Token-Anpassungen an.
function getChartColors() {
  const cs = getComputedStyle(document.documentElement);
  const v  = (n) => cs.getPropertyValue(n).trim();
  return {
    grid:      v('--border-hairline'),
    tick:      v('--text-muted'),
    einnahmen: v('--status-positive'),
    ausgaben:  v('--status-critical'),
    verfueg:   v('--action-primary'),
    data1:     v('--data-1'),
    data2:     v('--data-2'),
    data3:     v('--data-3'),
  };
}

export default function SummaryView() {
  const { session } = useAuth();
  const { mode }    = useUi();
  const [year,  setYear]  = useState(new Date().getFullYear());
  const [monthData, setMonthData] = useState(null);
  const [colors,    setColors]    = useState(getChartColors);
  const [sparschweinBalance, setSparschweinBalance] = useState(null);

  // Diagrammfarben nachziehen, wenn Hell/Dunkel gewechselt wird
  useEffect(() => { setColors(getChartColors()); }, [mode]);

  useEffect(() => {
    (async () => {
      const allEntries = await getAllEntries(session);
      const entries    = allEntries.filter((e) => e.year === year);

      setMonthData(MONTHS_DE.map((name, i) => {
        const m  = i + 1;
        const me = entries.filter((e) => e.month === m);
        const totalEin = sum(me, 'fixeinnahmen') + sum(me, 'sonstige_einnahmen');
        const fixKost  = sum(me, 'fixkosten');
        const varKost  = sum(me, 'variable_kosten');
        const sonstAus = sum(me, 'sonstige_ausgaben');
        const totalAus = fixKost + varKost + sonstAus;
        return { name, totalEin, fixKost, varKost, sonstAus, totalAus, verfuegbar: totalEin - totalAus };
      }));
    })();
  }, [session, year]);

  // Sparschwein-Stand: läuft über alle Jahre, kein Jahres-Reset
  useEffect(() => {
    getSparschweinLedger(session).then(({ balance }) => setSparschweinBalance(balance));
  }, [session]);

  if (!monthData) return <div className="loading-note">Lädt…</div>;

  const totEin   = monthData.reduce((s, m) => s + m.totalEin,  0);
  const totFix   = monthData.reduce((s, m) => s + m.fixKost,   0);
  const totVar   = monthData.reduce((s, m) => s + m.varKost,   0);
  const totSonst = monthData.reduce((s, m) => s + m.sonstAus,  0);
  const totAus   = monthData.reduce((s, m) => s + m.totalAus,  0);
  const balance  = totEin - totAus;

  const labels = MONTHS_DE.map((m) => m.substring(0, 3));

  const baseOpts = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        labels: { color: colors.tick, font: { size: 12 }, boxWidth: 12, padding: 12 },
      },
    },
  };

  const scaleOpts = {
    x: { ticks: { color: colors.tick }, grid: { color: colors.grid } },
    y: {
      ticks: { color: colors.tick, callback: (v) => v + ' €' },
      grid:  { color: colors.grid },
    },
  };

  return (
    <>
      {/* Jahres-Wähler */}
      <div className="summary-year-row">
        <select
          className="summary-year-select"
          value={year}
          onChange={(e) => setYear(Number(e.target.value))}
        >
          {Array.from({ length: 11 }, (_, i) => 2020 + i).map((y) => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>
      </div>

      {/* Kennzahlen-Chips */}
      <div className="summary-row">
        <div className="summary-chip">
          <div className="label">Einnahmen</div>
          <div className="value">{formatEur(totEin)}</div>
        </div>
        <div className="summary-chip negative">
          <div className="label">Ausgaben</div>
          <div className="value">{formatEur(totAus)}</div>
        </div>
        <div className={`summary-chip ${balance >= 0 ? 'positive' : 'negative'}`}>
          <div className="label">Bilanz</div>
          <div className="value">{formatEur(balance)}</div>
        </div>
        <div className="summary-chip neutral">
          <div className="label">Sparschwein</div>
          <div className="value">{sparschweinBalance === null ? '…' : formatEur(sparschweinBalance)}</div>
        </div>
      </div>

      {/* Monatsübersichts-Tabelle */}
      <div className="card">
        <div className="card-title">Monatsübersicht</div>
        <div className="table-wrap">
          <table className="entry-table">
            <thead>
              <tr>
                <th>Monat</th>
                <th style={{ textAlign: 'right' }}>Einnahmen</th>
                <th style={{ textAlign: 'right' }}>Fix</th>
                <th style={{ textAlign: 'right' }}>Var.</th>
                <th style={{ textAlign: 'right' }}>Sonst.</th>
                <th style={{ textAlign: 'right' }}>Ausg.</th>
                <th style={{ textAlign: 'right' }}>Verfügbar</th>
              </tr>
            </thead>
            <tbody>
              {monthData.map((m) => (
                <tr key={m.name}>
                  <td style={{ fontWeight: 600 }}>{m.name}</td>
                  <td className="amount" style={{ color: 'var(--status-positive)' }}>
                    {m.totalEin > 0 ? formatEur(m.totalEin) : '—'}
                  </td>
                  <td className="amount">{m.fixKost  > 0 ? formatEur(m.fixKost)  : '—'}</td>
                  <td className="amount">{m.varKost  > 0 ? formatEur(m.varKost)  : '—'}</td>
                  <td className="amount">{m.sonstAus > 0 ? formatEur(m.sonstAus) : '—'}</td>
                  <td className="amount" style={{ color: 'var(--status-critical)' }}>
                    {m.totalAus > 0 ? formatEur(m.totalAus) : '—'}
                  </td>
                  <td
                    className="amount"
                    style={{ color: m.verfuegbar >= 0 ? 'var(--status-positive)' : 'var(--status-critical)' }}
                  >
                    {(m.totalEin > 0 || m.totalAus > 0) ? formatEur(m.verfuegbar) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td className="t-meta" style={{ color: 'var(--text-muted)', fontWeight: 600 }}>Gesamt</td>
                <td className="amount" style={{ color: 'var(--status-positive)' }}>{formatEur(totEin)}</td>
                <td className="amount">{formatEur(totFix)}</td>
                <td className="amount">{formatEur(totVar)}</td>
                <td className="amount">{formatEur(totSonst)}</td>
                <td className="amount" style={{ color: 'var(--status-critical)' }}>{formatEur(totAus)}</td>
                <td
                  className="amount"
                  style={{ color: balance >= 0 ? 'var(--status-positive)' : 'var(--status-critical)' }}
                >
                  {formatEur(balance)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Einnahmen vs. Ausgaben */}
      <div className="card">
        <div className="card-title">Einnahmen vs. Ausgaben</div>
        <div className="chart-box" style={{ height: 260 }}>
          <Bar
            options={{ ...baseOpts, scales: scaleOpts }}
            data={{
              labels,
              datasets: [
                {
                  label: 'Einnahmen',
                  data: monthData.map((m) => m.totalEin),
                  backgroundColor: colors.einnahmen + 'CC',
                  borderRadius: 4,
                  borderSkipped: false,
                },
                {
                  label: 'Ausgaben',
                  data: monthData.map((m) => m.totalAus),
                  backgroundColor: colors.ausgaben + 'CC',
                  borderRadius: 4,
                  borderSkipped: false,
                },
              ],
            }}
          />
        </div>
      </div>

      {/* Verfügbares Kapital */}
      <div className="card">
        <div className="card-title">Verfügbares Kapital</div>
        <div className="chart-box" style={{ height: 220 }}>
          <Line
            options={{
              ...baseOpts,
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
                borderColor: colors.verfueg,
                backgroundColor: colors.verfueg + '22',
                fill: true,
                tension: 0.4,
                pointRadius: 4,
                pointBackgroundColor: colors.verfueg,
                spanGaps: false,
              }],
            }}
          />
        </div>
      </div>

      {/* Ausgaben-Kategorien */}
      <div className="card">
        <div className="card-title">Ausgaben-Kategorien</div>
        <div className="chart-box" style={{ height: 260 }}>
          <Doughnut
            options={{
              ...baseOpts,
              cutout: '62%',
              plugins: {
                legend: {
                  position: 'bottom',
                  labels: { color: colors.tick, font: { size: 12 }, boxWidth: 12, padding: 10 },
                },
              },
            }}
            data={{
              labels: ['Fixkosten', 'Variable', 'Sonstige'],
              datasets: [{
                data: [totFix, totVar, totSonst],
                backgroundColor: [colors.data1 + 'CC', colors.data2 + 'CC', colors.data3 + 'CC'],
                borderColor:     [colors.data1,          colors.data2,          colors.data3],
                borderWidth: 1.5,
                hoverOffset: 6,
              }],
            }}
          />
        </div>
      </div>
    </>
  );
}
