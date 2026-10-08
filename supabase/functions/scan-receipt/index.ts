// Kassenbon-Scan: Foto rein, Betrag/Händler/Datum raus (Claude Vision).
//
// Ablauf: Frontend verkleinert das Foto (JPEG, Base64) und schickt es per POST
// hierher. Die Function prüft das JWT, fragt Claude nach festem JSON-Schema
// und gibt die geprüften Felder zurück. Gespeichert wird hier NICHTS — weder
// das Foto noch das Ergebnis; das Frontend füllt damit nur den Erfassen-
// Wizard vor, der Nutzer bestätigt.
//
// Server-Konfiguration (Umgebung des Edge-Functions-Containers):
//   ANTHROPIC_API_KEY   Pflicht. Niemals ins Repo.
//   RECEIPT_MODEL       Optional, Default claude-sonnet-5-5 (z. B. claude-haiku-4-5).
//
// CORS: bewusst keine eigenen Header — wie bei den anderen Functions setzt
// das Kong-Gateway des Supabase-Stacks sie, doppelte Header würden brechen.

import Anthropic from 'npm:@anthropic-ai/sdk';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const MODEL = Deno.env.get('RECEIPT_MODEL') || 'claude-sonnet-5-5';

// Das Frontend verkleinert auf ~1600 px (typisch 200–500 KB). Alles darüber
// ist kein Beleg-Foto aus unserer App und wird abgelehnt, bevor es Geld kostet.
const MAX_BASE64_CHARS = 3_000_000;
const ALLOWED_MEDIA_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const PAYMENT_METHODS = ['bar', 'karte', 'paypal', 'gutschein', 'klarna', 'sonstige', 'unbekannt'];

const SYSTEM_PROMPT = `Du liest Fotos von Kassenbons und Quittungen (meist deutsch, Euro) und gibst die Felder im vorgegebenen JSON-Schema zurück.

Regeln:
- total: der Endbetrag, den der Kunde bezahlt hat ("SUMME", "Gesamt", "zu zahlen", "Total"). NICHT Zwischensumme, NICHT Mehrwertsteuer-Zeilen, NICHT "gegeben"/"Bar" und NICHT "Rückgeld". Als Zahl mit Punkt als Dezimaltrenner (12.49).
- merchant: Name des Geschäfts in kurzer Form (z. B. "REWE", "dm", "Aral"), ohne Adresse und Filialnummer.
- date: Datum des Einkaufs als YYYY-MM-DD.
- payment_method: womit bezahlt wurde. "bar" (Bargeld), "karte" (EC/Girocard/Kredit/Visa/Mastercard/Apple Pay/Lastschrift), "paypal", "gutschein" (Gutschein/Geschenkkarte), "klarna", "sonstige" (alles andere) oder "unbekannt", wenn der Beleg keine Zahlungsart zeigt. Bei gemischter Zahlung die Art, mit der der größte Teil bezahlt wurde.
- Ist ein Wert nicht sicher lesbar, gib null zurück. Rate niemals einen Betrag.
- Zeigt das Foto keinen Kassenbon, setze is_receipt auf false und alle anderen Felder auf null bzw. "unbekannt".`;

const SCHEMA = {
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

// Erst beim ersten Aufruf anlegen: ohne ANTHROPIC_API_KEY wirft der Konstruktor,
// und das soll als verständliche 503 beim Scan ankommen, nicht als Boot-Fehler.
let anthropicClient: Anthropic | null = null;
function getAnthropic() {
  if (!Deno.env.get('ANTHROPIC_API_KEY')) throw new HttpError(503, 'Beleg-Erkennung ist nicht eingerichtet');
  return (anthropicClient ??= new Anthropic());
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

class HttpError extends Error {
  constructor(public status: number, message: string) { super(message); }
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

// Modellabhängige Parameter: Die Beleg-Extraktion braucht kein Nachdenken.
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

Deno.serve(async (req) => {
  try {
    if (req.method !== 'POST') throw new HttpError(405, 'Nur POST erlaubt');
    const ownerId = await requireUser(req);

    const body = await req.json().catch(() => null);
    const image = body?.image;
    const mediaType = body?.media_type;
    if (typeof image !== 'string' || !image) throw new HttpError(400, 'Kein Bild übermittelt');
    if (!ALLOWED_MEDIA_TYPES.has(mediaType)) throw new HttpError(400, 'Bildformat nicht unterstützt');
    if (image.length > MAX_BASE64_CHARS) throw new HttpError(413, 'Bild ist zu groß');

    const { outputExtra, thinking } = modelParams(MODEL);
    const response = await getAnthropic().messages.create({
      model: MODEL,
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      ...(thinking ? { thinking } : {}),
      output_config: { format: { type: 'json_schema', schema: SCHEMA }, ...outputExtra },
      messages: [{
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: mediaType, data: image } },
          { type: 'text', text: 'Lies diesen Kassenbon.' },
        ],
      }],
    } as any);

    if (response.stop_reason === 'refusal') throw new HttpError(422, 'Der Beleg konnte nicht gelesen werden');
    const textBlock = response.content.find((b: any) => b.type === 'text') as { text: string } | undefined;
    let parsed: unknown;
    try { parsed = JSON.parse(textBlock?.text ?? ''); }
    catch { throw new HttpError(502, 'Antwort der Erkennung war nicht lesbar'); }

    // Kosten-Kontrolle: Tokens pro Scan im Function-Log (kein Bild, keine Inhalte).
    console.log('[scan-receipt]', ownerId, MODEL, JSON.stringify(response.usage));

    return json({ ok: true, receipt: cleanResult(parsed) });
  } catch (err) {
    if (err instanceof HttpError) return json({ error: err.message }, err.status);
    if (err instanceof Anthropic.RateLimitError) return json({ error: 'Gerade zu viele Anfragen – bitte gleich nochmal versuchen' }, 429);
    if (err instanceof Anthropic.AuthenticationError) {
      console.error('[scan-receipt] ANTHROPIC_API_KEY ungültig oder fehlt');
      return json({ error: 'Beleg-Erkennung ist nicht eingerichtet' }, 503);
    }
    // Ursache mitschicken (kurz, ohne Geheimnisse): Die App zeigt sie im Toast,
    // damit man am Handy sieht, ob Claude die Anfrage ablehnt oder die Function
    // selbst stolpert. Volle Details stehen im Function-Log.
    console.error('[scan-receipt]', err);
    const detail = err instanceof Anthropic.APIError
      ? `Claude ${err.status}: ${String(err.message).slice(0, 140)}`
      : String((err as Error)?.message ?? err).slice(0, 140);
    return json({ error: 'Beleg konnte nicht gelesen werden', detail }, 500);
  }
});
