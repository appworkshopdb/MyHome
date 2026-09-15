// Supabase Edge Function "send-notifications"
// =====================================================================
// Läuft NICHT im Browser — Deno-Umgebung bei Supabase. Wird STÜNDLICH
// per pg_cron aufgerufen (supabase/migrations/007_notification_cron_hourly.sql).
//
// V2 — Benachrichtigungen nach NESTUA-BENACHRICHTIGUNGEN-V1.md:
// - Feste Uhrzeiten pro Kategorie (keine Wunschstunde mehr)
// - Keine Quiet Hours
// - Neue Kategorienamen: finance, tasks_habits, profile, weekly_recap
// - Neue Prioritätsreihenfolge: finance > tasks_habits > weekly_recap > profile
// - Finanzen: Fall A (heute fällig, 08:00) + Fall B (überfällig, alle 3 Tage 08:00)
// - tasks_habits: offene Habits UND offene Todos heute zusammengefasst
// - profile: nur Samstag 11:00, Throttle 14 Tage
// - weekly_recap: nur Sonntag 18:00
//
// ZEITZONEN-REGEL: Jede Datums-/Stunden-/Wochentagslogik rechnet in
// Europe/Berlin — nie mit UTC-Hilfsmitteln wie toISOString().split('T'),
// getDay() oder setUTCHours(). Alles über berlinNow() / toBerlinDateStr()
// / berlinStartOfDay() unten.
//
// WICHTIG: dupliziert bewusst Prüf-Logik aus dem Frontend
// (BODY_REQUIRED_FIELDS, Habits-Fälligkeit, Todo-Fälligkeit) —
// Edge Functions können kein Frontend-JS importieren.
// Ändert sich die Logik im Frontend, hier manuell nachziehen.
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

// ─── Feste Prüfzeiten (Europe/Berlin, nicht vom Nutzer änderbar) ────
// Eine Kategorie ist nur dann Kandidat, wenn berlin.hour === ihre Stunde
// UND (falls angegeben) der Wochentag passt.
const CATEGORY_SCHEDULE = {
  finance:      { hour: 8  },               // täglich 08:00
  tasks_habits: { hour: 19 },               // täglich 19:00
  profile:      { hour: 11, weekday: 5 },   // Samstag 11:00  (Sa = 5, Mo=0…So=6)
  weekly_recap: { hour: 18, weekday: 6 },   // Sonntag  18:00 (So = 6)
};

// Throttle je Kategorie in Tagen.
// finance-Fall-A (heute fällig): kein eigener Throttle — due_day-Treffer
//   passiert von Natur aus nicht täglich für denselben Posten.
// finance-Fall-B (überfällig):  3 Tage — verhindert tägliche Wiederholung.
// tasks_habits: 0 — max. 1x/Tag, aber das regelt schon das Tageslimit.
// profile: 14 Tage.
// weekly_recap: 7 Tage — kommt ohnehin nur sonntags durch den Schedule.
const THROTTLE_DAYS = {
  finance:      3,   // gilt für Fall B (überfällig); Fall A ignoriert Throttle
  tasks_habits: 0,
  profile:      14,
  weekly_recap: 7,
};

// Prioritätsreihenfolge laut Spec (höchste zuerst).
// Bei >2 Kandidaten belegen die obersten das Tageslimit.
const PRIORITY_ORDER = ['finance', 'tasks_habits', 'weekly_recap', 'profile'];

// Max. Push-Benachrichtigungen pro Nutzer und Kalendertag (Berlin-Zeit).
const DAILY_CAP_TOTAL = 2;

// Standard-Toggles falls kein Eintrag in notification_prefs vorhanden.
const DEFAULT_CATEGORIES = {
  finance:      true,
  tasks_habits: true,
  profile:      true,
  weekly_recap: true,
};

// ─────────────────────────────────────────────────────────────────────
// Zeit-Helfer — die EINZIGEN Stellen, die die Zeitzone kennen.
// ─────────────────────────────────────────────────────────────────────

function toBerlinDateStr(date) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Berlin',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

