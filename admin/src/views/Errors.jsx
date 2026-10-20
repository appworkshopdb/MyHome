import { Card, State, useRpc, dateTimeOf, nf } from '../ui';

export default function Errors({ days }) {
  const state = useRpc('analytics_errors', { p_days: days });

  return (
    <Card title="JavaScript-Fehler" aside={`letzte ${days} Tage · gruppiert nach Meldung`}>
      <State state={state}>
        {(rows) => (
          <>
            {rows.map((r, i) => (
              <div key={i} className="error-item">
                <div className="error-msg">{r.message || '(ohne Text)'}</div>
                <div className="error-meta">
                  <span className="pill down">{nf.format(r.count)}×</span>
                  <span>{nf.format(r.users)} Nutzer</span>
                  <span>{r.file || '–'}</span>
                  <span>zuletzt {dateTimeOf(r.last)}</span>
                  <span>Version {r.version || '–'}</span>
                </div>
              </div>
            ))}
            {!rows.length && <div className="note">Keine Fehler im Zeitraum.</div>}
          </>
        )}
      </State>
    </Card>
  );
}
