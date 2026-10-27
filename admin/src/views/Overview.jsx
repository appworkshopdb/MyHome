import { Card, Bar, State, Spark, useRpc, areaName, screenLabel, nf, nf1 } from '../ui';

// Veränderung gegenüber der Vorperiode in Prozent. Bei Tageswerten wird
// bewusst nur "gestern N" gezeigt: heute ist noch nicht vorbei, ein
// Prozentwert wäre schief.
function pct(cur, prev) {
  if (!prev) return { text: cur ? 'neu' : '–', tone: 'flat' };
  const d = Math.round(((cur - prev) / prev) * 100);
  if (d === 0) return { text: '± 0 %', tone: 'flat' };
  return { text: `${d > 0 ? '↑' : '↓'} ${Math.abs(d)} %`, tone: d > 0 ? 'up' : 'down' };
}

function Kpi({ label, value, sub, tone = 'flat', spark, hero = false }) {
  return (
    <div className={`kpi${hero ? ' kpi-hero' : ''}`}>
      <div className="kpi-label">{label}</div>
      <div className="kpi-value">{value}</div>
      <div className="kpi-foot">
        <span className={`pill ${tone}`}>{sub}</span>
        {spark && <Spark values={spark} />}
      </div>
    </div>
  );
}

function AreaChart({ series }) {
  const W = 600, H = 200, PAD_L = 34, PAD_R = 8, PAD_B = 24, PAD_T = 8;
  const max = Math.max(5, ...series.map((s) => s.users));
  const top = Math.ceil(max / 10) * 10;
  const x = (i) => PAD_L + (i / Math.max(series.length - 1, 1)) * (W - PAD_L - PAD_R);
  const y = (v) => PAD_T + (1 - v / top) * (H - PAD_T - PAD_B);
  const line = series.map((s, i) => `${x(i)},${y(s.users)}`).join(' ');
  const area = `${x(0)},${y(0)} ${line} ${x(series.length - 1)},${y(0)}`;
  const label = (iso) => new Date(iso).toLocaleDateString('de-DE', { day: 'numeric', month: 'numeric' });
  const last = series.length - 1;
  const ticks = [...new Set([0, Math.floor(last / 3), Math.floor((last * 2) / 3), last])];

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="chart" role="img" aria-label={`Täglich aktive Nutzer, Höchstwert ${max}`}>
      {[0, 0.5, 1].map((f) => (
        <g key={f}>
          <line x1={PAD_L} x2={W - PAD_R} y1={y(top * f)} y2={y(top * f)} className="grid" />
          <text x={PAD_L - 6} y={y(top * f) + 4} textAnchor="end" className="axis">{Math.round(top * f)}</text>
        </g>
      ))}
      <polygon points={area} className="area" />
      <polyline points={line} className="line" />
      {series.length <= 31 && series.map((s, i) => (
        <circle key={s.day} cx={x(i)} cy={y(s.users)} r="3" className="dot">
          <title>{`${label(s.day)}: ${s.users} Nutzer, ${s.sessions} Sitzungen`}</title>
        </circle>
      ))}
      {ticks.map((i) => (
        <text key={i} x={x(i)} y={H - 6} textAnchor={i === last ? 'end' : i === 0 ? 'start' : 'middle'} className="axis">{label(series[i].day)}</text>
      ))}
    </svg>
  );
}