// Liefert alle relevanten Berlin-Zeitwerte aus EINEM Intl-Aufruf,
// damit um Mitternacht kein Kippen zwischen zwei Aufrufen passiert.
function berlinNow() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Berlin',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: 'numeric',
    hourCycle: 'h23',
    weekday: 'short',
  }).formatToParts(new Date());
  const get = (t) => parts.find((p) => p.type === t)?.value;

  const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const weekdayIndex = WEEKDAYS.indexOf(get('weekday')); // Mo=0 … So=6

  // Tageszahl (1–31) als Zahl — für Finanzen due_day-Vergleich.
  const day = Number(get('day'));

  return {
    hour: Number(get('hour')),
    weekdayIndex,
    day,
    todayStr: `${get('year')}-${get('month')}-${get('day')}`,
    year:  Number(get('year')),
    month: Number(get('month')),
  };
}

// UTC-Zeitpunkt von "heute 00:00 Uhr Berlin" für sent_at-Vergleiche.
function berlinStartOfDay(todayStr) {
  const utcMidnight = new Date(`${todayStr}T00:00:00Z`);
  const offsetHour = Number(
    new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Europe/Berlin',
      hour: 'numeric',
      hourCycle: 'h23',
    }).format(utcMidnight)
  );
  return new Date(utcMidnight.getTime() - offsetHour * 3600000);
}

// ─────────────────────────────────────────────────────────────────────
// Hilfsfunktionen
// ─────────────────────────────────────────────────────────────────────

// Prüft ob die Kategorie zum aktuellen Berlin-Zeitpunkt überhaupt
// gesendet werden darf (Stunde + optionaler Wochentag).
function isScheduledNow(category, berlin) {
  const s = CATEGORY_SCHEDULE[category];
  if (!s) return false;
  if (berlin.hour !== s.hour) return false;
  if (s.weekday !== undefined && berlin.weekdayIndex !== s.weekday) return false;
  return true;
}

// Wurde diese Kategorie für diesen Nutzer in den letzten `days` Tagen
// bereits gesendet? days=0 → nie geblockt.
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

// Anzahl gesendeter Pushes seit Berlin-Mitternacht (für Tageslimit).
async function sentTodayCount(ownerId, berlin) {
  const startOfDay = berlinStartOfDay(berlin.todayStr);
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
        // Totes Abo entfernen
        await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint);
      } else {
        console.error('Push-Fehler für', ownerId, err);
      }
    }
  }

  await supabase.from('notification_log').insert({ owner_id: ownerId, category });
}

// ─────────────────────────────────────────────────────────────────────
// Fachliche Bedingungsprüfung je Kategorie
// Gibt { title, body, url } zurück oder null (kein Kandidat).
// ─────────────────────────────────────────────────────────────────────

