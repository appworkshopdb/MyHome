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
      <form className="auth-card" onSubmit={submit}>
        <div>
          <h1>Zuhause</h1>
          <div className="sub">{mode === 'signin' ? 'Melde dich an' : 'Konto anlegen'}</div>
        </div>

        {!supabaseConfigured && (
          <div className="auth-msg warn">
            Supabase ist nicht korrekt konfiguriert. Prüfe die <code>.env</code>-Datei
            im Projektordner (Details in der Browser-Konsole, F12 → „Console").
          </div>
        )}

        <div className="form-group">
          <label>E-Mail</label>
          <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>

        <div className="form-group">
          <label>Passwort</label>
          <input type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>

        {status && <div className={`auth-msg ${status.type}`}>{status.text}</div>}

        <button type="submit" className="btn btn-primary btn-block" disabled={busy || !supabaseConfigured}>
          {busy ? 'Bitte warten…' : mode === 'signin' ? 'Anmelden' : 'Konto erstellen'}
        </button>

        <button type="button" className="link-btn" onClick={() => setMode(mode === 'signin' ? 'signup' : 'signin')}>
          {mode === 'signin' ? 'Noch kein Konto? Registrieren' : 'Schon ein Konto? Anmelden'}
        </button>
      </form>
    </div>
  );
}
