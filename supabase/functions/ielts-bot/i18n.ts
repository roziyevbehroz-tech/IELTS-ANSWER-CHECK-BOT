// Interfeys tarjimalari (uz / ru / en). Test MAZMUNI (passage, savol, javob)
// tarjima qilinmaydi — u har doim inglizcha (IELTS standarti). Bu yer faqat
// bot interfeysi: xabarlar, tugmalar, ogohlantirishlar.

export type Lang = "uz" | "ru" | "en";
export const LANGS: Lang[] = ["uz", "ru", "en"];
export function isLang(x: unknown): x is Lang {
  return x === "uz" || x === "ru" || x === "en";
}
// Telegram tilidan boshlang'ich taxmin (foydalanuvchi baribir /start da tanlaydi)
export function guessLang(code?: string): Lang {
  const c = (code || "").toLowerCase();
  if (c.startsWith("ru")) return "ru";
  if (c.startsWith("uz")) return "uz";
  if (c.startsWith("en")) return "en";
  return "uz";
}

type Dict = Record<string, string | ((...a: any[]) => string)>;

const uz: Dict = {
  lang_native: "O'zbekcha",
  lang_saved: "✅ Til o'zbekchaga o'rnatildi.",
  welcome: (name: string) =>
    `👋 Assalomu alaykum, *${name}*!\n\n` +
    "*DREAM ZONE* IELTS yordamchisiga xush kelibsiz 🎓\n\n" +
    "Listening va Reading javoblaringizni bir zumda tekshirib beraman — " +
    "boshlash uchun quyidagi tugmani bosing 👇",
  welcome_hint: "\n\nℹ️ Bot haqida — /about\n📖 Qo'llanma — /guide",
  menu: "👇 *Menyu*",
  menu_home: "🏠 *Bosh menyu*\n\nQuyidagilardan birini tanlang 👇",
  about:
    "🎓 *DREAM ZONE — IELTS yordamchisi*\n\n" +
    "Men *DREAM ZONE* o'quv markazi o'quvchilari uchun yaratilganman 💙\n\n" +
    "Cambridge IELTS Academic 10–21 kitoblaridagi Listening va Reading " +
    "testlarini tekshiraman — jami 48 ta to'liq test.\n\n" +
    "Eng muhimi: men *faqat to'g'ri* javoblaringizni ko'rsataman. Xato " +
    "javoblarning to'g'ri variantini darrov ochib qo'ymayman — siz ular " +
    "ustida o'zingiz ishlaysiz, tayyor bo'lganingizda esa o'zingiz ko'rasiz.\n\n" +
    "📖 Qanday foydalanish — /guide",
  guide:
    "📖 *Qanday foydalanaman?*\n\n" +
    "1. Mini App'ni oching yoki «Matn orqali tekshirish»ni tanlang.\n" +
    "2. Kitob, test va bo'limni tanlang.\n" +
    "3. O'sha qismni mustaqil yeching.\n" +
    "4. Javoblaringizni raqami bilan yuboring, masalan:\n" +
    "`1. cat`\n`2. TRUE`\n`3. B`\n" +
    "5. Men faqat to'g'rilarini belgilab beraman.\n" +
    "6. Xatolar ustida ishlang va qayta yuboring.\n" +
    "7. Tayyor bo'lsangiz — «🔑 Javoblarni ko'rish».\n\n" +
    "Savolingiz bo'lsa, *DREAM ZONE* ustozlaringizga murojaat qiling 💙",
  part_not_available:
    "⚠️ Afsuski, bu qism uchun javoblar hali bazaga kiritilmagan.\n" +
    "Iltimos boshqa qismni tanlang yoki keyinroq urinib ko'ring.",
  no_answers_parsed:
    "🤔 Javoblarni o'qib bo'lmadi. Iltimos har bir javobni raqami bilan yuboring:\n" +
    "`21. cat`\n`22. true`\n`23. B`",
  start_prompt: "Boshlash uchun /start ni bosing.",
  choose_book: "📚 Cambridge IELTS Academic — kitobni tanlang:",
  choose_test: (book: number) => `📝 ${book}-kitob. Testni tanlang:`,
  choose_section: (book: number, test: number) => `🎧📖 ${book}-kitob, Test ${test}. Bo'limni tanlang:`,
  choose_part: (icon: string, book: number, test: number, name: string) =>
    `${icon} ${book}-kitob, Test ${test}, ${name}. Qismni tanlang:`,
  full_test: "To'liq test",
  answers_prompt: (book: number, test: number, sec: string, part: string, first: number, last: number, count: number, example: string) =>
    `✍️ *${book}-kitob, Test ${test}, ${sec} — ${part}*\n` +
    `Savollar: ${first}–${last} (${count} ta)\n\n` +
    "Javoblaringizni tartib raqami bilan yuboring. Masalan:\n" +
    "`" + example + "`\n\n" +
    "Har bir javobni alohida qatorda yozsangiz ham bo'ladi.",
  result_header: (correct: number, total: number) => `📊 *Natija: ${correct}/${total} to'g'ri*\n\n`,
  result_all_correct: (total: number) => `🎉 Barakalla! Hammasi to'g'ri — ${total}/${total}!\n`,
  result_correct_list: (list: string) => `✅ To'g'ri javoblar: ${list}\n`,
  result_none: "Hozircha to'g'ri javob yo'q. Xafa bo'lmang, qayta urinib ko'ring! 💪\n",
  result_unanswered: (list: string) => `\nℹ️ Javob bermagan savollaringiz: ${list}\n`,
  result_retry_hint: "\n🔁 Qolgan savollar ustida yana mustaqil ishlang. Tayyor bo'lsangiz, javoblarni qaytadan yuboring.",
  reveal_header: (book: number, test: number, sec: string, part: string) =>
    `🔑 *To'g'ri javoblar — ${book}-kitob, Test ${test}, ${sec} ${part}:*\n\n`,
  stats_none: "📈 Hali yechilgan testlar yo'q. Birinchi testni yechib ko'ring!",
  stats_header: "📈 *Sizning statistikangiz:*\n\n",
  stats_total: (count: number, pct: number) => `\n*Jami:* ${count} ta urinish, o'rtacha ${pct}% to'g'ri.`,
  admin_only: "⛔ Bu buyruq faqat bot egasi uchun.",
  db_not_connected: "⚠️ Baza ulanmagan.",
  stats_error: "⚠️ Statistikani olishda xato.",
  myid: (id: number) => `🆔 Sizning Telegram ID: \`${id}\``,
  book_label: (b: number | string) => `${b}-kitob`,
  stats_row: (book: number, test: number, sec: string, part: string, correct: number, total: number) =>
    `• ${book}-kitob T${test} ${sec} ${part}: ${correct}/${total}\n`,
  admin_stats: (s: any, books: string, secs: string) =>
    "📊 *Bot analitikasi*\n\n" +
    `👥 *Foydalanuvchilar:* ${s.users_total} ta\n` +
    `   🆕 Yangi: bugun *${s.users_new_1d}*, 7 kun *${s.users_new_7d}*, 30 kun *${s.users_new_30d}*\n` +
    `   🟢 Faol: 24 soat *${s.users_active_1d}*, 7 kun *${s.users_active_7d}*\n\n` +
    `✅ *Javob tekshirish:* ${s.attempts_total} marta (bugun ${s.attempts_1d})\n` +
    `   📈 O'rtacha natija: *${s.attempts_avg_pct}%*\n\n` +
    `🆕 *CD test yaratildi:* ${s.cd_created_total} ta (bugun ${s.cd_created_1d})\n` +
    `📝 *Custom testlar:* ${s.custom_tests} ta\n` +
    `⏳ *Hozir yaratilyapti:* ${s.drafts_active} ta qoralama\n\n` +
    `📚 *Top kitoblar:* ${books}\n` +
    `🎧📖 *Top bo'limlar:* ${secs}`,
  // CD
  cd_intro:
    "🆕 *CD Test yaratish*\n\nQaysi bo'lim uchun test yaratmoqchisiz?\n\n" +
    "🟢 *Reading* — tayyor\n🔴 Listening / Speaking / Writing — tez orada\n\nBo'limni tanlang 👇",
  cd_coming: "🔴 Bu bo'lim hozircha tayyor emas. Tez orada! Hozircha 🟢 Reading mavjud.",
  cd_ask_passage: (n: number) =>
    `📖 *Reading — Passage ${n}*\n\nIltimos, testning *matn (passage)* qismini yuboring.\n\n` +
    "Qabul qilinadi: 📄 PDF, DOCX yoki oddiy matn.\n" +
    "Matnga savollar aralashib ketgan bo'lsa — bot ularni avtomatik ajratadi.\n" +
    "_(Skanerlangan/rasm PDF emas — matnli PDF bo'lsin.)_",
  cd_ask_questions: (title: string, paras: number, lettered: string, preview: string) =>
    `✅ Passage qabul qilindi!\n📌 Sarlavha: *${title}*\n📄 Paragraflar: ${paras} ta${lettered}\n\n` +
    `👀 *Namuna (boshi):*\n_${preview}_\n\n` +
    "Matn biroz chalkash chiqsa — oxirida tayyor HTML'ni *o'zingiz tahrirlab* " +
    "(bold, markaz, o'lcham) tuzatasiz.\n\n" +
    "Endi shu passage'ning *savollarini* yuboring (matn yoki fayl).\n\n" +
    "1️⃣ Toza Cambridge matni — bot turlarni o'zi taniydi.\n" +
    "2️⃣ Aniq shablon (100% ishonchli) — /qtemplate ni yuboring.",
  cd_lettered_note: " (A, B, C… belgilangan)",
  cd_no_q: "🤔 Savollarni ajratib bo'lmadi. Iltimos aniq shablondan foydalaning — /qtemplate ni yuboring.",
  cd_passage_empty: "🤔 Matn bo'sh ko'rinadi. Passage matnini qayta yuboring.",
  cd_preview_none: "(matn topilmadi)",
  cd_warn_junk: "• URL/reklama yozuvlari topildi va olib tashlandi",
  cd_warn_short: "• Matn juda qisqa — to'liq passage yuborilganini tekshiring",
  cd_warn_head: (body: string) =>
    "⚠️ *Diqqat:*\n" + body + "\nNamunani ko'rib chiqing; kerak bo'lsa oxirida HTML'da tuzatasiz.\n\n",
  cd_q_detected: (lines: string, count: number, first: number, last: number, ex: string) =>
    `🧩 *Savollar aniqlandi!*\n\n${lines}\nJami: *${count}* ta (Q${first}–${last}).\n\n` +
    "Endi *to'g'ri javoblarni* yuboring. Namuna:\n```\n" + ex + "\n```\n" +
    "Muqobil javob: `24. vegetable / vegetation`.\n" +
    "Ko'p tanlovli (Choose TWO/THREE): `12-13. C, D` — tartib muhim emas.",
  cd_ans_unreadable: "🤔 Javoblarni o'qib bo'lmadi. Namuna: `1. white`  `2. TRUE`  `3. B`",
  cd_ans_ok_limit: (count: number, warn: string) =>
    `✅ Javoblar qabul qilindi (${count} ta).${warn}\n\n(3 passage limiti — testni yaratamiz)`,
  cd_ans_ok_more: (count: number, warn: string) =>
    `✅ Javoblar qabul qilindi (${count} ta).${warn}\n\nBu passage tayyor. Yana passage qo'shasizmi yoki testni yaratamizmi?`,
  cd_missing: (list: string) => `\n⚠️ Javob berilmagan: ${list}`,
  cd_fmt_intro: "📋 *Javoblarni shu shaklda yuboring:*",
  cd_fmt_tfng: "TRUE / FALSE / NOT GIVEN (yoki T/F/NG)",
  cd_fmt_ynng: "YES / NO / NOT GIVEN",
  cd_fmt_mcq: "bitta harf A–E (masalan `B`)",
  cd_fmt_mcq_multi: "har savolga bitta harf (masalan `14-16. A, B, C` yoki `14,15,16 A B C`)",
  cd_fmt_matching: "harf A–H yoki raqam i, ii… (masalan `C`)",
  cd_fmt_gap: "so'z yoki ibora (masalan `sunlight`; muqobil: `sun/sunlight`)",
  cd_key_mismatch: (body: string) => `\n\n⚠️ *Ba'zi javoblar savol turiga mos kelmadi* — tekshiring:\n${body}`,
  cd_key_extra: (list: string) => `\n⚠️ Bu raqamlar bu passage savollariga kirmaydi: ${list}`,
  cd_fmt_line: (nums: string, fmt: string) => `• Q${nums} — ${fmt}`,
  cd_preparing: "⏳ CD test tayyorlanmoqda…",
  cd_caption: (total: number, passages: number) =>
    `🎉 *Tayyor!* CD Reading testingiz quyida.\n\n📊 ${total} ta savol · ${passages} ta passage\n\n` +
    "▶️ *Ishlashi:* o'quvchi javoblarni kiritib «Deliver» bosadi — to'g'rilari " +
    "yashil bo'lib qulflanadi, xatolarini tuzatib *cheksiz* qayta tekshirishi " +
    "mumkin. Xato javoblarning to'g'ri varianti «Javoblarni ko'rish»da ochiladi.\n\n" +
    "✏️ *Tuzatish kerakmi?* Faylni brauzerda oching → *✏️* tugmasi → matn/savollarni " +
    "tahrirlang → *💾 Saqlash* bilan toza faylni yuklab oling.\n\n" +
    "So'ng o'quvchilarga tarqating. 💙",
  cd_done: "✅ Test tayyor! Yana bittasini yaratasizmi?",
  cd_doc_no_flow: "📎 Faylni qabul qilish uchun avval «🆕 CD Test yaratish»ni boshlang (/start).",
  cd_file_too_big: "⚠️ Fayl juda katta (8 MB dan kichik bo'lsin).",
  cd_file_unreadable: (msg: string) => "⚠️ Faylni o'qib bo'lmadi: " + msg,
  cd_qtemplate:
    "🧩 *Savol shabloni* — har blok `[tur] boshlanish-tugash` bilan.\nGap uchun `___` yozing (avtomatik raqamlanadi).\n\n" +
    "```\n[note] 1-3\nComplete the notes. ONE WORD ONLY.\n- emperor wore ___ silk\n- payment of ___\n- used in ___ trade\n\n" +
    "[tfng] 4-5\nTRUE FALSE NOT GIVEN\n4. Statement one.\n5. Statement two.\n\n" +
    "[mcq] 6-6\nChoose the correct letter.\n6. Question stem?\nA option a\nB option b\nC option c\n\n" +
    "[mcq_multi] 7-8\nChoose TWO letters.\nA ...\nB ...\nC ...\nD ...\nE ...\n\n" +
    "[headings] 9-10\nList of Headings:\ni Heading one\nii Heading two\niii Heading three\n9. Paragraph A\n10. Paragraph B\n\n" +
    "[matching_info] 11-12 | A-F\nWhich paragraph contains...?\n11. info one\n12. info two\n\n" +
    "[matching_features] 13-14 | A-C\nMatch each statement with a person.\nA Smith\nB Jones\nC Lee\n13. one\n14. two\n\n" +
    "[summary]·[sentence]·[table]·[flowchart]·[shortanswer]·[diagram] — ham `___` bilan\n```",
  ct_not_found: "❌ Test topilmadi yoki o'chirilgan.",
  ct_closed: (title: string) => `🔒 *${title}*\n\nBu test yakunlangan — hozir javob qabul qilinmaydi.`,
  ct_paused: (title: string) => `⏸️ *${title}*\n\nBu test vaqtincha to'xtatilgan. Keyinroq urinib ko'ring.`,
  ct_intro: (title: string, total: number, who: string) =>
    `📝 *${title}*\n\n${total} ta savol · DREAM ZONE${who}\n\n` +
    "Javoblaringizni kiritib darrov tekshiring — faqat to'g'rilari ko'rsatiladi.\n\n" +
    "Boshlash uchun quyidagi tugmani bosing 👇",
  ct_owner: (name: string) => `\nYaratuvchi: ${name}`,
  // Tugmalar
  btn_miniapp: "🚀 Mini App'ni ochish",
  btn_text_check: "⌨️ Matn orqali tekshirish",
  btn_cd_create: "🆕 CD Test yaratish",
  btn_back: "⬅️ Orqaga",
  btn_full_test: "📋 To'liq test (1–40)",
  btn_retry: "🔁 Qaytadan urinish",
  btn_reveal: "🔑 Javoblarni ko'rish",
  btn_home: "🏠 Bosh menyu",
  btn_test_n: (n: number) => `Test ${n}`,
  btn_ct_start: "🚀 Testni boshlash",
  btn_cd_add: "➕ Yana passage qo'shish",
  btn_cd_finish: "✅ CD test yaratish",
  btn_cd_more: "➕ Yana CD test yaratish",
  rk_cd: "🆕 CD Test yaratish",
  rk_check: "📚 Test tekshirish",
  cmd_start: "Boshlash",
  cmd_about: "Bot haqida",
  cmd_guide: "Qo'llanma",
  cmd_stats: "Mening natijalarim",
  cmd_qtemplate: "CD test savol shabloni",
  cmd_language: "Til / Language",
};