async function checkCategory(category, ownerId, berlin) {

  // ── finance ────────────────────────────────────────────────────────
  // Fall A: Heute fällige Zahlung (due_day === heute) → sofort melden,
  //         ignoriert den 3-Tage-Throttle (wird vom Aufrufer übersprungen).
  // Fall B: Überfällige offene Buchungen aus Vorlagen → alle 3 Tage.
  if (category === 'finance') {

    // Fall A: Templates/Contracts mit due_day === heute
    // Hinweis: Intervall-Logik (quartalsweise, jährlich) ist hier bewusst
    // vereinfacht — nur der Tagesabgleich, keine start_month-Prüfung.
    // Präzisierung kann in einem späteren Notifications-Chat erfolgen.
    const [{ data: dueTemplates }, { data: dueContracts }] = await Promise.all([
      supabase
        .from('fin_fixtemplates')
        .select('id, name')
        .eq('owner_id', ownerId)
        .eq('due_day', berlin.day)
        .is('deleted_at', null),
      supabase
        .from('fin_contracts')
        .select('id, name')
        .eq('owner_id', ownerId)
        .eq('due_day', berlin.day)
        .is('deleted_at', null),
    ]);

    const dueTodayNames = [
      ...(dueTemplates ?? []).map((t) => t.name),
      ...(dueContracts ?? []).map((c) => c.name),
    ];

    if (dueTodayNames.length > 0) {
      const shown = dueTodayNames.slice(0, 2).join(', ');
      const rest  = dueTodayNames.length > 2 ? ` +${dueTodayNames.length - 2} weitere` : '';
      return {
        title: 'Zahlung fällig heute',
        body:  `${shown}${rest} ${dueTodayNames.length === 1 ? 'ist' : 'sind'} heute fällig.`,
        url:   './#/finance',
        skipThrottle: true, // Fall A überspringt den Kategorie-Throttle
      };
    }

    // Fall B: Offene Buchungen aus Vorlagen diesen Monat (überfällig)
    // Jahr/Monat aus Berlin-Sicht (wichtig an Monatsgrenzen).
    const { data: openEntries } = await supabase
      .from('fin_entries')
      .select('id')
      .eq('owner_id', ownerId)
      .eq('year', berlin.year)
      .eq('month', berlin.month)
      .eq('paid', false)
      .not('from_template', 'is', null)
      .is('deleted_at', null);

    if ((openEntries?.length ?? 0) === 0) return null;
    return {
      title: 'Fixkosten offen',
      body:  `${openEntries.length} unbezahlte Fixkosten diesen Monat.`,
      url:   './#/finance',
    };
  }

  // ── tasks_habits ───────────────────────────────────────────────────
  // Offene Habits + offene Todos für heute zusammengefasst.
  // Nur senden wenn tatsächlich etwas offen ist.
  if (category === 'tasks_habits') {
    const wd = berlin.weekdayIndex;

    // Habits: welche sind heute fällig?
    const { data: habits } = await supabase
      .from('hab_habits')
      .select('id, target_count, frequency, frequency_days, created_at')
      .eq('owner_id', ownerId)
      .eq('active', true)
      .is('deleted_at', null);

    const dueHabits = (habits ?? []).filter((h) => {
      if (toBerlinDateStr(new Date(h.created_at)) > berlin.todayStr) return false;
      if (h.frequency === 'daily') return true;
      if (h.frequency === 'weekdays') return wd < 5;
      if (h.frequency === 'custom' && Array.isArray(h.frequency_days)) return h.frequency_days.includes(wd);
      return true;
    });

    // Habits: welche davon sind noch nicht erledigt?
    let openHabits = 0;
    if (dueHabits.length > 0) {
      const { data: entries } = await supabase
        .from('hab_entries')
        .select('habit_id, count')
        .eq('owner_id', ownerId)
        .eq('logged_on', berlin.todayStr)
        .is('deleted_at', null);

      const doneIds = new Set(
        (entries ?? [])
          .filter((e) => {
            const h = dueHabits.find((x) => x.id === e.habit_id);
            return h && e.count >= h.target_count;
          })
          .map((e) => e.habit_id)
      );
      openHabits = dueHabits.length - doneIds.size;
    }

    // Todos: heute fällig (due_date <= heute) oder wichtig ohne Datum
    const { data: todos } = await supabase
      .from('todos')
      .select('id, due_date, priority')
      .eq('owner_id', ownerId)
      .eq('done', false)
      .is('deleted_at', null);

    const openTodos = (todos ?? []).filter((t) =>
      (t.due_date && t.due_date <= berlin.todayStr) ||
      (!t.due_date && t.priority)
    ).length;

    const totalOpen = openHabits + openTodos;
    if (totalOpen === 0) return null;

    // Text: unterscheide ob nur Habits, nur Todos oder beides offen
    let body;
    if (openHabits > 0 && openTodos > 0) {
      body = `${openHabits} Gewohnheit${openHabits !== 1 ? 'en' : ''} und ${openTodos} Aufgabe${openTodos !== 1 ? 'n' : ''} noch offen.`;
    } else if (openHabits > 0) {
      body = `Noch ${openHabits} von ${dueHabits.length} Gewohnheit${dueHabits.length !== 1 ? 'en' : ''} offen.`;
    } else {
      body = `${openTodos} Aufgabe${openTodos !== 1 ? 'n' : ''} für heute noch offen.`;
    }

    return {
      title: 'Gewohnheiten & Aufgaben',
      body,
      url: './#/habits',
    };
  }

  // ── profile ────────────────────────────────────────────────────────
  // Nur wenn tatsächlich relevante Angaben fehlen.
  // Felder gespiegelt aus core/lib/bodyProfileData.js BODY_REQUIRED_FIELDS.
  if (category === 'profile') {
    const { data: bp } = await supabase
      .from('body_profile')
      .select('gender, age, height, weight, activity, goal')
      .eq('owner_id', ownerId)
      .maybeSingle();

    const REQUIRED = ['gender', 'age', 'height', 'weight', 'activity', 'goal'];
    const missing = !bp || REQUIRED.some((k) => bp[k] === null || bp[k] === undefined || bp[k] === '');
    if (!missing) return null;

    return {
      title: 'Dein Profil ist noch nicht vollständig',
      body:  'Ergänze deine Angaben für genauere Ergebnisse.',
      url:   './#/profile',
    };
  }

  // ── weekly_recap ───────────────────────────────────────────────────
  // Nur sonntags (bereits durch Schedule gefiltert, doppelte Prüfung
  // als Sicherheitsnetz falls Schedule-Logik umgebaut wird).
  if (category === 'weekly_recap') {
    if (berlin.weekdayIndex !== 6) return null;
    return {
      title: 'Deine Woche',
      body:  'Dein Wochenrückblick ist da.',
      url:   './#/finance/auswertung',
    };
  }

  return null;
}

