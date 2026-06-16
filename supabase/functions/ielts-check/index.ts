// IELTS Answer Check — Supabase Edge Function
// Javoblarni SERVER tomonida tekshiradi. Faqat to'g'ri savol raqamlarini
// qaytaradi; xato javoblarning to'g'ri varianti "reveal" so'ralgandagina ochiladi.
//
// Endpointlar (POST, JSON body):
//   { action: "check",  initData, book, test, section, part, answers: {q: text} }
//   { action: "reveal", initData, book, test, section, part }
//
// Muhit (Supabase Function Secrets):
//   BOT_TOKEN                  — Telegram initData'ni tasdiqlash uchun (majburiy)
//   SUPABASE_URL               — avtomatik beriladi
//   SUPABASE_SERVICE_ROLE_KEY  — avtomatik beriladi (statistika yozish uchun)

import answers from "./answers.json" with { type: "json" };

type AnswerMap = Record<string, Record<string, string>>;
const ANSWERS = answers as AnswerMap;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const LISTENING: Record<string, [number, number]> = {
  "1": [1, 10], "2": [11, 20], "3": [21, 30], "4": [31, 40],
};
const READING: Record<string, [number, number]> = {
  "1": [1, 13], "2": [14, 26], "3": [27, 40],
};

function partRange(section: string, part: string): [number, number] {
  if (part === "all") return [1, 40];
  const t = section === "listening" ? LISTENING : READING;
  return t[part] ?? [1, 40];
}

// ----------------------------- tekshirgich -----------------------------

const TF_NG: Record<string, string> = {
  true: "true", t: "true",
  false: "false", f: "false",
  notgiven: "notgiven", ng: "notgiven", ngiven: "notgiven",
  yes: "yes", y: "yes",
  no: "no", n: "no",
};

function basicNormalize(text: string): string {
  let s = text.toLowerCase().trim();
  s = s.replace(/[^\p{L}\p{N}\s]/gu, " ");
  s = s.replace(/\s+/g, " ").trim();
  return s;
}

function canonical(text: string): string {
  const norm = basicNormalize(text);
  const collapsed = norm.replace(/\s/g, "");
  if (TF_NG[collapsed]) return TF_NG[collapsed];
  const tokens = norm.split(" ").filter((t) => t && t !== "and");
  const mapped = tokens.map((t) => TF_NG[t] ?? t);
  if (mapped.length <= 1) return mapped[0] ?? "";
  return [...mapped].sort().join("|");
}

function expandOptionals(answer: string): string[] {
  const segments = answer.split(/(\([^)]*\))/);
  let combos: string[] = [""];
  for (const seg of segments) {
    let choices: string[];
    if (seg.startsWith("(") && seg.endsWith(")")) {
      choices = [seg.slice(1, -1), ""];
    } else {
      choices = [seg];
    }
    const next: string[] = [];
    for (const c of combos) for (const ch of choices) next.push(c + ch);
    combos = next;
  }
  return combos;
}

function acceptableVariants(keyAnswer: string): Set<string> {
  const out = new Set<string>();
  for (const alt of keyAnswer.split("/")) {
    const a = alt.trim();
    if (!a) continue;
    for (const expanded of expandOptionals(a)) {
      const c = canonical(expanded);
      if (c) out.add(c);
    }
  }
  return out;
}

function isCorrect(userAnswer: string, keyAnswer: string): boolean {
  if (!userAnswer || !keyAnswer) return false;
  return acceptableVariants(keyAnswer).has(canonical(userAnswer));
}

// --------------------------- initData tekshirish ---------------------------

async function hmac(key: Uint8Array, msg: Uint8Array): Promise<Uint8Array> {
  const k = await crypto.subtle.importKey(
    "raw", key, { name: "HMAC", hash: "SHA-256" }, false, ["sign"],
  );
  return new Uint8Array(await crypto.subtle.sign("HMAC", k, msg));
}

