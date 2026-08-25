import { useEffect, useState } from 'react';
import { useAuth } from './lib/AuthContext';
import { useUi } from './lib/UiContext';
import { MODES } from './lib/theme';
import {
  isPushSupported, getPushSubscriptionStatus, subscribeToPush, unsubscribeFromPush,
  getNotificationPrefs, saveNotificationPrefs,
} from './lib/pushNotifications';

const NOTIFICATION_CATEGORIES = [
  { key: 'habits', label: 'Gewohnheiten-Erinnerung', hint: 'Abends, falls noch offen' },
  { key: 'required_data', label: 'Pflichtdaten unvollständig', hint: 'Gelegentlich, falls Angaben fehlen' },
  { key: 'fin_due', label: 'Fixkosten fällig', hint: 'Wenn unbezahlte Fixkosten offen sind' },
  { key: 'weekly_recap', label: 'Wochenrückblick', hint: 'Sonntagabend' },
];

// Konto/Profil (Avatar-Button rechts) und Module (Bottom-Nav) sind hier
// bewusst raus — dieses Dropdown ist für app-weite Einstellungen da:
// Design und Benachrichtigungen. Der rechte Avatar-Bereich (Profile.jsx)
// bleibt dagegen auf Konto/Körperdaten/Ziele beschränkt.
export default function AppMenu() {
  const { session } = useAuth();
  const { mode, setMode, showToast } = useUi();

  const [pushStatus, setPushStatus] = useState('laedt'); // laedt|unsupported|denied|unsubscribed|subscribed
  const [pushBusy, setPushBusy] = useState(false);
  const [prefs, setPrefs] = useState(null);

  useEffect(() => {
    let aktiv = true;
    async function loadPush() {
      if (!isPushSupported()) { setPushStatus('unsupported'); return; }
      const status = await getPushSubscriptionStatus();
      if (!aktiv) return;
      setPushStatus(status);
      if (status === 'subscribed') {
        const p = await getNotificationPrefs(session);
        if (aktiv) setPrefs(p);
      }
    }
    loadPush();
    return () => { aktiv = false; };
  }, [session]);

  async function handleEnablePush() {
    setPushBusy(true);
    try {
      await subscribeToPush(session);
      setPushStatus('subscribed');
      setPrefs(await getNotificationPrefs(session));
      showToast('Benachrichtigungen aktiviert');
    } catch (e) {
      showToast(e.message || 'Konnte nicht aktiviert werden');
      setPushStatus(await getPushSubscriptionStatus());
    } finally {
      setPushBusy(false);
    }
  }

  async function handleDisablePush() {
    setPushBusy(true);
    try {
      await unsubscribeFromPush(session);
      setPushStatus('unsubscribed');
      showToast('Benachrichtigungen deaktiviert');
    } catch (e) {
      showToast('Konnte nicht deaktiviert werden');
      console.error(e);
    } finally {
      setPushBusy(false);
    }
  }

  async function toggleCategory(key) {
    const next = { ...prefs, [key]: !prefs[key] };
    setPrefs(next);
    try {
      await saveNotificationPrefs(session, next);
    } catch (e) {
      showToast('Konnte nicht gespeichert werden');
      console.error(e);
    }
  }

  async function updateTiming(field, value) {
    const next = { ...prefs, [field]: value };
    setPrefs(next);
    try {
      await saveNotificationPrefs(session, next);
    } catch (e) {
      showToast('Konnte nicht gespeichert werden');
      console.error(e);
    }
  }

  return (
    <div className="app-menu">
      <div className="app-menu-heading">Einstellungen</div>

      <div className="app-menu-section-label">Design</div>
      <div className="mode-toggle">
        {MODES.map((m) => (
          <button key={m.key} className={m.key === mode ? 'active' : ''} onClick={() => setMode(m.key)}>
            {m.label}
          </button>
        ))}
      </div>

      <div className="app-menu-section-label" style={{ marginTop: 18 }}>Benachrichtigungen</div>
      {pushStatus === 'laedt' && <div className="status-note">Wird geladen…</div>}
      {pushStatus === 'unsupported' && (
        <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
          Wird auf diesem Gerät/Browser nicht unterstützt. Auf dem iPhone:
          erst über "Zum Home-Bildschirm" installieren, dann von dort aus öffnen.
        </p>
      )}
      {pushStatus === 'denied' && (
        <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
          Wurden blockiert — änderbar in den Browser-/System-Einstellungen für diese Seite.
        </p>
      )}
      {pushStatus === 'unsubscribed' && (
        <>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: 12 }}>
            Erhalte Erinnerungen auch außerhalb der App.
          </p>
          <button className="btn btn-primary" disabled={pushBusy} onClick={handleEnablePush}>
            {pushBusy ? 'Einen Moment…' : 'Benachrichtigungen aktivieren'}
          </button>
        </>
      )}
      {pushStatus === 'subscribed' && prefs && (
        <>
          {NOTIFICATION_CATEGORIES.map((c) => (
            <label key={c.key} className="goal-milestone" style={{ marginBottom: 10, alignItems: 'flex-start' }}>
              <input type="checkbox" checked={!!prefs[c.key]} onChange={() => toggleCategory(c.key)} style={{ marginTop: 2 }} />
              <span>
                {c.label}
                <span style={{ display: 'block', fontSize: '0.72rem', color: 'var(--text-muted)' }}>{c.hint}</span>
              </span>
            </label>
          ))}

          <div style={{ marginTop: 14, paddingTop: 12, borderTop: '1px solid var(--border)' }}>
            <div className="form-group" style={{ marginBottom: 10 }}>
              <label>Wunschstunde</label>
              <select value={prefs.preferred_hour} onChange={(e) => updateTiming('preferred_hour', Number(e.target.value))}>
                {Array.from({ length: 24 }, (_, h) => (
                  <option key={h} value={h}>{String(h).padStart(2, '0')}:00 Uhr</option>
                ))}
              </select>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div className="form-group">
                <label>Ruhezeit von</label>
                <select value={prefs.quiet_start} onChange={(e) => updateTiming('quiet_start', Number(e.target.value))}>
                  {Array.from({ length: 24 }, (_, h) => (
                    <option key={h} value={h}>{String(h).padStart(2, '0')}:00</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>Ruhezeit bis</label>
                <select value={prefs.quiet_end} onChange={(e) => updateTiming('quiet_end', Number(e.target.value))}>
                  {Array.from({ length: 24 }, (_, h) => (
                    <option key={h} value={h}>{String(h).padStart(2, '0')}:00</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <button className="btn btn-secondary" style={{ marginTop: 12 }} disabled={pushBusy} onClick={handleDisablePush}>
            Deaktivieren
          </button>
        </>
      )}
    </div>
  );
}
