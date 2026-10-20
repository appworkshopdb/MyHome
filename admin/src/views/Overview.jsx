import { Card, Bar, State, useRpc, areaName, screenLabel, nf, nf1 } from '../ui';

// Veränderung gegenüber der Vorperiode in Prozent. Bei Tageswerten wird
// bewusst nur "gestern N" gezeigt: heute ist noch nicht vorbei, ein
// Prozentwert wäre schief.
function pct(cur, prev) {
  if (!prev) return { text: cur ? 'neu' : '–', tone: 'flat' };
  const d = Math.round(((cur - prev) / prev) * 100);
  if (d === 0) return { text: '± 0 % zur Vorperiode', tone: 'flat' };
  return { text: `${d > 0 ? '↑' : '↓'} ${Math.abs(d)} % zur Vorperiode`, tone: d > 0 ? 'up' : 'down' };
}

function Kpi({ label, value, sub, tone = 'flat' }) {
  return (
    <div className="card kpi">
      <div className="kpi-label">{label}</div>
      <div className="kpi-value">{value}</div>
      <div className={`kpi-sub ${tone}`}>{sub}</div>
    </div>
  );
}

function LineChart({ series }) {
  const W = 600, H = 190, PAD_L = 34, PAD_B = 22, PAD_T = 8;
  const max = Math.max(5, ...series.map((s) => s.users));
  const top = Math.ceil(max / 10) * 10;
  const x = (i) => PAD_L + (i / Math.max(series.length - 1, 1)) * (W - PAD_L - 8);
  const y = (v) => PAD_T + (1 - v / top) * (H - PAD_T - PAD_B);
  const points = series.map((s, i) => `${x(i)},${y(s.users)}`).join(' ');
  const label = (iso) => new Date(iso).toLocaleDateString('de-DE', { day: 'numeric', month: 'numeric' });
  const ticks = [0, Math.floor((series.length - 1) / 3), Math.floor(((series.length - 1) * 2) / 3), series.length - 1];

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="chart" role="img"
         aria-label={`Täglich aktive Nutzer, Höchstwert ${max}`}>
      {[0, 0.5, 1].map((f) => (
        <g key={f}>
          <line x1={PAD_L} x2={W - 8} y1={y(top * f)} y2={y(top * f)} className="grid" />
          <text x={PAD_L - 6} y={y(top * f) + 4} textAnchor="end" className="axis">{Math.round(top * f)}</text>
        </g>
      ))}
      <polyline points={points} className="line" />
      {series.map((s, i) => (
        <circle key={s.day} cx={x(i)} cy={y(s.users)} r="3" className="dot">
          <title>{`${label(s.day)}: ${s.users} Nutzer, ${s.sessions} Sitzungen`}</title>
        </circle>
      ))}
      {[...new Set(ticks)].map((i) => (
        <text key={i} x={x(i)} y={H - 6} textAnchor={i === series.length - 1 ? 'end' : 'middle'} className="axis">{label(series[i].day)}</text>
      ))}
    </svg>
  );
}

