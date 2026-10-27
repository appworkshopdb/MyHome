import { getSupabase } from './supabaseClient';

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY;

// V2 — Neue Kategorienamen nach NESTUA-BENACHRICHTIGUNGEN-V1.md.
// preferred_hour / quiet_start / quiet_end entfernt — Zeiten sind
// feste Produktlogik in der Edge Function, nicht vom Nutzer einstellbar.
const DEFAULT_CATEGORIES = {
  daily_plan:   true,
  finance:      true,
  tasks_habits: true,
  profile:      true,
  weekly_recap: true,
  monthly_recap: true,
};

// Das Push-Abo selbst hängt am Gerät/Browser (nicht am Konto). Damit es sich wie
// eine Konto-Einstellung anfühlt, merkt sich dieses Gerät, FÜR WELCHEN Nutzer
// es aktiviert wurde: derselbe Nutzer ist nach Abmelden/Anmelden sofort wieder
// „aktiv“, ein anderer Nutzer auf demselben Gerät startet ohne Push (eigene
// Einwilligung nötig). Beim Abmelden wird nur die Zeile in push_subscriptions
// gelöscht, damit der nächste Nutzer keine fremden Mitteilungen bekommt.
const PUSH_USER_KEY = 'nestua_push_user';

function deviceUser() {
  try { return localStorage.getItem(PUSH_USER_KEY); } catch { return null; }
}
function setDeviceUser(uid) {
  try { if (uid) localStorage.setItem(PUSH_USER_KEY, uid); else localStorage.removeItem(PUSH_USER_KEY); } catch { /* egal */ }
}

function ownerId(session) {
  return session.user.id;
}

// VAPID-Key kommt base64url-kodiert aus der .env, PushManager will aber
// ein Uint8Array — Standard-Konvertierung, siehe MDN Push-API-Doku.
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
}

// Anleitung für den Fall „Benachrichtigungen blockiert“ — die App kann die
// Abfrage dann nicht mehr selbst auslösen, die Person muss sie im Gerät freigeben.
export function blockedHelp() {
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent || '' : '';
  if (/iPhone|iPad|iPod/.test(ua)) {
    return 'iPhone/iPad: Öffne Einstellungen → Mitteilungen → „Nestua“ und erlaube Mitteilungen. Steht die App dort nicht, lösche das Symbol vom Home-Bildschirm und füge die Seite in Safari über „Zum Home-Bildschirm“ erneut hinzu.';
  }
  if (/Android/.test(ua)) {
    return 'Android: Tippe in der Adresszeile auf das Symbol links neben der Adresse → Berechtigungen → Benachrichtigungen → Zulassen. Danach die Seite neu laden.';
  }
  return 'Klicke in der Adresszeile auf das Schloss-Symbol → Berechtigungen → Benachrichtigungen → Zulassen und lade die Seite neu. Steht sie dort schon auf „Blockieren“, ändere das in den Website-Einstellungen deines Browsers.';
}

export function isPushSupported() {
  return 'serviceWorker' in navigator && 'PushManager' in window && !!VAPID_PUBLIC_KEY;
}

// Relativer Pfad ("./sw.js") löst unabhängig vom Hash-Teil der URL immer
// zu /MyHome/sw.js auf, da der Dokument-Pfad selbst nie den Hash enthält.
export async function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return null;
  return navigator.serviceWorker.register('./sw.js');
}

export async function getPushSubscriptionStatus(session) {
  if (!isPushSupported()) return 'unsupported';
  if (Notification.permission === 'denied') return 'denied';
  const reg = await navigator.serviceWorker.getRegistration();
  const sub = await reg?.pushManager.getSubscription();
  if (!sub) return 'unsubscribed';
  // Abo gehört einem anderen Nutzer dieses Geräts → für diesen Nutzer aus.
  const owner = deviceUser();
  if (session && owner && owner !== ownerId(session)) return 'unsubscribed';
  return 'subscribed';
}

function saveSubscription(session, sub) {
  const json = sub.toJSON();
  return getSupabase().from('push_subscriptions').upsert(
    {
      owner_id: ownerId(session),
      endpoint: json.endpoint,
      p256dh:   json.keys.p256dh,
      auth:     json.keys.auth,
      user_agent: navigator.userAgent,
    },
    { onConflict: 'endpoint' }
  );
}

