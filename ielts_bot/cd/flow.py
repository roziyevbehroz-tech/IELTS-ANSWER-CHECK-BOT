"""CD test yaratish suhbat oqimi (Telegram state machine).

Foydalanuvchi: 🆕 CD Test yaratish -> Reading -> passage yuboradi ->
savollarni yuboradi -> javoblarni yuboradi -> sozlamalar -> tayyor HTML.
Barcha parsing AI'siz, avtomatik.
"""

from __future__ import annotations

import io
import logging
from typing import Dict

from telegram import Update
from telegram.constants import ParseMode
from telegram.ext import ContextTypes

from .. import keyboards
from . import answers as ans_mod
from . import extract, passage as passage_mod, questions as q_mod, render
from .models import Passage, ReadingTest, Settings

logger = logging.getLogger(__name__)

MAX_FILE = 8 * 1024 * 1024   # 8 MB

# ------------------------------- matnlar -------------------------------

INTRO = (
    "🆕 *CD Test yaratish*\n\n"
    "Qaysi bo'lim uchun test yaratmoqchisiz?\n\n"
    "🟢 *Reading* — tayyor\n"
    "🔴 Listening / Speaking / Writing — tez orada\n\n"
    "Bo'limni tanlang 👇"
)

COMING_SOON = "🔴 Bu bo'lim hozircha tayyor emas. Tez orada! Hozircha 🟢 Reading mavjud."

ASK_PASSAGE = (
    "📖 *Reading — Passage {n}*\n\n"
    "Iltimos, testning *matn (passage)* qismini yuboring.\n\n"
    "Qabul qilinadi: 📄 PDF, DOCX, DOC yoki oddiy matn.\n"
    "Agar matn ichida savollar ham bo'lsa — bot ularni avtomatik ajratadi va "
    "faqat passage'ni oladi.\n\n"
    "_Maslahat: matnning birinchi qatori sarlavha bo'lsa yaxshi._"
)

ASK_QUESTIONS = (
    "✅ Passage qabul qilindi!\n"
    "📌 Sarlavha: *{title}*\n"
    "📄 Paragraflar: {paras} ta{lettered}\n\n"
    "👀 *Namuna (boshi):*\n_{preview}_\n\n"
    "Agar matn biroz chalkash chiqsa — xavotir olmang: oxirida tayyor HTML'ni "
    "*o'zingiz tahrirlab* (bold, markaz, o'lcham) tuzatib olasiz.\n\n"
    "Endi shu passage'ning *savollarini* yuboring (matn yoki fayl).\n\n"
    "1️⃣ *Toza Cambridge matni* — shundoq tashlang, bot turlarni o'zi taniydi.\n"
    "2️⃣ *Aniq shablon* — 100% ishonchli. /qtemplate ni yuboring."
)

QTEMPLATE = (
    "🧩 *Savol shabloni* — har blok `[tur] boshlanish-tugash` bilan boshlanadi.\n"
    "Gap (bo'sh joy) uchun `___` yozing (tartib bilan raqamlanadi).\n\n"
    "```\n"
    "[note] 1-4\n"
    "Complete the notes. ONE WORD ONLY.\n"
    "Chinese silk\n"
    "- emperor wore ___ silk\n"
    "- used as payment of ___\n"
    "- replaced ___ as value\n"
    "- used in ___ trade\n\n"
    "[tfng] 5-7\n"
    "Do the statements agree? TRUE/FALSE/NOT GIVEN\n"
    "5. Statement one.\n"
    "6. Statement two.\n"
    "7. Statement three.\n\n"
    "[mcq] 8-9\n"
    "Choose the correct letter.\n"
    "8. Question stem?\n"
    "A option a\n"
    "B option b\n"
    "C option c\n"
    "9. Another stem?\n"
    "A ...\nB ...\nC ...\n\n"
    "[mcq_multi] 10-11\n"
    "Choose TWO letters. Which TWO ...?  (javob: `10-11. B, D`)\n"
    "A ...\nB ...\nC ...\nD ...\nE ...\n\n"
    "[headings] 12-14\n"
    "List of Headings:\n"
    "i   Heading one\n"
    "ii  Heading two\n"
    "iii Heading three\n"
    "12. Paragraph A\n"
    "13. Paragraph B\n"
    "14. Paragraph C\n\n"
    "[matching_info] 15-17 | A-F\n"
    "Which paragraph contains...?\n"
    "15. info one\n"
    "16. info two\n"
    "17. info three\n\n"
    "[matching_features] 18-20 | A-C\n"
    "Match each statement with a person.\n"
    "A Smith\nB Jones\nC Lee\n"
    "18. statement one\n"
    "19. statement two\n"
    "20. statement three\n\n"
    "[summary] 21-23\n"
    "[sentence] · [table] · [flowchart] · [shortanswer] · [diagram] — ham `___` bilan\n"
    "```\n\n"
    "Tayyor bo'lsangiz, savollaringizni yuboring."
)

