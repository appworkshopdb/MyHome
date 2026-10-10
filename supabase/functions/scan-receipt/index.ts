// Foto-Scans per Claude Vision. Eine Function, zwei Arten (Feld `kind`):
//   receipt  Kassenbon → Betrag/Händler/Datum/Zahlungsart   (Finanz-Wizard)
//   meal     Mahlzeit  → geschätzte Bestandteile + Nährwerte (Ernährung)
// (Der Name "scan-receipt" ist historisch — die App ruft ihn so auf.)
//
// Ablauf: Frontend verkleinert das Foto (JPEG, Base64) und schickt es per POST
// hierher. Die Function prüft das JWT, fragt Claude nach festem JSON-Schema
// und gibt die geprüften Felder zurück. Gespeichert wird hier NICHTS — weder
// das Foto noch das Ergebnis; das Frontend zeigt es nur an bzw. befüllt damit
// ein Formular, der Nutzer bestätigt.
//
// Server-Konfiguration (Umgebung des Edge-Functions-Containers):
//   ANTHROPIC_API_KEY      Pflicht. Niemals ins Repo.
//   RECEIPT_MODEL          Optional, Default claude-sonnet-5-5 (z. B. claude-haiku-4-5).
//   MEAL_MODEL             Optional, Default = RECEIPT_MODEL.
//   RECEIPT_MONTHLY_LIMIT  Optional, Beleg-Scans pro Nutzer und Kalendermonat (Europe/Berlin), Default 30.
//   MEAL_MONTHLY_LIMIT     Optional, Mahlzeit-Scans pro Nutzer und Kalendermonat, Default 30.
//                          Zähler liegt in der Tabelle receipt_scans (supabase/receipt_scans_migration.sql),
//                          je Art getrennt (Spalte kind). Dort stehen auch Modell, Tokens und Kosten
//                          (USD) je Scan — für die Kostenkontrolle, nirgends in der App sichtbar.
//
// Endpunkte:
//   POST  {kind?, image, media_type, foods?} → { ok, receipt | meal, quota }; 429 bei erreichtem Monatslimit
//         kind fehlt → 'receipt' (ältere App-Versionen)
//         foods (nur kind 'meal'): Lebensmittel der App [{id, name, group?, kcal, protein, carbs, sugar, fat,
//         satfat, fiber, salt}] (Werte pro 100 g/ml). Mit Liste ordnet die KI erkannte Bestandteile
//         Lebensmitteln zu, und die Nährwerte kommen aus der Liste statt aus der Schätzung der KI;
//         nur Bestandteile ohne Treffer werden weiter geschätzt. Ohne Liste: wie bisher.
//   GET   ?kind=receipt|meal → Restkontingent { ok, quota } (kostet nichts, zählt nicht)
//
// CORS: bewusst keine eigenen Header — wie bei den anderen Functions setzt
// das Kong-Gateway des Supabase-Stacks sie, doppelte Header würden brechen.

import Anthropic from 'npm:@anthropic-ai/sdk';
import { createClient } from 'npm:@supabase/supabase-js@2';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const MODEL = Deno.env.get('RECEIPT_MODEL') || 'claude-sonnet-5-5';
const MEAL_MODEL = Deno.env.get('MEAL_MODEL') || MODEL;

function limitFromEnv(name: string): number {
  const n = parseInt(Deno.env.get(name) ?? '', 10);
  return Number.isFinite(n) && n > 0 ? n : 30;
}
const supabase = createClient(supabaseUrl, serviceRoleKey);

// Das Frontend verkleinert auf ~1600 px (typisch 200–500 KB). Alles darüber
// ist kein Foto aus unserer App und wird abgelehnt, bevor es Geld kostet.
const MAX_BASE64_CHARS = 3_000_000;
const ALLOWED_MEDIA_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const PAYMENT_METHODS = ['bar', 'karte', 'paypal', 'gutschein', 'klarna', 'sonstige', 'unbekannt'];

type Kind = 'receipt' | 'meal';

