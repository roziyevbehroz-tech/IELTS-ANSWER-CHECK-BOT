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

// ---------------------- foydalanuvchi testlari (custom) ----------------------

const SB_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SRK = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

function dbHeaders(extra: Record<string, string> = {}): Record<string, string> {
  return { apikey: SRK, Authorization: `Bearer ${SRK}`, "Content-Type": "application/json", ...extra };
}
async function dbGet(path: string): Promise<any[]> {
  const r = await fetch(`${SB_URL}/rest/v1/${path}`, { headers: dbHeaders() });
  if (!r.ok) throw new Error("db get " + r.status);
  return await r.json();
}
async function dbInsert(table: string, row: unknown): Promise<any> {
  const r = await fetch(`${SB_URL}/rest/v1/${table}`, {
    method: "POST", headers: dbHeaders({ Prefer: "return=representation" }), body: JSON.stringify(row),
  });
  if (!r.ok) throw new Error("db insert " + r.status);
  const j = await r.json();
  return Array.isArray(j) ? j[0] : j;
}
async function dbPatch(table: string, filter: string, patch: unknown): Promise<void> {
  const r = await fetch(`${SB_URL}/rest/v1/${table}?${filter}`, {
    method: "PATCH", headers: dbHeaders({ Prefer: "return=minimal" }), body: JSON.stringify(patch),
  });
  if (!r.ok) throw new Error("db patch " + r.status);
}
function genId(): string {
  const c = "abcdefghijkmnpqrstuvwxyz23456789";
  const a = crypto.getRandomValues(new Uint8Array(8));
  let s = "";
  for (let i = 0; i < 8; i++) s += c[a[i] % c.length];
  return s;
}
function effectiveStatus(t: any): string {
  if (t.status === "closed") return "closed";
  if (t.closes_at && Date.parse(t.closes_at) < Date.now()) return "closed";
  return t.status; // active | paused
}
async function fetchTest(id: string): Promise<any | null> {
  const rows = await dbGet(`ielts_ac_custom_tests?id=eq.${encodeURIComponent(id)}&select=*`);
  return rows[0] ?? null;
}

