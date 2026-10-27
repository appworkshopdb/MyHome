import { useEffect, useState, useSyncExternalStore } from 'react';
import { configured, configInfo, getSession, subscribe, signIn, signOut, rpc } from './api';
import { Icon, RangeControl } from './ui';
import Overview from './views/Overview';
import Funnels from './views/Funnels';
import Users from './views/Users';
import Errors from './views/Errors';

const TABS = [
  { id: 'overview', label: 'Übersicht', short: 'Übersicht', icon: 'grid', View: Overview, ranged: true, sub: 'stand' },
  { id: 'funnels', label: 'Funnels & Abbruch', short: 'Funnels', icon: 'funnel', View: Funnels, ranged: true, sub: 'Wo Nutzer abspringen' },
  { id: 'users', label: 'Nutzer', short: 'Nutzer', icon: 'users', View: Users, ranged: false, sub: 'Pseudonym über UUID · keine E-Mail-Adressen' },
  { id: 'errors', label: 'Fehler', short: 'Fehler', icon: 'alert', View: Errors, ranged: true, sub: 'JavaScript-Fehler aus der App' },
];

// Adresse: #/<tab>[/<param>], z.B. #/users/<uuid>
function readRoute() {
  const [id, param] = window.location.hash.replace(/^#\/?/, '').split('/');
  return { tab: TABS.find((t) => t.id === id) || TABS[0], param: param || null };
}

function useRoute() {
  const [route, setRoute] = useState(readRoute);
  useEffect(() => {
    const on = () => setRoute(readRoute());
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return route;
}

function standText() {
  const now = new Date().toLocaleString('de-DE', { timeZone: 'Europe/Berlin', dateStyle: 'medium', timeStyle: 'short' });
  return `Stand ${now} · nur Nutzer mit Einwilligung`;
}

function Brand({ light = false }) {
  return (
    <div className={`brand${light ? ' brand-light' : ''}`}>
      <span className="brand-name">NESTUA</span><span className="brand-sub">Analytics</span>
    </div>
  );
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
      <form className="login-card" onSubmit={submit}>
        <Brand />
        <p className="muted">Interner Zugang. Anmeldung mit deinem Nestua-Konto, das als Admin freigeschaltet ist.</p>
        {!configured && (
          <div className="note error">
            Supabase-Einstellungen im Build fehlen oder sind ungültig. Adresse: {configInfo.url} · Key: {configInfo.hasKey ? 'vorhanden' : 'fehlt'}.
            Erwartet: https://dein-projekt.supabase.co oder deine eigene Domain, ohne Pfad.
          </div>
        )}
        <label className="label" htmlFor="email">E-Mail</label>
        <input id="email" type="email" required autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} />
        <label className="label" htmlFor="password">Passwort</label>
        <input id="password" type="password" required autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
        {error && <div className="note error" role="alert">{error}</div>}
        <button className="btn primary block" disabled={busy || !configured}>{busy ? 'Bitte warten…' : 'Anmelden'}</button>
      </form>
    </main>
  );
}

function Denied() {
  return (
    <main className="login">
      <div className="login-card">
        <Brand />
        <div className="note error" role="alert">Dieses Konto hat keinen Zugriff auf die Analyse.</div>
        <button className="btn block" onClick={signOut}>Abmelden</button>
      </div>
    </main>
  );
}

function Dashboard() {
  const { tab, param } = useRoute();
  const [days, setDays] = useState(30);
  const [menu, setMenu] = useState(false);

  return (
    <div className="layout">
      <aside className="sidebar">
        <Brand light />
        <nav aria-label="Bereiche">
          {TABS.map((t) => (
            <a key={t.id} href={`#/${t.id}`} className={t.id === tab.id ? 'active' : ''} aria-current={t.id === tab.id ? 'page' : undefined}>
              <Icon name={t.icon} />{t.label}
            </a>
          ))}
        </nav>
        <div className="sidebar-foot">
          <span className="avatar avatar-dark">T</span>
          <span className="sidebar-user"><b>Admin</b><button type="button" onClick={signOut}>Abmelden</button></span>
        </div>
      </aside>

      <div className="main">
        <div className="topbar">
          <Brand />
          <div className="menu-wrap">
            <button type="button" className="avatar avatar-btn" aria-label="Konto" aria-expanded={menu} onClick={() => setMenu((m) => !m)}>T</button>
            {menu && <div className="menu"><button type="button" onClick={signOut}>Abmelden</button></div>}
          </div>
        </div>

        <header className="page-head">
          <div>
            <h1>{tab.label}</h1>
            <div className="page-sub">{tab.sub === 'stand' ? standText() : tab.sub}</div>
          </div>
          {tab.ranged && <RangeControl days={days} onChange={setDays} />}
        </header>

        <main className="content"><tab.View days={days} param={param} /></main>
      </div>

      <nav className="tabbar" aria-label="Bereiche">
        {TABS.map((t) => (
          <a key={t.id} href={`#/${t.id}`} className={t.id === tab.id ? 'active' : ''} aria-current={t.id === tab.id ? 'page' : undefined}>
            <Icon name={t.icon} size={22} />{t.short}
          </a>
        ))}
      </nav>
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