// ── Kassenbon ────────────────────────────────────────────────────────────────
const RECEIPT_PROMPT = `Du liest Fotos von Kassenbons und Quittungen (meist deutsch, Euro) und gibst die Felder im vorgegebenen JSON-Schema zurück.

Regeln:
- total: der Endbetrag, den der Kunde bezahlt hat ("SUMME", "Gesamt", "zu zahlen", "Total"). NICHT Zwischensumme, NICHT Mehrwertsteuer-Zeilen, NICHT "gegeben"/"Bar" und NICHT "Rückgeld". Als Zahl mit Punkt als Dezimaltrenner (12.49).
- merchant: Name des Geschäfts in kurzer Form (z. B. "REWE", "dm", "Aral"), ohne Adresse und Filialnummer.
- date: Datum des Einkaufs als YYYY-MM-DD.
- payment_method: womit bezahlt wurde. "bar" (Bargeld), "karte" (EC/Girocard/Kredit/Visa/Mastercard/Apple Pay/Lastschrift), "paypal", "gutschein" (Gutschein/Geschenkkarte), "klarna", "sonstige" (alles andere) oder "unbekannt", wenn der Beleg keine Zahlungsart zeigt. Bei gemischter Zahlung die Art, mit der der größte Teil bezahlt wurde.
- Ist ein Wert nicht sicher lesbar, gib null zurück. Rate niemals einen Betrag.
- Zeigt das Foto keinen Kassenbon, setze is_receipt auf false und alle anderen Felder auf null bzw. "unbekannt".`;

const RECEIPT_SCHEMA = {
  type: 'object',
  properties: {
    is_receipt: { type: 'boolean' },
    total: { anyOf: [{ type: 'number' }, { type: 'null' }] },
    merchant: { anyOf: [{ type: 'string' }, { type: 'null' }] },
    date: { anyOf: [{ type: 'string' }, { type: 'null' }] },
    payment_method: { type: 'string', enum: PAYMENT_METHODS },
  },
  required: ['is_receipt', 'total', 'merchant', 'date', 'payment_method'],
  additionalProperties: false,
};

// ── Mahlzeit ─────────────────────────────────────────────────────────────────
const MEAL_PROMPT = `Du bekommst das Foto einer Mahlzeit (Teller, Schüssel, Snack, Getränk) und schätzt die Nährwerte. Du gibst die Felder im vorgegebenen JSON-Schema zurück.

Regeln:
- name: kurzer deutscher Name des Gerichts (z. B. "Spaghetti Bolognese").
- items: die sichtbaren Bestandteile (z. B. "Spaghetti, gekocht", "Hackfleischsoße", "Parmesan"). Höchstens 10, die kalorienreichsten zuerst; Kleinstmengen unter etwa 10 kcal weglassen.
- grams: geschätztes Gewicht der Portion dieses Bestandteils im zubereiteten Zustand, als Zahl. Nutze Größenanhaltspunkte auf dem Foto (Tellerdurchmesser etwa 26 cm, Besteck, Hände, Verpackung).
- kcal, protein, carbs, sugar, fat, satfat, fiber, salt: Nährwerte genau für diese Menge (grams), NICHT pro 100 g. kcal in kcal, alle anderen in Gramm. Berücksichtige übliche Zubereitung (Öl, Butter, Dressing), wenn sie erkennbar oder bei diesem Gericht üblich ist.
- kcal_low / kcal_high: realistische Unter- und Obergrenze der Gesamtkalorien der ganzen Mahlzeit. Sei ehrlich breit, wenn Portionsgröße oder Zutaten unsicher sind.
- note: ein kurzer deutscher Satz dazu, was die Schätzung am meisten unsicher macht (z. B. "Menge der Soße nicht erkennbar"), sonst null.
- Triff keine Aussagen zu Allergenen, Unverträglichkeiten, Diäten oder Gesundheit.
- Zeigt das Foto kein Essen oder Trinken, setze is_meal auf false, items auf eine leere Liste und alle übrigen Felder auf null.`;

const NUM = { type: 'number' };
const MEAL_ITEM_SCHEMA = {
  type: 'object',
  properties: {
    name: { type: 'string' },
    grams: NUM, kcal: NUM, protein: NUM, carbs: NUM, sugar: NUM, fat: NUM, satfat: NUM, fiber: NUM, salt: NUM,
  },
  required: ['name', 'grams', 'kcal', 'protein', 'carbs', 'sugar', 'fat', 'satfat', 'fiber', 'salt'],
  additionalProperties: false,
};
const MEAL_SCHEMA = {
  type: 'object',
  properties: {
    is_meal: { type: 'boolean' },
    name: { anyOf: [{ type: 'string' }, { type: 'null' }] },
    items: { type: 'array', items: MEAL_ITEM_SCHEMA },
    kcal_low: { anyOf: [NUM, { type: 'null' }] },
    kcal_high: { anyOf: [NUM, { type: 'null' }] },
    note: { anyOf: [{ type: 'string' }, { type: 'null' }] },
  },
  required: ['is_meal', 'name', 'items', 'kcal_low', 'kcal_high', 'note'],
  additionalProperties: false,
};

