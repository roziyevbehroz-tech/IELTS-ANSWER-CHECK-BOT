// IELTS Answer Check — Telegram Bot (webhook, Supabase Edge Function)
// ---------------------------------------------------------------------------
// Botning to'liq mantig'i SHU YERDA ishlaydi (Python run.py kerak emas).
// Telegram update'larni webhook orqali qabul qiladi va serverda javob beradi.
//
// Sozlash (bir martalik):
//   Brauzerда oching:  https://<project>.supabase.co/functions/v1/ielts-bot?setup=1
//   Bu funksiya o'zining webhook'ini Telegram'ga ro'yxatdan o'tkazadi.
//
// Muhit (Supabase Function Secrets):
//   BOT_TOKEN                  — Telegram bot tokeni (majburiy)
//   WEBAPP_URL                 — Mini App manzili (ixtiyoriy, standart: GitHub Pages)
//   SUPABASE_URL               — avtomatik beriladi (sessiya + statistika uchun)
//   SUPABASE_SERVICE_ROLE_KEY  — avtomatik beriladi
//
// page/answers fayllari: python scripts/build_webapp_data.py bilan generatsiya bo'ladi.

import answers from "./answers.json" with { type: "json" };
import * as CD from "./cd.ts";
import { t, Lang, LANGS, isLang, RK_CD_ALL, RK_CHECK_ALL } from "./i18n.ts";
import { unzipSync, strFromU8, zlibSync } from "https://esm.sh/fflate@0.8.2";
import { getDocumentProxy, getResolvedPDFJS } from "https://esm.sh/unpdf@0.12.1";

type AnswerMap = Record<string, Record<string, string>>;
const ANSWERS = answers as AnswerMap;

const BOT_TOKEN = Deno.env.get("BOT_TOKEN") ?? "";
// Bot egasi(lari) Telegram ID — vergul bilan. /admin analitikasi shular uchun.
const ADMIN_IDS = (Deno.env.get("ADMIN_IDS") ?? "").split(/[,\s]+/).filter(Boolean);
const WEBAPP_URL = (Deno.env.get("WEBAPP_URL") ??
  "https://roziyevbehroz-tech.github.io/IELTS-ANSWER-CHECK-BOT/").trim();
// Bot havolasi (CD test caption va h.k. uchun). BOT_USERNAME env bilan o'zgartiriladi.
const BOT_USERNAME = (Deno.env.get("BOT_USERNAME") ?? "IELTS_Answer_checkerbot").replace(/^@/, "").trim();
const BOT_LINK = "https://t.me/" + BOT_USERNAME;
const TG_API = `https://api.telegram.org/bot${BOT_TOKEN}`;

const BOOKS = Array.from({ length: 12 }, (_, i) => 10 + i); // 10..21
const TESTS = [1, 2, 3, 4];

// ----------------------------- savol diapazonlari -----------------------------

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

function isPartAvailable(book: number, test: number, section: string, part: string): boolean {
  return Object.keys(partAnswers(book, test, section, part)).length > 0;
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

// Rim raqami <-> oddiy raqam ekvivalenti (matching headings: "viii" == "8")
const ROMAN: Record<string, number> = {
  i: 1, ii: 2, iii: 3, iv: 4, v: 5, vi: 6, vii: 7, viii: 8, ix: 9, x: 10,
  xi: 11, xii: 12, xiii: 13, xiv: 14, xv: 15, xvi: 16, xvii: 17, xviii: 18, xix: 19, xx: 20,
};
function numeralVal(s: string): number | null {
  const t = (s || "").trim().toLowerCase().replace(/[).\s]+$/, "");
  if (/^\d+$/.test(t)) return parseInt(t, 10);
  return t in ROMAN ? ROMAN[t] : null;
}

function isCorrect(userAnswer: string, keyAnswer: string): boolean {
  if (!userAnswer || !keyAnswer) return false;
  if (acceptableVariants(keyAnswer).has(canonical(userAnswer))) return true;
  // Rim raqami <-> oddiy raqam (kalit "viii", javob "8")
  const uv = numeralVal(userAnswer);
  if (uv !== null) {
    for (const alt of keyAnswer.split("/")) if (numeralVal(alt) === uv) return true;
  }
  return false;
}

// ----------------------------- javoblarni o'qish -----------------------------

const LINE_RE = /^\s*(\d{1,3})\s*[\.\)\-:–—]?\s*(.+?)\s*$/;
const INLINE_RE = /(\d{1,3})\s*[\.\)\-:–—]\s*([^\d][^\n]*?)(?=\s+\d{1,3}\s*[\.\)\-:–—]|$)/g;

function parseAnswers(text: string): Record<number, string> {
  text = (text ?? "").trim();
  const result: Record<number, string> = {};
  if (!text) return result;

  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length > 1) {
    for (const line of lines) {
      const m = line.match(LINE_RE);
      if (m) result[Number(m[1])] = m[2].trim();
    }
    if (Object.keys(result).length) return result;
  }

  let m: RegExpExecArray | null;
  INLINE_RE.lastIndex = 0;
  while ((m = INLINE_RE.exec(text)) !== null) {
    result[Number(m[1])] = m[2].trim();
  }
  if (Object.keys(result).length) return result;

  const single = text.match(LINE_RE);
  if (single) result[Number(single[1])] = single[2].trim();
  return result;
}

// ------------------------------- matnlar -------------------------------

const SECTION_NAMES: Record<string, string> = { listening: "Listening", reading: "Reading" };
const SECTION_ICONS: Record<string, string> = { listening: "🎧", reading: "📖" };

function partLabel(section: string, part: string, lang: Lang): string {
  if (part === "all") return t(lang, "full_test");
  return section === "listening" ? `Part ${part}` : `Passage ${part}`;
}

function sendAnswersPrompt(book: number, test: number, section: string, part: string, lang: Lang): string {
  const [lo, hi] = partRange(section, part);
  const nums = Object.keys(partAnswers(book, test, section, part)).map(Number).sort((a, b) => a - b);
  const first = nums.length ? nums[0] : lo;
  const last = nums.length ? nums[nums.length - 1] : hi;
  // Namuna javoblari har doim inglizcha (IELTS mazmuni tarjima qilinmaydi)
  const example = section === "reading"
    ? `${first}. TRUE\n${first + 1}. paragraph\n${first + 2}. B`
    : `${first}. cat\n${first + 1}. 10 am\n${first + 2}. B`;
  return t(lang, "answers_prompt", book, test, SECTION_NAMES[section], partLabel(section, part, lang),
    first, last, nums.length, example);
}

// ------------------------------- klaviaturalar -------------------------------

type Btn = { text: string; callback_data?: string; web_app?: { url: string } };

function chunk<T>(arr: T[], n: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
  return out;
}

// Til tanlash — /start da va /language da (uch tilda birga ko'rsatiladi)
const LANG_PICK = "🌐 Tilni tanlang / Выберите язык / Choose your language:";
function langKb() {
  return {
    inline_keyboard: LANGS.map((l) => [{ text: t(l, "lang_native"), callback_data: `lang:${l}` }]),
  };
}

// Mini App manziliga qo'shimcha parametr (masalan lang) qo'shadi
function webappUrl(params: Record<string, string>): string {
  let u = WEBAPP_URL;
  for (const [k, v] of Object.entries(params)) {
    u += (u.indexOf("?") >= 0 ? "&" : "?") + k + "=" + encodeURIComponent(v);
  }
  return u;
}

function launcherKb(lang: Lang) {
  const rows: Btn[][] = [];
  if (WEBAPP_URL) rows.push([{ text: t(lang, "btn_miniapp"), web_app: { url: webappUrl({ lang }) } }]);
  rows.push([{ text: t(lang, "btn_text_check"), callback_data: "nav:books" }]);
  rows.push([{ text: t(lang, "btn_cd_create"), callback_data: "cd:start" }]);
  return { inline_keyboard: rows };
}

function booksKb() {
  const btns: Btn[] = BOOKS.map((b) => ({ text: String(b), callback_data: `b:${b}` }));
  return { inline_keyboard: chunk(btns, 4) };
}

