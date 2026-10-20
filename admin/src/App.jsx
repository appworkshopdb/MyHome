import { useEffect, useState, useSyncExternalStore } from 'react';
import { configured, configInfo, getSession, subscribe, signIn, signOut, rpc } from './api';
import Overview from './views/Overview';
import Funnels from './views/Funnels';
import Users from './views/Users';
import Errors from './views/Errors';

const TABS = [
  { id: 'overview', label: 'Übersicht', View: Overview, ranged: true },
  { id: 'funnels', label: 'Funnels & Abbruch', View: Funnels, ranged: true },
  { id: 'users', label: 'Nutzer', View: Users, ranged: false },
  { id: 'errors', label: 'Fehler', View: Errors, ranged: true },
];
const RANGES = [7, 30, 90];

function useTab() {
  const read = () => TABS.find((t) => t.id === window.location.hash.replace(/^#\/?/, '')) || TABS[0];
  const [tab, setTab] = useState(read);
  useEffect(() => {
    const on = () => setTab(read());
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return tab;
}

function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try { await signIn(email, password); } catch (err) { setError(err.message); } finally { setBusy(false); }
  }

  return (
    <main className="login">
      <form className="card login-card" onSubmit={submit}>
        <div className="brand">NESTUA <span>Analytics</span></div>
        <p className="muted">Interner Zugang. Anmeldung mit deinem Nestua-Konto, das als Admin freigeschaltet ist.</p>
        {!configured && (
          <div className="note error">
            Supabase-Einstellungen im Build fehlen oder sind ungültig. Adresse: {configInfo.url} · Key: {configInfo.hasKey ? 'vorhanden' : 'fehlt'}.
            Erwartet: https://xxxxx.supabase.co
          </div>
        )}
        <label className="label" htmlFor="email">E-Mail</label>
        <input id="email" type="email" required autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} />
        <label className="label" htmlFor="password">Passwort</label>
        <input id="password" type="password" required autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
        {error && <div className="note error" role="alert">{error}</div>}
        <button className="btn primary" disabled={busy || !configured}>{busy ? 'Bitte warten…' : 'Anmelden'}</button>
      </form>
    </main>
  );
}

function Denied() {
  return (
    <main className="login">
      <div className="card login-card">
        <div className="brand">NESTUA <span>Analytics</span></div>
        <div className="note error" role="alert">Dieses Konto hat keinen Zugriff auf die Analyse.</div>
        <button className="btn" onClick={signOut}>Abmelden</button>
      </div>
    </main>
  );
}

function Dashboard() {
  const tab = useTab();
  const [days, setDays] = useState(30);

  return (
    <div className="shell">
      <header className="top">
        <div className="brand">NESTUA <span>Analytics</span></div>
        <nav className="tabs" aria-label="Bereiche">
          {TABS.map((t) => (
            <a key={t.id} href={`#/${t.id}`} className={t.id === tab.id ? 'active' : ''} aria-current={t.id === tab.id ? 'page' : undefined}>{t.label}</a>
          ))}
        </nav>
        <div className="top-right">
          {tab.ranged && (
            <div className="range" role="group" aria-label="Zeitraum">
              {RANGES.map((r) => (
                <button key={r} className={r === days ? 'active' : ''} onClick={() => setDays(r)}>{r} Tage</button>
              ))}
            </div>
          )}
          <button className="btn small" onClick={signOut}>Abmelden</button>
        </div>
      </header>
      <main className="content"><tab.View days={days} /></main>
    </div>
  );
}

export default function App() {
  const session = useSyncExternalStore(subscribe, getSession);
  // null = wird geprüft, true/false = Ergebnis der Datenbank
  const [admin, setAdmin] = useState(null);
  const userId = session?.user?.id;

  useEffect(() => {
    if (!userId) { setAdmin(null); return; }
    let alive = true;
    rpc('is_analytics_admin').then((ok) => alive && setAdmin(ok === true)).catch(() => alive && setAdmin(false));
    return () => { alive = false; };
  }, [userId]);

  if (!session) return <Login />;
  if (admin === null) return <div className="note center">Lädt…</div>;
  if (!admin) return <Denied />;
  return <Dashboard />;
}
