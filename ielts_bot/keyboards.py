"""Inline klaviaturalar (tugmalar)."""

from __future__ import annotations

from telegram import InlineKeyboardButton, InlineKeyboardMarkup, WebAppInfo

from . import config, texts


def _grid(buttons, per_row):
    return [buttons[i : i + per_row] for i in range(0, len(buttons), per_row)]


def launcher_keyboard() -> InlineKeyboardMarkup:
    """Mini App'ni ochuvchi tugma + matnli rejim tugmasi."""
    rows = []
    if config.WEBAPP_URL:
        rows.append([
            InlineKeyboardButton(
                "🚀 Mini App'ni ochish",
                web_app=WebAppInfo(url=config.WEBAPP_URL),
            )
        ])
    rows.append([InlineKeyboardButton("⌨️ Matn orqali tekshirish", callback_data="nav:books")])
    return InlineKeyboardMarkup(rows)


def books_keyboard() -> InlineKeyboardMarkup:
    btns = [
        InlineKeyboardButton(str(b), callback_data=f"book:{b}")
        for b in config.BOOKS
    ]
    return InlineKeyboardMarkup(_grid(btns, 4))


def tests_keyboard() -> InlineKeyboardMarkup:
    btns = [
        InlineKeyboardButton(f"Test {t}", callback_data=f"test:{t}")
        for t in range(1, config.TESTS_PER_BOOK + 1)
    ]
    rows = _grid(btns, 2)
    rows.append([InlineKeyboardButton(texts.BTN_BACK, callback_data="nav:books")])
    return InlineKeyboardMarkup(rows)


def sections_keyboard() -> InlineKeyboardMarkup:
    rows = [
        [
            InlineKeyboardButton("🎧 Listening", callback_data="sec:listening"),
            InlineKeyboardButton("📖 Reading", callback_data="sec:reading"),
        ],
        [InlineKeyboardButton(texts.BTN_BACK, callback_data="nav:tests")],
    ]
    return InlineKeyboardMarkup(rows)


def parts_keyboard(section: str) -> InlineKeyboardMarkup:
    if section == "listening":
        labels = [("Part 1", "1"), ("Part 2", "2"), ("Part 3", "3"), ("Part 4", "4")]
    else:
        labels = [("Passage 1", "1"), ("Passage 2", "2"), ("Passage 3", "3")]
    btns = [
        InlineKeyboardButton(lbl, callback_data=f"part:{code}")
        for lbl, code in labels
    ]
    rows = _grid(btns, 2)
    rows.append(
        [InlineKeyboardButton("📋 To'liq test (1–40)", callback_data="part:all")]
    )
    rows.append([InlineKeyboardButton(texts.BTN_BACK, callback_data="nav:sections")])
    return InlineKeyboardMarkup(rows)


def result_keyboard() -> InlineKeyboardMarkup:
    rows = [
        [InlineKeyboardButton(texts.BTN_RETRY, callback_data="act:retry")],
        [InlineKeyboardButton(texts.BTN_REVEAL, callback_data="act:reveal")],
        [InlineKeyboardButton(texts.BTN_MENU, callback_data="nav:books")],
    ]
    return InlineKeyboardMarkup(rows)


def after_reveal_keyboard() -> InlineKeyboardMarkup:
    rows = [[InlineKeyboardButton(texts.BTN_MENU, callback_data="nav:books")]]
    return InlineKeyboardMarkup(rows)
