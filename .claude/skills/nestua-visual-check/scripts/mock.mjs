// Gemocktes Supabase-REST für die visuelle Prüfung der App (Skill nestua-visual-check).
// Nur erfundene Testdaten, kein Zugriff auf die echte Datenbank. Feste Uhr: 27.10.2026 11:50 Berlin.
// Neue Tabelle = Eintrag in TABLES; Spaltennamen MÜSSEN die echten sein (z. B. body_weight_logs.weight, nicht weight_kg).
const OWNER = '11111111-1111-1111-1111-111111111111';
const TODAY = '2026-10-27';
const D = (n) => { const d = new Date('2026-10-27T12:00:00'); d.setDate(d.getDate() + n); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; };
let id = 0; const uid = () => `00000000-0000-4000-8000-${String(++id).padStart(12,'0')}`;
const base = { owner_id: OWNER, created_at: '2026-09-01T08:00:00Z', updated_at: '2026-09-01T08:00:00Z', deleted_at: null };

const habIds = {}; ['Wasser trinken','Lesen · 20 Min','Meditation','Vitamine','Spaziergang'].forEach(n => habIds[n] = uid());
const habits = [
  { ...base, id: habIds['Wasser trinken'], name: 'Wasser trinken', icon: '💧', active: true, frequency: 'daily', frequency_days: null, target_count: 1, time_slot: 'anytime', sort_order: 1 },
  { ...base, id: habIds['Lesen · 20 Min'], name: 'Lesen · 20 Min', icon: '📖', active: true, frequency: 'daily', frequency_days: null, target_count: 1, time_slot: 'evening', sort_order: 2 },
  { ...base, id: habIds['Meditation'], name: 'Meditation', icon: '🧘', active: true, frequency: 'daily', frequency_days: null, target_count: 1, time_slot: 'morning', sort_order: 3 },
  { ...base, id: habIds['Vitamine'], name: 'Vitamine', icon: '💊', active: true, frequency: 'daily', frequency_days: null, target_count: 1, time_slot: 'morning', sort_order: 4 },
  { ...base, id: habIds['Spaziergang'], name: 'Spaziergang', icon: '🚶', active: true, frequency: 'daily', frequency_days: null, target_count: 1, time_slot: 'midday', sort_order: 5 },
];
const habEntries = [];
for (let n = 0; n < 12; n++) for (const h of habits) {
  if (n === 0 && ['Wasser trinken','Lesen · 20 Min'].includes(h.name)) continue;
  if (n > 0 && n % 5 === 0 && h.name === 'Lesen · 20 Min') continue;
  habEntries.push({ ...base, id: uid(), habit_id: h.id, logged_on: D(-n), count: 1 });
}
const wId = uid();
const workouts = [
  { ...base, id: wId, occurred_on: TODAY, type_key: 'kraft', title: 'Rücken & Bizeps', duration_min: 60, status: 'planned', is_rest: false },
  { ...base, id: uid(), occurred_on: D(-1), type_key: 'kraft', title: 'Beine', duration_min: 55, status: 'done', is_rest: false },
  { ...base, id: uid(), occurred_on: D(-3), type_key: 'ausdauer.laufen', title: 'Laufen', duration_min: 40, status: 'done', is_rest: false },
  { ...base, id: uid(), occurred_on: D(1), type_key: null, title: null, duration_min: null, status: 'planned', is_rest: true },
  { ...base, id: uid(), occurred_on: D(2), type_key: 'kraft', title: 'Brust & Trizeps', duration_min: 60, status: 'planned', is_rest: false },
];
const todos = [
  { ...base, id: uid(), title: 'Zahnarzt-Termin buchen', due_date: TODAY, priority: false, done: false, done_at: null, note: null },
  { ...base, id: uid(), title: 'Steuererklärung vorbereiten', due_date: D(3), priority: true, done: false, done_at: null, note: null },
  { ...base, id: uid(), title: 'Geschenk für Mira', due_date: null, priority: false, done: false, done_at: null, note: null },
];
const finEntries = [
  { ...base, id: uid(), year: 2026, month: 10, category: 'fixeinnahmen', name: 'Gehalt', payment: 'Bank', amount: 1753.6, paid: true, due_date: null, payments: null },
  { ...base, id: uid(), year: 2026, month: 10, category: 'fixkosten', name: 'Miete', payment: 'Bank', amount: 850, paid: true, due_date: null, payments: null },
  { ...base, id: uid(), year: 2026, month: 10, category: 'fixkosten', name: 'Strom', payment: 'Bank', amount: 62, paid: true, due_date: null, payments: null },
  { ...base, id: uid(), year: 2026, month: 10, category: 'fixkosten', name: 'Handyrechnung', payment: 'Bank', amount: 6.6, paid: false, due_date: TODAY, payments: null },
  { ...base, id: uid(), year: 2026, month: 10, category: 'fixkosten', name: 'Internet', payment: 'Bank', amount: 39.99, paid: true, due_date: null, payments: null },
  { ...base, id: uid(), year: 2026, month: 10, category: 'variable_kosten', name: 'Lebensmittel', payment: 'Karte', amount: 540.38, paid: true, due_date: null, payments: null },
  { ...base, id: uid(), year: 2026, month: 10, category: 'sonstige_ausgaben', name: 'Kino', payment: 'Karte', amount: 184, paid: true, due_date: null, payments: null },
];
const listId = uid();
const lists = [
  { ...base, id: listId, name: 'Wocheneinkauf', status: 'im_einkauf', is_template: false, sort_order: 1, icon: null,
    sho_items: Array.from({ length: 11 }, (_, i) => ({ id: uid(), done: i < 4, deleted_at: null })) },
  { ...base, id: uid(), name: 'Drogerie', status: 'offen', is_template: false, sort_order: 2, icon: null, sho_items: [{ id: uid(), done: false, deleted_at: null }, { id: uid(), done: false, deleted_at: null }] },
  { ...base, id: uid(), name: 'Geburtstag Samstag', status: 'offen', is_template: false, sort_order: 3, icon: null, sho_items: Array.from({ length: 12 }, () => ({ id: uid(), done: false, deleted_at: null })) },
];
const shoItems = ['Milch','Eier','Haferflocken','Bananen','Brot','Joghurt','Milch','Eier','Milch','Eier','Bananen','Brot','Haferflocken','Joghurt'].map((n, i) => ({ ...base, id: uid(), list_id: listId, name: n, category: 'sonstiges', quantity: null, unit: null, done: true, done_at: D(-i - 1) + 'T10:00:00Z', sort_order: i }));
const recipes = [
  { ...base, id: uid(), name: 'Hähnchen-Gemüsepfanne', servings: 2, category: 'mittag', ingredients: [], note: '', custom_tags: [], goal_tags: [], cover: null, household_id: null, created_at: '2026-09-02T08:00:00Z' },
  { ...base, id: uid(), name: 'Overnight Oats', servings: 1, category: 'fruehstueck', ingredients: [], note: '', custom_tags: [], goal_tags: [], cover: null, household_id: null, created_at: '2026-09-03T08:00:00Z' },
  { ...base, id: uid(), name: 'Linsensuppe', servings: 4, category: 'abend', ingredients: [], note: '', custom_tags: [], goal_tags: [], cover: null, household_id: null, created_at: '2026-09-04T08:00:00Z' },
];
const foods = [
  { id: uid(), owner_id: null, seed_id: 1, override_of: null, name: 'Haferflocken', category: 'erlaubt', kcal: 370, protein: 13, carbs: 59, fat: 7, sugar: 1, satfat: 1.2, fiber: 10, salt: 0, unit: 'g', diet: [], allergens: [], deleted_at: null },
  { id: uid(), owner_id: null, seed_id: 2, override_of: null, name: 'Hähnchenbrust', category: 'erlaubt', kcal: 110, protein: 23, carbs: 0, fat: 1.5, sugar: 0, satfat: 0.4, fiber: 0, salt: 0.1, unit: 'g', diet: [], allergens: [], deleted_at: null },
  { id: uid(), owner_id: null, seed_id: 3, override_of: null, name: 'Schokolade', category: 'tabu', kcal: 540, protein: 6, carbs: 55, fat: 31, sugar: 50, satfat: 18, fiber: 3, salt: 0.1, unit: 'g', diet: [], allergens: [], deleted_at: null },
  { id: uid(), owner_id: null, seed_id: 4, override_of: null, name: 'Linsen', category: 'erlaubt', kcal: 350, protein: 25, carbs: 50, fat: 1.5, sugar: 2, satfat: 0.2, fiber: 11, salt: 0, unit: 'g', diet: [], allergens: [], deleted_at: null },
  { id: uid(), owner_id: null, seed_id: 5, override_of: null, name: 'Käse', category: 'in_massen', kcal: 400, protein: 25, carbs: 1, fat: 33, sugar: 0, satfat: 21, fiber: 0, salt: 1.8, unit: 'g', diet: [], allergens: ['Milch'], deleted_at: null },
];
const TABLES = {
  body_profile: [{ ...base, display_name: 'Ben', onboarding_completed_at: '2026-09-01T09:00:00Z', tutorials_done: ['hub','finance','nutrition','sport','habits','shopping'], analytics_consent: false, analytics_consent_at: '2026-09-01T09:00:00Z', analytics_consent_version: 1, gender: 'm', age: 30, height: 180, weight: 78.4, activity: 'moderat', goal: 'muskel', training_focus: null, sports: [], avatar_url: null }],
  gamification_status: [{ ...base, points_total: 540, current_streak: 12, longest_streak: 20, last_active_date: D(-1), bird_species: 'robin' }],
  nut_profile: [{ ...base, diet: 'alles', allergies: [] }],
  measurements: [
    { ...base, id: uid(), metric_key: 'finance.income', value: 1753.6, occurred_on: D(-26) },
    { ...base, id: uid(), metric_key: 'finance.expense', value: 1736.38, occurred_on: D(-26) },
  ],
  fin_entries: finEntries, fin_savings: [{ ...base, id: uid(), year: 2026, month: 10, amount: 120, note: null }], fin_contracts: [
    { ...base, id: uid(), name: 'Fitnessstudio', amount: 29.9, duration: '12 Monate', start_date: '2026-01-01', end_date: '2026-11-30', is_monthly: true, payment: 'Bank', cancellation: null },
    { ...base, id: uid(), name: 'Handyvertrag', amount: 19.9, duration: '24 Monate', start_date: '2025-02-01', end_date: '2027-01-31', is_monthly: true, payment: 'Bank', cancellation: null },
  ],
  fin_fixtemplates: [], fin_report_prefs: [],
  hab_habits: habits, hab_entries: habEntries,
  todos, spo_workouts: workouts, spo_units: [], spo_plans: [{ ...base, id: uid(), name: 'Push', description: null }, { ...base, id: uid(), name: 'Pull', description: null }, { ...base, id: uid(), name: 'Beine', description: null }], spo_plan_items: [],
  body_weight_logs: [{ ...base, id: uid(), weight: 78.4, logged_on: D(-1) }, { ...base, id: uid(), weight: 79.0, logged_on: D(-8) }, { ...base, id: uid(), weight: 77.9, logged_on: D(-15) }, { ...base, id: uid(), weight: 78.6, logged_on: D(-22) }],
  sho_lists: lists, sho_items: shoItems, sho_list_stores: [], sho_payments: [],
  nut_recipes: recipes, nut_foods: foods, nut_meals: [],
  calendar_events: [{ ...base, id: uid(), event_date: TODAY, event_time: null, source_module: 'google', title: 'Klassenarbeit Deutsch', done: false, status: null }],
  google_calendars: [], google_calendar_connections: [], notification_prefs: [], push_subscriptions: [], household_members: [], gamification_events: [],
};

