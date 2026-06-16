"""Bot interfeysidagi matnlar (o'zbekcha)."""

WELCOME = (
    "🎓 *IELTS Answer Check Bot*\n\n"
    "Assalomu alaykum, *{name}*! Bu bot Cambridge IELTS Academic "
    "kitoblarining javob kalitlari bo'yicha tekshiruv o'tkazadi.\n\n"
    "━━━━━━━━━━━━━━━━━━━\n\n"
    "📚 *Qamrab olingan kitoblar:*\n"
    "Cambridge IELTS Academic *10–20* (11 ta kitob)\n"
    "Har birida 4 ta to'liq test · Listening + Reading\n"
    "Jami: *44 ta test, 3 520+ savol*\n\n"
    "🔒 *Asosiy xususiyat:*\n"
    "Bot faqat *to'g'ri* javoblarni ko'rsatadi. Xato javoblarning "
    "to'g'ri varianti «🔑 Ko'rish» tugmasi bosilgunicha yashirinib "
    "turadi — bu sizga mustaqil fikrlash va xatolaringiz ustida ishlash "
    "imkonini beradi.\n\n"
    "━━━━━━━━━━━━━━━━━━━\n\n"
    "📖 *Qo'llanma:*\n\n"
    "1️⃣ Kitob → Test → Listening/Reading → Part/Passage\n"
    "2️⃣ O'sha qismni mustaqil yeching\n"
    "3️⃣ Javoblarni raqami bilan yuboring:\n"
    "`1. cat`\n"
    "`2. TRUE`\n"
    "`3. B`\n"
    "4️⃣ Bot *faqat to'g'ri* javoblarni ko'rsatadi\n"
    "5️⃣ Xatolar ustida yana ishlang, qayta yuboring\n"
    "6️⃣ Barcha javoblar tayyor bo'lganda — «🔑 Ko'rish»\n\n"
    "━━━━━━━━━━━━━━━━━━━\n\n"
    "✨ Eng qulay tajriba uchun *Mini App*'ni oching:"
)

CHOOSE_BOOK = "📚 Cambridge IELTS Academic — kitobni tanlang:"
CHOOSE_TEST = "📝 {book}-kitob. Testni tanlang:"
CHOOSE_SECTION = "🎧📖 {book}-kitob, Test {test}. Bo'limni tanlang:"
CHOOSE_PART = "{icon} {book}-kitob, Test {test}, {section}. Qismni tanlang:"

SECTION_NAMES = {
    "listening": "Listening",
    "reading": "Reading",
}
SECTION_ICONS = {
    "listening": "🎧",
    "reading": "📖",
}

PART_NOT_AVAILABLE = (
    "⚠️ Afsuski, bu qism uchun javoblar hali bazaga kiritilmagan.\n"
    "Iltimos boshqa qismni tanlang yoki keyinroq urinib ko'ring."
)

SEND_ANSWERS = (
    "✍️ *{book}-kitob, Test {test}, {section} — {part}*\n"
    "Savollar: {first}–{last} ({count} ta)\n\n"
    "Javoblaringizni tartib raqami bilan yuboring. Masalan:\n"
    "`{example}`\n\n"
    "Har bir javobni alohida qatorda yozsangiz ham bo'ladi."
)

NO_ANSWERS_PARSED = (
    "🤔 Javoblarni o'qib bo'lmadi. Iltimos har bir javobni raqami bilan yuboring:\n"
    "`21. cat`\n`22. true`\n`23. B`"
)

RESULT_HEADER = "📊 *Natija: {correct}/{total} to'g'ri*\n\n"
RESULT_CORRECT_LINE = "✅ To'g'ri javoblar: {numbers}\n"
RESULT_ALL_CORRECT = "🎉 Barakalla! Hammasi to'g'ri — {total}/{total}!\n"
RESULT_NONE_CORRECT = "Hozircha to'g'ri javob yo'q. Xafa bo'lmang, qayta urinib ko'ring! 💪\n"
RESULT_REWORK = (
    "\n🔁 Qolgan savollar ustida yana mustaqil ishlang. "
    "Tayyor bo'lsangiz, javoblarni qaytadan yuboring."
)
RESULT_UNANSWERED = "\nℹ️ Javob bermagan savollaringiz: {numbers}\n"

REVEAL_HEADER = "🔑 *To'g'ri javoblar — {book}-kitob, Test {test}, {section} {part}:*\n\n"
REVEAL_LINE = "{q}. {answer}"

BTN_RETRY = "🔁 Qaytadan urinish"
BTN_REVEAL = "🔑 Javoblarni ko'rish"
BTN_MENU = "🏠 Bosh menyu"
BTN_BACK = "⬅️ Orqaga"
BTN_STATS = "📈 Mening statistikam"

STATS_EMPTY = "📈 Hali yechilgan testlar yo'q. Birinchi testni yechib ko'ring!"
STATS_HEADER = "📈 *Sizning statistikangiz:*\n\n"
STATS_LINE = "• {book}-kitob T{test} {section} {part}: {correct}/{total}\n"
STATS_SUMMARY = "\n*Jami:* {attempts} ta urinish, o'rtacha {avg:.0f}% to'g'ri."

HELP = (
    "ℹ️ *Yordam*\n\n"
    "1. /start — kitob, test, bo'lim va qismni tanlang.\n"
    "2. O'sha qismni o'zingiz yeching.\n"
    "3. Javoblarni raqami bilan botga yuboring (masalan `21. cat`).\n"
    "4. Bot faqat *to'g'ri* javoblaringizni ko'rsatadi.\n"
    "5. Xatolaringiz ustida ishlab, qayta yuboring.\n"
    "6. Tayyor bo'lganingizda «🔑 Javoblarni ko'rish» tugmasini bosing.\n\n"
    "Buyruqlar: /start, /help"
)