function testsKb(book: number, lang: Lang) {
  const btns: Btn[] = TESTS.map((tt) => ({ text: t(lang, "btn_test_n", tt), callback_data: `t:${book}:${tt}` }));
  const rows = chunk(btns, 2);
  rows.push([{ text: t(lang, "btn_back"), callback_data: "nav:books" }]);
  return { inline_keyboard: rows };
}

function sectionsKb(book: number, test: number, lang: Lang) {
  return {
    inline_keyboard: [
      [
        { text: "🎧 Listening", callback_data: `s:${book}:${test}:listening` },
        { text: "📖 Reading", callback_data: `s:${book}:${test}:reading` },
      ],
      [{ text: t(lang, "btn_back"), callback_data: `nav:tests:${book}` }],
    ],
  };
}

function partsKb(book: number, test: number, section: string, lang: Lang) {
  const labels: [string, string][] = section === "listening"
    ? [["Part 1", "1"], ["Part 2", "2"], ["Part 3", "3"], ["Part 4", "4"]]
    : [["Passage 1", "1"], ["Passage 2", "2"], ["Passage 3", "3"]];
  const btns: Btn[] = labels.map(([lbl, code]) =>
    ({ text: lbl, callback_data: `p:${book}:${test}:${section}:${code}` }));
  const rows = chunk(btns, 2);
  rows.push([{ text: t(lang, "btn_full_test"), callback_data: `p:${book}:${test}:${section}:all` }]);
  rows.push([{ text: t(lang, "btn_back"), callback_data: `nav:secs:${book}:${test}` }]);
  return { inline_keyboard: rows };
}

function resultKb(book: number, test: number, section: string, part: string, lang: Lang) {
  const ctx = `${book}:${test}:${section}:${part}`;
  return {
    inline_keyboard: [
      [{ text: t(lang, "btn_retry"), callback_data: `retry:${ctx}` }],
      [{ text: t(lang, "btn_reveal"), callback_data: `reveal:${ctx}` }],
      [{ text: t(lang, "btn_home"), callback_data: "nav:books" }],
    ],
  };
}

function afterRevealKb(lang: Lang) {
  return { inline_keyboard: [[{ text: t(lang, "btn_home"), callback_data: "nav:books" }]] };
}

// ------------------------------- Telegram API -------------------------------

