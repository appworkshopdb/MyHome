// core/components/ResetPassword.jsx
// Neues Passwort festlegen, nachdem die Person den „Passwort vergessen“-Link aus
// der Mail geöffnet hat. Die Sitzung besteht dann schon (rawAuth.consumeAuthRedirect),
// App.jsx zeigt diese Seite, solange AuthContext.recovery gesetzt ist.

import { useState } from 'react';
import { useAuth } from '../lib/AuthContext';
import { useUi } from '../lib/UiContext';
import * as rawAuth from '../lib/rawAuth';
import AuthHero from './AuthHero';
import { UiIcon } from './ModuleIcons';

export default function ResetPassword() {
  const { session, clearRecovery } = useAuth();
  const { showToast } = useUi();
  const [pw1, setPw1] = useState('');
  const [pw2, setPw2] = useState('');
  const [show, setShow] = useState(false);
  const [status, setStatus] = useState(null);
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    if (pw1.length < 6) { setStatus({ type: 'error', text: 'Mindestens 6 Zeichen.' }); return; }
    if (pw1 !== pw2) { setStatus({ type: 'error', text: 'Die Passwörter stimmen nicht überein.' }); return; }
    setBusy(true); setStatus(null);
    try {
      await rawAuth.updatePassword(session, pw1);
      showToast('Neues Passwort gespeichert');
      clearRecovery(); // weiter in die App (bzw. in den Registrierungs-Wizard)
    } catch (err) {
      setStatus({ type: 'error', text: err.message });
      setBusy(false);
    }
  }

  return (
    <div className="lg">
      <AuthHero compact title="Neues Passwort festlegen" sub="Wähle ein Passwort, das du dir merken kannst. Danach bist du gleich wieder drin." />
      <form className="lg-sheet" onSubmit={submit}>
        <div className="lg-field">
          <label className="lg-lab" htmlFor="rp-1"><span>Neues Passwort <em>mindestens 6 Zeichen</em></span></label>
          <div className="lg-in">
            <input id="rp-1" type={show ? 'text' : 'password'} autoComplete="new-password" required minLength={6} value={pw1} onChange={(e) => setPw1(e.target.value)} />
            <button type="button" className="lg-eye" aria-label={show ? 'Passwort verbergen' : 'Passwort anzeigen'} aria-pressed={show} onClick={() => setShow(!show)}>
              <UiIcon name={show ? 'eyeoff' : 'eye'} />
            </button>
          </div>
        </div>
        <div className="lg-field">
          <label className="lg-lab" htmlFor="rp-2">Wiederholen</label>
          <div className="lg-in">
            <input id="rp-2" type={show ? 'text' : 'password'} autoComplete="new-password" required value={pw2} onChange={(e) => setPw2(e.target.value)} />
          </div>
        </div>
        {status && <div className={`lg-msg ${status.type}`}>{status.text}</div>}
        <button type="submit" className="btn btn-primary lg-btn" disabled={busy}>{busy ? 'Speichert…' : 'Passwort speichern'}</button>
      </form>
    </div>
  );
}