Q_SUMMARY = (
    "🧩 *Savollar aniqlandi!*\n\n{lines}\n"
    "Jami: *{total}* ta savol (Q{first}–{last}).\n\n"
    "Endi shu savollarning *to'g'ri javoblarini* yuboring. Namuna:\n"
    "```\n{example}\n```\n"
    "Muqobil javob: `24. vegetable / vegetation`. "
    "TRUE/FALSE/NG uchun: `5. TRUE`. Harflar uchun: `8. B`.\n"
    "Ko'p tanlovli (Choose TWO/THREE): `12-13. C, D` — tartib muhim emas."
)

NO_QUESTIONS = (
    "🤔 Savollarni ajratib bo'lmadi. Iltimos aniq shablondan foydalaning — "
    "/qtemplate ni yuboring va namunaga qarab qayta yuboring."
)

ANS_OK = (
    "✅ Javoblar qabul qilindi ({n} ta).{warn}\n\n"
    "Bu passage tayyor. Yana passage qo'shasizmi yoki testni yaratamizmi?"
)

ASK_REVEAL = (
    "⚙️ *Sozlama 1/2 — javoblar qachon ko'rinsin?*\n\n"
    "⚡ *Darrov* — «Deliver» bosilganda to'g'ri javoblar darrov ko'rinadi.\n"
    "🔒 *Bosib ko'rsin* — avval faqat ball chiqadi, to'g'ri javoblar «Javoblarni "
    "ko'rish» bosilgandagina ochiladi (bot uslubi)."
)

ASK_EXPL = (
    "⚙️ *Sozlama 2/2 — izoh qo'shasizmi?*\n\n"
    "Har bir savol uchun qisqa izoh (nega bu javob to'g'ri) qo'shishingiz mumkin."
)

ASK_EXPL_TEXT = (
    "✍️ Izohlarni yuboring (ixtiyoriy savollar uchun). Namuna:\n"
    "```\n1. matnda 'white silk' deb aytilgan\n5. bu haqda ma'lumot yo'q\n```"
)

BUILDING = "⏳ CD test tayyorlanmoqda…"

DONE = (
    "🎉 *Tayyor!* CD Reading testingiz quyida.\n\n"
    "📊 {total} ta savol · {passages} ta passage · "
    "{reveal} · izoh: {expl}\n\n"
    "✏️ *Tuzatish kerakmi?* Faylni brauzerda oching → yuqoridagi *✏️* tugmasini "
    "bosing → matn/savollarni tahrirlang (bold, markaz, o'lcham) → *💾 Saqlash* "
    "bilan toza yakuniy faylni yuklab oling.\n\n"
    "So'ng o'quvchilarga tarqating. 💙"
)

BAD_FILE = (
    "⚠️ Faylni o'qib bo'lmadi: {err}\n\n"
    "Iltimos .docx, .pdf yoki oddiy matn ko'rinishida qayta yuboring."
)


# ------------------------------- holat --------------------------------

def _cd(context) -> Dict:
    return context.user_data.setdefault("cd", {})


def _reset(context) -> Dict:
    context.user_data["cd"] = {}
    return context.user_data["cd"]


def active(context) -> bool:
    cd = context.user_data.get("cd") or {}
    return bool(cd.get("step"))


# ------------------------------ kirish --------------------------------