// ─────────────────────────────────────────────────────────────────────
// Hauptlogik
// ─────────────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  const url = new URL(req.url);
  const testOwnerId = url.searchParams.get('test_owner');
  if (testOwnerId) {
    await sendToUser(testOwnerId, 'test', 'Test-Benachrichtigung', 'Wenn du das siehst, funktioniert die Zustellung.', './');
    return new Response(JSON.stringify({ test: true, ownerId: testOwnerId }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const berlin = berlinNow();

  // Alle Nutzer mit aktivem Push-Abo
  const { data: subRows } = await supabase.from('push_subscriptions').select('owner_id');
  const ownerIds = [...new Set((subRows ?? []).map((s) => s.owner_id))];

  let sentCount = 0;

  for (const ownerId of ownerIds) {
    // Toggles laden (nur categories-JSONB — preferred_hour/quiet_* nicht mehr relevant)
    const { data: prefRow } = await supabase
      .from('notification_prefs')
      .select('categories')
      .eq('owner_id', ownerId)
      .maybeSingle();

    const toggles = { ...DEFAULT_CATEGORIES, ...(prefRow?.categories ?? {}) };

    // Tageslimit prüfen — wenn bereits 2 heute gesendet, Nutzer überspringen
    let remainingBudget = DAILY_CAP_TOTAL - (await sentTodayCount(ownerId, berlin));
    if (remainingBudget <= 0) continue;

    // Kaskade: Toggle → Schedule → fachliche Bedingung → Throttle → Kandidat
    for (const category of PRIORITY_ORDER) {
      if (remainingBudget <= 0) break;

      // 1. Toggle aus (deaktivierte Kategorien sind keine Kandidaten,
      //    verbrauchen kein Budget, beeinflussen Auswahl nicht)
      if (!toggles[category]) continue;

      // 2. Prüfzeitpunkt (Stunde + ggf. Wochentag) passt gerade nicht
      if (!isScheduledNow(category, berlin)) continue;

      // 3. Fachliche Bedingung prüfen
      const result = await checkCategory(category, ownerId, berlin);
      if (!result) continue;

      // 4. Throttle — Fall A (finance, heute fällig) überspringt den Throttle
      if (!result.skipThrottle && await alreadySentRecently(ownerId, category, THROTTLE_DAYS[category])) continue;

      // → Kandidat: senden
      await sendToUser(ownerId, category, result.title, result.body, result.url);
      remainingBudget -= 1;
      sentCount += 1;
    }
  }

  return new Response(
    JSON.stringify({ checked: ownerIds.length, sent: sentCount, hour: berlin.hour, berlin: berlin.todayStr }),
    { headers: { 'Content-Type': 'application/json' } }
  );
});