async function tg(method: string, payload: Record<string, unknown>): Promise<any> {
  const res = await fetch(`${TG_API}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return res.json().catch(() => ({}));
}

// Markdown bilan yuboramiz; entity xatosi bo'lsa oddiy matn bilan qayta urinamiz.
async function sendMessage(chatId: number, text: string, replyMarkup?: unknown) {
  const base: Record<string, unknown> = { chat_id: chatId, text, parse_mode: "Markdown" };
  if (replyMarkup) base.reply_markup = replyMarkup;
  const r = await tg("sendMessage", base);
  if (!r.ok) {
    delete base.parse_mode;
    await tg("sendMessage", base);
  }
}

async function editMessage(chatId: number, messageId: number, text: string, replyMarkup?: unknown) {
  const base: Record<string, unknown> = { chat_id: chatId, message_id: messageId, text, parse_mode: "Markdown" };
  if (replyMarkup) base.reply_markup = replyMarkup;
  const r = await tg("editMessageText", base);
  if (!r.ok) {
    delete base.parse_mode;
    const r2 = await tg("editMessageText", base);
    // Agar tahrirlab bo'lmasa (masalan matn bir xil), e'tibor bermaymiz
    if (!r2.ok && replyMarkup) { /* ignore */ }
  }
}

// Vaqtinchalik "jarayon ketmoqda" xabari — yuboriladi, ish tugagach o'chiriladi
// (userga jimlik o'rniga darrov javob: qabul qilindi, tahlil qilinyapti).
async function cdNotice(chatId: number, lang: Lang): Promise<number | null> {
  try {
    bg(tg("sendChatAction", { chat_id: chatId, action: "typing" }));
    const r = await tg("sendMessage", { chat_id: chatId, text: t(lang, "cd_processing") });
    return r?.result?.message_id ?? null;
  } catch (_) { return null; }
}
async function cdNoticeDone(chatId: number, messageId: number | null): Promise<void> {
  if (!messageId) return;
  try { await tg("deleteMessage", { chat_id: chatId, message_id: messageId }); } catch (_) { /* ignore */ }
}

async function answerCallback(id: string, text?: string, alert = false) {
  const p: Record<string, unknown> = { callback_query_id: id };
  if (text) { p.text = text; p.show_alert = alert; }
  await tg("answerCallbackQuery", p);
}

// ------------------------------- baza (Supabase) -------------------------------

interface Session { book?: number; test?: number; section?: string; part?: string; awaiting: boolean; }

let _sb: any = null;
async function sb() {
  if (_sb) return _sb;
  const url = Deno.env.get("SUPABASE_URL");
  const srk = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !srk) return null;
  const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2");
  _sb = createClient(url, srk);
  return _sb;
}

async function getSession(tgId: number): Promise<Session | null> {
  try {
    const c = await sb();
    if (!c) return null;
    const { data } = await c.from("ielts_ac_sessions").select("*").eq("telegram_id", tgId).maybeSingle();
    if (!data) return null;
    return { book: data.book, test: data.test, section: data.section, part: data.part, awaiting: !!data.awaiting };
  } catch (_) { return null; }
}

async function setSession(tgId: number, s: Session): Promise<void> {
  try {
    const c = await sb();
    if (!c) return;
    await c.from("ielts_ac_sessions").upsert({
      telegram_id: tgId,
      book: s.book ?? null, test: s.test ?? null,
      section: s.section ?? null, part: s.part ?? null,
      awaiting: s.awaiting, updated_at: new Date().toISOString(),
    }, { onConflict: "telegram_id" });
  } catch (_) { /* ignore */ }
}

async function clearAwaiting(tgId: number): Promise<void> {
  try {
    const c = await sb();
    if (!c) return;
    await c.from("ielts_ac_sessions").update({ awaiting: false }).eq("telegram_id", tgId);
  } catch (_) { /* ignore */ }
}

async function upsertUser(u: any): Promise<void> {
  try {
    const c = await sb();
    if (!c || !u) return;
    await c.from("ielts_ac_users").upsert({
      telegram_id: u.id, username: u.username, first_name: u.first_name,
      language_code: u.language_code, last_active_at: new Date().toISOString(),
    }, { onConflict: "telegram_id" });
  } catch (_) { /* ignore */ }
}

// Foydalanuvchi tanlagan interfeys tili (uz/ru/en). Tanlamagan bo'lsa — uz.
async function getLang(tgId: number): Promise<Lang> {
  try {
    const c = await sb();
    if (!c) return "uz";
    const { data } = await c.from("ielts_ac_users").select("lang").eq("telegram_id", tgId).maybeSingle();
    return isLang(data?.lang) ? data.lang : "uz";
  } catch (_) { return "uz"; }
}

async function setLang(tgId: number, lang: Lang): Promise<void> {
  try {
    const c = await sb();
    if (!c) return;
    await c.from("ielts_ac_users").upsert({
      telegram_id: tgId, lang, last_active_at: new Date().toISOString(),
    }, { onConflict: "telegram_id" });
  } catch (_) { /* ignore */ }
}

async function recordAttempt(tgId: number, book: number, test: number, section: string,
  part: string, correct: number, total: number, details: unknown): Promise<void> {
  try {
    const c = await sb();
    if (!c) return;
    await c.from("ielts_ac_attempts").insert({
      telegram_id: tgId, book, test, section, part, correct, total, details: details ?? {},
    });
  } catch (_) { /* ignore */ }
}

// Funksiya ishlatilishini kuzatish (masalan "cd_created") — analitika uchun
async function logEvent(tgId: number | null, event: string, meta: Record<string, unknown> = {}): Promise<void> {
  try {
    const c = await sb();
    if (c) await c.from("ielts_bot_events").insert({ telegram_id: tgId, event, meta });
  } catch (_) { /* ignore */ }
}

// ------------------------------- update'larni qayta ishlash -------------------------------

function bg(task: Promise<unknown>) {
  const er = (globalThis as any).EdgeRuntime;
  if (er && typeof er.waitUntil === "function") er.waitUntil(task);
  else task.catch(() => {});
}

function ctStatus(t: any): string {
  if (!t) return "closed";
  if (t.status === "closed") return "closed";
  if (t.closes_at && Date.parse(t.closes_at) < Date.now()) return "closed";
  return t.status;
}

async function getCustomTest(id: string): Promise<any | null> {
  try {
    const c = await sb();
    if (!c) return null;
    const { data } = await c.from("ielts_ac_custom_tests")
      .select("id,title,answers,status,closes_at,owner_name").eq("id", id).maybeSingle();
    return data || null;
  } catch (_) { return null; }
}

function customTestKb(id: string, lang: Lang) {
  return { inline_keyboard: [[{ text: t(lang, "btn_ct_start"), web_app: { url: webappUrl({ ct: id, lang }) } }]] };
}

async function handleOpenCustom(chatId: number, from: any, id: string, lang: Lang) {
  bg(upsertUser(from));
  const ct = await getCustomTest(id);
  if (!ct) { await sendMessage(chatId, t(lang, "ct_not_found")); return; }
  const total = Object.keys(ct.answers || {}).length;
  const st = ctStatus(ct);
  if (st === "closed") { await sendMessage(chatId, t(lang, "ct_closed", ct.title)); return; }
  if (st === "paused") { await sendMessage(chatId, t(lang, "ct_paused", ct.title)); return; }
  const who = ct.owner_name ? t(lang, "ct_owner", ct.owner_name) : "";
  await sendMessage(chatId, t(lang, "ct_intro", ct.title, total, who), customTestKb(id, lang));
}

async function handleCommand(chatId: number, from: any, text: string, lang: Lang) {
  const segs = text.split(/\s+/);
  const cmd = segs[0].replace(/@.*$/, "");
  const param = segs[1] || "";
  if (cmd === "/start" && param.indexOf("t_") === 0) {
    return await handleOpenCustom(chatId, from, param.slice(2), lang);
  }
  if (cmd === "/start") {
    bg(upsertUser(from));
    bg(setSession(from.id, { awaiting: false }));
    // Doim: avval tilni so'raymiz. Tanlangach welcome + menyu ko'rsatiladi.
    await sendMessage(chatId, LANG_PICK, langKb());
  } else if (cmd === "/language" || cmd === "/lang") {
    await sendMessage(chatId, LANG_PICK, langKb());
  } else if (cmd === "/about") {
    await sendMessage(chatId, t(lang, "about"));
  } else if (cmd === "/guide" || cmd === "/help") {
    await sendMessage(chatId, t(lang, "guide"));
  } else if (cmd === "/stats") {
    await sendStats(chatId, from.id, lang);
  } else if (cmd === "/qtemplate") {
    await sendMessage(chatId, t(lang, "cd_qtemplate"));
  } else if (cmd === "/myid") {
    await sendMessage(chatId, t(lang, "myid", from.id));
  } else if (cmd === "/admin") {
    await sendAdminStats(chatId, from, lang);
  } else {
    await sendMessage(chatId, t(lang, "start_prompt"));
  }
}

// Til tanlagandan keyin welcome + doimiy tugmalar + menyuni ko'rsatamiz
async function showWelcome(chatId: number, from: any, lang: Lang) {
  const name = from.first_name || "friend";
  await sendMessage(chatId, t(lang, "welcome", name), mainReplyKb(lang));
  await sendMessage(chatId, t(lang, "menu") + t(lang, "welcome_hint"), launcherKb(lang));
}

// Bot egasi uchun umumiy analitika (ADMIN_IDS env orqali himoyalangan)
async function sendAdminStats(chatId: number, from: any, lang: Lang) {
  if (!ADMIN_IDS.length || !ADMIN_IDS.includes(String(from.id))) {
    await sendMessage(chatId, t(lang, "admin_only"));
    return;
  }
  const c = await sb();
  if (!c) { await sendMessage(chatId, t(lang, "db_not_connected")); return; }
  const { data, error } = await c.rpc("ielts_bot_admin_stats");
  if (error || !data) { await sendMessage(chatId, t(lang, "stats_error")); return; }
  const s = data as any;
  const books = (s.top_books ?? []).map((b: any) => `${t(lang, "book_label", b.book)} (${b.c})`).join(", ") || "—";
  const secs = (s.top_sections ?? []).map((x: any) =>
    `${SECTION_NAMES[x.section] ?? x.section} (${x.c})`).join(", ") || "—";
  await sendMessage(chatId, t(lang, "admin_stats", s, books, secs));
}

async function sendStats(chatId: number, tgId: number, lang: Lang) {
  const c = await sb();
  let rows: any[] = [];
  if (c) {
    try {
      const { data } = await c.from("ielts_ac_attempts")
        .select("book,test,section,part,correct,total,created_at")
        .eq("telegram_id", tgId).order("created_at", { ascending: false }).limit(10);
      rows = data ?? [];
    } catch (_) { rows = []; }
  }
  if (!rows.length) {
    await sendMessage(chatId, t(lang, "stats_none"));
    return;
  }
  let msg = t(lang, "stats_header");
  let pct = 0;
  for (const a of rows) {
    const sec = SECTION_NAMES[a.section] ?? a.section;
    msg += t(lang, "stats_row", a.book, a.test, sec, partLabel(a.section, a.part, lang), a.correct, a.total);
    if (a.total) pct += (a.correct / a.total) * 100;
  }
  msg += t(lang, "stats_total", rows.length, Math.round(pct / rows.length));
  await sendMessage(chatId, msg);
}

async function handleCallback(cq: any, lang: Lang) {
  const data: string = cq.data ?? "";
  const chatId = cq.message?.chat?.id;
  const messageId = cq.message?.message_id;
  const from = cq.from;
  await answerCallback(cq.id);
  if (!chatId || !messageId) return;

  const parts = data.split(":");
  const kind = parts[0];

  // Til tanlash: tanlangach welcome + menyuni yangi til bilan ko'rsatamiz
  if (kind === "lang") {
    const chosen = isLang(parts[1]) ? parts[1] : "uz";
    await setLang(from.id, chosen);
    await editMessage(chatId, messageId, t(chosen, "lang_saved"));
    await showWelcome(chatId, from, chosen);
    return;
  }

  if (kind === "cd") {
    await handleCdCallback(cq, parts.slice(1), lang);
    return;
  }

  if (kind === "nav") {
    const what = parts[1];
    if (what === "menu") {
      bg(clearAwaiting(from.id));
      bg(clearDraft(from.id));
      await editMessage(chatId, messageId, t(lang, "menu_home"), launcherKb(lang));
    } else if (what === "books") {
      bg(clearAwaiting(from.id));
      await editMessage(chatId, messageId, t(lang, "choose_book"), booksKb());
    } else if (what === "tests") {
      const book = Number(parts[2]);
      await editMessage(chatId, messageId, t(lang, "choose_test", book), testsKb(book, lang));
    } else if (what === "secs") {
      const book = Number(parts[2]), test = Number(parts[3]);
      await editMessage(chatId, messageId, t(lang, "choose_section", book, test), sectionsKb(book, test, lang));
    }
    return;
  }

  if (kind === "b") {
    const book = Number(parts[1]);
    await editMessage(chatId, messageId, t(lang, "choose_test", book), testsKb(book, lang));
    return;
  }

  if (kind === "t") {
    const book = Number(parts[1]), test = Number(parts[2]);
    await editMessage(chatId, messageId, t(lang, "choose_section", book, test), sectionsKb(book, test, lang));
    return;
  }

  if (kind === "s") {
    const book = Number(parts[1]), test = Number(parts[2]), section = parts[3];
    const icon = SECTION_ICONS[section] ?? "";
    const name = SECTION_NAMES[section] ?? section;
    await editMessage(chatId, messageId,
      t(lang, "choose_part", icon, book, test, name), partsKb(book, test, section, lang));
    return;
  }

  if (kind === "p") {
    const book = Number(parts[1]), test = Number(parts[2]), section = parts[3], part = parts[4];
    if (!isPartAvailable(book, test, section, part)) {
      await answerCallback(cq.id, t(lang, "part_not_available"), true);
      await editMessage(chatId, messageId, t(lang, "part_not_available"), partsKb(book, test, section, lang));
      return;
    }
    bg(setSession(from.id, { book, test, section, part, awaiting: true }));
    await editMessage(chatId, messageId, sendAnswersPrompt(book, test, section, part, lang));
    return;
  }

  if (kind === "retry") {
    const book = Number(parts[1]), test = Number(parts[2]), section = parts[3], part = parts[4];
    bg(setSession(from.id, { book, test, section, part, awaiting: true }));
    await editMessage(chatId, messageId, sendAnswersPrompt(book, test, section, part, lang));
    return;
  }

  if (kind === "reveal") {
    const book = Number(parts[1]), test = Number(parts[2]), section = parts[3], part = parts[4];
    bg(clearAwaiting(from.id));
    const keys = partAnswers(book, test, section, part);
    const header = t(lang, "reveal_header", book, test, SECTION_NAMES[section], partLabel(section, part, lang));
    const lines = Object.keys(keys).map(Number).sort((a, b) => a - b)
      .map((q) => `${q}. ${keys[q]}`);
    await editMessage(chatId, messageId, header + lines.join("\n"), afterRevealKb(lang));
    return;
  }
}

async function handleText(chatId: number, from: any, text: string, lang: Lang) {
  // Doimiy pastki tugmalar (reply keyboard) — oqimning istalgan joyidan ishlaydi
  if (RK_CD_ALL.has(text)) {
    await setDraft(from.id, "skill", newDraft());
    await sendMessage(chatId, t(lang, "cd_intro"), cdSkillKb(lang));
    return;
  }
  if (RK_CHECK_ALL.has(text)) {
    bg(clearAwaiting(from.id));
    await clearDraft(from.id);
    await sendMessage(chatId, t(lang, "choose_book"), booksKb());
    return;
  }

  // CD test yaratish oqimi faol bo'lsa — o'sha yerga yo'naltiramiz
  const draft = await getDraft(from.id);
  if (draft && CD_STEPS.has(draft.step)) {
    const notice = await cdNotice(chatId, lang);
    try { await cdHandleInput(chatId, from, draft.step, draft.data, text, [], lang); }
    finally { await cdNoticeDone(chatId, notice); }
    return;
  }

  const session = await getSession(from.id);
  if (!session || !session.awaiting || !session.book || !session.section || !session.part) {
    await sendMessage(chatId, t(lang, "start_prompt"));
    return;
  }
  const { book, test, section, part } = session as Required<Session>;
  const userAnswers = parseAnswers(text);
  if (Object.keys(userAnswers).length === 0) {
    await sendMessage(chatId, t(lang, "no_answers_parsed"));
    return;
  }

  const keys = partAnswers(book, test, section, part);
  const correct: number[] = [];
  const unanswered: number[] = [];
  for (const q of Object.keys(keys).map(Number).sort((a, b) => a - b)) {
    const ua = userAnswers[q];
    if (ua === undefined || !String(ua).trim()) unanswered.push(q);
    else if (isCorrect(String(ua), keys[q])) correct.push(q);
  }
  const total = Object.keys(keys).length;

  let msg = t(lang, "result_header", correct.length, total);
  if (correct.length === total && total > 0) {
    msg += t(lang, "result_all_correct", total);
  } else {
    if (correct.length) msg += t(lang, "result_correct_list", correct.join(", "));
    else msg += t(lang, "result_none");
    if (unanswered.length) msg += t(lang, "result_unanswered", unanswered.join(", "));
    msg += t(lang, "result_retry_hint");
  }

  await sendMessage(chatId, msg, resultKb(book, test, section, part, lang));
  bg(recordAttempt(from.id, book, test, section, part, correct.length, total,
    { correct, unanswered }));
}

// ======================= CD Test yaratish (Reading) =======================

const CD_MAX_FILE = 8 * 1024 * 1024;
// intake — universal material qabul qilish; review — topilganini tasdiqlash;
// answers — javob kalitini so'rash
const CD_STEPS = new Set(["intake", "review", "answers", "more"]);

interface CdPending {
  segments: { passage: CD.Passage; groups: CD.QuestionGroup[] }[];
  answerKey: Record<number, string>;
  note: string;
}
interface CdDraft {
  skill: string;
  passages: CD.Passage[];               // tasdiqlangan passage'lar (groups biriktirilgan)
  answerKey: Record<number, string>;    // to'plangan global javob kaliti
  pending: CdPending | null;            // ko'rib chiqilayotgan (tasdiqlanmagan) natija
  failCount: number;                    // ketma-ket ajrata olmagan urinishlar
  settings: CD.Settings;
}

function newDraft(): CdDraft {
  return { skill: "reading", passages: [], answerKey: {}, pending: null,
    failCount: 0, settings: CD.newSettings() };
}

// Ketma-ket raqamlarni ixcham ko'rinishga keltiradi: [14,15,16,20] -> "14-16, 20"
function compactNums(nums: number[]): string {
  const a = Array.from(new Set(nums)).sort((x, y) => x - y);
  const parts: string[] = [];
  let i = 0;
  while (i < a.length) {
    let j = i;
    while (j + 1 < a.length && a[j + 1] === a[j] + 1) j++;
    parts.push(j > i ? `${a[i]}-${a[j]}` : `${a[i]}`);
    i = j + 1;
  }
  return parts.join(", ");
}

// Savol turlari uchun "qanday shaklda yuborish" qo'llanmasi (tanlangan tilda)
function cdFormatGuide(groups: CD.QuestionGroup[], lang: Lang): string {
  const kinds = Array.from(new Set(groups.map((g) => CD.kindOf(g))));
  const lines = kinds.map((k) => "• " + t(lang, "cd_fmt_" + k));
  return t(lang, "cd_fmt_intro") + "\n" + lines.join("\n");
}

// Turiga mos kelmagan javoblar bo'yicha ogohlantirish (raqam + to'g'ri shakl)
function cdMismatchMsg(badByKind: Record<string, number[]>, lang: Lang): string {
  const lines = Object.keys(badByKind).map((k) =>
    t(lang, "cd_fmt_line", compactNums(badByKind[k]), t(lang, "cd_fmt_" + k)));
  return t(lang, "cd_key_mismatch", lines.join("\n"));
}

async function getDraft(tgId: number): Promise<{ step: string; data: CdDraft } | null> {
  try {
    const c = await sb();
    if (!c) return null;
    const { data } = await c.from("ielts_cd_drafts").select("step,data").eq("telegram_id", tgId).maybeSingle();
    if (!data) return null;
    return { step: data.step, data: data.data as CdDraft };
  } catch (_) { return null; }
}
async function setDraft(tgId: number, step: string, data: CdDraft): Promise<void> {
  const c = await sb();
  if (!c) throw new Error("db yo'q");
  await c.from("ielts_cd_drafts").upsert({
    telegram_id: tgId, step, data, updated_at: new Date().toISOString(),
  }, { onConflict: "telegram_id" });
}
async function clearDraft(tgId: number): Promise<void> {
  try { const c = await sb(); if (c) await c.from("ielts_cd_drafts").delete().eq("telegram_id", tgId); } catch (_) { /* ignore */ }
}

// ---- fayldan matn (txt/docx) ----
function cdCleanText(t: string): string {
  t = t.replace(/\r\n/g, "\n").replace(/\r/g, "\n").replace(/ /g, " ").replace(/﻿/g, "");
  t = t.replace(/\n{3,}/g, "\n\n");
  return t.split("\n").map((l) => l.replace(/\s+$/, "")).join("\n").trim();
}
function docxToText(data: Uint8Array): string {
  const files = unzipSync(data);
  const doc = files["word/document.xml"];
  if (!doc) throw new Error("docx tuzilmasi buzuq");
  let xml = strFromU8(doc);
  xml = xml.replace(/<\/w:p>/g, "\n").replace(/<w:tab\/>/g, "\t").replace(/<[^>]+>/g, "");
  xml = xml.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'");
  return xml;
}
// PDF -> matn: pdf.js text-item'laridan qator/paragraf tuzilishini tiklaydi
// (Y-koordinata bo'yicha). Skanerlangan (rasm) PDF'lar OCR talab qiladi — ular
// uchun matn topilmaydi va foydalanuvchidan matn/DOCX so'raladi.
async function pdfToText(data: Uint8Array): Promise<string> {
  const pdf = await getDocumentProxy(data);
  let out = "";
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    let prevY: number | null = null, prevH = 0, prevEndX = 0;
    for (const it of content.items as any[]) {
      if (typeof it.str !== "string") continue;
      const x = it.transform[4], y = it.transform[5];
      const w = it.width || 0, h = it.height || prevH || 11;
      if (prevY !== null) {
        const gap = prevY - y;
        if (gap > h * 1.8) out += "\n\n";           // paragraf oralig'i
        else if (gap > h * 0.4) out += "\n";        // yangi qator
        else if (x - prevEndX > h * 0.25 && !out.endsWith(" ")) out += " "; // so'z oralig'i
      }
      out += it.str;
      prevY = y; prevH = h; prevEndX = x + w;
    }
    out += "\n\n";
  }
  return out;
}

// ---- PDF'dan diagramma rasmlarini ajratish (PNG encode, canvas kerak emas) ----
const _CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; }
  return t;
})();
function _crc32(buf: Uint8Array): number {
  let c = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) c = _CRC_TABLE[(c ^ buf[i]) & 0xFF] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) >>> 0;
}
function _pngChunk(type: string, data: Uint8Array): Uint8Array {
  const out = new Uint8Array(12 + data.length);
  const dv = new DataView(out.buffer);
  dv.setUint32(0, data.length);
  for (let i = 0; i < 4; i++) out[4 + i] = type.charCodeAt(i);
  out.set(data, 8);
  dv.setUint32(8 + data.length, _crc32(out.subarray(4, 8 + data.length)));
  return out;
}
// pdf.js image kind: 1=GRAYSCALE_1BPP, 2=RGB_24BPP, 3=RGBA_32BPP
function _encodePng(w: number, h: number, kind: number, data: Uint8Array): Uint8Array {
  const ch = kind === 3 ? 4 : kind === 1 ? 1 : 3;
  const colorType = kind === 3 ? 6 : kind === 1 ? 0 : 2;
  const stride = w * ch;
  const raw = new Uint8Array(h * (1 + stride));
  for (let y = 0; y < h; y++) { raw[y * (1 + stride)] = 0; raw.set(data.subarray(y * stride, (y + 1) * stride), y * (1 + stride) + 1); }
  const idat = zlibSync(raw, { level: 6 });
  const ihdr = new Uint8Array(13);
  const dv = new DataView(ihdr.buffer);
  dv.setUint32(0, w); dv.setUint32(4, h); ihdr[8] = 8; ihdr[9] = colorType;
  const sig = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
  const parts = [sig, _pngChunk("IHDR", ihdr), _pngChunk("IDAT", idat), _pngChunk("IEND", new Uint8Array(0))];
  const total = parts.reduce((a, p) => a + p.length, 0);
  const out = new Uint8Array(total);
  let o = 0;
  for (const p of parts) { out.set(p, o); o += p.length; }
  return out;
}
function _b64(bytes: Uint8Array): string {
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}
// Sahifalardagi barcha mazmunli rasmlarni PNG data URI sifatida qaytaradi
async function pdfToImages(data: Uint8Array): Promise<string[]> {
  try {
    const pdf = await getDocumentProxy(data);
    const { OPS } = await getResolvedPDFJS();
    const imgOps = new Set([OPS.paintImageXObject, OPS.paintInlineImageXObject]);
    const uris: string[] = [];
    let totalBytes = 0;
    for (let pn = 1; pn <= pdf.numPages && uris.length < 6; pn++) {
      const page = await pdf.getPage(pn);
      const ops = await page.getOperatorList();
      for (let i = 0; i < ops.fnArray.length && uris.length < 6; i++) {
        if (!imgOps.has(ops.fnArray[i])) continue;
        const objId = ops.argsArray[i][0];
        let obj: any = null;
        try { obj = page.objs.get(objId); } catch (_) { try { obj = (pdf as any).commonObjs.get(objId); } catch (_) { obj = null; } }
        if (!obj || !obj.data || !obj.width || !obj.height) continue;
        const px = obj.width * obj.height;
        if (px < 3000 || px > 4_000_000) continue;   // ikonlarni va ulkan rasmlarni o'tkazamiz
        const kind = obj.kind || 2;
        const bytes = obj.data instanceof Uint8Array ? obj.data : new Uint8Array(obj.data.buffer || obj.data);
        try {
          const png = _encodePng(obj.width, obj.height, kind, bytes);
          totalBytes += png.length;
          if (totalBytes > 3_500_000) break;         // umumiy hajmni cheklaymiz (draft/telegram uchun)
          uris.push("data:image/png;base64," + _b64(png));
        } catch (_) { /* bu rasmni o'tkazamiz */ }
      }
    }
    return uris;
  } catch (_) {
    return [];
  }
}
async function cdExtractImages(data: Uint8Array, filename: string): Promise<string[]> {
  const name = (filename || "").toLowerCase();
  if (name.endsWith(".pdf") || (data[0] === 0x25 && data[1] === 0x50)) return await pdfToImages(data);
  return [];
}

async function cdExtractText(data: Uint8Array, filename: string): Promise<string> {
  const name = (filename || "").toLowerCase();
  if (name.endsWith(".pdf") || (data[0] === 0x25 && data[1] === 0x50)) {
    const txt = cdCleanText(await pdfToText(data));
    if (txt.replace(/\s/g, "").length < 20) {
      throw new Error("PDF ichida matn topilmadi (skanerlangan/rasm PDF bo'lishi mumkin). Iltimos matnni oddiy matn yoki .docx ko'rinishida yuboring.");
    }
    return txt;
  }
  if (name.endsWith(".docx") || (data[0] === 0x50 && data[1] === 0x4b)) return cdCleanText(docxToText(data));
  return cdCleanText(new TextDecoder("utf-8").decode(data));
}
async function downloadTgFile(fileId: string): Promise<Uint8Array> {
  const info = await tg("getFile", { file_id: fileId });
  const path = info?.result?.file_path;
  if (!path) throw new Error("faylni yuklab bo'lmadi");
  const res = await fetch(`https://api.telegram.org/file/bot${BOT_TOKEN}/${path}`);
  return new Uint8Array(await res.arrayBuffer());
}

async function sendDocumentHtml(chatId: number, filename: string, html: string, caption: string) {
  const fd = new FormData();
  fd.append("chat_id", String(chatId));
  fd.append("caption", caption);
  fd.append("parse_mode", "Markdown");
  fd.append("document", new Blob([html], { type: "text/html" }), filename);
  const r = await fetch(`${TG_API}/sendDocument`, { method: "POST", body: fd });
  const j = await r.json().catch(() => ({}));
  if (!j.ok) { // parse_mode xatosi bo'lsa oddiy matn bilan qayta
    const fd2 = new FormData();
    fd2.append("chat_id", String(chatId));
    fd2.append("caption", caption.replace(/[*_`]/g, ""));
    fd2.append("document", new Blob([html], { type: "text/html" }), filename);
    await fetch(`${TG_API}/sendDocument`, { method: "POST", body: fd2 });
  }
}

// ---- klaviaturalar ----
function cdSkillKb(lang: Lang) {
  return {
    inline_keyboard: [
      [{ text: "🟢 Reading", callback_data: "cd:skill:reading" }, { text: "🔴 Listening", callback_data: "cd:skill:listening" }],
      [{ text: "🔴 Speaking", callback_data: "cd:skill:speaking" }, { text: "🔴 Writing", callback_data: "cd:skill:writing" }],
      [{ text: t(lang, "btn_home"), callback_data: "cd:cancel" }],
    ],
  };
}
// Topilgan material tasdig'i: tasdiqlash / yana passage / qayta yuborish / bekor
function cdReviewKb(lang: Lang, canAdd: boolean) {
  const rows: Btn[][] = [[{ text: t(lang, "btn_cd_confirm"), callback_data: "cd:rev:ok" }]];
  if (canAdd) rows.push([{ text: t(lang, "btn_cd_addmore"), callback_data: "cd:rev:add" }]);
  rows.push([{ text: t(lang, "btn_cd_redo_material"), callback_data: "cd:rev:redo" }]);
  rows.push([{ text: t(lang, "btn_cd_cancel"), callback_data: "cd:cancel" }]);
  return { inline_keyboard: rows };
}
// To'liq passage tayyor bo'lgach: yana passage qo'shish / CD testni yakunlash
function cdMoreKb(lang: Lang) {
  return { inline_keyboard: [
    [{ text: t(lang, "btn_cd_addmore"), callback_data: "cd:more:add" }],
    [{ text: t(lang, "btn_cd_finish"), callback_data: "cd:more:finish" }],
    [{ text: t(lang, "btn_cd_cancel"), callback_data: "cd:cancel" }],
  ] };
}

// Javob kalitini so'rashda: qayta yuborish / kalitsiz yaratish / bekor
function cdAnswersKb(lang: Lang, withSkip = true) {
  const rows: Btn[][] = [[{ text: t(lang, "btn_cd_redo_material"), callback_data: "cd:ans:redo" }]];
  if (withSkip) rows.push([{ text: t(lang, "btn_cd_skip_key"), callback_data: "cd:ans:skip" }]);
  rows.push([{ text: t(lang, "btn_cd_cancel"), callback_data: "cd:cancel" }]);
  return { inline_keyboard: rows };
}
// Test yaratilgandan keyin: yana yaratish / bosh menyu
function cdDoneKb(lang: Lang) {
  return { inline_keyboard: [
    [{ text: t(lang, "btn_cd_more"), callback_data: "cd:start" }],
    [{ text: t(lang, "btn_home"), callback_data: "nav:menu" }],
  ] };
}
// Doimiy pastki tugmalar (reply keyboard) — har doim qo'l ostida
function mainReplyKb(lang: Lang) {
  return {
    keyboard: [[{ text: t(lang, "rk_cd") }], [{ text: t(lang, "rk_check") }]],
    resize_keyboard: true,
    is_persistent: true,
  };
}

// Passage ogohlantirishlari (junk/short) — tanlangan tilda
function cdWarnText(warnings: string[], lang: Lang): string {
  if (!warnings || !warnings.length) return "";
  const msgs: string[] = [];
  if (warnings.includes("junk")) msgs.push(t(lang, "cd_warn_junk"));
  if (warnings.includes("short")) msgs.push(t(lang, "cd_warn_short"));
  if (!msgs.length) return "";
  return t(lang, "cd_warn_head", msgs.join("\n"));
}

// ---- callback ----
async function handleCdCallback(cq: any, sub: string[], lang: Lang) {
  const chatId = cq.message?.chat?.id;
  const messageId = cq.message?.message_id;
  const from = cq.from;
  if (!chatId) return;
  const op = sub[0];

  if (op === "start") {
    await setDraft(from.id, "skill", newDraft());
    await editMessage(chatId, messageId, t(lang, "cd_intro"), cdSkillKb(lang));
    return;
  }
  if (op === "skill") {
    if (sub[1] !== "reading") { await answerCallback(cq.id, t(lang, "cd_coming"), true); return; }
    await setDraft(from.id, "intake", newDraft());
    await editMessage(chatId, messageId, t(lang, "cd_ask_material", 1));
    return;
  }
  if (op === "cancel") {
    await clearDraft(from.id);
    await editMessage(chatId, messageId, t(lang, "choose_book"), booksKb());
    return;
  }
  const d = await getDraft(from.id);
  if (!d) { await sendMessage(chatId, t(lang, "start_prompt")); return; }

  // Ko'rib chiqish (review) tugmalari
  if (op === "rev") {
    if (!d.data.pending) { await sendMessage(chatId, t(lang, "cd_ask_material", 1)); return; }
    if (sub[1] === "redo") {
      d.data.pending = null;
      await setDraft(from.id, "intake", d.data);
      await editMessage(chatId, messageId, t(lang, "cd_ask_material", d.data.passages.length + 1));
      return;
    }
    // ok / add — pending segmentlarni tasdiqlab passages'ga qo'shamiz
    cdCommitPending(d.data);
    if (sub[1] === "add" && d.data.passages.length < 3) {
      await setDraft(from.id, "intake", d.data);
      await editMessage(chatId, messageId, t(lang, "cd_ask_material", d.data.passages.length + 1));
      return;
    }
    await cdAfterConfirm(chatId, from, d.data, lang, messageId);
    return;
  }
  // Javob kaliti bosqichida "materialni qayta yuborish"
  if (op === "ans" && sub[1] === "redo") {
    await setDraft(from.id, "intake", d.data);
    await editMessage(chatId, messageId, t(lang, "cd_ask_material", d.data.passages.length + 1));
    return;
  }
  // "Kalitsiz yaratish" — user javob kalitisiz test qurishni aniq tanladi
  if (op === "ans" && sub[1] === "skip") {
    if (!d.data.passages.some((p: CD.Passage) => p.groups.length)) {
      await sendMessage(chatId, t(lang, "cd_ask_material", d.data.passages.length + 1));
      return;
    }
    // kalitsiz ham darrov qurmasdan — yana passage yoki yakunlashni so'raymiz
    await cdOfferMore(chatId, from, d.data, lang, messageId);
    return;
  }
  // "Yana passage qo'shish" / "CD testni yakunlash"
  if (op === "more") {
    if (sub[1] === "add") {
      await setDraft(from.id, "intake", d.data);
      await editMessage(chatId, messageId, t(lang, "cd_ask_material", d.data.passages.length + 1));
    } else {
      await editMessage(chatId, messageId, t(lang, "cd_preparing"));
      await cdFinish(chatId, from, d.data, lang);
    }
    return;
  }
}

// PDF'dan ajratilgan rasmlarni diagram/flow-chart bor passage'ga biriktiramiz
function cdAttachImages(seg: CD.Segmentation, images: string[]) {
  for (const s of seg.segments) {
    if (s.groups.some((g) => g.qtype === "diagram" || g.qtype === "flowchart")) {
      s.passage.images = images;
    }
  }
}

// Ko'rib chiqish (review) hisoboti: nima topilgani + kalit holati + yana qo'shsa bo'ladimi
function cdSegReport(data: CdDraft, seg: CD.Segmentation, lang: Lang) {
  const base = data.passages.length;   // allaqachon tasdiqlangan passage'lar
  const lines = seg.segments.map((s, i) => {
    const idx = base + i + 1;
    const title = s.passage.title || "—";
    const paras = s.passage.paragraphs.length;
    if (s.groups.length) {
      const nums = s.groups.flatMap((g) => CD.numbersOf(g));
      return t(lang, "cd_seg_pline", idx, title, paras, new Set(nums).size, compactNums(nums));
    }
    return t(lang, "cd_seg_pline_noq", idx, title, paras);
  });
  const keyCount = Object.keys(seg.answerKey).length;
  const keyLine = keyCount ? t(lang, "cd_seg_key_found", keyCount) : t(lang, "cd_seg_key_none");
  return { body: lines.join("\n"), keyLine, canAdd: (base + seg.segments.length) < 3 };
}

// pending segmentlarni tasdiqlab passages'ga qo'shamiz + kalitni biriktiramiz
function cdCommitPending(data: CdDraft) {
  if (!data.pending) return;
  for (const s of data.pending.segments) {
    if (data.passages.length >= 3) break;
    const p = s.passage;
    p.groups = s.groups;
    p.answers = {};
    data.passages.push(p);
  }
  Object.assign(data.answerKey, data.pending.answerKey);
  data.pending = null;
  cdApplyAnswerKey(data);
}

// Global javob kalitidan har passage'ning javoblarini to'ldiradi
function cdApplyAnswerKey(data: CdDraft) {
  for (const p of data.passages) {
    p.answers = {};
    for (const g of p.groups) for (const n of CD.numbersOf(g)) {
      if (n in data.answerKey && String(data.answerKey[n]).trim()) p.answers[n] = data.answerKey[n];
    }
  }
}

// Hali javobi yo'q savol raqamlari
function cdMissingNums(data: CdDraft): number[] {
  const missing: number[] = [];
  for (const p of data.passages) for (const g of p.groups) for (const n of CD.numbersOf(g)) {
    if (!(n in data.answerKey) || !String(data.answerKey[n]).trim()) missing.push(n);
  }
  return missing;
}

// Savol turiga mos kelmagan javoblar bo'yicha ogohlantirish (barcha passage bo'ylab)
function cdKeyWarnings(data: CdDraft, lang: Lang): string {
  const badByKind: Record<string, number[]> = {};
  for (const p of data.passages) {
    const v = CD.validateAnswerKey(data.answerKey, p.groups);
    for (const k of Object.keys(v.badByKind)) (badByKind[k] ||= []).push(...v.badByKind[k]);
  }
  return Object.keys(badByKind).length ? cdMismatchMsg(badByKind, lang) : "";
}

// Tasdiqlagach: savol yo'q bo'lsa — savol so'raymiz; kalit to'liq bo'lsa — quramiz;
// aks holda kalitni so'raymiz
async function cdAfterConfirm(chatId: number, from: any, data: CdDraft, lang: Lang, messageId?: number) {
  const totalQ = data.passages.reduce((a, p) => a + p.groups.length, 0);
  if (!totalQ) {
    // passage bor, lekin savol yo'q — nimani olganimizni aytib, savol so'raymiz
    await setDraft(from.id, "intake", data);
    const txt = t(lang, "cd_ask_q_missing", data.passages.length);
    const kb = cdAnswersKb(lang, false);
    if (messageId) await editMessage(chatId, messageId, txt, kb);
    else await sendMessage(chatId, txt, kb);
    return;
  }
  const missing = cdMissingNums(data);
  if (missing.length) {
    await setDraft(from.id, "answers", data);
    const txt = t(lang, "cd_ask_key", compactNums(missing));
    if (messageId) await editMessage(chatId, messageId, txt, cdAnswersKb(lang));
    else await sendMessage(chatId, txt, cdAnswersKb(lang));
  } else {
    await cdOfferMore(chatId, from, data, lang, messageId);
  }
}

// To'liq passage (matn+savol+kalit) tayyor bo'lgach — darrov qurmasdan,
// yana passage qo'shishni yoki CD testni yakunlashni so'raymiz. 3 ta passage
// yig'ilgan bo'lsa (to'liq IELTS testi) — to'g'ridan-to'g'ri quramiz.
function cdTotalQ(data: CdDraft): number {
  let n = 0;
  for (const p of data.passages) for (const g of p.groups) n += CD.numbersOf(g).length;
  return n;
}
async function cdOfferMore(chatId: number, from: any, data: CdDraft, lang: Lang, messageId?: number) {
  if (data.passages.length >= 3) {
    if (messageId) await editMessage(chatId, messageId, t(lang, "cd_preparing"));
    await cdFinish(chatId, from, data, lang);
    return;
  }
  await setDraft(from.id, "more", data);
  const txt = t(lang, "cd_ready_more", data.passages.length, cdTotalQ(data));
  if (messageId) await editMessage(chatId, messageId, txt, cdMoreKb(lang));
  else await sendMessage(chatId, txt, cdMoreKb(lang));
}

// Qismlarni alohida yuborish: passage allaqachon bor bo'lsa, kelgan matnni
// (faqat) savol yoki (faqat) javob kaliti sifatida biriktirishga urinamiz.
const CD_Q_START = /^\s*(questions?\s+\d|complete the|choose the correct|do the following|which\s+(section|paragraph)|label the|list of headings|match each|classify)/i;
function cdFirstLine(text: string): string {
  for (const l of (text || "").split(/\r?\n/)) if (l.trim()) return l.trim();
  return "";
}
async function cdHandlePartial(chatId: number, from: any, data: CdDraft, text: string, images: string[], lang: Lang): Promise<boolean> {
  const noGroupP = data.passages.find((p) => !p.groups.length);
  // (a) savolsiz passage kutmoqda — kelgan matn savollarga o'xshasa biriktiramiz
  if (noGroupP && CD_Q_START.test(cdFirstLine(text))) {
    const qGroups = CD.parseQuestions(text, noGroupP.paragraphs.length).filter((g) => CD.numbersOf(g).length);
    if (qGroups.length) {
      noGroupP.groups = qGroups;
      if (images.length && qGroups.some((g) => g.qtype === "diagram" || g.qtype === "flowchart")) noGroupP.images = images;
      cdApplyAnswerKey(data);
      data.failCount = 0;
      const nums = qGroups.flatMap((g) => CD.numbersOf(g));
      await sendMessage(chatId, t(lang, "cd_seg_pline", data.passages.indexOf(noGroupP) + 1,
        noGroupP.title || "—", noGroupP.paragraphs.length, new Set(nums).size, compactNums(nums)));
      await cdAfterConfirm(chatId, from, data, lang);
      return true;
    }
  }
  // (b) savolli passage(lar) bor — matn faqat javob kalitiga o'xshasa biriktiramiz
  const hasQ = data.passages.some((p) => p.groups.length);
  const looksKey = !/reading\s+passage|questions?\s+\d/i.test(text) && text.length < 1500;
  if (hasQ && looksKey) {
    const key = CD.parseAnswerKey(text);
    if (Object.keys(key).length) {
      Object.assign(data.answerKey, key);
      cdApplyAnswerKey(data);
      data.failCount = 0;
      await sendMessage(chatId, t(lang, "cd_key_added_ok", Object.keys(key).length, cdKeyWarnings(data, lang)));
      await cdAfterConfirm(chatId, from, data, lang);
      return true;
    }
  }
  return false;
}

// ---- xabar (matn/fayl) ----
async function cdHandleInput(chatId: number, from: any, step: string, data: CdDraft, text: string, images: string[] = [], lang: Lang = "uz") {
  // "more" bosqichida yangi material kelsa — uni intake kabi (yangi passage) qabul qilamiz
  if (step === "more") step = "intake";
  // intake yoki review paytida kelgan matn/fayl — (qayta) material sifatida ajratiladi
  if (step === "intake" || step === "review") {
    // Qismlarni alohida yuborish: passage bor bo'lsa — savol/kalitni biriktirishga urinamiz
    if (step === "intake" && data.passages.length) {
      if (await cdHandlePartial(chatId, from, data, text, images, lang)) return;
    }
    const seg = CD.segmentMaterial(text);
    if (images.length) cdAttachImages(seg, images);
    if (seg.note === "no_passage" || !seg.segments.length) {
      data.failCount = (data.failCount || 0) + 1;
      data.pending = null;
      await setDraft(from.id, "intake", data);
      await sendMessage(chatId, data.failCount >= 2 ? t(lang, "cd_seg_fail_again") : t(lang, "cd_seg_fail"));
      return;
    }
    data.failCount = 0;
    data.pending = { segments: seg.segments, answerKey: seg.answerKey, note: seg.note };
    await setDraft(from.id, "review", data);
    const rep = cdSegReport(data, seg, lang);
    let msg = t(lang, "cd_seg_review", rep.body, rep.keyLine);
    if (seg.segments.some((s) => !s.groups.length)) msg += t(lang, "cd_seg_no_q_warn");
    await sendMessage(chatId, msg, cdReviewKb(lang, rep.canAdd));
    return;
  }
  if (step === "answers") {
    const key = CD.parseAnswerKey(text);
    if (!Object.keys(key).length) {
      const groups = data.passages.flatMap((p) => p.groups);
      await sendMessage(chatId, t(lang, "cd_ans_unreadable") + "\n\n" + cdFormatGuide(groups, lang), cdAnswersKb(lang));
      return;
    }
    Object.assign(data.answerKey, key);
    cdApplyAnswerKey(data);
    const warn = cdKeyWarnings(data, lang);
    await sendMessage(chatId, t(lang, "cd_key_added_ok", Object.keys(key).length, warn));
    const missing = cdMissingNums(data);
    if (missing.length) {
      await setDraft(from.id, "answers", data);
      await sendMessage(chatId, t(lang, "cd_ask_key", compactNums(missing)), cdAnswersKb(lang));
    } else {
      // to'liq passage tayyor — darrov qurmasdan, yana passage yoki yakunlashni so'raymiz
      await cdOfferMore(chatId, from, data, lang);
    }
  }
}

function slugify(s: string): string {
  const base = (s || "").toLowerCase().normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")   // diakritiklar
    .replace(/[^a-z0-9\s-]/g, "").trim()
    .replace(/[\s-]+/g, "_").slice(0, 40).replace(/^_+|_+$/g, "");
  return base || "reading";
}

async function cdFinish(chatId: number, from: any, data: CdDraft, lang: Lang) {
  await sendMessage(chatId, t(lang, "cd_preparing"));
  data.settings.brand = "DREAM ZONE";
  data.settings.lang = lang;   // CD HTML interfeysi shu tilda bo'ladi
  // Sarlavha (yo'q bo'lsa passage boshidan) — fayl nomi uchun
  const rawTitle = (data.passages[0] && data.passages[0].title) || "";
  const firstText = (data.passages[0] && data.passages[0].paragraphs && data.passages[0].paragraphs[0]) || "";
  const title = rawTitle || "IELTS Reading Practice";
  const test: CD.ReadingTest = { title, passages: data.passages, settings: data.settings };
  const html = CD.renderTest(test);
  const total = CD.totalQuestions(test);
  const fileName = "dream_zone_" + slugify(rawTitle || firstText) + ".html";
  const caption = t(lang, "cd_caption", total, data.passages.length, BOT_LINK);
  await sendDocumentHtml(chatId, fileName, html, caption);
  await clearDraft(from.id);
  bg(logEvent(from.id, "cd_created", { questions: total, passages: data.passages.length }));
  await sendMessage(chatId, t(lang, "cd_done"), cdDoneKb(lang));
}

async function handleCdDocument(chatId: number, from: any, doc: any, lang: Lang) {
  const d = await getDraft(from.id);
  if (!d || !CD_STEPS.has(d.step)) {
    await sendMessage(chatId, t(lang, "cd_doc_no_flow"));
    return;
  }
  if (doc.file_size && doc.file_size > CD_MAX_FILE) { await sendMessage(chatId, t(lang, "cd_file_too_big")); return; }
  // Fayl yuklab olinishi + PDF tahlili vaqt oladi — darrov "jarayon" xabari
  const notice = await cdNotice(chatId, lang);
  let text: string;
  let images: string[] = [];
  try {
    const bytes = await downloadTgFile(doc.file_id);
    text = await cdExtractText(bytes, doc.file_name || "");
    // Material bosqichida (intake/review) diagramma rasmlarini ajratib olamiz
    if (d.step === "intake" || d.step === "review") {
      try { images = await cdExtractImages(bytes, doc.file_name || ""); } catch (_) { images = []; }
    }
  } catch (e) {
    await cdNoticeDone(chatId, notice);
    await sendMessage(chatId, t(lang, "cd_file_unreadable", (e as Error).message));
    return;
  }
  try { await cdHandleInput(chatId, from, d.step, d.data, text, images, lang); }
  finally { await cdNoticeDone(chatId, notice); }
}

// ======================= update'larni qayta ishlash =======================

async function handleUpdate(update: any) {
  try {
    if (update.callback_query) {
      const cq = update.callback_query;
      const lang = await getLang(cq.from?.id);
      await handleCallback(cq, lang);
      return;
    }
    const msg = update.message ?? update.edited_message;
    if (!msg || !msg.from) return;
    const chatId = msg.chat.id;
    const lang = await getLang(msg.from.id);
    if (msg.document) { await handleCdDocument(chatId, msg.from, msg.document, lang); return; }
    const text = (msg.text ?? "").trim();
    if (!text) return;
    if (text.startsWith("/")) await handleCommand(chatId, msg.from, text, lang);
    else await handleText(chatId, msg.from, text, lang);
  } catch (e) {
    console.error("handleUpdate xato:", e);
  }
}

// ------------------------------- webhook secret -------------------------------

async function webhookSecret(): Promise<string> {
  const enc = new TextEncoder();
  const buf = await crypto.subtle.digest("SHA-256", enc.encode(BOT_TOKEN));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("").slice(0, 40);
}

// --------------------------------- main ---------------------------------

Deno.serve(async (req) => {
  if (!BOT_TOKEN) return new Response("BOT_TOKEN yo'q", { status: 500 });
  const url = new URL(req.url);

  // Funksiyaning ommaviy manzili. req.url ba'zan ichki host beradi, shuning uchun
  // loyihaning SUPABASE_URL muhit o'zgaruvchisidan quramiz (eng ishonchli).
  function publicHookUrl(): string {
    const base = (Deno.env.get("SUPABASE_URL") ?? url.origin).replace(/\/+$/, "");
    return `${base}/functions/v1/ielts-bot`;
  }

  // Keep-alive: loyihani faol ushlab turish uchun yengil DB so'rovi (GET ?ping=1)
  if (req.method === "GET" && url.searchParams.has("ping")) {
    let dbState = "skip";
    try {
      const c = await sb();
      if (c) { await c.from("ielts_ac_users").select("telegram_id").limit(1); dbState = "ok"; }
    } catch (_) { dbState = "err"; }
    return new Response("pong " + dbState, { status: 200 });
  }

  // Webhook holatini ko'rish (debug): GET ?info=1
  if (req.method === "GET" && url.searchParams.has("info")) {
    const r = await tg("getWebhookInfo", {});
    return new Response(JSON.stringify(r, null, 2),
      { status: 200, headers: { "content-type": "application/json; charset=utf-8" } });
  }

  // Bir martalik sozlash: webhook'ni ro'yxatdan o'tkazish.
  if (req.method === "GET" && url.searchParams.has("setup")) {
    const hookUrl = publicHookUrl();
    const secret = await webhookSecret();
    const set = await tg("setWebhook", {
      url: hookUrl,
      secret_token: secret,
      allowed_updates: ["message", "callback_query"],
      drop_pending_updates: true,
    });
    // Telegram buyruqlar menyusi — har til uchun alohida (language_code scope).
    const cmdList = (l: Lang) => [
      { command: "start", description: t(l, "cmd_start") },
      { command: "language", description: t(l, "cmd_language") },
      { command: "about", description: t(l, "cmd_about") },
      { command: "guide", description: t(l, "cmd_guide") },
      { command: "stats", description: t(l, "cmd_stats") },
      { command: "qtemplate", description: t(l, "cmd_qtemplate") },
    ];
    // Standart (uz) + ru/en scope'lari
    await tg("setMyCommands", { commands: cmdList("uz") });
    await tg("setMyCommands", { commands: cmdList("ru"), language_code: "ru" });
    await tg("setMyCommands", { commands: cmdList("en"), language_code: "en" });
    // Pastdagi doimiy "Menyu" tugmasi Mini App'ni ochsin.
    let menu: any = { ok: false, description: "WEBAPP_URL yo'q" };
    if (WEBAPP_URL) {
      menu = await tg("setChatMenuButton", {
        menu_button: { type: "web_app", text: "Mini App", web_app: { url: WEBAPP_URL } },
      });
    }
    const info = await tg("getWebhookInfo", {});
    const okMsg = set.ok
      ? "✅ Webhook muvaffaqiyatli sozlandi! Endi botga /start yuboring."
      : "❌ Webhook sozlanmadi. Quyidagi xatoga qarang.";
    return new Response(
      `${okMsg}\n\nsetWebhook: ${JSON.stringify(set)}\n` +
      `menuButton (Mini App): ${JSON.stringify(menu)}\nURL: ${hookUrl}\n\n` +
      `getWebhookInfo: ${JSON.stringify(info.result ?? info)}`,
      { status: 200, headers: { "content-type": "text/plain; charset=utf-8" } },
    );
  }

  if (req.method !== "POST") return new Response("ok", { status: 200 });

  // Telegram secret_token tekshiruvi.
  const expected = await webhookSecret();
  const got = req.headers.get("x-telegram-bot-api-secret-token");
  if (got !== expected) return new Response("forbidden", { status: 401 });

  let update: any;
  try { update = await req.json(); } catch (_) { return new Response("bad json", { status: 400 }); }

  // Update'ni fonda qayta ishlaymiz, Telegram'ga darrov 200 qaytaramiz.
  bg(handleUpdate(update));
  return new Response("ok", { status: 200 });
});