async function handleCustom(body: any, auth: any): Promise<Response> {
  const action = body.action;
  if (!SB_URL || !SRK) return json({ error: "server bazasi sozlanmagan" }, 500);
  if (!auth.userId) return json({ error: "foydalanuvchi aniqlanmadi" }, 401);

  if (action === "ct_create") {
    const title = (String(body.title ?? "").trim().slice(0, 100)) || "Nomsiz test";
    const rawAns = body.answers ?? {};
    const answers: Record<string, string> = {};
    for (const k of Object.keys(rawAns)) {
      const n = Number(k);
      const v = String(rawAns[k] ?? "").trim();
      if (Number.isInteger(n) && n >= 1 && n <= 200 && v) answers[String(n)] = v.slice(0, 120);
    }
    if (Object.keys(answers).length === 0) return json({ error: "Kamida bitta savol-javob kiriting." }, 400);
    let id = genId();
    for (let i = 0; i < 3; i++) { if (!(await fetchTest(id))) break; id = genId(); }
    await dbInsert("ielts_ac_custom_tests", {
      id, owner_id: auth.userId, owner_name: auth.firstName ?? auth.username ?? null,
      title, answers, status: "active",
    });
    return json({ id, total: Object.keys(answers).length });
  }

  if (action === "ct_meta") {
    const t = await fetchTest(String(body.id));
    if (!t) return json({ error: "Test topilmadi." }, 404);
    const qnums = Object.keys(t.answers || {}).map(Number).sort((a, b) => a - b);
    return json({
      id: t.id, title: t.title, total: qnums.length, qnums,
      status: effectiveStatus(t), ownerName: t.owner_name,
      isOwner: Number(t.owner_id) === auth.userId, closesAt: t.closes_at,
    });
  }

  if (action === "ct_check") {
    const t = await fetchTest(String(body.id));
    if (!t) return json({ error: "Test topilmadi." }, 404);
    const st = effectiveStatus(t);
    if (st !== "active") return json({ error: st === "paused" ? "Test vaqtincha to'xtatilgan." : "Test yakunlangan." }, 403);
    const key: Record<string, string> = t.answers || {};
    const userAnswers = body.answers ?? {};
    const correct: number[] = [], unanswered: number[] = [];
    const qs = Object.keys(key).map(Number).sort((a, b) => a - b);
    for (const q of qs) {
      const ua = userAnswers[String(q)];
      if (ua === undefined || !String(ua).trim()) unanswered.push(q);
      else if (isCorrect(String(ua), key[String(q)])) correct.push(q);
    }
    const total = qs.length;
    const response = json({ correct, unanswered, total, score: correct.length });
    const task = dbInsert("ielts_ac_custom_submissions", {
      test_id: t.id, telegram_id: auth.userId, username: auth.username ?? null,
      first_name: auth.firstName ?? null, score: correct.length, total,
      details: { correct, unanswered },
    }).catch(() => {});
    const er = (globalThis as any).EdgeRuntime;
    if (er && typeof er.waitUntil === "function") er.waitUntil(task);
    return response;
  }

  if (action === "ct_reveal") {
    const t = await fetchTest(String(body.id));
    if (!t) return json({ error: "Test topilmadi." }, 404);
    const key: Record<string, string> = t.answers || {};
    const sorted = Object.keys(key).map(Number).sort((a, b) => a - b).map((q) => ({ q, answer: key[String(q)] }));
    return json({ answers: sorted, total: sorted.length });
  }

  if (action === "ct_list") {
    const tests = await dbGet(`ielts_ac_custom_tests?owner_id=eq.${auth.userId}&select=id,title,status,closes_at,answers,created_at&order=created_at.desc`);
    const out: any[] = [];
    for (const t of tests) {
      const subs = await dbGet(`ielts_ac_custom_submissions?test_id=eq.${encodeURIComponent(t.id)}&select=telegram_id`);
      const uniq = new Set(subs.map((s: any) => s.telegram_id));
      out.push({
        id: t.id, title: t.title, status: effectiveStatus(t), closesAt: t.closes_at,
        total: Object.keys(t.answers || {}).length, submissions: subs.length, students: uniq.size,
      });
    }
    return json({ tests: out });
  }

  if (action === "ct_stats") {
    const t = await fetchTest(String(body.id));
    if (!t) return json({ error: "Test topilmadi." }, 404);
    if (Number(t.owner_id) !== auth.userId) return json({ error: "Ruxsat yo'q." }, 403);
    const subs = await dbGet(`ielts_ac_custom_submissions?test_id=eq.${encodeURIComponent(t.id)}&select=telegram_id,username,first_name,score,total,created_at&order=created_at.desc`);
    const byUser: Record<string, any> = {};
    for (const s of subs) {
      const k = String(s.telegram_id);
      if (!byUser[k]) {
        byUser[k] = { name: s.first_name || s.username || ("ID " + s.telegram_id), username: s.username, best: s.score, total: s.total, attempts: 0, last: s.created_at };
      }
      byUser[k].attempts++;
      if (s.score > byUser[k].best) byUser[k].best = s.score;
    }
    const students = Object.keys(byUser).map((k) => byUser[k]);
    return json({
      title: t.title, total: Object.keys(t.answers || {}).length,
      status: effectiveStatus(t), closesAt: t.closes_at, students, totalAttempts: subs.length,
    });
  }

  if (action === "ct_manage") {
    const t = await fetchTest(String(body.id));
    if (!t) return json({ error: "Test topilmadi." }, 404);
    if (Number(t.owner_id) !== auth.userId) return json({ error: "Ruxsat yo'q." }, 403);
    const op = String(body.op);
    const patch: any = {};
    if (op === "pause") patch.status = "paused";
    else if (op === "resume") { patch.status = "active"; patch.closes_at = null; }
    else if (op === "close") patch.status = "closed";
    else if (op === "deadline") { patch.status = "active"; patch.closes_at = body.closesAt || null; }
    else return json({ error: "noma'lum amal" }, 400);
    await dbPatch("ielts_ac_custom_tests", `id=eq.${encodeURIComponent(t.id)}`, patch);
    return json({ ok: true });
  }

  return json({ error: "noma'lum ct action" }, 400);
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

  // Foydalanuvchi yaratgan testlar (ct_*) alohida hal qilinadi.
  if (typeof body.action === "string" && body.action.startsWith("ct_")) {
    return await handleCustom(body, auth);
  }

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
