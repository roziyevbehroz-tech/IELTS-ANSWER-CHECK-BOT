"""Bot interfeysidagi matnlar (o'zbekcha)."""

WELCOME = (
    "👋 Assalomu alaykum, *{name}*!\n\n"
    "*DREAM ZONE* IELTS yordamchisiga xush kelibsiz 🎓\n\n"
    "Listening va Reading javoblaringizni bir zumda tekshirib beraman — "
    "boshlash uchun quyidagi tugmani bosing 👇\n\n"
    "ℹ️ Bot haqida — /about\n"
    "📖 Qo'llanma — /guide"
)

ABOUT = (
    "🎓 *DREAM ZONE — IELTS yordamchisi*\n\n"
    "Men *DREAM ZONE* o'quv markazi o'quvchilari uchun yaratilganman 💙\n\n"
    "Cambridge IELTS Academic 10–20 kitoblaridagi Listening va Reading "
    "testlarini tekshiraman — jami 44 ta to'liq test.\n\n"
    "Eng muhimi: men *faqat to'g'ri* javoblaringizni ko'rsataman. Xato "
    "javoblarning to'g'ri variantini darrov ochib qo'ymayman — siz ular "
    "ustida o'zingiz ishlaysiz, tayyor bo'lganingizda esa o'zingiz ko'rasiz.\n\n"
    "📖 Qanday foydalanish — /guide"
)

GUIDE = (
    "📖 *Qanday foydalanaman?*\n\n"
    "1. Mini App'ni oching yoki «Matn orqali tekshirish»ni tanlang.\n"
    "2. Kitob, test va bo'limni tanlang.\n"
    "3. O'sha qismni mustaqil yeching.\n"
    "4. Javoblaringizni raqami bilan yuboring, masalan:\n"
    "`1. cat`\n"
    "`2. TRUE`\n"
    "`3. B`\n"
    "5. Men faqat to'g'rilarini belgilab beraman.\n"
    "6. Xatolar ustida ishlang va qayta yuboring.\n"
    "7. Tayyor bo'lsangiz — «🔑 Javoblarni ko'rish».\n\n"
    "Savolingiz bo'lsa, *DREAM ZONE* ustozlaringizga murojaat qiling 💙"
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
