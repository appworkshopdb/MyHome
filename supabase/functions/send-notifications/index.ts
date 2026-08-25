// Supabase Edge Function "send-notifications"
// =====================================================================
// Läuft NICHT im Browser — Deno-Umgebung bei Supabase. Wird STÜNDLICH
// per pg_cron aufgerufen (supabase/migrations/007_notification_cron_hourly.sql).
// Prüft pro Nutzer:in, ob GERADE ihre Wunschstunde ist (deutsche Zeit,
// preferred_hour), respektiert Quiet Hours und eine gemeinsame
// Tagesobergrenze über alle 4 Kategorien hinweg — nicht nur die
// Pro-Kategorie-Drossel von vorher.
//
// WICHTIG: dupliziert bewusst etwas Prüf-Logik aus dem Frontend
// (core/lib/bodyProfileData.js BODY_REQUIRED_FIELDS, core/Hub.jsx
// loadTodayHabits) — Edge Functions können kein Frontend-JS importieren.
// Ändert sich diese Logik im Frontend, hier manuell nachziehen.
// =====================================================================

import { createClient } from 'npm:@supabase/supabase-js@2';
import webpush from 'npm:web-push@3.6.7';

const supabaseUrl = Deno.env.get('SUPABASE_URL');
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
const vapidPublicKey = Deno.env.get('VAPID_PUBLIC_KEY');
const vapidPrivateKey = Deno.env.get('VAPID_PRIVATE_KEY');
const vapidSubject = Deno.env.get('VAPID_SUBJECT') ?? 'mailto:kontakt@example.com';

webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);
const supabase = createClient(supabaseUrl, serviceRoleKey);

// Throttle je Kategorie in Tagen (zusätzlich zur Tagesobergrenze unten).
const THROTTLE_DAYS = {
  habits: 0,
  required_data: 3,
  fin_due: 7,
  weekly_recap: 6,
};

// Reihenfolge, in der Kategorien die Tagesobergrenze "belegen", falls an
// einem Lauf mehrere gleichzeitig fällig wären — Wochenrückblick zuerst
// (kommt nur 1x/Woche, soll nicht wegen was Alltäglichem ausfallen),
// Pflichtdaten zuletzt (am wenigsten dringend, kann warten).
const PRIORITY_ORDER = ['weekly_recap', 'habits', 'fin_due', 'required_data'];

// Max. Push-Benachrichtigungen INSGESAMT pro Person und Tag, über alle
// Kategorien zusammengerechnet — verhindert, dass an einem Abend alle
// vier gleichzeitig ankommen. Bewusst noch nicht pro Nutzer einstellbar,
// nur ein fester Sicherheitswert.
const DAILY_CAP_TOTAL = 2;

const DEFAULT_PREFS = {
  habits: true,
  required_data: true,
  fin_due: true,
  weekly_recap: true,
  preferred_hour: 20,
  quiet_start: 0,
  quiet_end: 6,
};

function berlinNow() {
  const parts = new Intl.DateTimeFormat('de-DE', {
    timeZone: 'Europe/Berlin',
    hour: 'numeric',
    weekday: 'short',
    hour12: false,
  }).formatToParts(new Date());
  const hour = Number(parts.find((p) => p.type === 'hour').value);
  const weekdayShort = parts.find((p) => p.type === 'weekday').value;
  return { hour, isSunday: weekdayShort.startsWith('So') };
}

function inQuietHours(hour, quietStart, quietEnd) {
  if (quietStart === quietEnd) return false;
  if (quietStart < quietEnd) return hour >= quietStart && hour < quietEnd;
  return hour >= quietStart || hour < quietEnd;
}

async function alreadySentRecently(ownerId, category, days) {
  if (days <= 0) return false;
  const since = new Date(Date.now() - days * 86400000).toISOString();
  const { data } = await supabase
    .from('notification_log')
    .select('id')
    .eq('owner_id', ownerId)
    .eq('category', category)
    .gte('sent_at', since)
    .limit(1);
  return (data?.length ?? 0) > 0;
}

async function sentTodayCount(ownerId) {
  const startOfDay = new Date();
  startOfDay.setUTCHours(0, 0, 0, 0);
  const { data } = await supabase
    .from('notification_log')
    .select('id')
    .eq('owner_id', ownerId)
    .gte('sent_at', startOfDay.toISOString());
  return data?.length ?? 0;
}

async function sendToUser(ownerId, category, title, body, url = './') {
  const { data: subs } = await supabase
    .from('push_subscriptions')
    .select('endpoint, p256dh, auth')
    .eq('owner_id', ownerId);
  if (!subs || subs.length === 0) return;

  const payload = JSON.stringify({ title, body, url, category });
  for (const sub of subs) {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        payload
      );
    } catch (err) {
      if (err?.statusCode === 404 || err?.statusCode === 410) {
        await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint);
      } else {
        console.error('Push-Fehler für', ownerId, err);
      }
    }
  }

  await supabase.from('notification_log').insert({ owner_id: ownerId, category });
}