async def start(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    _reset(context)
    _cd(context)["step"] = "skill"
    await update.callback_query.edit_message_text(
        INTRO, reply_markup=keyboards.cd_skill_keyboard(),
        parse_mode=ParseMode.MARKDOWN,
    )


async def on_skill(update, context, value) -> None:
    if value != "reading":
        await update.callback_query.answer(COMING_SOON, show_alert=True)
        return
    cd = _reset(context)
    cd.update(step="passage", skill="reading", passages=[],
              settings=Settings(), explanations={})
    await update.callback_query.edit_message_text(
        ASK_PASSAGE.format(n=1), parse_mode=ParseMode.MARKDOWN,
    )


async def cancel(update, context) -> None:
    _reset(context)
    from .. import texts
    await update.callback_query.edit_message_text(
        texts.CHOOSE_BOOK, reply_markup=keyboards.books_keyboard(),
    )


# --------------------------- callbacklar ------------------------------

async def on_callback(update, context, value) -> None:
    """cd:<sub>:<arg> callback'larini boshqaradi."""
    sub, _, arg = value.partition(":")
    if sub == "start":
        await start(update, context)
    elif sub == "skill":
        await on_skill(update, context, arg)
    elif sub == "cancel":
        await cancel(update, context)
    elif sub == "reveal":
        await _set_reveal(update, context, arg)
    elif sub == "expl":
        await _set_expl(update, context, arg)
    elif sub == "more":
        await _on_more(update, context, arg)


# --------------------------- xabar oqimi ------------------------------

async def on_message(update: Update, context: ContextTypes.DEFAULT_TYPE) -> bool:
    """CD faol bo'lsa xabarni qayta ishlaydi. True qaytarsa — qabul qilindi."""
    cd = context.user_data.get("cd") or {}
    step = cd.get("step")
    if step not in ("passage", "questions", "answers", "expl"):
        return False

    text = await _read_input(update, context)
    if text is None:
        return True  # xato allaqachon yuborilgan

    if step == "passage":
        await _handle_passage(update, context, text)
    elif step == "questions":
        await _handle_questions(update, context, text)
    elif step == "answers":
        await _handle_answers(update, context, text)
    elif step == "expl":
        await _handle_expl(update, context, text)
    return True


async def _read_input(update, context):
    """Matn yoki fayldan matn oladi. Xato bo'lsa xabar yuborib None qaytaradi."""
    msg = update.message
    if msg.document:
        doc = msg.document
        if doc.file_size and doc.file_size > MAX_FILE:
            await msg.reply_text("⚠️ Fayl juda katta (8 MB dan kichik bo'lsin).")
            return None
        try:
            f = await doc.get_file()
            data = bytes(await f.download_as_bytearray())
            return extract.extract_text(data, doc.file_name or "")
        except extract.ExtractError as e:
            await msg.reply_text(BAD_FILE.format(err=e), parse_mode=ParseMode.MARKDOWN)
            return None
        except Exception as e:  # noqa: BLE001
            logger.exception("fayl o'qishda xato")
            await msg.reply_text(BAD_FILE.format(err=e))
            return None
    if msg.text:
        return msg.text
    await msg.reply_text("Iltimos matn yoki fayl (PDF/DOCX) yuboring.")
    return None


async def _handle_passage(update, context, text) -> None:
    cd = _cd(context)
    passage_part, _q = passage_mod.split_passage_and_questions(text)
    idx = len(cd["passages"]) + 1
    p = passage_mod.parse_passage(passage_part or text, index=idx)
    if not p.paragraphs:
        await update.message.reply_text(
            "🤔 Matn bo'sh ko'rinadi. Iltimos passage matnini qayta yuboring.")
        return
    cd["cur_passage"] = p
    cd["step"] = "questions"
    lettered = " (A, B, C… belgilangan)" if p.lettered else ""
    preview = " ".join(p.paragraphs)[:180].strip()
    preview = (preview + "…") if preview else "(matn topilmadi)"
    await update.message.reply_text(
        ASK_QUESTIONS.format(title=p.title or "—", paras=len(p.paragraphs),
                             lettered=lettered, preview=preview),
        parse_mode=ParseMode.MARKDOWN,
    )


async def _handle_questions(update, context, text) -> None:
    cd = _cd(context)
    p: Passage = cd["cur_passage"]
    groups = q_mod.parse_questions(text, para_count=len(p.paragraphs))
    groups = [g for g in groups if g.numbers]
    if not groups:
        await update.message.reply_text(NO_QUESTIONS, parse_mode=ParseMode.MARKDOWN)
        return
    cd["cur_groups"] = groups
    cd["step"] = "answers"
    lines = "\n".join(
        f"• {g.label}: Q{g.start}–{g.end}" for g in groups)
    nums = [n for g in groups for n in g.numbers]
    first, last = min(nums), max(nums)
    example = _answer_example(groups)
    await update.message.reply_text(
        Q_SUMMARY.format(lines=lines, total=len(set(nums)), first=first,
                         last=last, example=example),
        parse_mode=ParseMode.MARKDOWN,
    )


def _answer_example(groups) -> str:
    ex = []
    for g in groups[:4]:
        n = g.start
        if g.kind in ("tfng",):
            ex.append(f"{n}. TRUE")
        elif g.kind == "ynng":
            ex.append(f"{n}. YES")
        elif g.kind == "mcq_multi":
            ex.append(f"{g.start}-{g.end}. B, D")
        elif g.kind in ("mcq", "matching"):
            ex.append(f"{n}. B")
        else:
            ex.append(f"{n}. answer")
    return "\n".join(ex)


async def _handle_answers(update, context, text) -> None:
    cd = _cd(context)
    key = ans_mod.parse_answer_key(text)
    if not key:
        await update.message.reply_text(
            "🤔 Javoblarni o'qib bo'lmadi. Namuna: `1. white`  `2. TRUE`  `3. B`",
            parse_mode=ParseMode.MARKDOWN)
        return
    groups = cd["cur_groups"]
    expected = [n for g in groups for n in g.numbers]
    missing, _extra = ans_mod.validate(key, expected)
    warn = ""
    if missing:
        warn = f"\n⚠️ Javob berilmagan: {', '.join(map(str, missing[:20]))}"

    # passage'ni yakunlaymiz
    p: Passage = cd["cur_passage"]
    p.groups = groups
    p.answers = {q: key[q] for q in expected if q in key}
    cd["passages"].append(p)
    cd["cur_passage"] = None
    cd["cur_groups"] = None
    cd["step"] = "await_more"

    kb = keyboards.cd_more_keyboard()
    if len(cd["passages"]) >= 3:
        # 3 passage limiti — to'g'ridan-to'g'ri yakunga
        await update.message.reply_text(
            ANS_OK.format(n=len(p.answers), warn=warn) +
            "\n\n(3 passage limiti — testni yaratamiz)",
            parse_mode=ParseMode.MARKDOWN)
        await _ask_reveal(update, context)
        return
    await update.message.reply_text(
        ANS_OK.format(n=len(p.answers), warn=warn),
        reply_markup=kb, parse_mode=ParseMode.MARKDOWN)


async def _on_more(update, context, arg) -> None:
    cd = _cd(context)
    if arg == "add":
        cd["step"] = "passage"
        n = len(cd["passages"]) + 1
        await update.callback_query.edit_message_text(
            ASK_PASSAGE.format(n=n), parse_mode=ParseMode.MARKDOWN)
    elif arg == "finish":
        await _ask_reveal(update, context, edit=True)


async def _ask_reveal(update, context, edit=False) -> None:
    _cd(context)["step"] = "await_reveal"
    kb = keyboards.cd_reveal_keyboard()
    if edit and update.callback_query:
        await update.callback_query.edit_message_text(
            ASK_REVEAL, reply_markup=kb, parse_mode=ParseMode.MARKDOWN)
    else:
        await update.message.reply_text(
            ASK_REVEAL, reply_markup=kb, parse_mode=ParseMode.MARKDOWN)


async def _set_reveal(update, context, arg) -> None:
    cd = _cd(context)
    cd["settings"].reveal_mode = "instant" if arg == "instant" else "end"
    cd["step"] = "await_expl"
    await update.callback_query.edit_message_text(
        ASK_EXPL, reply_markup=keyboards.cd_explanations_keyboard(),
        parse_mode=ParseMode.MARKDOWN)


async def _set_expl(update, context, arg) -> None:
    cd = _cd(context)
    if arg == "yes":
        cd["settings"].explanations = True
        cd["step"] = "expl"
        await update.callback_query.edit_message_text(
            ASK_EXPL_TEXT, parse_mode=ParseMode.MARKDOWN)
    else:
        cd["settings"].explanations = False
        await _finish(update, context)


async def _handle_expl(update, context, text) -> None:
    cd = _cd(context)
    expl = ans_mod.parse_answer_key(text)   # {q: izoh}
    cd["explanations"] = {int(k): v for k, v in expl.items()}
    await _finish(update, context)


# ------------------------------ yakun ---------------------------------

async def _finish(update, context) -> None:
    cd = _cd(context)
    msg_obj = update.callback_query.message if update.callback_query else update.message
    await msg_obj.reply_text(BUILDING)

    settings: Settings = cd["settings"]
    settings.brand = "DREAM ZONE"
    title = cd["passages"][0].title or "IELTS Reading Practice"
    test = ReadingTest(
        title=title,
        passages=cd["passages"],
        settings=settings,
        explanations=cd.get("explanations", {}),
    )
    html = render.render_test(test)
    buf = io.BytesIO(html.encode("utf-8"))
    buf.name = "dream_zone_reading.html"

    reveal_lbl = "⚡ darrov" if settings.reveal_mode == "instant" else "🔒 bosib ko'rish"
    expl_lbl = "bor" if settings.explanations else "yo'q"
    caption = DONE.format(
        total=test.total_questions, passages=len(test.passages),
        reveal=reveal_lbl, expl=expl_lbl)

    await msg_obj.reply_document(
        document=buf, filename="dream_zone_reading.html",
        caption=caption, parse_mode=ParseMode.MARKDOWN)
    _reset(context)


async def cmd_qtemplate(update, context) -> None:
    await update.message.reply_text(QTEMPLATE, parse_mode=ParseMode.MARKDOWN)
