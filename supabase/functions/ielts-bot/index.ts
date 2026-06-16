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
  "🎓 *IELTS Answer Check Bot*\n\n" +
  `Assalomu alaykum, *${name}*! Bu bot Cambridge IELTS Academic ` +
  "kitoblarining javob kalitlari bo'yicha tekshiruv o'tkazadi.\n\n" +
  "━━━━━━━━━━━━━━━━━━━\n\n" +
  "📚 *Qamrab olingan kitoblar:*\n" +
  "Cambridge IELTS Academic *10–20* (11 ta kitob)\n" +
  "Har birida 4 ta to'liq test · Listening + Reading\n" +
  "Jami: *44 ta test, 3 520+ savol*\n\n" +
  "🔒 *Asosiy xususiyat:*\n" +
  "Bot faqat *to'g'ri* javoblarni ko'rsatadi. Xato javoblarning " +
  "to'g'ri varianti «🔑 Ko'rish» tugmasi bosilgunicha yashirinib " +
  "turadi — bu sizga mustaqil fikrlash va xatolaringiz ustida ishlash " +
  "imkonini beradi.\n\n" +
  "━━━━━━━━━━━━━━━━━━━\n\n" +
  "📖 *Qo'llanma:*\n\n" +
  "1️⃣ Kitob → Test → Listening/Reading → Part/Passage\n" +
  "2️⃣ O'sha qismni mustaqil yeching\n" +
  "3️⃣ Javoblarni raqami bilan yuboring:\n" +
  "`1. cat`\n`2. TRUE`\n`3. B`\n" +
  "4️⃣ Bot *faqat to'g'ri* javoblarni ko'rsatadi\n" +
  "5️⃣ Xatolar ustida yana ishlang, qayta yuboring\n" +
  "6️⃣ Barcha javoblar tayyor bo'lganda — «🔑 Ko'rish»\n\n" +
  "━━━━━━━━━━━━━━━━━━━\n\n" +
  "✨ Eng qulay tajriba uchun *Mini App*'ni oching:";

const HELP =
  "ℹ️ *Yordam*\n\n" +
  "1. /start — kitob, test, bo'lim va qismni tanlang.\n" +
  "2. O'sha qismni o'zingiz yeching.\n" +
  "3. Javoblarni raqami bilan botga yuboring (masalan `21. cat`).\n" +
  "4. Bot faqat *to'g'ri* javoblaringizni ko'rsatadi.\n" +
  "5. Xatolaringiz ustida ishlab, qayta yuboring.\n" +
  "6. Tayyor bo'lganingizda «🔑 Javoblarni ko'rish» tugmasini bosing.\n\n" +
  "Buyruqlar: /start, /help, /stats";

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

async function handleCommand(chatId: number, from: any, text: string) {
  const cmd = text.split(/\s+/)[0].replace(/@.*$/, "");
  if (cmd === "/start") {
    bg(upsertUser(from));
    bg(setSession(from.id, { awaiting: false }));
    const name = from.first_name || "do'stim";
    await sendMessage(chatId, WELCOME(name), launcherKb());
  } else if (cmd === "/help") {
    await sendMessage(chatId, HELP);
  } else if (cmd === "/stats") {
    await sendStats(chatId, from.id);
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

async function handleUpdate(update: any) {
  try {
    if (update.callback_query) {
      await handleCallback(update.callback_query);
      return;
    }
    const msg = update.message ?? update.edited_message;
    if (!msg || !msg.from) return;
    const chatId = msg.chat.id;
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

  // Bir martalik sozlash: webhook'ni ro'yxatdan o'tkazish.
  if (req.method === "GET" && url.searchParams.has("setup")) {
    const hookUrl = `${url.origin}${url.pathname}`;
    const secret = await webhookSecret();
    const r = await tg("setWebhook", {
      url: hookUrl,
      secret_token: secret,
      allowed_updates: ["message", "callback_query"],
      drop_pending_updates: true,
    });
    return new Response(
      `Webhook sozlandi: ${JSON.stringify(r)}\nURL: ${hookUrl}`,
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
