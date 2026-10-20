import { Card, Bar, State, useRpc, areaName, nf } from '../ui';

function cohortStyle(v) {
  if (v === null || v === undefined) return { background: 'var(--grey-050)', color: 'var(--muted)' };
  if (v >= 60) return { background: 'var(--navy-800)', color: '#FFFFFF' };
  if (v >= 45) return { background: 'var(--navy-400)', color: 'var(--ink)' };
  return { background: '#D5DCEB', color: 'var(--ink)' };
}

export default function Funnels({ days }) {
  const state = useRpc('analytics_funnels', { p_days: days });

  return (
    <State state={state}>
      {(f) => {
        const first = Math.max(1, f.onboarding[0]?.count || 0);
        return (
          <>
            <div className="row">
              <Card title="Tutorials beim ersten Besuch" aside={`letzte ${f.days} Tage · Nutzer je Schritt`} className="grow3">
                {f.onboarding.map((s, i) => {
                  const prev = i === 0 ? s.count : f.onboarding[i - 1].count;
                  const lost = Math.max(prev - s.count, 0);
                  return (
                    <div key={s.label} className="funnel-step">
                      <div className="funnel-head">
                        <b>{s.label}</b>
                        <span className="nowrap"><b>{nf.format(s.count)}</b> <span className="muted">({Math.round((s.count / first) * 100)} %)</span></span>
                      </div>
                      <div className="funnel-bar"><span style={{ width: `${(s.count / first) * 100}%` }} /></div>
                      <div className="funnel-drop">
                        {i > 0 && lost > 0 ? `↓ ${nf.format(lost)} gehen hier verloren (${Math.round((lost / Math.max(prev, 1)) * 100)} %)` : ' '}
                      </div>
                    </div>
                  );
                })}
                {f.tutorials?.length > 0 && (
                  <div className="t-table">
                    <div className="t-row t-head"><span>Bereich</span><span>Gezeigt</span><span>Beendet</span><span>Aktion</span></div>
                    {f.tutorials.map((t) => (
                      <div key={t.tutorial} className="t-row">
                        <b>{areaName(t.tutorial)}</b>
                        <span>{nf.format(t.shown)}</span><span>{nf.format(t.done)}</span><span>{nf.format(t.acted)}</span>
                      </div>
                    ))}
                  </div>
                )}
                <div className="hint">
                  {nf.format(f.skipped)} Nutzer haben mindestens ein Tutorial übersprungen. Ein Nutzer zählt je Schritt höchstens einmal.
                </div>
              </Card>

              <Card title="Abbruch bei Formularen" aside="geöffnet, aber nicht gespeichert" className="grow2">
                {f.forms.map((r) => {
                  const rate = r.opened ? Math.max(0, Math.round(((r.opened - r.saved) / r.opened) * 100)) : null;
                  const high = rate !== null && rate >= 30;
                  return (
                    <div key={r.name} className="form-item">
                      <div className="form-head">
                        <b>{r.name}</b>
                        <span className={`pill ${rate === null ? 'flat' : high ? 'down' : 'up'}`}>{rate === null ? '–' : `${rate} % Abbruch`}</span>
                      </div>
                      <Bar value={r.saved} max={Math.max(r.opened, 1)} />
                      <div className="hint tight">{nf.format(r.opened)} geöffnet · {nf.format(r.saved)} gespeichert</div>
                    </div>
                  );
                })}
                <div className="hint">Rot ab 30 % Abbruch. Gezählt werden Ereignisse, nicht Nutzer; Speichern kann auch Bearbeiten sein.</div>
              </Card>
            </div>

            <Card title="Retention nach Anmelde-Woche" aside="Anteil der Kohorte, der in Woche N wieder aktiv war">
              <div className="cohorts">
                <div className="cohort-row head">
                  <span>Kohorte</span><span className="c-size">Nutzer</span>
                  {[0, 1, 2, 3, 4].map((k) => <span key={k} className={`c-cell${k === 0 ? ' c-w0' : ''}`}>W{k}</span>)}
                </div>
                {f.cohorts.map((c) => (
                  <div key={c.cohort} className="cohort-row">
                    <span className="c-name"><b>ab {new Date(c.cohort).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' })}</b><span className="c-sub">{nf.format(c.size)} Nutzer</span></span>
                    <span className="c-size">{nf.format(c.size)}</span>
                    {c.weeks.map((v, k) => (
                      <span key={k} className={`c-cell cohort-cell${k === 0 ? ' c-w0' : ''}`} style={cohortStyle(v)}>{v === null ? '–' : `${v} %`}</span>
                    ))}
                  </div>
                ))}
              </div>
              <div className="hint">Kohorte = Woche der ersten erfassten Aktivität. Die Tabelle füllt sich erst mit den Tagen, an denen die tägliche Verdichtung gelaufen ist.</div>
            </Card>
          </>
        );
      }}
    </State>
  );
}
