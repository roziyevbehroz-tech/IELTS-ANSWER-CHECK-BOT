"""Javoblar bazasini (answer keys) yuklash va kerakli qismni ajratib berish.

Ma'lumotlar `data/answers/book_<N>.json` fayllarida saqlanadi.
Fayl formati uchun `data/README.md` ga qarang.
"""

from __future__ import annotations

import json
from functools import lru_cache
from typing import Dict, List, Optional

from . import config

# IELTS Listening: 40 ta savol, 4 ta Part (har birida 10 ta)
LISTENING_PARTS: Dict[str, range] = {
    "1": range(1, 11),
    "2": range(11, 21),
    "3": range(21, 31),
    "4": range(31, 41),
}

# IELTS Reading: 40 ta savol, 3 ta Passage (13 + 13 + 14)
READING_PARTS: Dict[str, range] = {
    "1": range(1, 14),
    "2": range(14, 27),
    "3": range(27, 41),
}

SECTIONS = ("listening", "reading")


def part_range(section: str, part: str) -> List[int]:
    """Bo'lim va qism uchun savol raqamlari ro'yxatini qaytaradi.

    `part == "all"` bo'lsa, butun bo'lim (1..40) qaytariladi.
    """
    if part == "all":
        return list(range(1, 41))
    table = LISTENING_PARTS if section == "listening" else READING_PARTS
    return list(table[part])


@lru_cache(maxsize=None)
def _load_book(book: int) -> Optional[dict]:
    """Bitta kitob faylini yuklaydi (keshlanadi)."""
    path = config.DATA_DIR / f"book_{book}.json"
    if not path.exists():
        return None
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def get_section_answers(book: int, test: int, section: str) -> Dict[int, str]:
    """Berilgan kitob/test/bo'lim uchun {savol_raqami: javob} lug'atini qaytaradi.

    Faqat bo'sh bo'lmagan javoblar qaytariladi.
    """
    data = _load_book(book)
    if not data:
        return {}
    raw = (
        data.get("tests", {})
        .get(str(test), {})
        .get(section, {})
    )
    result: Dict[int, str] = {}
    for key, value in raw.items():
        if value is None:
            continue
        value = str(value).strip()
        if not value:
            continue
        try:
            result[int(key)] = value
        except (TypeError, ValueError):
            continue
    return result


def get_part_answers(book: int, test: int, section: str, part: str) -> Dict[int, str]:
    """Tanlangan qism (Part/Passage) uchun to'g'ri javoblarni qaytaradi."""
    section_answers = get_section_answers(book, test, section)
    wanted = part_range(section, part)
    return {q: section_answers[q] for q in wanted if q in section_answers}


def is_part_available(book: int, test: int, section: str, part: str) -> bool:
    """Tanlangan qism uchun javoblar kiritilgan-yo'qligini tekshiradi."""
    return len(get_part_answers(book, test, section, part)) > 0


def reload_cache() -> None:
    """Disk-dagi o'zgarishlardan keyin keshni tozalaydi."""
    _load_book.cache_clear()
