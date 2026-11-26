import { useEffect, useState } from 'react';
import { useAuth } from './lib/AuthContext';
import { useUi } from './lib/UiContext';
import { MODES } from './lib/theme';
import { isSoundEnabled, isHapticEnabled, setSoundEnabled, setHapticEnabled, fb } from './lib/feedback';
import {
  isPushSupported, getPushSubscriptionStatus, subscribeToPush, unsubscribeFromPush, blockedHelp,
  getNotificationPrefs, saveNotificationPrefs,
} from './lib/pushNotifications';
import {
  getGoogleCalendarStatus, connectGoogleCalendar, syncGoogleCalendar, disconnectGoogleCalendar,
} from './lib/googleCalendar';
import { ago } from './lib/calendarUtils';
import { setConsent, track } from './lib/analytics';
import { useAnalyticsConsent } from './lib/useAnalyticsConsent';
import { Skeleton, Segmented, Switch, Button } from './components/ui';

const NOTIFICATION_CATEGORIES = [
  { key: 'daily_plan', label: 'Tagesplan', hint: 'Morgens um 6 Uhr' },
  { key: 'tasks_habits', label: 'Aufgaben & Gewohnheiten', hint: 'Abends, wenn etwas offen ist' },
  { key: 'finance', label: 'Finanzen', hint: 'Fällige und offene Zahlungen' },
  { key: 'profile', label: 'Profil & Fortschritt', hint: 'Wenn Angaben fehlen' },
  { key: 'weekly_recap', label: 'Wochenüberblick', hint: 'Montags: Rückblick' },
  { key: 'monthly_recap', label: 'Monatsüberblick', hint: 'Am 1.: Rückblick' },
];

function NotifToggle({ checked, onChange, label, hint }) {
  return (
    <Switch checked={checked} onChange={() => onChange()}>
      <span className="am-sw"><b>{label}</b><small>{hint}</small></span>
    </Switch>
  );
}