async function checkCategory(category, ownerId, todayStr, isSunday) {
  if (category === 'habits') {
    const { data: habits } = await supabase
      .from('hab_habits')
      .select('id, target_count, frequency, frequency_days, created_at')
      .eq('owner_id', ownerId)
      .eq('active', true)
      .is('deleted_at', null);

    const wd = (new Date().getDay() + 6) % 7;
    const due = (habits ?? []).filter((h) => {
      if (new Date(h.created_at).toISOString().split('T')[0] > todayStr) return false;
      if (h.frequency === 'daily') return true;
      if (h.frequency === 'weekdays') return wd < 5;
      if (h.frequency === 'custom' && Array.isArray(h.frequency_days)) return h.frequency_days.includes(wd);
      return true;
    });
    if (due.length === 0) return null;

    const { data: entries } = await supabase
      .from('hab_entries')
      .select('habit_id, count')
      .eq('owner_id', ownerId)
      .eq('logged_on', todayStr)
      .is('deleted_at', null);
    const doneIds = new Set(
      (entries ?? [])
        .filter((e) => {
          const h = due.find((x) => x.id === e.habit_id);
          return h && e.count >= h.target_count;
        })
        .map((e) => e.habit_id)
    );
    const open = due.length - doneIds.size;
    if (open <= 0) return null;
    return { title: 'Gewohnheiten heute', body: `Noch ${open} von ${due.length} offen.`, url: './#/habits' };
  }

  if (category === 'required_data') {
    const { data: body } = await supabase
      .from('body_profile')
      .select('gender, age, height, weight, activity, goal')
      .eq('owner_id', ownerId)
      .maybeSingle();
    const REQUIRED = ['gender', 'age', 'height', 'weight', 'activity', 'goal'];
    const missing = !body || REQUIRED.some((k) => body[k] === null || body[k] === undefined || body[k] === '');
    if (!missing) return null;
    return { title: 'Profil unvollständig', body: 'Ein paar Angaben fehlen noch für genaue Ergebnisse.', url: './#/profile' };
  }

  if (category === 'fin_due') {
    const now = new Date();
    const { data: openEntries } = await supabase
      .from('fin_entries')
      .select('id')
      .eq('owner_id', ownerId)
      .eq('year', now.getFullYear())
      .eq('month', now.getMonth() + 1)
      .eq('paid', false)
      .not('from_template', 'is', null)
      .is('deleted_at', null);
    if ((openEntries?.length ?? 0) === 0) return null;
    return { title: 'Fixkosten offen', body: `${openEntries.length} unbezahlte Fixkosten diesen Monat.`, url: './#/finance/months' };
  }

  if (category === 'weekly_recap') {
    if (!isSunday) return null;
    return { title: 'Deine Woche', body: 'Dein Wochenrückblick ist da.', url: './' };
  }

  return null;
}

Deno.serve(async (req) => {
  const url = new URL(req.url);
  const testOwnerId = url.searchParams.get('test_owner');
  if (testOwnerId) {
    await sendToUser(testOwnerId, 'test', 'Test-Benachrichtigung', 'Wenn du das siehst, funktioniert die Zustellung.', './');
    return new Response(JSON.stringify({ test: true, ownerId: testOwnerId }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const { hour, isSunday } = berlinNow();
  const todayStr = new Date().toISOString().split('T')[0];

  const { data: subRows } = await supabase.from('push_subscriptions').select('owner_id');
  const ownerIds = [...new Set((subRows ?? []).map((s) => s.owner_id))];

  let sentCount = 0;

  for (const ownerId of ownerIds) {
    const { data: prefRow } = await supabase
      .from('notification_prefs')
      .select('categories, preferred_hour, quiet_start, quiet_end')
      .eq('owner_id', ownerId)
      .maybeSingle();

    const prefs = { ...DEFAULT_PREFS, ...(prefRow?.categories ?? {}) };
    const preferredHour = prefRow?.preferred_hour ?? DEFAULT_PREFS.preferred_hour;
    const quietStart = prefRow?.quiet_start ?? DEFAULT_PREFS.quiet_start;
    const quietEnd = prefRow?.quiet_end ?? DEFAULT_PREFS.quiet_end;

    if (hour !== preferredHour) continue;
    if (inQuietHours(hour, quietStart, quietEnd)) continue;

    let remainingBudget = DAILY_CAP_TOTAL - (await sentTodayCount(ownerId));
    if (remainingBudget <= 0) continue;

    for (const category of PRIORITY_ORDER) {
      if (remainingBudget <= 0) break;
      if (!prefs[category]) continue;
      if (await alreadySentRecently(ownerId, category, THROTTLE_DAYS[category])) continue;

      const result = await checkCategory(category, ownerId, todayStr, isSunday);
      if (!result) continue;

      await sendToUser(ownerId, category, result.title, result.body, result.url);
      remainingBudget -= 1;
      sentCount += 1;
    }
  }

  return new Response(JSON.stringify({ checked: ownerIds.length, sent: sentCount, hour }), {
    headers: { 'Content-Type': 'application/json' },
  });
});
