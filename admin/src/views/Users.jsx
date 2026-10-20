import { useState } from 'react';
import { Card, Bar, State, useRpc, areaName, screenLabel, shortId, timeOf, dateTimeOf, nf } from '../ui';

function kindOf(name) {
  if (name === 'screen_view') return 'screen';
  if (name === 'js_error') return 'error';
  if (name === 'session_start' || name === 'heartbeat' || name === 'consent_granted') return 'sys';
  return 'click';
}

const KIND_LABEL = { screen: 'Screen', click: 'Aktion', error: 'Fehler', sys: 'System' };

function describe(e) {
  switch (e.name) {
    case 'screen_view': return { title: screenLabel(e.module, e.view), detail: 'screen_view' };
    case 'session_start': return { title: 'Sitzung gestartet', detail: 'session_start' };
    case 'heartbeat': return { title: `Aktivität: ${Number(e.props?.clicks) || 0} Klicks`, detail: 'heartbeat' };
    case 'js_error': return { title: 'js_error', detail: `${e.props?.message ?? ''} · ${e.props?.file ?? ''}:${e.props?.line ?? ''}` };
    default: return { title: e.name, detail: screenLabel(e.module, e.view) };
  }
}

function Detail({ userId }) {
  const state = useRpc('analytics_user', { p_user: userId });
  return (
    <State state={state}>
      {(u) => {
        const s = u.stats;
        const maxMin = Math.max(1, ...u.areas.map((a) => a.minutes));
        const first = u.events[0], last = u.events[u.events.length - 1];
        const stats = [
          ['Sitzungen', nf.format(s.sessions)],
          ['Aktive Minuten', nf.format(s.minutes)],
          ['Klicks gesamt', nf.format(s.clicks)],
          ['Letzter Besuch', dateTimeOf(s.last_seen)],
          ['Gerät', s.standalone ? 'App (installiert)' : 'Browser'],
          ['App-Version', s.app_version || '–'],
        ];
        return (
          <>
            <Card title={shortId(u.user_id)} aside={`erste Daten ${dateTimeOf(s.first_seen)}${s.consent_at ? ` · Einwilligung ${dateTimeOf(s.consent_at)}` : ''}`}>
              <div className="stat-grid">
                {stats.map(([label, value]) => (
                  <div key={label} className="stat"><span>{label}</span><b>{value}</b></div>
                ))}
              </div>
            </Card>
            <div className="row">
              <Card title="Letzte Sitzung" aside={first ? `${dateTimeOf(first.ts)} – ${timeOf(last.ts)}` : ''} className="grow2">
                {u.events.map((e, i) => {
                  const k = kindOf(e.name), d = describe(e);
                  return (
                    <div key={i} className="event">
                      <span className="event-time">{timeOf(e.ts)}</span>
                      <span className={`event-dot ${k}`} title={KIND_LABEL[k]} />
                      <span><b>{d.title}</b><span className="event-detail">{d.detail}</span></span>
                    </div>
                  );
                })}
                <div className="legend">
                  {Object.entries(KIND_LABEL).map(([k, l]) => <span key={k}><i className={`event-dot ${k}`} /> {l}</span>)}
                </div>
              </Card>
              <Card title="Zeit pro Bereich" aside="aktive Minuten, gesamt" className="grow1">
                {u.areas.map((a) => (
                  <div key={a.module} className="live-row">
                    <div className="live-name"><span>{areaName(a.module)}</span><span className="muted">{a.minutes} Min.</span></div>
                    <Bar value={a.minutes} max={maxMin} />
                  </div>
                ))}
                {!u.areas.length && <div className="note">Noch keine aktiven Minuten.</div>}
              </Card>
            </div>
          </>
        );
      }}
    </State>
  );
}

export default function Users() {
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState(null);
  const list = useRpc('analytics_users', { p_search: search || null, p_limit: 50 });

  return (
    <div className="row top">
      <Card className="grow1 users-list">
        <label htmlFor="usersearch" className="label">Nutzer suchen</label>
        <input id="usersearch" type="text" value={search} placeholder="Kennung, z. B. u_7c2e"
               onChange={(e) => setSearch(e.target.value)} />
        <div className="hint">Nutzer erscheinen nur mit pseudonymer Kennung, nicht mit E-Mail.</div>
        <State state={list}>
          {(users) => (
            <>
              {users.map((u) => (
                <button key={u.user_id} className={`user-item${selected === u.user_id ? ' active' : ''}`} onClick={() => setSelected(u.user_id)}>
                  <span>
                    <b>{shortId(u.user_id)}</b>
                    <span className="muted small">zuletzt {dateTimeOf(u.last_seen)} · {u.standalone ? 'App' : 'Browser'}</span>
                  </span>
                  <span className="muted small nowrap">{u.sessions} Sitzungen</span>
                </button>
              ))}
              {!users.length && <div className="note">Keine Nutzer gefunden.</div>}
            </>
          )}
        </State>
      </Card>

      <div className="stack grow3">
        {selected ? <Detail userId={selected} /> : <Card><div className="note">Links einen Nutzer auswählen.</div></Card>}
      </div>
    </div>
  );
}
