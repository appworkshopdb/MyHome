import { useEffect, useState } from 'react';
import { supabaseConfigured } from '../lib/supabaseClient';
import * as rawAuth from '../lib/rawAuth';
import { useAuth } from '../lib/AuthContext';
import EnvelopeArt from './EnvelopeArt';

const RESEND_COOLDOWN_S = 60;

export default function Login() {
  const { setSession, authNotice, clearAuthNotice } = useAuth();
  const [mode, setMode] = useState('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [status, setStatus] = useState(null);
  const [busy, setBusy] = useState(false);
  // Gesetzt, sobald die Registrierung eine Bestätigungsmail ausgelöst hat
  // (oder ein Login an „E-Mail nicht bestätigt“ scheitert) → Warte-Ansicht.
  const [awaitingConfirm, setAwaitingConfirm] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return undefined;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  function showConfirmation() {
    setAwaitingConfirm(true);
    setStatus(null);
    setCooldown(RESEND_COOLDOWN_S);
  }

  async function resend() {
    setBusy(true);
    setStatus(null);
    try {
      await rawAuth.resendConfirmation(email);
      setStatus({ type: 'ok', text: 'Mail erneut gesendet.' });
      setCooldown(RESEND_COOLDOWN_S);
    } catch (err) {
      setStatus({ type: 'error', text: err.message });
    } finally {
      setBusy(false);
    }
  }

  // „Ich habe bestätigt“ — Link evtl. auf einem anderen Gerät geöffnet,
  // daher mit den noch im Formular stehenden Zugangsdaten anmelden.
  async function checkConfirmed() {
    setBusy(true);
    setStatus(null);
    try {
      setSession(await rawAuth.signInWithPassword(email, password));
    } catch (err) {
      setStatus({
        type: 'error',
        text: err.code === 'email_not_confirmed' ? 'Noch nicht bestätigt — bitte den Link in der Mail öffnen.' : err.message,
      });
    } finally {
      setBusy(false);
    }
  }

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setStatus(null);
    clearAuthNotice();
    try {
      if (mode === 'signin') {
        setSession(await rawAuth.signInWithPassword(email, password));
      } else {
        const data = await rawAuth.signUp(email, password);
        if (data.access_token) setSession(data); // Bestätigung serverseitig aus
        else showConfirmation();
      }
    } catch (err) {
      if (err.code === 'email_not_confirmed') showConfirmation();
      else setStatus({ type: 'error', text: err.message });
    } finally {
      setBusy(false);
    }
  }

  if (awaitingConfirm) {
    return (
      <div className="cf">
        <header className="onb-top">
          <span className="onb-wordmark">NESTUA</span>
          <span className="onb-count">Konto bestätigen</span>
        </header>

        <div className="onb-hero cf-hero"><EnvelopeArt height={186} /></div>

        <main className="onb-main">
          <h1 className="onb-title">Fast geschafft.</h1>
          <p className="onb-lead">
            Wir haben dir eine Mail an <strong>{email}</strong> geschickt. Tipp auf den Link darin,
            dann richten wir dein Nest ein. Das dauert nur eine Minute.
          </p>
          <p className="wiz-info" role="note">Nichts angekommen? Schau im Spam-Ordner nach.</p>
          {status && <div className={`auth-msg ${status.type}`} style={{ marginTop: 12 }}>{status.text}</div>}
        </main>

        <div className="cf-actions">
          <button type="button" className="btn btn-primary" disabled={busy} onClick={checkConfirmed}>
            {busy ? 'Bitte warten…' : 'Ich habe bestätigt'}
          </button>
          <button type="button" className="btn btn-secondary" disabled={busy || cooldown > 0} onClick={resend}>
            {cooldown > 0 ? `Mail erneut senden (${cooldown} s)` : 'Mail erneut senden'}
          </button>
          <button type="button" className="btn onb-ghost" onClick={() => { setAwaitingConfirm(false); setStatus(null); setMode('signup'); }}>
            Andere E-Mail verwenden
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-screen">
      <div className="auth-wordmark">NESTUA</div>

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

        {authNotice && <div className="auth-msg warn">{authNotice}</div>}
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