export default function Overview({ days }) {
  const overview = useRpc('analytics_overview', { p_days: days });
  const live = useRpc('analytics_live', {}, 30_000);

  return (
    <>
      <State state={overview}>
        {(o) => {
          const k = o.kpis;
          const minPerUser = k.dau ? k.minutes / k.dau : 0;
          const minPerUserPrev = k.dau_prev ? k.minutes_prev / k.dau_prev : 0;
          const wau = pct(k.wau, k.wau_prev);
          const mau = pct(k.mau, k.mau_prev);
          const maxViews = Math.max(1, ...o.areas.map((a) => a.views));
          const installed = o.platform.installed, browser = o.platform.browser;
          const total = Math.max(1, installed + browser);

          return (
            <>
              <div className="kpis">
                <Kpi label="Aktive Nutzer heute" value={nf.format(k.dau)} sub={`gestern ${nf.format(k.dau_prev)}`} />
                <Kpi label="Aktiv in 7 Tagen" value={nf.format(k.wau)} sub={wau.text} tone={wau.tone} />
                <Kpi label="Aktiv in 30 Tagen" value={nf.format(k.mau)} sub={mau.text} tone={mau.tone} />
                <Kpi label="Ø aktive Minuten pro Nutzer heute" value={nf1.format(minPerUser)} sub={`gestern ${nf1.format(minPerUserPrev)}`} />
                <Kpi label="Sitzungen heute" value={nf.format(k.sessions)} sub={`gestern ${nf.format(k.sessions_prev)}`} />
              </div>

              <div className="row">
                <Card title="Gerade aktiv" aside={<b className="up">{live.data?.total ?? 0} Nutzer · letzte 3 Min.</b>} className="grow1">
                  {live.data?.rows.length ? (
                    live.data.rows.map((r) => (
                      <div key={`${r.module}/${r.view}`} className="live-row">
                        <div className="live-name"><span>{screenLabel(r.module, r.view)}</span><span className="muted">{r.users}</span></div>
                        <Bar value={r.users} max={live.data.rows[0].users} />
                      </div>
                    ))
                  ) : (
                    <div className="note">Gerade niemand aktiv.</div>
                  )}
                  <div className="hint">Aktualisiert sich alle 30 Sekunden. Basis: Aktivitätsmeldungen (1 pro Minute, nur bei bedienter App).</div>
                </Card>

                <Card title="Aktive Nutzer pro Tag" aside={`letzte ${o.days} Tage`} className="grow2">
                  <LineChart series={o.series} />
                </Card>
              </div>

              <div className="row">
                <Card title="Wo sind die Nutzer?" aside={`letzte ${o.days} Tage`} className="grow3">
                  <div className="table-scroll">
                    <table>
                      <thead>
                        <tr><th>Bereich</th><th>Aufrufe</th><th>Nutzer</th><th>Min. pro Besuch</th><th>Klicks pro Besuch</th></tr>
                      </thead>
                      <tbody>
                        {o.areas.map((a) => (
                          <tr key={a.module}>
                            <td><b>{areaName(a.module)}</b></td>
                            <td><span className="with-bar"><span className="num">{nf.format(a.views)}</span><Bar value={a.views} max={maxViews} /></span></td>
                            <td>{nf.format(a.users)}</td>
                            <td>{a.views ? nf1.format(a.minutes / a.views) : '–'}</td>
                            <td>{a.views ? nf1.format(a.clicks / a.views) : '–'}</td>
                          </tr>
                        ))}
                        {!o.areas.length && <tr><td colSpan="5" className="muted">Noch keine Daten im gewählten Zeitraum.</td></tr>}
                      </tbody>
                    </table>
                  </div>
                </Card>

                <div className="stack grow1">
                  <Card title="Nutzung als App">
                    <div className="split" role="img" aria-label={`${installed} installiert, ${browser} im Browser`}>
                      <span style={{ width: `${(installed / total) * 100}%` }} />
                    </div>
                    <div className="split-legend">
                      <span><b>{Math.round((installed / total) * 100)} %</b> installiert (PWA)</span>
                      <span><b>{Math.round((browser / total) * 100)} %</b> Browser</span>
                    </div>
                  </Card>
                  <Card title="Mit Tracking">
                    <div className="split-legend"><span>Nutzer mit Daten</span><b>{nf.format(o.tracked.users)} von {nf.format(o.tracked.accounts)}</b></div>
                    <Bar value={o.tracked.users} max={Math.max(1, o.tracked.accounts)} color="var(--green)" />
                    <div className="hint">Nur wer zugestimmt hat, ist in den Zahlen enthalten.</div>
                  </Card>
                </div>
              </div>
            </>
          );
        }}
      </State>
    </>
  );
}
