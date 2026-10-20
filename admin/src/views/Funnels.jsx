import { Card, State, useRpc, nf } from '../ui';

function cohortStyle(v) {
  if (v === null || v === undefined) return { background: '#F4F6FA', color: '#5B6577' };
  if (v >= 60) return { background: 'var(--accent)', color: '#FFFFFF' };
  if (v >= 45) return { background: '#9DB0DB', color: '#151B26' };
  return { background: '#D2DAEE', color: '#151B26' };
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
              <Card title="Funnel: Gewohnheiten-Onboarding" aside={`letzte ${f.days} Tage · Nutzer je Schritt`} className="grow3">
                {f.onboarding.map((s, i) => {
                  const prev = i === 0 ? s.count : f.onboarding[i - 1].count;
                  const lost = Math.max(prev - s.count, 0);
                  return (
                    <div key={s.label} className="funnel-step">
                      <div className="funnel-head">
                        <b>{s.label}</b>
                        <span><b>{nf.format(s.count)}</b> <span className="muted">({Math.round((s.count / first) * 100)} %)</span></span>
                      </div>
                      <div className="funnel-bar"><span style={{ width: `${(s.count / first) * 100}%` }} /></div>
                      <div className="funnel-drop">
                        {i > 0 && lost > 0 ? `↓ ${nf.format(lost)} sind hier abgesprungen (${Math.round((lost / Math.max(prev, 1)) * 100)} %)` : ' '}
                      </div>
                    </div>
                  );
                })}
                <div className="hint">
                  {nf.format(f.skipped)} Nutzer haben das Onboarding übersprungen. Ein Nutzer zählt je Schritt höchstens einmal.
                </div>
              </Card>

              <Card title="Abbruch bei Formularen" aside="geöffnet, aber nicht gespeichert" className="grow2">
                <div className="table-scroll">
                  <table>
                    <thead><tr><th>Formular</th><th>Geöffnet</th><th>Gespeichert</th><th>Abbruch</th></tr></thead>
                    <tbody>
                      {f.forms.map((r) => {
                        const rate = r.opened ? Math.max(0, Math.round(((r.opened - r.saved) / r.opened) * 100)) : null;
                        return (
                          <tr key={r.name}>
                            <td><b>{r.name}</b></td>
                            <td>{nf.format(r.opened)}</td>
                            <td>{nf.format(r.saved)}</td>
                            <td className={rate !== null && rate >= 30 ? 'down strong' : 'up strong'}>{rate === null ? '–' : `${rate} %`}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <div className="hint">Rot ab 30 % Abbruch. Gezählt werden Ereignisse, nicht Nutzer; Speichern kann auch Bearbeiten sein.</div>
              </Card>
            </div>

            <Card title="Retention nach Anmelde-Woche" aside="Anteil der Kohorte, der in Woche N wieder aktiv war">
              <div className="table-scroll">
                <div className="cohorts">
                  <div className="cohort-row head">
                    <span>Kohorte</span><span>Nutzer</span>
                    {[0, 1, 2, 3, 4].map((k) => <span key={k}>Woche {k}</span>)}
                  </div>
                  {f.cohorts.map((c) => (
                    <div key={c.cohort} className="cohort-row">
                      <b>ab {new Date(c.cohort).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' })}</b>
                      <span>{nf.format(c.size)}</span>
                      {c.weeks.map((v, k) => (
                        <span key={k} className="cohort-cell" style={cohortStyle(v)}>{v === null ? '–' : `${v} %`}</span>
                      ))}
                    </div>
                  ))}
                </div>
              </div>
              <div className="hint">Kohorte = Woche der ersten erfassten Aktivität. Die Tabelle füllt sich erst mit den Tagen, an denen die tägliche Verdichtung gelaufen ist.</div>
            </Card>
          </>
        );
      }}
    </State>
  );
}
