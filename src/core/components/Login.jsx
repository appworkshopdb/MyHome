import { useEffect, useState } from 'react';
import { supabaseConfigured } from '../lib/supabaseClient';
import * as rawAuth from '../lib/rawAuth';
import { useAuth } from '../lib/AuthContext';
import EnvelopeArt from './EnvelopeArt';
import AuthHero from './AuthHero';
import { UiIcon } from './ModuleIcons';

// Anmelden / Registrieren / Passwort vergessen — Variante B der Mockups: oben
// der dunkelblaue Bereich mit der Aussage und den sechs Bereichen, darunter das
// weiße Karten-Sheet mit Umschalter „Anmelden | Registrieren“. Danach: bei
// aktiver Bestätigungspflicht die „Fast geschafft“-Seite (awaitingConfirm).
// Styles: styles/onboarding.css (.lg-*).

const RESEND_COOLDOWN_S = 60;

// Die Datenschutzerklärung liegt als statische Seite in public/. Nutzungsbedingungen
// gibt es noch nicht — deshalb steht nur der Hinweis auf die Datenschutzerklärung da
// (keine toten Links, keine erfundenen Rechtstexte).
const PRIVACY_URL = `${import.meta.env.BASE_URL}datenschutz.html`;

const HEAD = {
  signin: {
    title: 'Dein Leben, in Zahlen die dir gehören.',
    sub: 'Geld, Sport, Ernährung, Gewohnheiten — ein Konto, sechs Module, alles auf jedem Gerät.',
  },
  signup: {
    title: 'Neu hier? Ein Konto für alles.',
    sub: 'Ein Konto, alle Module. Kein zusätzliches Passwort pro Bereich.',
  },
  forgot: {
    title: 'Passwort vergessen?',
    sub: 'Kein Problem. Wir schicken dir einen Link, mit dem du ein neues festlegst.',
  },
};

const STEPS = ['E-Mail bestätigen', 'Profil einrichten', 'Vogel wählen'];

export default function Login() {
  const { setSession, authNotice, clearAuthNotice } = useAuth();
  const [mode, setMode] = useState('signin'); // signin | signup | forgot
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [status, setStatus] = useState(null);
  const [busy, setBusy] = useState(false);
  // Gesetzt, sobald die Registrierung eine Bestätigungsmail ausgelöst hat
  // (oder ein Login an „E-Mail nicht bestätigt“ scheitert) → Warte-Ansicht.
  const [awaitingConfirm, setAwaitingConfirm] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [resetSent, setResetSent] = useState(false);

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

  function switchMode(next) {
    setMode(next);
    setStatus(null);
    setResetSent(false);
    clearAuthNotice();
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
      if (mode === 'forgot') {
        await rawAuth.requestPasswordReset(email);
        setResetSent(true);
      } else if (mode === 'signin') {
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
          {status && <div className={`lg-msg ${status.type}`} style={{ marginTop: 12 }}>{status.text}</div>}
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

  const head = HEAD[mode];
  const signup = mode === 'signup';
  const forgot = mode === 'forgot';

  return (
    <div className="lg">
      <AuthHero title={head.title} sub={head.sub} />

      <form className="lg-sheet" onSubmit={submit}>
        {!forgot && (
          <div className="lg-tabs" role="tablist">
            <button type="button" role="tab" aria-selected={!signup} className={!signup ? 'on' : ''} onClick={() => switchMode('signin')}>Anmelden</button>
            <button type="button" role="tab" aria-selected={signup} className={signup ? 'on' : ''} onClick={() => switchMode('signup')}>Registrieren</button>
          </div>
        )}

        {!supabaseConfigured && (
          <div className="lg-msg warn">
            Supabase ist nicht korrekt konfiguriert. Prüfe die <code>.env</code>-Datei
            im Projektordner (Details in der Browser-Konsole, F12 → „Console").
          </div>
        )}

        {forgot && resetSent ? (
          <>
            <div className="lg-msg ok">Wenn ein Konto zu dieser Adresse gehört, ist eine Mail mit dem Link unterwegs. Schau auch im Spam-Ordner nach.</div>
            <button type="button" className="btn btn-primary lg-btn" onClick={() => switchMode('signin')}>Zurück zur Anmeldung</button>
          </>
        ) : (
          <>
            <div className="lg-field">
              <label className="lg-lab" htmlFor="lg-email">E-Mail</label>
              <div className="lg-in">
                <input id="lg-email" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
            </div>

            {!forgot && (
              <div className="lg-field">
                <label className="lg-lab" htmlFor="lg-pw">
                  <span>Passwort{signup && <em> mindestens 6 Zeichen</em>}</span>
                  {!signup && <button type="button" className="lg-textbtn" onClick={() => switchMode('forgot')}>Passwort vergessen?</button>}
                </label>
                <div className="lg-in">
                  <input
                    id="lg-pw" type={showPw ? 'text' : 'password'} required minLength={6}
                    autoComplete={signup ? 'new-password' : 'current-password'}
                    value={password} onChange={(e) => setPassword(e.target.value)}
                  />
                  <button type="button" className="lg-eye" aria-label={showPw ? 'Passwort verbergen' : 'Passwort anzeigen'} aria-pressed={showPw} onClick={() => setShowPw(!showPw)}>
                    <UiIcon name={showPw ? 'eyeoff' : 'eye'} />
                  </button>
                </div>
              </div>
            )}

            {authNotice && <div className="lg-msg warn">{authNotice}</div>}
            {status && <div className={`lg-msg ${status.type}`}>{status.text}</div>}

            <button type="submit" className="btn btn-primary lg-btn" disabled={busy || !supabaseConfigured}>
              {busy ? 'Bitte warten…' : forgot ? 'Link senden' : signup ? 'Konto erstellen' : 'Anmelden'}
            </button>
            {forgot && <button type="button" className="btn onb-ghost" onClick={() => switchMode('signin')}>Zurück zur Anmeldung</button>}
          </>
        )}

        {signup && (
          <>
            <div>
              <span className="lg-lab">So geht’s danach weiter</span>
              <ol className="lg-steps">
                {STEPS.map((s, i) => <li key={s}><b>{i + 1}</b>{s}</li>)}
              </ol>
            </div>
            <p className="lg-legal">
              Wie wir mit deinen Daten umgehen, steht in der <a href={PRIVACY_URL} target="_blank" rel="noopener noreferrer">Datenschutzerklärung</a>.
            </p>
          </>
        )}

        <p className="lg-foot"><UiIcon name="lock" size={14} />Server in Frankfurt. Keine Werbung, keine Weitergabe.</p>
      </form>
    </div>
  );
}
