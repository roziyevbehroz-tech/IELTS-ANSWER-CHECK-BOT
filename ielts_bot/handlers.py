"""Telegram handlerlari — botning asosiy mantig'i."""

from __future__ import annotations

import logging
from typing import Dict

from telegram import Update
from telegram.constants import ParseMode
from telegram.ext import (
    Application,
    CallbackQueryHandler,
    CommandHandler,
    ContextTypes,
    MessageHandler,
    filters,
)

from . import answer_keys, checker, database, keyboards, parsing, texts
from .cd import flow as cd_flow

logger = logging.getLogger(__name__)


# ----------------------- yordamchi funksiyalar -----------------------

def _sel(context: ContextTypes.DEFAULT_TYPE) -> Dict:
    return context.user_data.setdefault("sel", {})


def part_label(section: str, part: str) -> str:
    if part == "all":
        return "To'liq test"
    if section == "listening":
        return f"Part {part}"
    return f"Passage {part}"


async def _save_user(update: Update) -> None:
    u = update.effective_user
    if u is None:
        return
    database.upsert_user(u.id, u.username, u.first_name, u.language_code)


# ----------------------------- buyruqlar -----------------------------

async def cmd_start(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    context.user_data.clear()
    await _save_user(update)
    name = update.effective_user.first_name if update.effective_user else "do'stim"
    await update.message.reply_text(
        texts.WELCOME.format(name=name),
        reply_markup=keyboards.launcher_keyboard(),
        parse_mode=ParseMode.MARKDOWN,
    )


async def cmd_about(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    await update.message.reply_text(texts.ABOUT, parse_mode=ParseMode.MARKDOWN)


async def cmd_guide(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    await update.message.reply_text(texts.GUIDE, parse_mode=ParseMode.MARKDOWN)


async def cmd_stats(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    attempts = database.get_user_attempts(update.effective_user.id, limit=10)
    if not attempts:
        await update.message.reply_text(texts.STATS_EMPTY)
        return
    await update.message.reply_text(
        _format_stats(attempts), parse_mode=ParseMode.MARKDOWN
    )


def _format_stats(attempts) -> str:
    msg = texts.STATS_HEADER
    total_pct = 0.0
    for a in attempts:
        sec = texts.SECTION_NAMES.get(a["section"], a["section"])
        msg += texts.STATS_LINE.format(
            book=a["book"], test=a["test"], section=sec,
            part=part_label(a["section"], a["part"]),
            correct=a["correct"], total=a["total"],
        )
        if a["total"]:
            total_pct += a["correct"] / a["total"] * 100
    avg = total_pct / len(attempts) if attempts else 0
    msg += texts.STATS_SUMMARY.format(attempts=len(attempts), avg=avg)
    return msg


# --------------------------- callback'lar ---------------------------

async def on_callback(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    query = update.callback_query
    await query.answer()
    data = query.data or ""
    kind, _, value = data.partition(":")

    if kind == "cd":
        await cd_flow.on_callback(update, context, value)
        return

    handlers = {
        "book": _cb_book,
        "test": _cb_test,
        "sec": _cb_section,
        "part": _cb_part,
        "nav": _cb_nav,
        "act": _cb_action,
    }
    handler = handlers.get(kind)
    if handler:
        await handler(update, context, value)


async def _cb_book(update, context, value):
    sel = _sel(context)
    sel["book"] = int(value)
    sel.pop("test", None)
    sel.pop("section", None)
    sel.pop("part", None)
    await update.callback_query.edit_message_text(
        texts.CHOOSE_TEST.format(book=sel["book"]),
        reply_markup=keyboards.tests_keyboard(),
        parse_mode=ParseMode.MARKDOWN,
    )


async def _cb_test(update, context, value):
    sel = _sel(context)
    sel["test"] = int(value)
    await update.callback_query.edit_message_text(
        texts.CHOOSE_SECTION.format(book=sel["book"], test=sel["test"]),
        reply_markup=keyboards.sections_keyboard(),
        parse_mode=ParseMode.MARKDOWN,
    )


async def _cb_section(update, context, value):
    sel = _sel(context)
    sel["section"] = value
    icon = texts.SECTION_ICONS.get(value, "")
    name = texts.SECTION_NAMES.get(value, value)
    await update.callback_query.edit_message_text(
        texts.CHOOSE_PART.format(
            icon=icon, book=sel["book"], test=sel["test"], section=name
        ),
        reply_markup=keyboards.parts_keyboard(value),
        parse_mode=ParseMode.MARKDOWN,
    )


async def _cb_part(update, context, value):
    sel = _sel(context)
    sel["part"] = value
    book, test, section = sel["book"], sel["test"], section_of(sel)

    if not answer_keys.is_part_available(book, test, section, value):
        await update.callback_query.answer(
            "Bu qism uchun javoblar hali yo'q.", show_alert=True
        )
        await update.callback_query.edit_message_text(
            texts.PART_NOT_AVAILABLE,
            reply_markup=keyboards.parts_keyboard(section),
        )
        return

    context.user_data["awaiting"] = True
    await update.callback_query.edit_message_text(
        _prompt_text(sel), parse_mode=ParseMode.MARKDOWN
    )


async def _cb_nav(update, context, value):
    sel = _sel(context)
    if value == "books":
        context.user_data["awaiting"] = False
        await update.callback_query.edit_message_text(
            texts.CHOOSE_BOOK, reply_markup=keyboards.books_keyboard()
        )
    elif value == "tests":
        await update.callback_query.edit_message_text(
            texts.CHOOSE_TEST.format(book=sel.get("book")),
            reply_markup=keyboards.tests_keyboard(),
            parse_mode=ParseMode.MARKDOWN,
        )
    elif value == "sections":
        await update.callback_query.edit_message_text(
            texts.CHOOSE_SECTION.format(book=sel.get("book"), test=sel.get("test")),
            reply_markup=keyboards.sections_keyboard(),
            parse_mode=ParseMode.MARKDOWN,
        )


async def _cb_action(update, context, value):
    sel = _sel(context)
    if value == "retry":
        context.user_data["awaiting"] = True
        await update.callback_query.edit_message_text(
            _prompt_text(sel), parse_mode=ParseMode.MARKDOWN
        )
    elif value == "reveal":
        await _reveal_answers(update, context)


# --------------------------- javoblar oqimi ---------------------------

def section_of(sel: Dict) -> str:
    return sel.get("section", "listening")


def _prompt_text(sel: Dict) -> str:
    section = section_of(sel)
    part = sel["part"]
    nums = answer_keys.part_range(section, part)
    example = _example_for(section, nums[0])
    return texts.SEND_ANSWERS.format(
        book=sel["book"],
        test=sel["test"],
        section=texts.SECTION_NAMES.get(section, section),
        part=part_label(section, part),
        first=nums[0],
        last=nums[-1],
        count=len(nums),
        example=example,
    )


def _example_for(section: str, first: int) -> str:
    if section == "reading":
        return f"{first}. TRUE\n{first + 1}. paragraph\n{first + 2}. B"
    return f"{first}. cat\n{first + 1}. 10 am\n{first + 2}. B"


async def on_document(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Fayl (PDF/DOCX/DOC/txt) — faqat CD test yaratish oqimida qabul qilinadi."""
    if cd_flow.active(context):
        await cd_flow.on_message(update, context)
        return
    await update.message.reply_text(
        "📎 Faylni qabul qilish uchun avval «🆕 CD Test yaratish»ni boshlang (/start)."
    )


async def on_text(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    # CD test yaratish oqimi faol bo'lsa — o'sha yerga yo'naltiramiz
    if cd_flow.active(context):
        handled = await cd_flow.on_message(update, context)
        if handled:
            return

    if not context.user_data.get("awaiting"):
        # Foydalanuvchi tasodifan matn yubordi — menyuga yo'naltiramiz
        await update.message.reply_text(
            "Boshlash uchun /start ni bosing.",
        )
        return

    sel = _sel(context)
    section = section_of(sel)
    user_answers = parsing.parse_answers(update.message.text)
    if not user_answers:
        await update.message.reply_text(
            texts.NO_ANSWERS_PARSED, parse_mode=ParseMode.MARKDOWN
        )
        return

    key_answers = answer_keys.get_part_answers(
        sel["book"], sel["test"], section, sel["part"]
    )
    result = checker.check_answers(user_answers, key_answers)

    await update.message.reply_text(
        _format_result(result),
        reply_markup=keyboards.result_keyboard(),
        parse_mode=ParseMode.MARKDOWN,
    )

    database.record_attempt(
        telegram_id=update.effective_user.id,
        book=sel["book"],
        test=sel["test"],
        section=section,
        part=sel["part"],
        correct=result.correct_count,
        total=result.total,
        details={
            "correct": result.correct_numbers,
            "unanswered": result.unanswered_numbers,
        },
    )


def _format_result(result: checker.CheckResult) -> str:
    msg = texts.RESULT_HEADER.format(correct=result.correct_count, total=result.total)

    if result.correct_count == result.total and result.total > 0:
        msg += texts.RESULT_ALL_CORRECT.format(total=result.total)
        return msg

    if result.correct_numbers:
        nums = ", ".join(str(n) for n in result.correct_numbers)
        msg += texts.RESULT_CORRECT_LINE.format(numbers=nums)
    else:
        msg += texts.RESULT_NONE_CORRECT

    if result.unanswered_numbers:
        nums = ", ".join(str(n) for n in result.unanswered_numbers)
        msg += texts.RESULT_UNANSWERED.format(numbers=nums)

    msg += texts.RESULT_REWORK
    return msg


async def _reveal_answers(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    sel = _sel(context)
    section = section_of(sel)
    key_answers = answer_keys.get_part_answers(
        sel["book"], sel["test"], section, sel["part"]
    )
    context.user_data["awaiting"] = False

    header = texts.REVEAL_HEADER.format(
        book=sel["book"],
        test=sel["test"],
        section=texts.SECTION_NAMES.get(section, section),
        part=part_label(section, sel["part"]),
    )
    lines = [
        texts.REVEAL_LINE.format(q=q, answer=key_answers[q])
        for q in sorted(key_answers)
    ]
    await update.callback_query.edit_message_text(
        header + "\n".join(lines),
        reply_markup=keyboards.after_reveal_keyboard(),
        parse_mode=ParseMode.MARKDOWN,
    )


# ----------------------------- ro'yxatga olish -----------------------------

def register(application: Application) -> None:
    application.add_handler(CommandHandler("start", cmd_start))
    application.add_handler(CommandHandler("about", cmd_about))
    application.add_handler(CommandHandler(["guide", "help"], cmd_guide))
    application.add_handler(CommandHandler("stats", cmd_stats))
    application.add_handler(CommandHandler("qtemplate", cd_flow.cmd_qtemplate))
    application.add_handler(CallbackQueryHandler(on_callback))
    application.add_handler(MessageHandler(filters.Document.ALL, on_document))
    application.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, on_text))
