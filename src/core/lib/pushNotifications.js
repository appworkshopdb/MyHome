import { getSupabase } from './supabaseClient';

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY;

const DEFAULT_CATEGORIES = {
  habits: true,
  required_data: true,
  fin_due: true,
  weekly_recap: true,
};

const DEFAULT_TIMING = {
  preferred_hour: 20,
  quiet_start: 0,
  quiet_end: 6,
};

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

export function isPushSupported() {
  return 'serviceWorker' in navigator && 'PushManager' in window && !!VAPID_PUBLIC_KEY;
}

// Relativer Pfad ("./sw.js") löst unabhängig vom Hash-Teil der URL immer
// zu /MyHome/sw.js auf, da der Dokument-Pfad selbst nie den Hash enthält.
export async function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return null;
  return navigator.serviceWorker.register('./sw.js');
}

export async function getPushSubscriptionStatus() {
  if (!isPushSupported()) return 'unsupported';
  if (Notification.permission === 'denied') return 'denied';
  const reg = await navigator.serviceWorker.getRegistration();
  const sub = await reg?.pushManager.getSubscription();
  return sub ? 'subscribed' : 'unsubscribed';
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

  const json = sub.toJSON();
  const { error } = await getSupabase().from('push_subscriptions').upsert(
    {
      owner_id: ownerId(session),
      endpoint: json.endpoint,
      p256dh: json.keys.p256dh,
      auth: json.keys.auth,
      user_agent: navigator.userAgent,
    },
    { onConflict: 'endpoint' }
  );
  if (error) throw error;
  return sub;
}

export async function unsubscribeFromPush(session) {
  const reg = await navigator.serviceWorker.getRegistration();
  const sub = await reg?.pushManager.getSubscription();
  if (sub) {
    await getSupabase().from('push_subscriptions').delete().eq('endpoint', sub.endpoint).eq('owner_id', ownerId(session));
    await sub.unsubscribe();
  }
}

// Gibt Kategorien UND Timing (Wunschstunde/Quiet Hours) zusammen zurück
// — die UI (Profile.jsx) behandelt das als ein Einstellungs-Objekt.
export async function getNotificationPrefs(session) {
  const { data, error } = await getSupabase()
    .from('notification_prefs')
    .select('categories, preferred_hour, quiet_start, quiet_end')
    .eq('owner_id', ownerId(session))
    .maybeSingle();
  if (error) throw error;
  return {
    ...DEFAULT_CATEGORIES,
    ...(data?.categories || {}),
    preferred_hour: data?.preferred_hour ?? DEFAULT_TIMING.preferred_hour,
    quiet_start: data?.quiet_start ?? DEFAULT_TIMING.quiet_start,
    quiet_end: data?.quiet_end ?? DEFAULT_TIMING.quiet_end,
  };
}

// prefs = komplettes Objekt aus getNotificationPrefs (Kategorien + Timing
// gemischt) — wird hier wieder in categories-jsonb + die drei separaten
// Spalten aufgeteilt, wie es notification_prefs erwartet.
export async function saveNotificationPrefs(session, prefs) {
  const { preferred_hour, quiet_start, quiet_end, ...categories } = prefs;
  const { error } = await getSupabase().from('notification_prefs').upsert(
    {
      owner_id: ownerId(session),
      categories,
      preferred_hour,
      quiet_start,
      quiet_end,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'owner_id' }
  );
  if (error) throw error;
}