function applyFilters(rows, params) {
  let out = rows.slice();
  for (const [k, v] of params) {
    if (['select','order','limit','offset','on_conflict','columns'].includes(k)) continue;
    const m = /^(eq|neq|gte|lte|gt|lt|is|in|not)\.(.*)$/.exec(v);
    if (!m) continue;
    const [, op, val] = m;
    out = out.filter((r) => {
      const x = r[k];
      if (op === 'eq') return String(x) === val;
      if (op === 'neq') return String(x) !== val;
      if (op === 'is') return val === 'null' ? x == null : x === (val === 'true');
      if (op === 'gte') return x != null && String(x) >= val;
      if (op === 'lte') return x != null && String(x) <= val;
      if (op === 'gt') return x != null && String(x) > val;
      if (op === 'lt') return x != null && String(x) < val;
      if (op === 'in') return val.replace(/[()]/g,'').split(',').includes(String(x));
      return true;
    });
  }
  return out;
}

export async function installMock(ctx, { log } = {}) {
  const unknown = new Set();
  await ctx.route('https://mock.nestua.de/**', async (route) => {
    const req = route.request();
    const u = new URL(req.url());
    const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*', 'content-type': 'application/json' };
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors });
    if (u.pathname === '/auth/v1/token') return route.fulfill({ status: 200, headers: cors, body: JSON.stringify({ access_token: jwt({ sub: OWNER, role: 'authenticated', exp: 4102444800 }), refresh_token: 'r2', expires_in: 3600, token_type: 'bearer', user: { id: OWNER, email: 'test@example.com' } }) });
    const m = /\/rest\/v1\/([a-z_]+)$/.exec(u.pathname);
    if (!m) { unknown.add(req.method() + ' ' + u.pathname); return route.fulfill({ status: 200, headers: cors, body: '[]' }); }
    const table = m[1];
    if (req.method() !== 'GET') {
      // Schreibzugriffe: erfolgreich quittieren, Zeile zurückgeben
      let body = {}; try { body = JSON.parse(req.postData() || '{}'); } catch {}
      const row = Array.isArray(body) ? body[0] : body;
      return route.fulfill({ status: 200, headers: cors, body: JSON.stringify(req.headers()['prefer']?.includes('return=representation') ? [ { id: uid(), ...base, ...row } ] : []) });
    }
    if (!(table in TABLES)) { unknown.add('GET ' + table); return route.fulfill({ status: 200, headers: cors, body: '[]' }); }
    let rows = applyFilters(TABLES[table], u.searchParams);
    if (!/sho_items!/.test(u.searchParams.get('select') || '')) rows = rows.map(({ sho_items, ...r }) => r);
    const single = (req.headers()['accept'] || '').includes('vnd.pgrst.object');
    if (single) {
      if (!rows.length) return route.fulfill({ status: 406, headers: cors, body: JSON.stringify({ code: 'PGRST116', message: 'none', details: '', hint: '' }) });
      return route.fulfill({ status: 200, headers: cors, body: JSON.stringify(rows[0]) });
    }
    return route.fulfill({ status: 200, headers: cors, body: JSON.stringify(rows) });
  });
  return unknown;
}