function toHex(bytes: Uint8Array): string {
  return [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function validateInitData(
  initData: string,
  botToken: string,
): Promise<{ ok: boolean; userId?: number; username?: string; firstName?: string }> {
  const params = new URLSearchParams(initData);
  const hash = params.get("hash");
  if (!hash) return { ok: false };
  params.delete("hash");
  const dataCheckString = [...params.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join("\n");

  const enc = new TextEncoder();
  const secret = await hmac(enc.encode("WebAppData"), enc.encode(botToken));
  const computed = toHex(await hmac(secret, enc.encode(dataCheckString)));
  if (computed !== hash) return { ok: false };

  let userId: number | undefined;
  let username: string | undefined;
  let firstName: string | undefined;
  try {
    const u = JSON.parse(params.get("user") ?? "{}");
    userId = u.id;
    username = u.username;
    firstName = u.first_name;
  } catch (_) { /* ignore */ }
  return { ok: true, userId, username, firstName };
}

// ------------------------------- yordamchi -------------------------------

function partAnswers(book: number, test: number, section: string, part: string) {
  const block = ANSWERS[`${book}-${test}-${section}`] ?? {};
  const [lo, hi] = partRange(section, part);
  const out: Record<number, string> = {};
  for (const [q, v] of Object.entries(block)) {
    const n = Number(q);
    if (n >= lo && n <= hi) out[n] = v;
  }
  return out;
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

// ---------------------- statistika (fonda, best-effort) ----------------------

interface StatPayload {
  userId: number;
  username?: string;
  firstName?: string;
  book: number;
  test: number;
  section: string;
  part: string;
  correct: number;
  total: number;
  details: unknown;
}

// Javob qaytarilgandan KEYIN fonda ishlaydi — foydalanuvchini kutdirmaydi.
// supabase-js faqat shu yerda (dinamik) yuklanadi, cold-start'ni tezlashtiradi.
async function recordStats(p: StatPayload): Promise<void> {
  try {
    const url = Deno.env.get("SUPABASE_URL");
    const srk = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!url || !srk) return;
    const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2");
    const sb = createClient(url, srk);
    await sb.from("ielts_ac_users").upsert({
      telegram_id: p.userId,
      username: p.username,
      first_name: p.firstName,
      last_active_at: new Date().toISOString(),
    }, { onConflict: "telegram_id" });
    await sb.from("ielts_ac_attempts").insert({
      telegram_id: p.userId,
      book: p.book,
      test: p.test,
      section: p.section,
      part: p.part,
      correct: p.correct,
      total: p.total,
      details: p.details,
    });
  } catch (_) { /* statistika yozilmasa ham muhim emas */ }
}

// --------------------------------- main ---------------------------------

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "POST kerak" }, 405);

  let body: any;
  try {
    body = await req.json();
  } catch (_) {
    return json({ error: "noto'g'ri JSON" }, 400);
  }

  const botToken = Deno.env.get("BOT_TOKEN") ?? "";
  if (!botToken) return json({ error: "server sozlanmagan (BOT_TOKEN yo'q)" }, 500);

  const auth = await validateInitData(body.initData ?? "", botToken);
  if (!auth.ok) return json({ error: "tasdiqlanmadi (initData)" }, 401);

  const book = Number(body.book);
  const test = Number(body.test);
  const section = String(body.section);
  const part = String(body.part);
  const keyMap = partAnswers(book, test, section, part);
  const total = Object.keys(keyMap).length;

  if (body.action === "reveal") {
    const sorted = Object.keys(keyMap)
      .map(Number).sort((a, b) => a - b)
      .map((q) => ({ q, answer: keyMap[q] }));
    return json({ answers: sorted, total });
  }

  if (body.action === "check") {
    const userAnswers: Record<string, string> = body.answers ?? {};
    const correct: number[] = [];
    const incorrect: number[] = [];
    const unanswered: number[] = [];
    for (const q of Object.keys(keyMap).map(Number).sort((a, b) => a - b)) {
      const ua = userAnswers[String(q)];
      if (ua === undefined || !String(ua).trim()) unanswered.push(q);
      else if (isCorrect(String(ua), keyMap[q])) correct.push(q);
      else incorrect.push(q);
    }

    // Natijani DARROV qaytaramiz; statistikani FONDA yozamiz (javobni kechiktirmaslik uchun).
    const response = json({ correct, unanswered, total, score: correct.length });
    if (auth.userId) {
      const task = recordStats({
        userId: auth.userId,
        username: auth.username,
        firstName: auth.firstName,
        book, test, section, part,
        correct: correct.length,
        total,
        details: { correct, unanswered },
      });
      const er = (globalThis as any).EdgeRuntime;
      if (er && typeof er.waitUntil === "function") er.waitUntil(task);
    }
    return response;
  }

  return json({ error: "noma'lum action" }, 400);
});