// ── Mahlzeit mit Lebensmittel-Liste der App (Variante "foods") ───────────────
// Die KI erkennt weiterhin Bestandteile und Mengen, ordnet sie aber einem
// Lebensmittel der Liste zu (food_ref = Nummer in der Liste). Nährwerte setzt
// dann diese Function aus den Listenwerten ein; die KI schätzt sie nur für
// Bestandteile ohne Treffer. So bleiben Scan und eigene Rezepte vergleichbar.
const MAX_FOODS = 1000;
const FOOD_KEYS = ['kcal', 'protein', 'carbs', 'sugar', 'fat', 'satfat', 'fiber', 'salt'] as const;

// Die Liste kostet bei jedem Scan Eingabe-Tokens, deshalb schlank halten:
//  - Gruppen, die auf einem Foto kaum erkennbar sind und kaum Kalorien beitragen
//    (Gewürze, Süßungsmittel), stehen nicht in der Liste. Solche Bestandteile schätzt
//    die KI wie Zutaten ohne Treffer.
//  - Der kcal-Wert dient nur dazu, den Zustand eines Eintrags zu erkennen (trocken/
//    roh/gekocht). Wo das keine Rolle spielt, entfällt er. Unbekannte oder fehlende
//    Gruppen behalten ihn (sicherer Standard).
const LIST_EXCLUDED_GROUPS = new Set(['Gewürze', 'Süßungsmittel']);
const LIST_NO_KCAL_GROUPS = new Set([
  'Getränke', 'Eier & Milchprodukte', 'Obst', 'Nüsse, Samen & Kerne', 'Fette & Öle', 'Snacks & Süßes',
]);

const MEAL_PROMPT_FOODS = `Du bekommst das Foto einer Mahlzeit (Teller, Schüssel, Snack, Getränk) und die Lebensmittelliste einer App (Nr | Name | kcal pro 100 g; der kcal-Wert steht nur bei Einträgen, bei denen der Zustand wichtig ist, z. B. Nudeln, Reis, Fleisch). Gewürze und Süßungsmittel stehen nicht in der Liste, dafür gilt food_ref null. Du erkennst die Bestandteile, schätzt ihre Menge und ordnest sie nach Möglichkeit Lebensmitteln der Liste zu. Du gibst die Felder im vorgegebenen JSON-Schema zurück.

Regeln:
- name: kurzer deutscher Name des Gerichts (z. B. "Spaghetti Bolognese").
- items: die sichtbaren Bestandteile (z. B. "Spaghetti, gekocht", "Hackfleischsoße", "Parmesan"). Höchstens 10, die kalorienreichsten zuerst; Kleinstmengen unter etwa 10 kcal weglassen.
- grams: geschätztes Gewicht der Portion dieses Bestandteils im zubereiteten Zustand, als Zahl. Nutze Größenanhaltspunkte auf dem Foto (Tellerdurchmesser etwa 26 cm, Besteck, Hände, Verpackung).
- food_ref: die Nummer des Listeneintrags, wenn der Bestandteil genau dieses Lebensmittel ist (gleiche Sorte). Im Zweifel null. Wähle nie einen nur ähnlichen Eintrag und nie ein Einzelprodukt für eine Mischung: "Hackfleischsoße" ist kein "Hackfleisch", "Nudelsalat" ist keine "Nudel".
- db_grams: nur bei food_ref (sonst null). Das Gewicht des Bestandteils in dem Zustand, auf den sich die Werte des Listeneintrags beziehen (Werte pro 100 g). Der kcal-Wert in der Liste zeigt den Zustand: Nudeln mit etwa 350 kcal pro 100 g sind trocken, gekochte haben etwa 130–160. Beispiel: 220 g gekochte Spaghetti und Eintrag "Weiße Nudeln, 358 kcal" ergeben db_grams ≈ 90. Passt der Zustand schon oder steht kein kcal-Wert, ist db_grams gleich grams. Bei Getränken und Flüssigkeiten zählt 1 ml wie 1 g.
- kcal, protein, carbs, sugar, fat, satfat, fiber, salt: Nährwerte genau für diese Menge (grams), NICHT pro 100 g. kcal in kcal, alle anderen in Gramm. Nur für Bestandteile OHNE food_ref schätzen, bei food_ref alle acht Werte null. Berücksichtige übliche Zubereitung (Öl, Butter, Dressing), wenn sie erkennbar oder bei diesem Gericht üblich ist.
- range_minus_pct / range_plus_pct: wie viel Prozent die Gesamtkalorien der ganzen Mahlzeit realistisch nach unten bzw. nach oben abweichen können (5 bis 60), vor allem wegen Portionsgröße und unsichtbarer Zutaten. Sei ehrlich breit, wenn vieles unsicher ist.
- note: ein kurzer deutscher Satz dazu, was die Schätzung am meisten unsicher macht (z. B. "Menge der Soße nicht erkennbar"), sonst null.
- Triff keine Aussagen zu Allergenen, Unverträglichkeiten, Diäten oder Gesundheit.
- Zeigt das Foto kein Essen oder Trinken, setze is_meal auf false, items auf eine leere Liste und alle übrigen Felder auf null.`;

