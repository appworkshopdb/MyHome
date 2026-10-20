import { useState } from 'react';
import {
  Card, Bar, State, Icon, useRpc, areaName, screenLabel, shortId, initials, timeOf, dateTimeOf, dateOf, nf, UUID_RE,
  isOnline, ago,
} from '../ui';

const LIVE_REFRESH_MS = 30_000;

// Live-Status: grüner Punkt + aktueller Bildschirm, sonst "zuletzt vor …".
function Status({ lastSeen, screen }) {
  const on = isOnline(lastSeen);
  return (
    <span className={`status ${on ? 'on' : 'off'}`}>
      <i />{on ? `online${screen ? ` · ${screen}` : ''}` : `zuletzt ${ago(lastSeen)}`}
    </span>
  );
}

const FILTERS = [
  ['all', 'Alle'],
  ['online', 'Online'],
  ['today', 'Heute aktiv'],
  ['app', 'App'],
  ['browser', 'Browser'],
];

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
    case 'consent_granted': return { title: 'Einwilligung erteilt', detail: 'consent_granted' };
    case 'heartbeat': return { title: `Aktivität: ${Number(e.props?.clicks) || 0} Klicks`, detail: 'heartbeat' };
    case 'js_error': return { title: 'js_error', detail: `${e.props?.message ?? ''} · ${e.props?.file ?? ''}:${e.props?.line ?? ''}` };
    default: return { title: e.name, detail: screenLabel(e.module, e.view) };
  }
}