const jwt = (o) => 'x.' + Buffer.from(JSON.stringify(o)).toString('base64url') + '.y';
export async function newPage(browser, { dark = false, width = 390, height = 844 } = {}) {
  const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 2, colorScheme: dark ? 'dark' : 'light', locale: 'de-DE', timezoneId: 'Europe/Berlin' });
  const unknown = await installMock(ctx);
  await ctx.addInitScript((s) => {
    localStorage.setItem('nestua_session', JSON.stringify(s));
    localStorage.setItem('nestua_analytics_consent:11111111-1111-1111-1111-111111111111', 'denied');
    localStorage.setItem('mode', s.__dark ? 'dark' : 'light');
  }, { access_token: jwt({ sub: OWNER, role: 'authenticated', exp: 4102444800 }), refresh_token: 'r', expires_in: 3600, expires_at: Date.now() + 3600 * 1000 * 24 * 365, token_type: 'bearer', user: { id: OWNER, email: 'test@example.com' }, __dark: dark });
  const page = await ctx.newPage();
  await page.clock.setFixedTime(new Date('2026-10-27T11:50:00+01:00'));
  const errs = [];
  page.on('pageerror', (e) => errs.push('PAGEERR ' + e.message + ' ' + (e.stack||'').split('\n').slice(1,4).join(' | ')));
  page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource|favicon/.test(m.text())) errs.push(m.text().slice(0, 200)); });
  return { page, ctx, errs, unknown };
}