const NUM_OR_NULL = { anyOf: [NUM, { type: 'null' }] };
const MEAL_ITEM_SCHEMA_FOODS = {
  type: 'object',
  properties: {
    name: { type: 'string' },
    grams: NUM,
    food_ref: { anyOf: [{ type: 'integer' }, { type: 'null' }] },
    db_grams: NUM_OR_NULL,
    kcal: NUM_OR_NULL, protein: NUM_OR_NULL, carbs: NUM_OR_NULL, sugar: NUM_OR_NULL,
    fat: NUM_OR_NULL, satfat: NUM_OR_NULL, fiber: NUM_OR_NULL, salt: NUM_OR_NULL,
  },
  required: ['name', 'grams', 'food_ref', 'db_grams', 'kcal', 'protein', 'carbs', 'sugar', 'fat', 'satfat', 'fiber', 'salt'],
  additionalProperties: false,
};
const MEAL_SCHEMA_FOODS = {
  type: 'object',
  properties: {
    is_meal: { type: 'boolean' },
    name: { anyOf: [{ type: 'string' }, { type: 'null' }] },
    items: { type: 'array', items: MEAL_ITEM_SCHEMA_FOODS },
    range_minus_pct: NUM_OR_NULL,
    range_plus_pct: NUM_OR_NULL,
    note: { anyOf: [{ type: 'string' }, { type: 'null' }] },
  },
  required: ['is_meal', 'name', 'items', 'range_minus_pct', 'range_plus_pct', 'note'],
  additionalProperties: false,
};

type Food = { id: string | number; name: string; group: string | null; per100: Record<typeof FOOD_KEYS[number], number> };

// Liste aus dem Request prüfen. Fehlt sie oder ist sie leer/ungültig → null (alte Variante).
function parseFoods(raw: unknown): Food[] | null {
  if (!Array.isArray(raw) || raw.length === 0) return null;
  const foods: Food[] = [];
  for (const f of raw.slice(0, MAX_FOODS)) {
    const idOk = (typeof f?.id === 'number' && Number.isFinite(f.id)) || (typeof f?.id === 'string' && f.id.length > 0 && f.id.length <= 64);
    const name = typeof f?.name === 'string' ? f.name.replace(/\s+/g, ' ').trim().slice(0, 60) : '';
    if (!idOk || !name) continue;
    const group = typeof f?.group === 'string' ? f.group.trim().slice(0, 60) || null : null;
    if (group && LIST_EXCLUDED_GROUPS.has(group)) continue;
    const per100: any = {};
    let valid = true;
    for (const k of FOOD_KEYS) {
      const v = boundedNum(f[k], 1000, 2);
      if (v === null) { valid = false; break; }
      per100[k] = v;
    }
    if (valid) foods.push({ id: f.id, name, group, per100 });
  }
  return foods.length > 0 ? foods : null;
}

// Liste für die KI: "Nr | Name | kcal pro 100 g" (Nummer = Position in `foods`);
// der kcal-Wert entfällt bei Gruppen, in denen der Zustand keine Rolle spielt.
function foodListText(foods: Food[]): string {
  return foods
    .map((f, i) => (f.group && LIST_NO_KCAL_GROUPS.has(f.group) ? `${i} | ${f.name}` : `${i} | ${f.name} | ${Math.round(f.per100.kcal)}`))
    .join('\n');
}