function Detail({ userId }) {
  const state = useRpc('analytics_user', { p_user: userId }, LIVE_REFRESH_MS);
  const [copied, setCopied] = useState(false);

  function copyId() {
    navigator.clipboard?.writeText(userId).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }).catch(() => {});
  }

  return (
    <State state={state}>
      {(u) => {
        const s = u.stats;
        const acc = u.account;
        const maxMin = Math.max(1, ...u.areas.map((a) => a.minutes));
        const first = u.events[0], last = u.events[u.events.length - 1];
        const lastScreen = [...u.events].reverse().find((e) => e.module);
        // Ältere Datenbankfunktion (vor Migration 103): Feld "account" fehlt ganz.
        const accountMissing = !('account' in u);
        const usage = 'uses_app' in s
          ? (s.uses_app && s.uses_browser ? 'App und Browser' : s.uses_app ? 'App (installiert)' : 'Browser')
          : (s.standalone ? 'App (installiert)' : 'Browser');
        const NA = 'nicht verfügbar';
        const stats = [
          ['Registriert am', accountMissing ? NA : acc ? dateOf(acc.created_at) : '–'],
          ['Letzter Login', accountMissing ? NA : acc?.last_sign_in_at ? dateTimeOf(acc.last_sign_in_at) : '–'],
          ['E-Mail bestätigt', accountMissing ? NA : acc ? (acc.email_confirmed ? 'Ja' : 'Nein') : '–'],
          ['Nutzung', usage],
          ['App-Version', s.app_version || '–'],
          ['Sitzungen', nf.format(s.sessions)],
          ['Aktive Minuten', nf.format(s.minutes)],
          ['Klicks gesamt', nf.format(s.clicks)],
          ['Letzter Besuch', dateTimeOf(s.last_seen)],
        ];
        return (
          <>
            <section className="card detail-hero">
              <a href="#/users" className="back-link"><Icon name="back" size={18} />Nutzer</a>
              <div className="detail-id">
                <div className="avatar avatar-lg">{initials(u.user_id)}</div>
                <div>
                  <h2>{shortId(u.user_id)}</h2>
                  <Status lastSeen={s.last_seen} screen={lastScreen ? screenLabel(lastScreen.module, lastScreen.view) : null} />
                  <div className="detail-sub">{s.consent_at ? `Einwilligung am ${dateOf(s.consent_at)}` : `erste Daten ${dateTimeOf(s.first_seen)}`}</div>
                </div>
              </div>
              <div className="uuid-row">
                <span className="uuid-label">UUID (Supabase → Authentication → Users)</span>
                <code>{u.user_id}</code>
                <button type="button" className="btn" onClick={copyId}>{copied ? 'Kopiert' : 'UUID kopieren'}</button>
              </div>
            </section>

            {accountMissing && (
              <div className="note error" role="alert">
                Konto-Daten und App-/Browser-Nutzung fehlen: In der Datenbank läuft noch die alte Funktion analytics_user().
                Migration 103 (supabase/migrations/103_analytics_user_profile.sql) im Staging-Backend ausführen.
              </div>
            )}
            <div className="stat-grid">
              {stats.map(([label, value]) => (
                <div key={label} className={`stat${value === NA ? ' stat-na' : ''}`}><span>{label}</span><b>{value}</b></div>
              ))}
            </div>

            <div className="row top">
              <Card title="Letzte Sitzung" aside={first ? `${dateTimeOf(first.ts)} – ${timeOf(last.ts)}` : ''} className="grow2">
                {u.events.map((e, i) => {
                  const k = kindOf(e.name), d = describe(e);
                  return (
                    <div key={i} className="event">
                      <span className="event-time">{timeOf(e.ts)}</span>
                      <span className={`event-dot ${k}`} title={KIND_LABEL[k]} />
                      <span className="event-text"><b>{d.title}</b><span className="event-detail">{d.detail}</span></span>
                    </div>
                  );
                })}
                <div className="legend">
                  {Object.entries(KIND_LABEL).map(([k, l]) => <span key={k}><i className={`event-dot ${k}`} /> {l}</span>)}
                </div>
              </Card>
              <Card title="Zeit pro Bereich" aside="aktive Minuten" className="grow1">
                {u.areas.map((a) => (
                  <div key={a.module} className="meter">
                    <div className="meter-head"><span>{areaName(a.module)}</span><span className="muted">{a.minutes} Min.</span></div>
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

export default function Users({ param }) {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const list = useRpc('analytics_users', { p_search: search || null, p_limit: 50 }, LIVE_REFRESH_MS);
  const selected = param && UUID_RE.test(param) ? param : null;
  const today = dateOf(new Date().toISOString());

  const match = (u) => (
    filter === 'all'
    || (filter === 'online' && isOnline(u.last_seen))
    || (filter === 'today' && dateOf(u.last_seen) === today)
    || (filter === 'app' && u.standalone)
    || (filter === 'browser' && !u.standalone)
  );

  return (
    <div className={`users${selected ? ' has-detail' : ''}`}>
      <div className="users-list">
        <div className="field">
          <label htmlFor="usersearch" className="label">Nutzer suchen</label>
          <input id="usersearch" type="text" value={search} placeholder="Kennung oder UUID" autoComplete="off"
                 onChange={(e) => setSearch(e.target.value)} />
          <div className="hint tight">Gesucht wird nach dem Anfang der UUID. E-Mail-Adressen zeigt das Dashboard nicht. Online = Aktivität in den letzten 3 Minuten, Aktualisierung alle 30 s.</div>
        </div>

        <div className="chips" role="group" aria-label="Filter">
          {FILTERS.map(([id, label]) => (
            <button key={id} type="button" className={filter === id ? 'active' : ''} aria-pressed={filter === id} onClick={() => setFilter(id)}>{label}</button>
          ))}
        </div>

        <State state={list}>
          {(users) => {
            const shown = users.filter(match);
            return (
              <>
                {shown.map((u) => (
                  <a key={u.user_id} href={`#/users/${u.user_id}`} className={`user-item${selected === u.user_id ? ' active' : ''}`}>
                    <span className="avatar-wrap">
                      <span className="avatar">{initials(u.user_id)}</span>
                      <i className={`live-dot ${isOnline(u.last_seen) ? 'on' : ''}`} aria-hidden="true" />
                    </span>
                    <span className="user-main">
                      <span className="user-top"><b>{shortId(u.user_id)}</b><span className={`chip-tag ${u.standalone ? 'tag-app' : 'tag-browser'}`}>{u.standalone ? 'App' : 'Browser'}</span></span>
                      <span className="uuid-small">{u.user_id}</span>
                      <Status lastSeen={u.last_seen} screen={u.last_module ? screenLabel(u.last_module, u.last_view) : null} />
                      <span className="muted small">{u.sessions} {u.sessions === 1 ? 'Sitzung' : 'Sitzungen'}</span>
                    </span>
                    <span className="chev"><Icon name="chevron" size={18} /></span>
                  </a>
                ))}
                {!shown.length && <div className="note">Keine Nutzer gefunden.</div>}
              </>
            );
          }}
        </State>
      </div>

      <div className="users-detail">
        {selected ? <Detail userId={selected} key={selected} /> : <Card><div className="note">Links einen Nutzer auswählen.</div></Card>}
      </div>
    </div>
  );
}
