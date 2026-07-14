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
import { unzipSync, strFromU8 } from "https://esm.sh/fflate@0.8.2";

type AnswerMap = Record<string, Record<string, string>>;
const ANSWERS = answers as AnswerMap;

const BOT_TOKEN = Deno.env.get("BOT_TOKEN") ?? "";
const WEBAPP_URL = (Deno.env.get("WEBAPP_URL") ??
  "https://roziyevbehroz-tech.github.io/IELTS-ANSWER-CHECK-BOT/").trim();
const TG_API = `https://api.telegram.org/bot${BOT_TOKEN}`;

const BOOKS = Array.from({ length: 11 }, (_, i) => 10 + i); // 10..20
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

function isCorrect(userAnswer: string, keyAnswer: string): boolean {
  if (!userAnswer || !keyAnswer) return false;
  return acceptableVariants(keyAnswer).has(canonical(userAnswer));
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

function partLabel(section: string, part: string): string {
  if (part === "all") return "To'liq test";
  return section === "listening" ? `Part ${part}` : `Passage ${part}`;
}

const WELCOME = (name: string) =>
  `👋 Assalomu alaykum, *${name}*!\n\n` +
  "*DREAM ZONE* IELTS yordamchisiga xush kelibsiz 🎓\n\n" +
  "Listening va Reading javoblaringizni bir zumda tekshirib beraman — " +
  "boshlash uchun quyidagi tugmani bosing 👇";

const WELCOME_HINT =
  "\n\nℹ️ Bot haqida — /about\n📖 Qo'llanma — /guide";

const ABOUT =
  "🎓 *DREAM ZONE — IELTS yordamchisi*\n\n" +
  "Men *DREAM ZONE* o'quv markazi o'quvchilari uchun yaratilganman 💙\n\n" +
  "Cambridge IELTS Academic 10–20 kitoblaridagi Listening va Reading " +
  "testlarini tekshiraman — jami 44 ta to'liq test.\n\n" +
  "Eng muhimi: men *faqat to'g'ri* javoblaringizni ko'rsataman. Xato " +
  "javoblarning to'g'ri variantini darrov ochib qo'ymayman — siz ular " +
  "ustida o'zingiz ishlaysiz, tayyor bo'lganingizda esa o'zingiz ko'rasiz.\n\n" +
  "📖 Qanday foydalanish — /guide";

const GUIDE =
  "📖 *Qanday foydalanaman?*\n\n" +
  "1. Mini App'ni oching yoki «Matn orqali tekshirish»ni tanlang.\n" +
  "2. Kitob, test va bo'limni tanlang.\n" +
  "3. O'sha qismni mustaqil yeching.\n" +
  "4. Javoblaringizni raqami bilan yuboring, masalan:\n" +
  "`1. cat`\n`2. TRUE`\n`3. B`\n" +
  "5. Men faqat to'g'rilarini belgilab beraman.\n" +
  "6. Xatolar ustida ishlang va qayta yuboring.\n" +
  "7. Tayyor bo'lsangiz — «🔑 Javoblarni ko'rish».\n\n" +
  "Savolingiz bo'lsa, *DREAM ZONE* ustozlaringizga murojaat qiling 💙";

const PART_NOT_AVAILABLE =
  "⚠️ Afsuski, bu qism uchun javoblar hali bazaga kiritilmagan.\n" +
  "Iltimos boshqa qismni tanlang yoki keyinroq urinib ko'ring.";

const NO_ANSWERS_PARSED =
  "🤔 Javoblarni o'qib bo'lmadi. Iltimos har bir javobni raqami bilan yuboring:\n" +
  "`21. cat`\n`22. true`\n`23. B`";

function sendAnswersPrompt(book: number, test: number, section: string, part: string): string {
  const [lo, hi] = partRange(section, part);
  const nums = Object.keys(partAnswers(book, test, section, part)).map(Number).sort((a, b) => a - b);
  const first = nums.length ? nums[0] : lo;
  const last = nums.length ? nums[nums.length - 1] : hi;
  const example = section === "reading"
    ? `${first}. TRUE\n${first + 1}. paragraph\n${first + 2}. B`
    : `${first}. cat\n${first + 1}. 10 am\n${first + 2}. B`;
  return (
    `✍️ *${book}-kitob, Test ${test}, ${SECTION_NAMES[section]} — ${partLabel(section, part)}*\n` +
    `Savollar: ${first}–${last} (${nums.length} ta)\n\n` +
    "Javoblaringizni tartib raqami bilan yuboring. Masalan:\n" +
    "`" + example + "`\n\n" +
    "Har bir javobni alohida qatorda yozsangiz ham bo'ladi."
  );
}

// ------------------------------- klaviaturalar -------------------------------

type Btn = { text: string; callback_data?: string; web_app?: { url: string } };

function chunk<T>(arr: T[], n: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
  return out;
}

function launcherKb() {
  const rows: Btn[][] = [];
  if (WEBAPP_URL) rows.push([{ text: "🚀 Mini App'ni ochish", web_app: { url: WEBAPP_URL } }]);
  rows.push([{ text: "⌨️ Matn orqali tekshirish", callback_data: "nav:books" }]);
  rows.push([{ text: "🆕 CD Test yaratish", callback_data: "cd:start" }]);
  return { inline_keyboard: rows };
}

function booksKb() {
  const btns: Btn[] = BOOKS.map((b) => ({ text: String(b), callback_data: `b:${b}` }));
  return { inline_keyboard: chunk(btns, 4) };
}

function testsKb(book: number) {
  const btns: Btn[] = TESTS.map((t) => ({ text: `Test ${t}`, callback_data: `t:${book}:${t}` }));
  const rows = chunk(btns, 2);
  rows.push([{ text: "⬅️ Orqaga", callback_data: "nav:books" }]);
  return { inline_keyboard: rows };
}

function sectionsKb(book: number, test: number) {
  return {
    inline_keyboard: [
      [
        { text: "🎧 Listening", callback_data: `s:${book}:${test}:listening` },
        { text: "📖 Reading", callback_data: `s:${book}:${test}:reading` },
      ],
      [{ text: "⬅️ Orqaga", callback_data: `nav:tests:${book}` }],
    ],
  };
}

function partsKb(book: number, test: number, section: string) {
  const labels: [string, string][] = section === "listening"
    ? [["Part 1", "1"], ["Part 2", "2"], ["Part 3", "3"], ["Part 4", "4"]]
    : [["Passage 1", "1"], ["Passage 2", "2"], ["Passage 3", "3"]];
  const btns: Btn[] = labels.map(([lbl, code]) =>
    ({ text: lbl, callback_data: `p:${book}:${test}:${section}:${code}` }));
  const rows = chunk(btns, 2);
  rows.push([{ text: "📋 To'liq test (1–40)", callback_data: `p:${book}:${test}:${section}:all` }]);
  rows.push([{ text: "⬅️ Orqaga", callback_data: `nav:secs:${book}:${test}` }]);
  return { inline_keyboard: rows };
}

function resultKb(book: number, test: number, section: string, part: string) {
  const ctx = `${book}:${test}:${section}:${part}`;
  return {
    inline_keyboard: [
      [{ text: "🔁 Qaytadan urinish", callback_data: `retry:${ctx}` }],
      [{ text: "🔑 Javoblarni ko'rish", callback_data: `reveal:${ctx}` }],
      [{ text: "🏠 Bosh menyu", callback_data: "nav:books" }],
    ],
  };
}

function afterRevealKb() {
  return { inline_keyboard: [[{ text: "🏠 Bosh menyu", callback_data: "nav:books" }]] };
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

function customTestKb(id: string) {
  var sep = WEBAPP_URL.indexOf("?") >= 0 ? "&" : "?";
  return { inline_keyboard: [[{ text: "🚀 Testni boshlash", web_app: { url: WEBAPP_URL + sep + "ct=" + id } }]] };
}

async function handleOpenCustom(chatId: number, from: any, id: string) {
  bg(upsertUser(from));
  const t = await getCustomTest(id);
  if (!t) { await sendMessage(chatId, "❌ Test topilmadi yoki o'chirilgan."); return; }
  const total = Object.keys(t.answers || {}).length;
  const st = ctStatus(t);
  if (st === "closed") {
    await sendMessage(chatId, `🔒 *${t.title}*\n\nBu test yakunlangan — hozir javob qabul qilinmaydi.`);
    return;
  }
  if (st === "paused") {
    await sendMessage(chatId, `⏸️ *${t.title}*\n\nBu test vaqtincha to'xtatilgan. Keyinroq urinib ko'ring.`);
    return;
  }
  const who = t.owner_name ? `\nYaratuvchi: ${t.owner_name}` : "";
  await sendMessage(chatId,
    `📝 *${t.title}*\n\n${total} ta savol · DREAM ZONE${who}\n\n` +
    "Javoblaringizni kiritib darrov tekshiring — faqat to'g'rilari ko'rsatiladi.\n\n" +
    "Boshlash uchun quyidagi tugmani bosing 👇",
    customTestKb(id));
}

async function handleCommand(chatId: number, from: any, text: string) {
  const segs = text.split(/\s+/);
  const cmd = segs[0].replace(/@.*$/, "");
  const param = segs[1] || "";
  if (cmd === "/start" && param.indexOf("t_") === 0) {
    return await handleOpenCustom(chatId, from, param.slice(2));
  }
  if (cmd === "/start") {
    bg(upsertUser(from));
    bg(setSession(from.id, { awaiting: false }));
    const name = from.first_name || "do'stim";
    await sendMessage(chatId, WELCOME(name) + WELCOME_HINT, launcherKb());
  } else if (cmd === "/about") {
    await sendMessage(chatId, ABOUT);
  } else if (cmd === "/guide" || cmd === "/help") {
    await sendMessage(chatId, GUIDE);
  } else if (cmd === "/stats") {
    await sendStats(chatId, from.id);
  } else if (cmd === "/qtemplate") {
    await sendMessage(chatId, CD_QTEMPLATE);
  } else {
    await sendMessage(chatId, "Boshlash uchun /start ni bosing.");
  }
}

async function sendStats(chatId: number, tgId: number) {
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
    await sendMessage(chatId, "📈 Hali yechilgan testlar yo'q. Birinchi testni yechib ko'ring!");
    return;
  }
  let msg = "📈 *Sizning statistikangiz:*\n\n";
  let pct = 0;
  for (const a of rows) {
    const sec = SECTION_NAMES[a.section] ?? a.section;
    msg += `• ${a.book}-kitob T${a.test} ${sec} ${partLabel(a.section, a.part)}: ${a.correct}/${a.total}\n`;
    if (a.total) pct += (a.correct / a.total) * 100;
  }
  msg += `\n*Jami:* ${rows.length} ta urinish, o'rtacha ${Math.round(pct / rows.length)}% to'g'ri.`;
  await sendMessage(chatId, msg);
}

async function handleCallback(cq: any) {
  const data: string = cq.data ?? "";
  const chatId = cq.message?.chat?.id;
  const messageId = cq.message?.message_id;
  const from = cq.from;
  await answerCallback(cq.id);
  if (!chatId || !messageId) return;

  const parts = data.split(":");
  const kind = parts[0];

  if (kind === "cd") {
    await handleCdCallback(cq, parts.slice(1));
    return;
  }

  if (kind === "nav") {
    const what = parts[1];
    if (what === "books") {
      bg(clearAwaiting(from.id));
      await editMessage(chatId, messageId, "📚 Cambridge IELTS Academic — kitobni tanlang:", booksKb());
    } else if (what === "tests") {
      const book = Number(parts[2]);
      await editMessage(chatId, messageId, `📝 ${book}-kitob. Testni tanlang:`, testsKb(book));
    } else if (what === "secs") {
      const book = Number(parts[2]), test = Number(parts[3]);
      await editMessage(chatId, messageId, `🎧📖 ${book}-kitob, Test ${test}. Bo'limni tanlang:`, sectionsKb(book, test));
    }
    return;
  }

  if (kind === "b") {
    const book = Number(parts[1]);
    await editMessage(chatId, messageId, `📝 ${book}-kitob. Testni tanlang:`, testsKb(book));
    return;
  }

  if (kind === "t") {
    const book = Number(parts[1]), test = Number(parts[2]);
    await editMessage(chatId, messageId, `🎧📖 ${book}-kitob, Test ${test}. Bo'limni tanlang:`, sectionsKb(book, test));
    return;
  }

  if (kind === "s") {
    const book = Number(parts[1]), test = Number(parts[2]), section = parts[3];
    const icon = SECTION_ICONS[section] ?? "";
    const name = SECTION_NAMES[section] ?? section;
    await editMessage(chatId, messageId,
      `${icon} ${book}-kitob, Test ${test}, ${name}. Qismni tanlang:`, partsKb(book, test, section));
    return;
  }

  if (kind === "p") {
    const book = Number(parts[1]), test = Number(parts[2]), section = parts[3], part = parts[4];
    if (!isPartAvailable(book, test, section, part)) {
      await answerCallback(cq.id, "Bu qism uchun javoblar hali yo'q.", true);
      await editMessage(chatId, messageId, PART_NOT_AVAILABLE, partsKb(book, test, section));
      return;
    }
    bg(setSession(from.id, { book, test, section, part, awaiting: true }));
    await editMessage(chatId, messageId, sendAnswersPrompt(book, test, section, part));
    return;
  }

  if (kind === "retry") {
    const book = Number(parts[1]), test = Number(parts[2]), section = parts[3], part = parts[4];
    bg(setSession(from.id, { book, test, section, part, awaiting: true }));
    await editMessage(chatId, messageId, sendAnswersPrompt(book, test, section, part));
    return;
  }

  if (kind === "reveal") {
    const book = Number(parts[1]), test = Number(parts[2]), section = parts[3], part = parts[4];
    bg(clearAwaiting(from.id));
    const keys = partAnswers(book, test, section, part);
    const header = `🔑 *To'g'ri javoblar — ${book}-kitob, Test ${test}, ` +
      `${SECTION_NAMES[section]} ${partLabel(section, part)}:*\n\n`;
    const lines = Object.keys(keys).map(Number).sort((a, b) => a - b)
      .map((q) => `${q}. ${keys[q]}`);
    await editMessage(chatId, messageId, header + lines.join("\n"), afterRevealKb());
    return;
  }
}

async function handleText(chatId: number, from: any, text: string) {
  // CD test yaratish oqimi faol bo'lsa — o'sha yerga yo'naltiramiz
  const draft = await getDraft(from.id);
  if (draft && CD_STEPS.has(draft.step)) {
    await cdHandleInput(chatId, from, draft.step, draft.data, text);
    return;
  }

  const session = await getSession(from.id);
  if (!session || !session.awaiting || !session.book || !session.section || !session.part) {
    await sendMessage(chatId, "Boshlash uchun /start ni bosing.");
    return;
  }
  const { book, test, section, part } = session as Required<Session>;
  const userAnswers = parseAnswers(text);
  if (Object.keys(userAnswers).length === 0) {
    await sendMessage(chatId, NO_ANSWERS_PARSED);
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

  let msg = `📊 *Natija: ${correct.length}/${total} to'g'ri*\n\n`;
  if (correct.length === total && total > 0) {
    msg += `🎉 Barakalla! Hammasi to'g'ri — ${total}/${total}!\n`;
  } else {
    if (correct.length) msg += `✅ To'g'ri javoblar: ${correct.join(", ")}\n`;
    else msg += "Hozircha to'g'ri javob yo'q. Xafa bo'lmang, qayta urinib ko'ring! 💪\n";
    if (unanswered.length) msg += `\nℹ️ Javob bermagan savollaringiz: ${unanswered.join(", ")}\n`;
    msg += "\n🔁 Qolgan savollar ustida yana mustaqil ishlang. Tayyor bo'lsangiz, javoblarni qaytadan yuboring.";
  }

  await sendMessage(chatId, msg, resultKb(book, test, section, part));
  bg(recordAttempt(from.id, book, test, section, part, correct.length, total,
    { correct, unanswered }));
}

// ======================= CD Test yaratish (Reading) =======================

const CD_MAX_FILE = 8 * 1024 * 1024;
const CD_STEPS = new Set(["passage", "questions", "answers", "expl"]);

interface CdDraft {
  skill: string;
  passages: CD.Passage[];
  curPassage: CD.Passage | null;
  curGroups: CD.QuestionGroup[] | null;
  settings: CD.Settings;
  explanations: Record<number, string>;
}

function newDraft(): CdDraft {
  return { skill: "reading", passages: [], curPassage: null, curGroups: null,
    settings: CD.newSettings(), explanations: {} };
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
function cdExtractText(data: Uint8Array, filename: string): string {
  const name = (filename || "").toLowerCase();
  if (name.endsWith(".pdf") || (data[0] === 0x25 && data[1] === 0x50)) {
    throw new Error("PDF hozircha edge-botda qo'llab-quvvatlanmaydi. Iltimos matnni oddiy matn yoki .docx ko'rinishida yuboring.");
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
function cdSkillKb() {
  return {
    inline_keyboard: [
      [{ text: "🟢 Reading", callback_data: "cd:skill:reading" }, { text: "🔴 Listening", callback_data: "cd:skill:listening" }],
      [{ text: "🔴 Speaking", callback_data: "cd:skill:speaking" }, { text: "🔴 Writing", callback_data: "cd:skill:writing" }],
      [{ text: "🏠 Bosh menyu", callback_data: "cd:cancel" }],
    ],
  };
}
function cdRevealKb() {
  return { inline_keyboard: [
    [{ text: "⚡ Darrov ko'rinsin", callback_data: "cd:reveal:instant" }],
    [{ text: "🔒 Bosib ko'rsin (bot kabi)", callback_data: "cd:reveal:end" }],
  ] };
}
function cdExplKb() {
  return { inline_keyboard: [[
    { text: "➕ Ha, izoh qo'shaman", callback_data: "cd:expl:yes" },
    { text: "⏭ Yo'q, kerak emas", callback_data: "cd:expl:no" },
  ]] };
}
function cdMoreKb() {
  return { inline_keyboard: [
    [{ text: "➕ Yana passage qo'shish", callback_data: "cd:more:add" }],
    [{ text: "✅ CD test yaratish", callback_data: "cd:more:finish" }],
  ] };
}

// ---- matnlar ----
const CD_INTRO =
  "🆕 *CD Test yaratish*\n\nQaysi bo'lim uchun test yaratmoqchisiz?\n\n" +
  "🟢 *Reading* — tayyor\n🔴 Listening / Speaking / Writing — tez orada\n\nBo'limni tanlang 👇";
const CD_COMING = "🔴 Bu bo'lim hozircha tayyor emas. Tez orada! Hozircha 🟢 Reading mavjud.";
const cdAskPassage = (n: number) =>
  `📖 *Reading — Passage ${n}*\n\nIltimos, testning *matn (passage)* qismini yuboring.\n\n` +
  "Qabul qilinadi: 📄 DOCX yoki oddiy matn. (PDF hozircha edge-botda emas.)\n" +
  "Matnga savollar aralashib ketgan bo'lsa — bot ularni avtomatik ajratadi.";
const cdAskQuestions = (title: string, paras: number, lettered: string) =>
  `✅ Passage qabul qilindi!\n📌 Sarlavha: *${title}*\n📄 Paragraflar: ${paras} ta${lettered}\n\n` +
  "Endi shu passage'ning *savollarini* yuboring (matn yoki fayl).\n\n" +
  "1️⃣ Toza Cambridge matni — bot turlarni o'zi taniydi.\n" +
  "2️⃣ Aniq shablon (100% ishonchli) — /qtemplate ni yuboring.";
const CD_NO_Q =
  "🤔 Savollarni ajratib bo'lmadi. Iltimos aniq shablondan foydalaning — /qtemplate ni yuboring.";
const CD_ASK_REVEAL =
  "⚙️ *Sozlama 1/2 — javoblar qachon ko'rinsin?*\n\n" +
  "⚡ *Darrov* — «Deliver» bosilganda to'g'ri javoblar darrov ko'rinadi.\n" +
  "🔒 *Bosib ko'rsin* — avval faqat ball, to'g'ri javoblar «Javoblarni ko'rish» bosilganda ochiladi (bot uslubi).";
const CD_ASK_EXPL =
  "⚙️ *Sozlama 2/2 — izoh qo'shasizmi?*\n\nHar bir savol uchun qisqa izoh qo'shishingiz mumkin.";
const CD_ASK_EXPL_TEXT =
  "✍️ Izohlarni yuboring. Namuna:\n```\n1. matnda 'white silk' deb aytilgan\n5. bu haqda ma'lumot yo'q\n```";
const CD_QTEMPLATE =
  "🧩 *Savol shabloni* — har blok `[tur] boshlanish-tugash` bilan.\nGap uchun `___` yozing (avtomatik raqamlanadi).\n\n" +
  "```\n[note] 1-3\nComplete the notes. ONE WORD ONLY.\n- emperor wore ___ silk\n- payment of ___\n- used in ___ trade\n\n" +
  "[tfng] 4-5\nTRUE FALSE NOT GIVEN\n4. Statement one.\n5. Statement two.\n\n" +
  "[mcq] 6-6\nChoose the correct letter.\n6. Question stem?\nA option a\nB option b\nC option c\n\n" +
  "[mcq_multi] 7-8\nChoose TWO letters.\nA ...\nB ...\nC ...\nD ...\nE ...\n\n" +
  "[headings] 9-10\nList of Headings:\ni Heading one\nii Heading two\niii Heading three\n9. Paragraph A\n10. Paragraph B\n\n" +
  "[matching_info] 11-12 | A-F\nWhich paragraph contains...?\n11. info one\n12. info two\n\n" +
  "[matching_features] 13-14 | A-C\nMatch each statement with a person.\nA Smith\nB Jones\nC Lee\n13. one\n14. two\n\n" +
  "[summary]·[sentence]·[table]·[flowchart]·[shortanswer]·[diagram] — ham `___` bilan\n```";

// ---- callback ----
async function handleCdCallback(cq: any, sub: string[]) {
  const chatId = cq.message?.chat?.id;
  const messageId = cq.message?.message_id;
  const from = cq.from;
  if (!chatId) return;
  const op = sub[0];

  if (op === "start") {
    await setDraft(from.id, "skill", newDraft());
    await editMessage(chatId, messageId, CD_INTRO, cdSkillKb());
    return;
  }
  if (op === "skill") {
    if (sub[1] !== "reading") { await answerCallback(cq.id, CD_COMING, true); return; }
    await setDraft(from.id, "passage", newDraft());
    await editMessage(chatId, messageId, cdAskPassage(1));
    return;
  }
  if (op === "cancel") {
    await clearDraft(from.id);
    await editMessage(chatId, messageId, "📚 Cambridge IELTS Academic — kitobni tanlang:", booksKb());
    return;
  }
  const d = await getDraft(from.id);
  if (!d) { await sendMessage(chatId, "Boshlash uchun /start ni bosing."); return; }

  if (op === "more") {
    if (sub[1] === "add") {
      await setDraft(from.id, "passage", d.data);
      await editMessage(chatId, messageId, cdAskPassage(d.data.passages.length + 1));
    } else {
      await setDraft(from.id, "await_reveal", d.data);
      await editMessage(chatId, messageId, CD_ASK_REVEAL, cdRevealKb());
    }
    return;
  }
  if (op === "reveal") {
    d.data.settings.revealMode = sub[1] === "instant" ? "instant" : "end";
    await setDraft(from.id, "await_expl", d.data);
    await editMessage(chatId, messageId, CD_ASK_EXPL, cdExplKb());
    return;
  }
  if (op === "expl") {
    if (sub[1] === "yes") {
      d.data.settings.explanations = true;
      await setDraft(from.id, "expl", d.data);
      await editMessage(chatId, messageId, CD_ASK_EXPL_TEXT);
    } else {
      d.data.settings.explanations = false;
      await setDraft(from.id, "await_expl", d.data);
      await cdFinish(chatId, from, d.data);
    }
    return;
  }
}

// ---- xabar (matn/fayl) ----
async function cdHandleInput(chatId: number, from: any, step: string, data: CdDraft, text: string) {
  if (step === "passage") {
    const [passagePart] = CD.splitPassageAndQuestions(text);
    const idx = data.passages.length + 1;
    const p = CD.parsePassage(passagePart || text, idx);
    if (!p.paragraphs.length) { await sendMessage(chatId, "🤔 Matn bo'sh ko'rinadi. Passage matnini qayta yuboring."); return; }
    data.curPassage = p;
    await setDraft(from.id, "questions", data);
    const lettered = p.lettered ? " (A, B, C… belgilangan)" : "";
    await sendMessage(chatId, cdAskQuestions(p.title || "—", p.paragraphs.length, lettered));
  } else if (step === "questions") {
    const p = data.curPassage!;
    const groups = CD.parseQuestions(text, p.paragraphs.length).filter((g) => CD.numbersOf(g).length);
    if (!groups.length) { await sendMessage(chatId, CD_NO_Q); return; }
    data.curGroups = groups;
    await setDraft(from.id, "answers", data);
    const lines = groups.map((g) => `• ${CD.labelOf(g)}: Q${g.start}–${g.end}`).join("\n");
    const nums = groups.flatMap((g) => CD.numbersOf(g));
    const first = Math.min(...nums), last = Math.max(...nums);
    const ex = groups.slice(0, 4).map((g) => {
      const k = CD.kindOf(g);
      if (k === "tfng") return `${g.start}. TRUE`;
      if (k === "ynng") return `${g.start}. YES`;
      if (k === "mcq" || k === "mcq_multi" || k === "matching") return `${g.start}. B`;
      return `${g.start}. answer`;
    }).join("\n");
    await sendMessage(chatId,
      `🧩 *Savollar aniqlandi!*\n\n${lines}\nJami: *${new Set(nums).size}* ta (Q${first}–${last}).\n\n` +
      "Endi *to'g'ri javoblarni* yuboring. Namuna:\n```\n" + ex + "\n```\n" +
      "Muqobil: `24. vegetable / vegetation`.");
  } else if (step === "answers") {
    const key = parseAnswers(text);
    if (!Object.keys(key).length) { await sendMessage(chatId, "🤔 Javoblarni o'qib bo'lmadi. Namuna: `1. white`  `2. TRUE`  `3. B`"); return; }
    const p = data.curPassage!;
    const groups = data.curGroups!;
    const expected = groups.flatMap((g) => CD.numbersOf(g));
    const missing = expected.filter((n) => !(n in key));
    p.groups = groups;
    p.answers = {};
    for (const n of expected) if (n in key) p.answers[n] = key[n];
    data.passages.push(p);
    data.curPassage = null; data.curGroups = null;
    const warn = missing.length ? `\n⚠️ Javob berilmagan: ${missing.slice(0, 20).join(", ")}` : "";
    if (data.passages.length >= 3) {
      await setDraft(from.id, "await_reveal", data);
      await sendMessage(chatId, `✅ Javoblar qabul qilindi (${Object.keys(p.answers).length} ta).${warn}\n\n(3 passage limiti — testni yaratamiz)`);
      await sendMessage(chatId, CD_ASK_REVEAL, cdRevealKb());
    } else {
      await setDraft(from.id, "await_more", data);
      await sendMessage(chatId,
        `✅ Javoblar qabul qilindi (${Object.keys(p.answers).length} ta).${warn}\n\nBu passage tayyor. Yana passage qo'shasizmi yoki testni yaratamizmi?`,
        cdMoreKb());
    }
  } else if (step === "expl") {
    const expl = parseAnswers(text);
    data.explanations = {};
    for (const [k, v] of Object.entries(expl)) data.explanations[Number(k)] = v;
    await cdFinish(chatId, from, data);
  }
}

async function cdFinish(chatId: number, from: any, data: CdDraft) {
  await sendMessage(chatId, "⏳ CD test tayyorlanmoqda…");
  data.settings.brand = "DREAM ZONE";
  const title = (data.passages[0] && data.passages[0].title) || "IELTS Reading Practice";
  const test: CD.ReadingTest = { title, passages: data.passages, settings: data.settings, explanations: data.explanations };
  const html = CD.renderTest(test);
  const total = CD.totalQuestions(test);
  const revealLbl = data.settings.revealMode === "instant" ? "⚡ darrov" : "🔒 bosib ko'rish";
  const explLbl = data.settings.explanations ? "bor" : "yo'q";
  const caption =
    `🎉 *Tayyor!* CD Reading testingiz.\n\n📊 ${total} ta savol · ${data.passages.length} ta passage · ${revealLbl} · izoh: ${explLbl}\n\n` +
    "HTML faylni brauzerda oching yoki o'quvchilarga tarqating. 💙";
  await sendDocumentHtml(chatId, "dream_zone_reading.html", html, caption);
  await clearDraft(from.id);
}

async function handleCdDocument(chatId: number, from: any, doc: any) {
  const d = await getDraft(from.id);
  if (!d || !CD_STEPS.has(d.step)) {
    await sendMessage(chatId, "📎 Faylni qabul qilish uchun avval «🆕 CD Test yaratish»ni boshlang (/start).");
    return;
  }
  if (doc.file_size && doc.file_size > CD_MAX_FILE) { await sendMessage(chatId, "⚠️ Fayl juda katta (8 MB dan kichik bo'lsin)."); return; }
  let text: string;
  try {
    const bytes = await downloadTgFile(doc.file_id);
    text = cdExtractText(bytes, doc.file_name || "");
  } catch (e) {
    await sendMessage(chatId, "⚠️ Faylni o'qib bo'lmadi: " + (e as Error).message);
    return;
  }
  await cdHandleInput(chatId, from, d.step, d.data, text);
}

// ======================= update'larni qayta ishlash =======================

async function handleUpdate(update: any) {
  try {
    if (update.callback_query) {
      await handleCallback(update.callback_query);
      return;
    }
    const msg = update.message ?? update.edited_message;
    if (!msg || !msg.from) return;
    const chatId = msg.chat.id;
    if (msg.document) { await handleCdDocument(chatId, msg.from, msg.document); return; }
    const text = (msg.text ?? "").trim();
    if (!text) return;
    if (text.startsWith("/")) await handleCommand(chatId, msg.from, text);
    else await handleText(chatId, msg.from, text);
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
    // Telegram buyruqlar menyusi (qulay tugmalar).
    await tg("setMyCommands", {
      commands: [
        { command: "start", description: "Boshlash" },
        { command: "about", description: "Bot haqida" },
        { command: "guide", description: "Qo'llanma" },
        { command: "stats", description: "Mening natijalarim" },
        { command: "qtemplate", description: "CD test savol shabloni" },
      ],
    });
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
