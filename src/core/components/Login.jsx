import { useState } from 'react';
import { supabaseConfigured } from '../lib/supabaseClient';
import * as rawAuth from '../lib/rawAuth';
import { useAuth } from '../lib/AuthContext';

export default function Login() {
  const { setSession } = useAuth();
  const [mode, setMode] = useState('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [status, setStatus] = useState(null);
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setStatus(null);
    try {
      if (mode === 'signin') {
        setSession(await rawAuth.signInWithPassword(email, password));
      } else {
        const data = await rawAuth.signUp(email, password);
        if (data.access_token) setSession(data);
        else setStatus({ type: 'ok', text: 'Konto erstellt — je nach Einstellung ggf. E-Mail bestätigen, dann einloggen.' });
      }
    } catch (err) {
      setStatus({ type: 'error', text: err.message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-screen">
      <div className="auth-wordmark">ZUHAUSE</div>

      <form className="auth-card" onSubmit={submit}>
        <div>
          <h1>
            {(mode === 'signin'
              ? ['Dein Leben,', 'in Zahlen die', 'dir gehören.']
              : ['Neu hier?', 'Ein Konto für', 'alles.']
            ).map((line, i, arr) => (
              <span key={i}>
                {line}
                {i < arr.length - 1 && <br />}
              </span>
            ))}
          </h1>
          <div className="sub">
            {mode === 'signin'
              ? 'Geld, Sport, Ernährung, Gewohnheiten — ein Konto, sechs Module, alles auf jedem Gerät.'
              : 'Ein Konto, alle Module. Kein zusätzliches Passwort pro Bereich.'}
          </div>
        </div>

        {!supabaseConfigured && (
          <div className="auth-msg warn">
            Supabase ist nicht korrekt konfiguriert. Prüfe die <code>.env</code>-Datei
            im Projektordner (Details in der Browser-Konsole, F12 → „Console").
          </div>
        )}

        <div className="auth-field">
          <label>E-Mail</label>
          <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>

        <div className="auth-field">
          <label>Passwort</label>
          <input type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>

        {status && <div className={`auth-msg ${status.type}`}>{status.text}</div>}

        <div className="auth-actions">
          <button type="submit" className="btn btn-primary btn-block" disabled={busy || !supabaseConfigured}>
            {busy ? 'Bitte warten…' : mode === 'signin' ? 'Anmelden' : 'Konto erstellen'}
          </button>

          <button type="button" className="btn btn-outline-block" onClick={() => setMode(mode === 'signin' ? 'signup' : 'signin')}>
            {mode === 'signin' ? 'Konto erstellen' : 'Schon ein Konto? Anmelden'}
          </button>
        </div>

        <div className="auth-footnote">Server in Frankfurt. Keine Werbung, keine Weitergabe.</div>
      </form>
    </div>
  );
}