export default function Overview({ days }) {
  const overview = useRpc('analytics_overview', { p_days: days }, 60_000);
  const live = useRpc('analytics_live', {}, 30_000);

  return (
    <State state={overview}>
      {(o) => {
        const k = o.kpis;
        const minPerUser = k.dau ? k.minutes / k.dau : 0;
        const minPerUserPrev = k.dau_prev ? k.minutes_prev / k.dau_prev : 0;
        const dMin = minPerUser - minPerUserPrev;
        const wau = pct(k.wau, k.wau_prev);
        const mau = pct(k.mau, k.mau_prev);
        const maxViews = Math.max(1, ...o.areas.map((a) => a.views));
        const installed = o.platform.installed, browser = o.platform.browser;
        const total = Math.max(1, installed + browser);
        const instPct = Math.round((installed / total) * 100);
        const tail = (arr, key) => arr.slice(-14).map((s) => s[key]);

        return (
          <>
            <div className="kpis">
              <Kpi hero label="Aktive Nutzer heute" value={nf.format(k.dau)} sub={`gestern ${nf.format(k.dau_prev)}`} spark={tail(o.series, 'users')} />
              <Kpi label="Aktiv in 7 Tagen" value={nf.format(k.wau)} sub={wau.text} tone={wau.tone} />
              <Kpi label="Aktiv in 30 Tagen" value={nf.format(k.mau)} sub={mau.text} tone={mau.tone} />
              <Kpi label="Ø aktive Min. pro Nutzer" value={nf1.format(minPerUser)}
                   sub={k.dau_prev ? `${dMin >= 0 ? '↑' : '↓'} ${nf1.format(Math.abs(dMin))} Min.` : `gestern ${nf1.format(minPerUserPrev)}`}
                   tone={k.dau_prev ? (dMin >= 0 ? 'up' : 'down') : 'flat'} />
              <Kpi label="Sitzungen heute" value={nf.format(k.sessions)} sub={`gestern ${nf.format(k.sessions_prev)}`} spark={tail(o.series, 'sessions')} />
            </div>

            <div className="row">
              <Card title="Aktive Nutzer pro Tag" aside={`letzte ${o.days} Tage`} className="grow2 order-chart">
                <AreaChart series={o.series} />
              </Card>

              <Card title="Gerade aktiv" aside={<span className="live-chip"><i />{live.data?.total ?? 0} online</span>} className="grow1 order-live">
                {live.data?.rows.length ? (
                  live.data.rows.map((r) => (
                    <div key={`${r.module}/${r.view}`} className="meter">
                      <div className="meter-head"><span>{screenLabel(r.module, r.view)}</span><span className="muted">{r.users}</span></div>
                      <Bar value={r.users} max={live.data.rows[0].users} className="bar-dark" />
                    </div>
                  ))
                ) : (
                  <div className="note">Gerade niemand aktiv.</div>
                )}
                <div className="hint">Letzte 3 Minuten · aktualisiert alle 30 s</div>
              </Card>
            </div>

            <div className="row">
              <Card title="Wo sind die Nutzer?" aside={`letzte ${o.days} Tage`} className="grow3">
                <div className="areas">
                  <div className="area-head">
                    <span>Bereich</span><span className="span2">Aufrufe</span><span>Nutzer</span><span>Min. / Besuch</span><span>Klicks / Besuch</span>
                  </div>
                  {o.areas.map((a) => (
                    <div key={a.module} className="area-row">
                      <b className="area-name">{areaName(a.module)}</b>
                      <span className="area-num">{nf.format(a.views)}<span className="area-unit"> Aufrufe</span></span>
                      <Bar value={a.views} max={maxViews} className="area-bar" />
                      <span className="c-users">{nf.format(a.users)}</span>
                      <span className="c-min">{a.views ? nf1.format(a.minutes / a.views) : '–'}</span>
                      <span className="c-clicks">{a.views ? nf1.format(a.clicks / a.views) : '–'}</span>
                      <span className="area-meta">
                        {nf.format(a.users)} Nutzer · {a.views ? nf1.format(a.minutes / a.views) : '–'} Min. / Besuch · {a.views ? nf1.format(a.clicks / a.views) : '–'} Klicks / Besuch
                      </span>
                    </div>
                  ))}
                  {!o.areas.length && <div className="note">Noch keine Daten im gewählten Zeitraum.</div>}
                </div>
              </Card>

              <div className="side grow1">
                <Card className="card-split">
                  <div className="donut" style={{ background: `conic-gradient(var(--navy-800) 0 ${instPct}%, var(--grey-300) 0)` }}
                       role="img" aria-label={`${installed} installiert, ${browser} im Browser`}>
                    <div>{instPct} %</div>
                  </div>
                  <div className="split-text">
                    <h2>Nutzung als App</h2>
                    <span className="muted">{instPct} % installiert (PWA)<br />{100 - instPct} % im Browser</span>
                  </div>
                </Card>
                <Card title="Mit Tracking" aside={<b>{nf.format(o.tracked.users)} von {nf.format(o.tracked.accounts)}</b>}>
                  <Bar value={o.tracked.users} max={Math.max(1, o.tracked.accounts)} className="bar-green bar-thick" />
                  <div className="hint">Nur wer zugestimmt hat, ist in den Zahlen enthalten.</div>
                </Card>
              </div>
            </div>
          </>
        );
      }}
    </State>
  );
}