const ru: Dict = {
  lang_native: "Русский",
  lang_saved: "✅ Язык переключён на русский.",
  welcome: (name: string) =>
    `👋 Здравствуйте, *${name}*!\n\n` +
    "Добро пожаловать в IELTS-помощник *DREAM ZONE* 🎓\n\n" +
    "Моментально проверю ваши ответы Listening и Reading — " +
    "нажмите кнопку ниже, чтобы начать 👇",
  welcome_hint: "\n\nℹ️ О боте — /about\n📖 Руководство — /guide",
  menu: "👇 *Меню*",
  menu_home: "🏠 *Главное меню*\n\nВыберите один из вариантов 👇",
  about:
    "🎓 *DREAM ZONE — IELTS-помощник*\n\n" +
    "Я создан для учеников учебного центра *DREAM ZONE* 💙\n\n" +
    "Проверяю тесты Listening и Reading из книг Cambridge IELTS Academic 10–21 — " +
    "всего 48 полных тестов.\n\n" +
    "Главное: я показываю *только правильные* ответы. Правильные варианты " +
    "неверных ответов сразу не открываю — вы работаете над ними сами, " +
    "а когда будете готовы — увидите их.\n\n" +
    "📖 Как пользоваться — /guide",
  guide:
    "📖 *Как пользоваться?*\n\n" +
    "1. Откройте Mini App или выберите «Проверка по тексту».\n" +
    "2. Выберите книгу, тест и раздел.\n" +
    "3. Решите эту часть самостоятельно.\n" +
    "4. Отправьте ответы с номерами, например:\n" +
    "`1. cat`\n`2. TRUE`\n`3. B`\n" +
    "5. Я отмечу только правильные.\n" +
    "6. Поработайте над ошибками и отправьте снова.\n" +
    "7. Когда будете готовы — «🔑 Показать ответы».\n\n" +
    "Если есть вопросы — обратитесь к преподавателям *DREAM ZONE* 💙",
  part_not_available:
    "⚠️ К сожалению, ответы для этой части ещё не добавлены в базу.\n" +
    "Пожалуйста, выберите другую часть или попробуйте позже.",
  no_answers_parsed:
    "🤔 Не удалось прочитать ответы. Пожалуйста, отправьте каждый ответ с номером:\n" +
    "`21. cat`\n`22. true`\n`23. B`",
  start_prompt: "Нажмите /start, чтобы начать.",
  choose_book: "📚 Cambridge IELTS Academic — выберите книгу:",
  choose_test: (book: number) => `📝 Книга ${book}. Выберите тест:`,
  choose_section: (book: number, test: number) => `🎧📖 Книга ${book}, Тест ${test}. Выберите раздел:`,
  choose_part: (icon: string, book: number, test: number, name: string) =>
    `${icon} Книга ${book}, Тест ${test}, ${name}. Выберите часть:`,
  full_test: "Полный тест",
  answers_prompt: (book: number, test: number, sec: string, part: string, first: number, last: number, count: number, example: string) =>
    `✍️ *Книга ${book}, Тест ${test}, ${sec} — ${part}*\n` +
    `Вопросы: ${first}–${last} (${count} шт.)\n\n` +
    "Отправьте ответы с их номерами. Например:\n" +
    "`" + example + "`\n\n" +
    "Можно писать каждый ответ на отдельной строке.",
  result_header: (correct: number, total: number) => `📊 *Результат: ${correct}/${total} верно*\n\n`,
  result_all_correct: (total: number) => `🎉 Отлично! Всё верно — ${total}/${total}!\n`,
  result_correct_list: (list: string) => `✅ Верные ответы: ${list}\n`,
  result_none: "Пока нет верных ответов. Не расстраивайтесь, попробуйте снова! 💪\n",
  result_unanswered: (list: string) => `\nℹ️ Без ответа остались вопросы: ${list}\n`,
  result_retry_hint: "\n🔁 Поработайте над остальными вопросами самостоятельно. Когда будете готовы, отправьте ответы снова.",
  reveal_header: (book: number, test: number, sec: string, part: string) =>
    `🔑 *Правильные ответы — Книга ${book}, Тест ${test}, ${sec} ${part}:*\n\n`,
  stats_none: "📈 Пока нет решённых тестов. Решите первый тест!",
  stats_header: "📈 *Ваша статистика:*\n\n",
  stats_total: (count: number, pct: number) => `\n*Всего:* ${count} попыток, в среднем ${pct}% верно.`,
  admin_only: "⛔ Эта команда только для владельца бота.",
  db_not_connected: "⚠️ База не подключена.",
  stats_error: "⚠️ Ошибка при получении статистики.",
  myid: (id: number) => `🆔 Ваш Telegram ID: \`${id}\``,
  book_label: (b: number | string) => `Книга ${b}`,
  stats_row: (book: number, test: number, sec: string, part: string, correct: number, total: number) =>
    `• Книга ${book} Т${test} ${sec} ${part}: ${correct}/${total}\n`,
  admin_stats: (s: any, books: string, secs: string) =>
    "📊 *Аналитика бота*\n\n" +
    `👥 *Пользователи:* ${s.users_total}\n` +
    `   🆕 Новые: сегодня *${s.users_new_1d}*, 7 дней *${s.users_new_7d}*, 30 дней *${s.users_new_30d}*\n` +
    `   🟢 Активные: 24 ч *${s.users_active_1d}*, 7 дней *${s.users_active_7d}*\n\n` +
    `✅ *Проверок ответов:* ${s.attempts_total} (сегодня ${s.attempts_1d})\n` +
    `   📈 Средний результат: *${s.attempts_avg_pct}%*\n\n` +
    `🆕 *Создано CD-тестов:* ${s.cd_created_total} (сегодня ${s.cd_created_1d})\n` +
    `📝 *Custom-тесты:* ${s.custom_tests}\n` +
    `⏳ *Сейчас создаётся:* ${s.drafts_active} черновиков\n\n` +
    `📚 *Топ книги:* ${books}\n` +
    `🎧📖 *Топ разделы:* ${secs}`,
  cd_intro:
    "🆕 *Создание CD-теста*\n\nДля какого раздела создать тест?\n\n" +
    "🟢 *Reading* — готов\n🔴 Listening / Speaking / Writing — скоро\n\nВыберите раздел 👇",
  cd_coming: "🔴 Этот раздел пока не готов. Скоро! Пока доступен 🟢 Reading.",
  cd_ask_passage: (n: number) =>
    `📖 *Reading — Passage ${n}*\n\nПожалуйста, отправьте *текст (passage)* теста.\n\n` +
    "Принимается: 📄 PDF, DOCX или обычный текст.\n" +
    "Если вопросы смешаны с текстом — бот разделит их автоматически.\n" +
    "_(Не отсканированный/картинка PDF — нужен текстовый PDF.)_",
  cd_ask_questions: (title: string, paras: number, lettered: string, preview: string) =>
    `✅ Passage принят!\n📌 Заголовок: *${title}*\n📄 Абзацев: ${paras}${lettered}\n\n` +
    `👀 *Пример (начало):*\n_${preview}_\n\n` +
    "Если текст вышел немного неаккуратным — в конце вы *сами отредактируете* " +
    "готовый HTML (жирный, центр, размер).\n\n" +
    "Теперь отправьте *вопросы* к этому passage (текст или файл).\n\n" +
    "1️⃣ Чистый текст Cambridge — бот сам распознает типы.\n" +
    "2️⃣ Точный шаблон (100% надёжно) — отправьте /qtemplate.",
  cd_lettered_note: " (отмечены A, B, C…)",
  cd_no_q: "🤔 Не удалось выделить вопросы. Пожалуйста, используйте точный шаблон — отправьте /qtemplate.",
  cd_passage_empty: "🤔 Текст выглядит пустым. Отправьте текст passage ещё раз.",
  cd_preview_none: "(текст не найден)",
  cd_warn_junk: "• Найдены и удалены URL/рекламные строки",
  cd_warn_short: "• Текст слишком короткий — проверьте, что отправлен полный passage",
  cd_warn_head: (body: string) =>
    "⚠️ *Внимание:*\n" + body + "\nПросмотрите пример; при необходимости исправите в конце в HTML.\n\n",
  cd_q_detected: (lines: string, count: number, first: number, last: number, ex: string) =>
    `🧩 *Вопросы распознаны!*\n\n${lines}\nВсего: *${count}* (Q${first}–${last}).\n\n` +
    "Теперь отправьте *правильные ответы*. Пример:\n```\n" + ex + "\n```\n" +
    "Альтернативный ответ: `24. vegetable / vegetation`.\n" +
    "Множественный выбор (Choose TWO/THREE): `12-13. C, D` — порядок не важен.",
  cd_ans_unreadable: "🤔 Не удалось прочитать ответы. Пример: `1. white`  `2. TRUE`  `3. B`",
  cd_ans_ok_limit: (count: number, warn: string) =>
    `✅ Ответы приняты (${count} шт.).${warn}\n\n(Лимит 3 passage — создаём тест)`,
  cd_ans_ok_more: (count: number, warn: string) =>
    `✅ Ответы приняты (${count} шт.).${warn}\n\nЭтот passage готов. Добавите ещё passage или создаём тест?`,
  cd_missing: (list: string) => `\n⚠️ Без ответа: ${list}`,
  cd_fmt_intro: "📋 *Отправляйте ответы в таком виде:*",
  cd_fmt_tfng: "TRUE / FALSE / NOT GIVEN (или T/F/NG)",
  cd_fmt_ynng: "YES / NO / NOT GIVEN",
  cd_fmt_mcq: "одна буква A–E (например `B`)",
  cd_fmt_mcq_multi: "по одной букве на вопрос (например `14-16. A, B, C` или `14,15,16 A B C`)",
  cd_fmt_matching: "буква A–H или номер i, ii… (например `C`)",
  cd_fmt_gap: "слово или фраза (например `sunlight`; вариант: `sun/sunlight`)",
  cd_key_mismatch: (body: string) => `\n\n⚠️ *Некоторые ответы не соответствуют типу вопроса* — проверьте:\n${body}`,
  cd_key_extra: (list: string) => `\n⚠️ Эти номера не относятся к вопросам этого passage: ${list}`,
  cd_fmt_line: (nums: string, fmt: string) => `• Q${nums} — ${fmt}`,
  cd_preparing: "⏳ CD-тест готовится…",
  cd_caption: (total: number, passages: number) =>
    `🎉 *Готово!* Ваш CD Reading-тест ниже.\n\n📊 ${total} вопросов · ${passages} passage\n\n` +
    "▶️ *Как работает:* ученик вводит ответы и нажимает «Deliver» — верные " +
    "становятся зелёными и блокируются, ошибки можно исправлять и проверять " +
    "*бесконечно*. Правильные варианты неверных ответов открываются в «Показать ответы».\n\n" +
    "✏️ *Нужно исправить?* Откройте файл в браузере → кнопка *✏️* → отредактируйте " +
    "текст/вопросы → *💾 Сохранить* и скачайте чистый файл.\n\n" +
    "Затем раздайте ученикам. 💙",
  cd_done: "✅ Тест готов! Создать ещё один?",
  cd_doc_no_flow: "📎 Чтобы принять файл, сначала начните «🆕 Создание CD-теста» (/start).",
  cd_file_too_big: "⚠️ Файл слишком большой (не более 8 МБ).",
  cd_file_unreadable: (msg: string) => "⚠️ Не удалось прочитать файл: " + msg,
  cd_qtemplate:
    "🧩 *Шаблон вопросов* — каждый блок с `[тип] начало-конец`.\nДля пропуска пишите `___` (нумеруется автоматически).\n\n" +
    "```\n[note] 1-3\nComplete the notes. ONE WORD ONLY.\n- emperor wore ___ silk\n- payment of ___\n- used in ___ trade\n\n" +
    "[tfng] 4-5\nTRUE FALSE NOT GIVEN\n4. Statement one.\n5. Statement two.\n\n" +
    "[mcq] 6-6\nChoose the correct letter.\n6. Question stem?\nA option a\nB option b\nC option c\n\n" +
    "[mcq_multi] 7-8\nChoose TWO letters.\nA ...\nB ...\nC ...\nD ...\nE ...\n\n" +
    "[headings] 9-10\nList of Headings:\ni Heading one\nii Heading two\niii Heading three\n9. Paragraph A\n10. Paragraph B\n\n" +
    "[matching_info] 11-12 | A-F\nWhich paragraph contains...?\n11. info one\n12. info two\n\n" +
    "[matching_features] 13-14 | A-C\nMatch each statement with a person.\nA Smith\nB Jones\nC Lee\n13. one\n14. two\n\n" +
    "[summary]·[sentence]·[table]·[flowchart]·[shortanswer]·[diagram] — тоже с `___`\n```",
  ct_not_found: "❌ Тест не найден или удалён.",
  ct_closed: (title: string) => `🔒 *${title}*\n\nЭтот тест завершён — сейчас ответы не принимаются.`,
  ct_paused: (title: string) => `⏸️ *${title}*\n\nЭтот тест временно приостановлен. Попробуйте позже.`,
  ct_intro: (title: string, total: number, who: string) =>
    `📝 *${title}*\n\n${total} вопросов · DREAM ZONE${who}\n\n` +
    "Введите ответы и сразу проверьте — показываются только правильные.\n\n" +
    "Нажмите кнопку ниже, чтобы начать 👇",
  ct_owner: (name: string) => `\nАвтор: ${name}`,
  btn_miniapp: "🚀 Открыть Mini App",
  btn_text_check: "⌨️ Проверка по тексту",
  btn_cd_create: "🆕 Создать CD-тест",
  btn_back: "⬅️ Назад",
  btn_full_test: "📋 Полный тест (1–40)",
  btn_retry: "🔁 Попробовать снова",
  btn_reveal: "🔑 Показать ответы",
  btn_home: "🏠 Главное меню",
  btn_test_n: (n: number) => `Тест ${n}`,
  btn_ct_start: "🚀 Начать тест",
  btn_cd_add: "➕ Добавить ещё passage",
  btn_cd_finish: "✅ Создать CD-тест",
  btn_cd_more: "➕ Создать ещё CD-тест",
  rk_cd: "🆕 Создать CD-тест",
  rk_check: "📚 Проверка теста",
  cmd_start: "Начать",
  cmd_about: "О боте",
  cmd_guide: "Руководство",
  cmd_stats: "Мои результаты",
  cmd_qtemplate: "Шаблон вопросов CD-теста",
  cmd_language: "Til / Язык / Language",
};

