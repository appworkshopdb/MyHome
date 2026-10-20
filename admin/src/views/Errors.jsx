import { Card, State, useRpc, dateTimeOf, nf } from '../ui';

export default function Errors({ days }) {
  const state = useRpc('analytics_errors', { p_days: days });

  return (
    <Card title="JavaScript-Fehler" aside={`letzte ${days} Tage · gruppiert nach Meldung`}>
      <State state={state}>
        {(rows) => (
          <div className="table-scroll">
            <table>
              <thead><tr><th>Meldung</th><th>Datei</th><th>Anzahl</th><th>Nutzer</th><th>Zuletzt</th><th>Version</th></tr></thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i}>
                    <td className="wrap"><b>{r.message || '(ohne Text)'}</b></td>
                    <td>{r.file || '–'}</td>
                    <td>{nf.format(r.count)}</td>
                    <td>{nf.format(r.users)}</td>
                    <td>{dateTimeOf(r.last)}</td>
                    <td>{r.version || '–'}</td>
                  </tr>
                ))}
                {!rows.length && <tr><td colSpan="6" className="muted">Keine Fehler im Zeitraum.</td></tr>}
              </tbody>
            </table>
          </div>
        )}
      </State>
    </Card>
  );
}