// Erst beim ersten Aufruf anlegen: ohne ANTHROPIC_API_KEY wirft der Konstruktor,
// und das soll als verständliche 503 beim Scan ankommen, nicht als Boot-Fehler.
let anthropicClient: Anthropic | null = null;
function getAnthropic() {
  if (!Deno.env.get('ANTHROPIC_API_KEY')) throw new HttpError(503, 'Die Foto-Erkennung ist nicht eingerichtet');
  return (anthropicClient ??= new Anthropic());
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

class HttpError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

// Pro Art: Modell, Prompt, Schema, Antwortlänge, Monatslimit und Bezeichnungen.
const KINDS: Record<Kind, {
  model: string; prompt: string; schema: object; maxTokens: number; userText: string;
  limit: number; limitLabel: string; failText: string;
}> = {
  receipt: {
    model: MODEL, prompt: RECEIPT_PROMPT, schema: RECEIPT_SCHEMA, maxTokens: 1024, userText: 'Lies diesen Kassenbon.',
    limit: limitFromEnv('RECEIPT_MONTHLY_LIMIT'), limitLabel: 'Scans', failText: 'Der Beleg konnte nicht gelesen werden',
  },
  meal: {
    model: MEAL_MODEL, prompt: MEAL_PROMPT, schema: MEAL_SCHEMA, maxTokens: 2048, userText: 'Schätze die Nährwerte dieser Mahlzeit.',
    limit: limitFromEnv('MEAL_MONTHLY_LIMIT'), limitLabel: 'Mahlzeit-Scans', failText: 'Die Mahlzeit konnte nicht gelesen werden',
  },
};

// Preise in USD pro 1 Mio. Tokens [Input, Output] (Stand der Modelltabelle, Okt. 2026).
// Nur zur Kostenkontrolle: Die Tokens werden immer gespeichert, die Kosten sind
// ein Schnappschuss und bei unbekanntem Modell NULL (dann aus den Tokens nachrechnen).
const PRICES: Record<string, [number, number]> = {
  'claude-sonnet-5-5': [2, 10], 'claude-sonnet-5': [2, 10], 'claude-sonnet-4-6': [3, 15],
  'claude-haiku-4-5': [1, 5],
  'claude-opus-5-5': [4, 20], 'claude-opus-5': [5, 25], 'claude-opus-4-8': [5, 25],
  'claude-opus-4-7': [5, 25], 'claude-opus-4-6': [5, 25],
  'claude-fable-5-1': [10, 50], 'claude-fable-5': [10, 50],
};

function costUsd(model: string, usage: any): number | null {
  const p = PRICES[model];
  if (!p || typeof usage?.input_tokens !== 'number' || typeof usage?.output_tokens !== 'number') return null;
  return Math.round(((usage.input_tokens * p[0] + usage.output_tokens * p[1]) / 1e6) * 1e6) / 1e6;
}

// Verbrauch an der reservierten Zeile festhalten. Darf den Scan nie scheitern lassen:
// Der Nutzer hat sein Ergebnis, ein Logging-Fehler wird nur protokolliert.
async function recordUsage(id: string, model: string, usage: any) {
  const { error } = await supabase.from('receipt_scans').update({
    model,
    input_tokens: usage?.input_tokens ?? null,
    output_tokens: usage?.output_tokens ?? null,
    cost_usd: costUsd(model, usage),
  }).eq('id', id);
  if (error) console.error('[scan-receipt] Verbrauch nicht gespeichert', id, error);
}

function parseKind(v: unknown): Kind {
  if (v === undefined || v === null || v === '') return 'receipt'; // ältere App-Versionen
  if (v === 'receipt' || v === 'meal') return v;
  throw new HttpError(400, 'Unbekannte Art des Scans');
}

// Gleiche Prüfung wie in google-calendar-sync: JWT gegen die Auth-API.
async function requireUser(req: Request) {
  const auth = req.headers.get('Authorization');
  if (!auth?.startsWith('Bearer ')) throw new HttpError(401, 'Nicht eingeloggt');
  const res = await fetch(`${supabaseUrl}/auth/v1/user`, { headers: { Authorization: auth, apikey: serviceRoleKey } });
  if (!res.ok) throw new HttpError(401, 'Nicht eingeloggt');
  const user = await res.json();
  if (!user?.id) throw new HttpError(401, 'Nicht eingeloggt');
  return user.id as string;
}

// ── Monatskontingent ─────────────────────────────────────────────────────────
// Kalendermonat in Berlin als 'YYYY-MM' (der Monatswechsel gilt nach deutscher
// Uhrzeit, nicht nach UTC). Über Intl-Teile statt Date-Rechnung, damit keine
// UTC-Verschiebung hineinspielt (siehe CLAUDE.md "Lokale Datums-Strings").
function currentPeriod(now = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Berlin', year: 'numeric', month: '2-digit' }).formatToParts(now);
  const y = parts.find((p) => p.type === 'year')!.value;
  const m = parts.find((p) => p.type === 'month')!.value;
  return `${y}-${m}`;
}

async function countUsed(ownerId: string, period: string, kind: Kind): Promise<number> {
  const { count, error } = await supabase
    .from('receipt_scans')
    .select('id', { count: 'exact', head: true })
    .eq('owner_id', ownerId)
    .eq('period', period)
    .eq('kind', kind);
  if (error || count == null) {
    console.error('[scan-receipt] Kontingent nicht lesbar', error);
    throw new HttpError(503, 'Scan-Kontingent gerade nicht verfügbar');
  }
  return count;
}

function quotaOf(used: number, kind: Kind) {
  const limit = KINDS[kind].limit;
  return { limit, used, remaining: Math.max(0, limit - used) };
}

// Erst eintragen, dann zählen: So können parallele Anfragen desselben Nutzers
// das Limit nicht überlaufen (im Zweifel werden beide abgewiesen, nie beide
// durchgelassen). Wird nach der Reservierung abgewiesen, ist der Eintrag
// wieder weg.
async function reserveScan(ownerId: string, kind: Kind) {
  const period = currentPeriod();
  const { data: row, error } = await supabase
    .from('receipt_scans')
    .insert({ owner_id: ownerId, period, kind })
    .select('id')
    .single();
  if (error || !row) {
    console.error('[scan-receipt] Reservierung fehlgeschlagen', error);
    throw new HttpError(503, 'Scan-Kontingent gerade nicht verfügbar');
  }
  let used: number;
  try { used = await countUsed(ownerId, period, kind); }
  catch (e) { await releaseScan(row.id); throw e; }
  const { limit, limitLabel } = KINDS[kind];
  if (used > limit) {
    await releaseScan(row.id);
    throw new HttpError(429, `Monatslimit von ${limit} ${limitLabel} erreicht. Ab dem nächsten Monat sind wieder Scans möglich – manuell eintragen geht weiterhin.`);
  }
  return { id: row.id as string, quota: quotaOf(used, kind) };
}

async function releaseScan(id: string) {
  const { error } = await supabase.from('receipt_scans').delete().eq('id', id);
  if (error) console.error('[scan-receipt] Freigabe fehlgeschlagen', id, error);
}

// Modellabhängige Parameter: Die Extraktion braucht kein tiefes Nachdenken.
//  - Sonnet 5.5: "between_tools" ist die niedrigste Denkstufe (disabled → 400).
//  - Haiku 4.5: kein Denken ohne Budget, "effort" wird dort abgelehnt.
//  - alles andere (Opus 5.x, Fable): Denken nicht abschaltbar → effort "low".
function modelParams(model: string) {
  if (model.startsWith('claude-haiku')) return { outputExtra: {}, thinking: undefined };
  if (model === 'claude-sonnet-5-5') return { outputExtra: {}, thinking: { type: 'between_tools' } };
  return { outputExtra: { effort: 'low' }, thinking: undefined };
}

// Datum nur als echten Kalendertag akzeptieren (kein Date-Objekt → keine
// UTC-Verschiebung, siehe CLAUDE.md "Lokale Datums-Strings").
function validDate(s: unknown): string | null {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const [y, m, d] = s.split('-').map(Number);
  if (y < 2000 || m < 1 || m > 12 || d < 1) return null;
  const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return d <= daysInMonth ? s : null;
}

function cleanResult(raw: any) {
  const isReceipt = raw?.is_receipt === true;
  const totalNum = typeof raw?.total === 'number' && Number.isFinite(raw.total) ? Math.round(raw.total * 100) / 100 : null;
  const merchant = typeof raw?.merchant === 'string' ? raw.merchant.trim().slice(0, 80) || null : null;
  return {
    is_receipt: isReceipt,
    // Betrag nur plausibel akzeptieren — lieber leer lassen als falsch vorbefüllen.
    total: isReceipt && totalNum !== null && totalNum > 0 && totalNum < 100000 ? totalNum : null,
    merchant: isReceipt ? merchant : null,
    date: isReceipt ? validDate(raw?.date) : null,
    payment_method: PAYMENT_METHODS.includes(raw?.payment_method) ? raw.payment_method : 'unbekannt',
  };
}

// Zahl in [0, max] oder null; auf `digits` Nachkommastellen gerundet.
function boundedNum(v: unknown, max: number, digits = 1): number | null {
  if (typeof v !== 'number' || !Number.isFinite(v) || v < 0 || v > max) return null;
  const f = 10 ** digits;
  return Math.round(v * f) / f;
}

// Mahlzeit: Bestandteile mit unmöglichen Werten fliegen raus (statt falsche
// Zahlen anzuzeigen). Die Gesamtspanne wird so geklemmt, dass sie die Summe
// der Bestandteile immer einschließt.
function cleanMeal(raw: any) {
  const items = (Array.isArray(raw?.items) ? raw.items : []).slice(0, 12).flatMap((it: any) => {
    const name = typeof it?.name === 'string' ? it.name.trim().slice(0, 60) : '';
    const grams = boundedNum(it?.grams, 3000, 0);
    const kcal = boundedNum(it?.kcal, 5000, 0);
    const protein = boundedNum(it?.protein, 500);
    const carbs = boundedNum(it?.carbs, 800);
    const sugar = boundedNum(it?.sugar, 800);
    const fat = boundedNum(it?.fat, 500);
    const satfat = boundedNum(it?.satfat, 500);
    const fiber = boundedNum(it?.fiber, 200);
    const salt = boundedNum(it?.salt, 50);
    if (!name || !grams || grams <= 0 || kcal === null || protein === null || carbs === null || sugar === null
      || fat === null || satfat === null || fiber === null || salt === null) return [];
    return [{ name, grams, kcal, protein, carbs, sugar, fat, satfat, fiber, salt }];
  });

  const isMeal = raw?.is_meal === true && items.length > 0;
  if (!isMeal) return { is_meal: false, name: null, items: [], kcal_low: null, kcal_high: null, note: null };

  const sumKcal = items.reduce((s: number, i: { kcal: number }) => s + i.kcal, 0);
  const low = boundedNum(raw?.kcal_low, 20000, 0);
  const high = boundedNum(raw?.kcal_high, 20000, 0);
  return {
    is_meal: true,
    name: typeof raw?.name === 'string' ? raw.name.trim().slice(0, 80) || null : null,
    items,
    kcal_low: Math.min(low ?? sumKcal, sumKcal),
    kcal_high: Math.max(high ?? sumKcal, sumKcal),
    note: typeof raw?.note === 'string' ? raw.note.trim().slice(0, 200) || null : null,
  };
}

// Variante mit Lebensmittel-Liste. Bestandteil mit gültigem food_ref: Nährwerte aus
// der Liste (Werte pro 100 g × db_grams / 100). Ohne Treffer: geschätzte Werte der
// KI, genauso geprüft wie in cleanMeal. Antwortform wie cleanMeal, je Bestandteil
// zusätzlich src ('db' | 'ai'), bei 'db' auch food_id und food_name.
function cleanMealFoods(raw: any, foods: Food[]) {
  const items = (Array.isArray(raw?.items) ? raw.items : []).slice(0, 12).flatMap((it: any) => {
    const name = typeof it?.name === 'string' ? it.name.trim().slice(0, 60) : '';
    const grams = boundedNum(it?.grams, 3000, 0);
    if (!name || !grams || grams <= 0) return [];

    const ref = Number.isInteger(it?.food_ref) && it.food_ref >= 0 && it.food_ref < foods.length ? foods[it.food_ref] : null;
    if (ref) {
      // db_grams fehlt oder ist unsinnig → Zustand als gleich annehmen
      const dbGrams = boundedNum(it?.db_grams, 3000, 1);
      const useGrams = dbGrams && dbGrams > 0 && dbGrams <= grams * 4 && dbGrams >= grams / 4 ? dbGrams : grams;
      const f = useGrams / 100;
      const n: any = {};
      for (const k of FOOD_KEYS) n[k] = Math.round(ref.per100[k] * f * 10) / 10;
      n.kcal = Math.round(n.kcal);
      return [{ name, grams, ...n, src: 'db', food_id: ref.id, food_name: ref.name }];
    }

    const kcal = boundedNum(it?.kcal, 5000, 0);
    const protein = boundedNum(it?.protein, 500);
    const carbs = boundedNum(it?.carbs, 800);
    const sugar = boundedNum(it?.sugar, 800);
    const fat = boundedNum(it?.fat, 500);
    const satfat = boundedNum(it?.satfat, 500);
    const fiber = boundedNum(it?.fiber, 200);
    const salt = boundedNum(it?.salt, 50);
    if (kcal === null || protein === null || carbs === null || sugar === null
      || fat === null || satfat === null || fiber === null || salt === null) return [];
    return [{ name, grams, kcal, protein, carbs, sugar, fat, satfat, fiber, salt, src: 'ai' }];
  });

  if (!(raw?.is_meal === true && items.length > 0)) {
    return { is_meal: false, name: null, items: [], kcal_low: null, kcal_high: null, note: null };
  }

  // Spanne in Prozent von der KI, auf die tatsächliche Summe angewendet
  const sumKcal = items.reduce((s: number, i: { kcal: number }) => s + i.kcal, 0);
  const minus = boundedNum(raw?.range_minus_pct, 100, 0);
  const plus = boundedNum(raw?.range_plus_pct, 200, 0);
  const lo = Math.min(Math.max(minus ?? 25, 5), 60);
  const hi = Math.min(Math.max(plus ?? 25, 5), 60);
  return {
    is_meal: true,
    name: typeof raw?.name === 'string' ? raw.name.trim().slice(0, 80) || null : null,
    items,
    kcal_low: Math.round(sumKcal * (1 - lo / 100)),
    kcal_high: Math.round(sumKcal * (1 + hi / 100)),
    note: typeof raw?.note === 'string' ? raw.note.trim().slice(0, 200) || null : null,
  };
}

Deno.serve(async (req) => {
  try {
    if (req.method !== 'GET' && req.method !== 'POST') throw new HttpError(405, 'Nur GET und POST erlaubt');
    const ownerId = await requireUser(req);

    // Restkontingent für die Anzeige in der App — kostet nichts, zählt nicht.
    if (req.method === 'GET') {
      const kind = parseKind(new URL(req.url).searchParams.get('kind'));
      return json({ ok: true, quota: quotaOf(await countUsed(ownerId, currentPeriod(), kind), kind) });
    }

    const body = await req.json().catch(() => null);
    const kind = parseKind(body?.kind);
    const cfg = KINDS[kind];
    const image = body?.image;
    const mediaType = body?.media_type;
    if (typeof image !== 'string' || !image) throw new HttpError(400, 'Kein Bild übermittelt');
    if (!ALLOWED_MEDIA_TYPES.has(mediaType)) throw new HttpError(400, 'Bildformat nicht unterstützt');
    if (image.length > MAX_BASE64_CHARS) throw new HttpError(413, 'Bild ist zu groß');

    // Lebensmittel-Liste nur für Mahlzeiten; sonst/ungültig: Variante ohne Liste
    const foods = kind === 'meal' ? parseFoods(body?.foods) : null;

    const client = getAnthropic(); // vor der Reservierung: fehlt der Key, kostet nichts
    const reservation = await reserveScan(ownerId, kind);

    const { outputExtra, thinking } = modelParams(cfg.model);
    let response: any;
    try {
      response = await client.messages.create({
        model: cfg.model,
        max_tokens: cfg.maxTokens,
        system: foods ? MEAL_PROMPT_FOODS : cfg.prompt,
        ...(thinking ? { thinking } : {}),
        output_config: { format: { type: 'json_schema', schema: foods ? MEAL_SCHEMA_FOODS : cfg.schema }, ...outputExtra },
        messages: [{
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: mediaType, data: image } },
            { type: 'text', text: foods ? `${cfg.userText}\n\nLebensmittelliste (Nr | Name | kcal pro 100 g, wo der Zustand wichtig ist):\n${foodListText(foods)}` : cfg.userText },
          ],
        }],
      } as any);
    } catch (err) {
      // Der Aufruf ist gescheitert, bevor Claude etwas geliefert hat: kein
      // Verbrauch, also zählt der Scan auch nicht gegen das Kontingent.
      await releaseScan(reservation.id);
      throw err;
    }

    // Sofort nach der Antwort: Auch abgelehnte oder unlesbare Antworten kosten Tokens.
    await recordUsage(reservation.id, cfg.model, response.usage);

    if (response.stop_reason === 'refusal') throw new HttpError(422, cfg.failText);
    const textBlock = response.content.find((b: any) => b.type === 'text') as { text: string } | undefined;
    let parsed: unknown;
    try { parsed = JSON.parse(textBlock?.text ?? ''); }
    catch { throw new HttpError(502, 'Antwort der Erkennung war nicht lesbar'); }

    // Kosten-Kontrolle: Tokens pro Scan im Function-Log (kein Bild, keine Inhalte).
    console.log('[scan-receipt]', kind, ownerId, cfg.model, JSON.stringify(response.usage));

    return json(kind === 'meal'
      ? { ok: true, meal: foods ? cleanMealFoods(parsed, foods) : cleanMeal(parsed), quota: reservation.quota }
      : { ok: true, receipt: cleanResult(parsed), quota: reservation.quota });
  } catch (err) {
    if (err instanceof HttpError) return json({ error: err.message }, err.status);
    if (err instanceof Anthropic.RateLimitError) return json({ error: 'Gerade zu viele Anfragen – bitte gleich nochmal versuchen' }, 429);
    if (err instanceof Anthropic.AuthenticationError) {
      console.error('[scan-receipt] ANTHROPIC_API_KEY ungültig oder fehlt');
      return json({ error: 'Die Foto-Erkennung ist nicht eingerichtet' }, 503);
    }
    // Ursache mitschicken (kurz, ohne Geheimnisse): Die App zeigt sie an,
    // damit man am Handy sieht, ob Claude die Anfrage ablehnt oder die Function
    // selbst stolpert. Volle Details stehen im Function-Log.
    console.error('[scan-receipt]', err);
    const detail = err instanceof Anthropic.APIError
      ? `Claude ${err.status}: ${String(err.message).slice(0, 140)}`
      : String((err as Error)?.message ?? err).slice(0, 140);
    return json({ error: 'Das Foto konnte nicht gelesen werden', detail }, 500);
  }
});