export default function AppMenu() {
  const { session } = useAuth();
  const { mode, setMode, showToast } = useUi();
  const [sound, setSound] = useState(isSoundEnabled());
  const [haptik, setHaptik] = useState(isHapticEnabled());
  const [pushStatus, setPushStatus] = useState('laedt');
  const [pushBusy, setPushBusy] = useState(false);
  const [pushError, setPushError] = useState(null); // bleibt unter dem Knopf stehen (ein Hinweis-Toast ist zu flüchtig)
  const [prefs, setPrefs] = useState(null);
  const [gcalStatus, setGcalStatus] = useState('laedt');
  const [gcalConnection, setGcalConnection] = useState(null);
  const [gcalBusy, setGcalBusy] = useState(false);
  const analyticsConsent = useAnalyticsConsent();

  useEffect(() => {
    let aktiv = true;
    async function loadPush() {
      if (!isPushSupported()) { setPushStatus('unsupported'); return; }
      const status = await getPushSubscriptionStatus(session);
      if (!aktiv) return;
      setPushStatus(status);
      if (status === 'subscribed') { const p = await getNotificationPrefs(session); if (aktiv) setPrefs(p); }
    }
    async function loadGcal() {
      try {
        const conn = await getGoogleCalendarStatus(session);
        if (!aktiv) return;
        setGcalConnection(conn);
        setGcalStatus(conn ? 'verbunden' : 'nicht-verbunden');
      } catch (e) { console.error(e); if (aktiv) setGcalStatus('nicht-verbunden'); }
    }
    loadPush(); loadGcal();
    return () => { aktiv = false; };
  }, [session]);

  async function handleEnablePush() {
    setPushBusy(true);
    setPushError(null);
    try { await subscribeToPush(session); setPushStatus('subscribed'); setPrefs(await getNotificationPrefs(session)); track('push_enabled'); showToast('Benachrichtigungen aktiviert'); }
    catch (e) { setPushError(e.message || 'Konnte nicht aktiviert werden'); showToast(e.message || 'Konnte nicht aktiviert werden'); setPushStatus(await getPushSubscriptionStatus(session)); }
    finally { setPushBusy(false); }
  }
  async function handleDisablePush() {
    setPushBusy(true);
    try { await unsubscribeFromPush(session); setPushStatus('unsubscribed'); showToast('Benachrichtigungen deaktiviert'); }
    catch (e) { showToast('Konnte nicht deaktiviert werden'); console.error(e); }
    finally { setPushBusy(false); }
  }
  async function toggleCategory(key) {
    const next = { ...prefs, [key]: !prefs[key] }; setPrefs(next);
    try { await saveNotificationPrefs(session, next); } catch (e) { setPrefs(prefs); showToast('Konnte nicht gespeichert werden'); console.error(e); }
  }
  async function handleConnectGoogle() {
    setGcalBusy(true);
    try { await connectGoogleCalendar(session); }
    catch (e) { showToast(e.message || 'Verbindung konnte nicht gestartet werden'); setGcalBusy(false); }
  }
  async function handleSyncGoogle() {
    setGcalBusy(true);
    try {
      const result = await syncGoogleCalendar(session);
      const count = result?.results?.[0]?.count ?? 0;
      const revoked = result?.results?.[0]?.status === 'revoked';
      if (revoked) {
        const conn = await getGoogleCalendarStatus(session);
        setGcalConnection(conn);
        showToast('Google-Zugriff wurde widerrufen');
      } else {
        const conn = await getGoogleCalendarStatus(session);
        setGcalConnection(conn);
        showToast(`${count} Google-Termine synchronisiert`);
      }
    } catch (e) { showToast(e.message || 'Synchronisierung fehlgeschlagen'); }
    finally { setGcalBusy(false); }
  }
  async function handleDisconnectGoogle() {
    setGcalBusy(true);
    try { await disconnectGoogleCalendar(session); setGcalConnection(null); setGcalStatus('nicht-verbunden'); showToast('Google Kalender getrennt'); }
    catch (e) { showToast('Trennen fehlgeschlagen'); console.error(e); }
    finally { setGcalBusy(false); }
  }

  return (
    <div className="app-menu">
      <div className="app-menu-heading">Einstellungen</div>

      <section className="am-sec">
        <h3 className="app-menu-section-label">Design</h3>
        <Segmented label="Design" options={MODES.map((m) => ({ value: m.key, label: m.label }))} value={mode} onChange={setMode} />
      </section>

      <section className="am-sec">
        <h3 className="app-menu-section-label">Rückmeldung</h3>
        <NotifToggle checked={sound} label="Töne" hint="Beim Abhaken und Drehen"
          onChange={() => { const v = !sound; setSound(v); setSoundEnabled(v); if (v) fb.todoCheck(); }} />
        <NotifToggle checked={haptik} label="Haptik" hint="Spürbar beim Drehen"
          onChange={() => { const v = !haptik; setHaptik(v); setHapticEnabled(v); if (v) fb.tick(); }} />
      </section>

      <section className="am-sec">
        <h3 className="app-menu-section-label">Kalender</h3>
        {gcalStatus === 'laedt' && <Skeleton w="60%" h={14} />}
        {gcalStatus === 'nicht-verbunden' && <>
          <p className="am-note">Google-Termine im Kalender anzeigen.</p>
          <Button variant="secondary" block loading={gcalBusy} onClick={handleConnectGoogle}>Verbinden</Button>
        </>}
        {gcalStatus === 'verbunden' && gcalConnection && <>
          <p className="am-note">Verbunden mit <strong>{gcalConnection.google_email}</strong></p>
          <p className="am-note am-note--mut">
            {gcalConnection.last_synced_at
              ? `Zuletzt ${ago(gcalConnection.last_synced_at)} (${new Date(gcalConnection.last_synced_at).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })} Uhr)`
              : 'Noch nicht synchronisiert'}
          </p>
          {gcalConnection.sync_error && <p className="am-note am-note--err">{gcalConnection.sync_error}</p>}
          <div className="am-btns">
            <Button variant="secondary" block icon="restore" loading={gcalBusy} onClick={handleSyncGoogle}>Synchronisieren</Button>
            <Button variant="text" block disabled={gcalBusy} onClick={handleDisconnectGoogle}>{gcalConnection.sync_error ? 'Erneut verbinden' : 'Trennen'}</Button>
          </div>
        </>}
      </section>

      <section className="am-sec">
        <h3 className="app-menu-section-label">Benachrichtigungen</h3>
        {pushStatus === 'laedt' && <Skeleton w="60%" h={14} />}
        {pushStatus === 'unsupported' && <p className="am-note">Auf diesem Gerät nicht verfügbar. iPhone: erst zum Home-Bildschirm hinzufügen.</p>}
        {pushStatus === 'denied' && <p className="am-note">Blockiert. In den Geräte-Einstellungen freigeben. {blockedHelp()}</p>}
        {pushStatus === 'unsubscribed' && <>
          <p className="am-note">Erinnerungen auch außerhalb der App.</p>
          <Button block loading={pushBusy} onClick={handleEnablePush}>Aktivieren</Button>
          {pushError && <p role="alert" className="am-note am-note--err">{pushError}</p>}
        </>}
        {pushStatus === 'subscribed' && prefs && <>
          {NOTIFICATION_CATEGORIES.map((c) => <NotifToggle key={c.key} checked={!!prefs[c.key]} onChange={() => toggleCategory(c.key)} label={c.label} hint={c.hint} />)}
          <Button variant="text" block disabled={pushBusy} onClick={handleDisablePush}>Deaktivieren</Button>
        </>}
      </section>

      <section className="am-sec">
        <h3 className="app-menu-section-label">Nutzungsdaten</h3>
        <NotifToggle
          checked={analyticsConsent === 'granted'}
          onChange={() => setConsent(analyticsConsent !== 'granted')}
          label="Nutzungsstatistik teilen"
          hint="Nur Bereiche und Fehler, nie Inhalte."
        />
      </section>
    </div>
  );
}