const en: Dict = {
  lang_native: "English",
  lang_saved: "✅ Language set to English.",
  welcome: (name: string) =>
    `👋 Hello, *${name}*!\n\n` +
    "Welcome to the *DREAM ZONE* IELTS assistant 🎓\n\n" +
    "I'll instantly check your Listening and Reading answers — " +
    "tap the button below to start 👇",
  welcome_hint: "\n\nℹ️ About — /about\n📖 Guide — /guide",
  menu: "👇 *Menu*",
  menu_home: "🏠 *Main menu*\n\nChoose one of the options 👇",
  about:
    "🎓 *DREAM ZONE — IELTS assistant*\n\n" +
    "I was built for the students of *DREAM ZONE* learning centre 💙\n\n" +
    "I check the Listening and Reading tests from Cambridge IELTS Academic 10–21 — " +
    "48 full tests in total.\n\n" +
    "Most importantly: I show *only your correct* answers. I don't reveal the " +
    "correct options for wrong answers right away — you work on them yourself, " +
    "and see them when you're ready.\n\n" +
    "📖 How to use — /guide",
  guide:
    "📖 *How do I use it?*\n\n" +
    "1. Open the Mini App or choose «Check by text».\n" +
    "2. Pick a book, test and section.\n" +
    "3. Solve that part on your own.\n" +
    "4. Send your answers with their numbers, e.g.:\n" +
    "`1. cat`\n`2. TRUE`\n`3. B`\n" +
    "5. I'll mark only the correct ones.\n" +
    "6. Work on the mistakes and send again.\n" +
    "7. When ready — «🔑 Show answers».\n\n" +
    "If you have questions, ask your *DREAM ZONE* teachers 💙",
  part_not_available:
    "⚠️ Unfortunately, answers for this part haven't been added to the database yet.\n" +
    "Please choose another part or try again later.",
  no_answers_parsed:
    "🤔 Couldn't read your answers. Please send each answer with its number:\n" +
    "`21. cat`\n`22. true`\n`23. B`",
  start_prompt: "Press /start to begin.",
  choose_book: "📚 Cambridge IELTS Academic — choose a book:",
  choose_test: (book: number) => `📝 Book ${book}. Choose a test:`,
  choose_section: (book: number, test: number) => `🎧📖 Book ${book}, Test ${test}. Choose a section:`,
  choose_part: (icon: string, book: number, test: number, name: string) =>
    `${icon} Book ${book}, Test ${test}, ${name}. Choose a part:`,
  full_test: "Full test",
  answers_prompt: (book: number, test: number, sec: string, part: string, first: number, last: number, count: number, example: string) =>
    `✍️ *Book ${book}, Test ${test}, ${sec} — ${part}*\n` +
    `Questions: ${first}–${last} (${count})\n\n` +
    "Send your answers with their numbers. For example:\n" +
    "`" + example + "`\n\n" +
    "You can also write each answer on its own line.",
  result_header: (correct: number, total: number) => `📊 *Result: ${correct}/${total} correct*\n\n`,
  result_all_correct: (total: number) => `🎉 Well done! All correct — ${total}/${total}!\n`,
  result_correct_list: (list: string) => `✅ Correct answers: ${list}\n`,
  result_none: "No correct answers yet. Don't worry, try again! 💪\n",
  result_unanswered: (list: string) => `\nℹ️ Questions you left unanswered: ${list}\n`,
  result_retry_hint: "\n🔁 Keep working on the remaining questions on your own. When ready, send your answers again.",
  reveal_header: (book: number, test: number, sec: string, part: string) =>
    `🔑 *Correct answers — Book ${book}, Test ${test}, ${sec} ${part}:*\n\n`,
  stats_none: "📈 No solved tests yet. Try your first test!",
  stats_header: "📈 *Your statistics:*\n\n",
  stats_total: (count: number, pct: number) => `\n*Total:* ${count} attempts, ${pct}% correct on average.`,
  admin_only: "⛔ This command is for the bot owner only.",
  db_not_connected: "⚠️ Database not connected.",
  stats_error: "⚠️ Error getting statistics.",
  myid: (id: number) => `🆔 Your Telegram ID: \`${id}\``,
  book_label: (b: number | string) => `Book ${b}`,
  stats_row: (book: number, test: number, sec: string, part: string, correct: number, total: number) =>
    `• Book ${book} T${test} ${sec} ${part}: ${correct}/${total}\n`,
  admin_stats: (s: any, books: string, secs: string) =>
    "📊 *Bot analytics*\n\n" +
    `👥 *Users:* ${s.users_total}\n` +
    `   🆕 New: today *${s.users_new_1d}*, 7 days *${s.users_new_7d}*, 30 days *${s.users_new_30d}*\n` +
    `   🟢 Active: 24 h *${s.users_active_1d}*, 7 days *${s.users_active_7d}*\n\n` +
    `✅ *Answer checks:* ${s.attempts_total} (today ${s.attempts_1d})\n` +
    `   📈 Average score: *${s.attempts_avg_pct}%*\n\n` +
    `🆕 *CD tests created:* ${s.cd_created_total} (today ${s.cd_created_1d})\n` +
    `📝 *Custom tests:* ${s.custom_tests}\n` +
    `⏳ *Being created now:* ${s.drafts_active} drafts\n\n` +
    `📚 *Top books:* ${books}\n` +
    `🎧📖 *Top sections:* ${secs}`,
  cd_intro:
    "🆕 *Create a CD test*\n\nWhich section do you want to create a test for?\n\n" +
    "🟢 *Reading* — ready\n🔴 Listening / Speaking / Writing — coming soon\n\nChoose a section 👇",
  cd_coming: "🔴 This section isn't ready yet. Coming soon! For now 🟢 Reading is available.",
  cd_ask_passage: (n: number) =>
    `📖 *Reading — Passage ${n}*\n\nPlease send the *passage (text)* of the test.\n\n` +
    "Accepted: 📄 PDF, DOCX or plain text.\n" +
    "If questions are mixed into the text — the bot separates them automatically.\n" +
    "_(Not a scanned/image PDF — it must be a text PDF.)_",
  cd_ask_questions: (title: string, paras: number, lettered: string, preview: string) =>
    `✅ Passage received!\n📌 Title: *${title}*\n📄 Paragraphs: ${paras}${lettered}\n\n` +
    `👀 *Preview (start):*\n_${preview}_\n\n` +
    "If the text comes out a bit messy — you'll *edit* the finished HTML yourself " +
    "at the end (bold, centre, size).\n\n" +
    "Now send the *questions* for this passage (text or file).\n\n" +
    "1️⃣ Clean Cambridge text — the bot detects the types itself.\n" +
    "2️⃣ Exact template (100% reliable) — send /qtemplate.",
  cd_lettered_note: " (A, B, C… labelled)",
  cd_no_q: "🤔 Couldn't extract the questions. Please use the exact template — send /qtemplate.",
  cd_passage_empty: "🤔 The text looks empty. Please send the passage text again.",
  cd_preview_none: "(no text found)",
  cd_warn_junk: "• URL/ad lines were found and removed",
  cd_warn_short: "• The text is very short — check that the full passage was sent",
  cd_warn_head: (body: string) =>
    "⚠️ *Note:*\n" + body + "\nReview the preview; if needed, fix it in the HTML at the end.\n\n",
  cd_q_detected: (lines: string, count: number, first: number, last: number, ex: string) =>
    `🧩 *Questions detected!*\n\n${lines}\nTotal: *${count}* (Q${first}–${last}).\n\n` +
    "Now send the *correct answers*. Example:\n```\n" + ex + "\n```\n" +
    "Alternative answer: `24. vegetable / vegetation`.\n" +
    "Multiple choice (Choose TWO/THREE): `12-13. C, D` — order doesn't matter.",
  cd_ans_unreadable: "🤔 Couldn't read the answers. Example: `1. white`  `2. TRUE`  `3. B`",
  cd_ans_ok_limit: (count: number, warn: string) =>
    `✅ Answers received (${count}).${warn}\n\n(3-passage limit — creating the test)`,
  cd_ans_ok_more: (count: number, warn: string) =>
    `✅ Answers received (${count}).${warn}\n\nThis passage is ready. Add another passage or create the test?`,
  cd_missing: (list: string) => `\n⚠️ Unanswered: ${list}`,
  cd_fmt_intro: "📋 *Send the answers in this format:*",
  cd_fmt_tfng: "TRUE / FALSE / NOT GIVEN (or T/F/NG)",
  cd_fmt_ynng: "YES / NO / NOT GIVEN",
  cd_fmt_mcq: "one letter A–E (e.g. `B`)",
  cd_fmt_mcq_multi: "one letter per question (e.g. `14-16. A, B, C` or `14,15,16 A B C`)",
  cd_fmt_matching: "a letter A–H or a numeral i, ii… (e.g. `C`)",
  cd_fmt_gap: "a word or phrase (e.g. `sunlight`; alternative: `sun/sunlight`)",
  cd_key_mismatch: (body: string) => `\n\n⚠️ *Some answers don't match the question type* — please check:\n${body}`,
  cd_key_extra: (list: string) => `\n⚠️ These numbers don't belong to this passage's questions: ${list}`,
  cd_fmt_line: (nums: string, fmt: string) => `• Q${nums} — ${fmt}`,
  cd_preparing: "⏳ Preparing the CD test…",
  cd_caption: (total: number, passages: number) =>
    `🎉 *Done!* Your CD Reading test is below.\n\n📊 ${total} questions · ${passages} passage(s)\n\n` +
    "▶️ *How it works:* the student enters answers and taps «Deliver» — correct " +
    "ones turn green and lock, mistakes can be fixed and re-checked *unlimited* " +
    "times. The correct options for wrong answers open in «Show answers».\n\n" +
    "✏️ *Need to fix it?* Open the file in a browser → the *✏️* button → edit the " +
    "text/questions → *💾 Save* to download the clean file.\n\n" +
    "Then share it with your students. 💙",
  cd_done: "✅ Test ready! Create another one?",
  cd_doc_no_flow: "📎 To accept a file, first start «🆕 Create a CD test» (/start).",
  cd_file_too_big: "⚠️ The file is too large (must be under 8 MB).",
  cd_file_unreadable: (msg: string) => "⚠️ Couldn't read the file: " + msg,
  cd_qtemplate:
    "🧩 *Question template* — each block with `[type] start-end`.\nUse `___` for a gap (numbered automatically).\n\n" +
    "```\n[note] 1-3\nComplete the notes. ONE WORD ONLY.\n- emperor wore ___ silk\n- payment of ___\n- used in ___ trade\n\n" +
    "[tfng] 4-5\nTRUE FALSE NOT GIVEN\n4. Statement one.\n5. Statement two.\n\n" +
    "[mcq] 6-6\nChoose the correct letter.\n6. Question stem?\nA option a\nB option b\nC option c\n\n" +
    "[mcq_multi] 7-8\nChoose TWO letters.\nA ...\nB ...\nC ...\nD ...\nE ...\n\n" +
    "[headings] 9-10\nList of Headings:\ni Heading one\nii Heading two\niii Heading three\n9. Paragraph A\n10. Paragraph B\n\n" +
    "[matching_info] 11-12 | A-F\nWhich paragraph contains...?\n11. info one\n12. info two\n\n" +
    "[matching_features] 13-14 | A-C\nMatch each statement with a person.\nA Smith\nB Jones\nC Lee\n13. one\n14. two\n\n" +
    "[summary]·[sentence]·[table]·[flowchart]·[shortanswer]·[diagram] — also with `___`\n```",
  ct_not_found: "❌ Test not found or deleted.",
  ct_closed: (title: string) => `🔒 *${title}*\n\nThis test has finished — answers aren't accepted right now.`,
  ct_paused: (title: string) => `⏸️ *${title}*\n\nThis test is temporarily paused. Try again later.`,
  ct_intro: (title: string, total: number, who: string) =>
    `📝 *${title}*\n\n${total} questions · DREAM ZONE${who}\n\n` +
    "Enter your answers and check instantly — only the correct ones are shown.\n\n" +
    "Tap the button below to start 👇",
  ct_owner: (name: string) => `\nAuthor: ${name}`,
  btn_miniapp: "🚀 Open Mini App",
  btn_text_check: "⌨️ Check by text",
  btn_cd_create: "🆕 Create CD test",
  btn_back: "⬅️ Back",
  btn_full_test: "📋 Full test (1–40)",
  btn_retry: "🔁 Try again",
  btn_reveal: "🔑 Show answers",
  btn_home: "🏠 Main menu",
  btn_test_n: (n: number) => `Test ${n}`,
  btn_ct_start: "🚀 Start test",
  btn_cd_add: "➕ Add another passage",
  btn_cd_finish: "✅ Create CD test",
  btn_cd_more: "➕ Create another CD test",
  rk_cd: "🆕 Create CD test",
  rk_check: "📚 Check a test",
  cmd_start: "Start",
  cmd_about: "About",
  cmd_guide: "Guide",
  cmd_stats: "My results",
  cmd_qtemplate: "CD test question template",
  cmd_language: "Til / Язык / Language",
};

const ALL: Record<Lang, Dict> = { uz, ru, en };

export function t(lang: Lang, key: string, ...args: any[]): string {
  const d = ALL[lang] ?? uz;
  let v = d[key];
  if (v === undefined) v = uz[key];
  if (typeof v === "function") return (v as (...a: any[]) => string)(...args);
  return (v as string) ?? key;
}

// Reply-keyboard tugmalari matni — barcha tillarda (foydalanuvchi bosgan
// tugmani tanish uchun, tilidan qat'i nazar).
export const RK_CD_ALL = new Set(LANGS.map((l) => t(l, "rk_cd")));
export const RK_CHECK_ALL = new Set(LANGS.map((l) => t(l, "rk_check")));