// Beim Anmelden / App-Start: Ist Push auf diesem Gerät für diesen Nutzer schon
// erlaubt, wird das Abo ohne neue Abfrage wiederhergestellt (Zeile in
// push_subscriptions, bei verlorenem Browser-Abo auch das Abo selbst — die
// Berechtigung ist ja schon erteilt). Fragt nie nach, ändert nichts, wenn der
// Nutzer Push nicht aktiviert hatte.
export async function restorePushForUser(session) {
  try {
    if (!isPushSupported() || Notification.permission !== 'granted') return;
    const uid = ownerId(session);
    const owner = deviceUser();
    const reg = await navigator.serviceWorker.getRegistration();
    let sub = await reg?.pushManager.getSubscription();

    if (sub) {
      // Altbestand (vor dieser Änderung aktiviert, Gerätenutzer unbekannt) gilt
      // für den Nutzer, der sich hier anmeldet; sonst nur für den Besitzer.
      if (owner && owner !== uid) return;
    } else {
      // iOS & Co. verwerfen Abos gelegentlich: nur still erneuern, wenn dieser
      // Nutzer hier Push aktiviert hatte.
      if (owner !== uid || !reg) return;
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      });
    }
    const { error } = await saveSubscription(session, sub);
    if (error) throw error;
    setDeviceUser(uid);
  } catch (e) {
    console.warn('[Push] Wiederherstellen fehlgeschlagen:', e?.message || e);
  }
}

// Beim Abmelden (solange die Sitzung noch gilt): nur die Zeile dieses Geräts
// entfernen. Das Browser-Abo und die Gerätezuordnung bleiben, damit derselbe
// Nutzer beim nächsten Login nichts neu einrichten muss.
export async function releasePushForLogout(session) {
  // Höchstens 3 s warten — Abmelden darf nie an einer hängenden Anfrage scheitern.
  const timeout = new Promise((resolve) => setTimeout(resolve, 3000));
  const work = (async () => {
    if (!isPushSupported()) return;
    const reg = await navigator.serviceWorker.getRegistration();
    const sub = await reg?.pushManager.getSubscription();
    if (!sub) return;
    await getSupabase()
      .from('push_subscriptions')
      .delete()
      .eq('endpoint', sub.endpoint)
      .eq('owner_id', ownerId(session));
  })().catch((e) => console.warn('[Push] Abmelden: Abo-Zeile nicht entfernt:', e?.message || e));
  await Promise.race([work, timeout]);
}

// Fragt die Berechtigung an (falls nötig), abonniert Push beim Browser
// und speichert das Abo in push_subscriptions.
export async function subscribeToPush(session) {
  const reg = await registerServiceWorker();
  if (!reg) throw new Error('Service Worker wird nicht unterstützt');

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') throw new Error('Berechtigung nicht erteilt');

  const sub = await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
  });

  const { error } = await saveSubscription(session, sub);
  if (error) throw error;
  setDeviceUser(ownerId(session));
  return sub;
}

export async function unsubscribeFromPush(session) {
  const reg = await navigator.serviceWorker.getRegistration();
  const sub = await reg?.pushManager.getSubscription();
  if (sub) {
    await getSupabase()
      .from('push_subscriptions')
      .delete()
      .eq('endpoint', sub.endpoint)
      .eq('owner_id', ownerId(session));
    await sub.unsubscribe();
  }
  setDeviceUser(null);
}

// Gibt nur noch die vier Kategorie-Toggles zurück.
// preferred_hour / quiet_start / quiet_end werden nicht mehr gelesen
// oder zurückgegeben — feste Zeiten liegen in der Edge Function.
export async function getNotificationPrefs(session) {
  const { data, error } = await getSupabase()
    .from('notification_prefs')
    .select('categories')
    .eq('owner_id', ownerId(session))
    .maybeSingle();
  if (error) throw error;
  return {
    ...DEFAULT_CATEGORIES,
    ...(data?.categories ?? {}),
  };
}

// Speichert ausschließlich die categories-JSONB-Spalte.
// preferred_hour / quiet_start / quiet_end werden nicht mehr geschrieben.
export async function saveNotificationPrefs(session, prefs) {
  const { error } = await getSupabase()
    .from('notification_prefs')
    .upsert(
      {
        owner_id:   ownerId(session),
        categories: prefs,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'owner_id' }
    );
  if (error) throw error;
}
