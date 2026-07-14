"""Passage (reading matni) ni tozalash va formatlash — AI'siz.

Vazifalar:
  * Agar matn ichida savollar bo'lsa, ularni ajratib, faqat passage qismini olish.
  * Sarlavha (title) va kichik sarlavhani (subtitle) aniqlash.
  * Paragraflarga bo'lish; agar matn A, B, C... bilan belgilangan bo'lsa,
    `lettered=True` qilib saqlash (matching-headings/paragraph testlari uchun).
"""

from __future__ import annotations

import re
from typing import List, Tuple

from .models import Passage

# Savol bo'limi boshlanishini bildiruvchi belgilar (bulardan keyin passage tugaydi)
_QUESTION_MARKERS = re.compile(
    r"^\s*(questions?\s+\d+\s*[-–—]\s*\d+"
    r"|question\s+\d+"
    r"|choose\s+the\s+correct"
    r"|complete\s+the\s+(notes|summary|table|sentences|flow|diagram)"
    r"|do\s+the\s+following\s+statements"
    r"|which\s+(section|paragraph)"
    r"|list\s+of\s+headings"
    r"|write\s+(your\s+answers|no\s+more\s+than|one\s+word)"
    r"|match\s+each"
    r"|reading\s+passage\s+\d+\s+has"
    r")",
    re.IGNORECASE,
)

# Passage boshidagi ortiqcha sarlavhalarni tashlash
_HEADER_NOISE = re.compile(
    r"^\s*(reading\s+passage\s*\d*|part\s*\d+|passage\s*\d+"
    r"|you\s+should\s+spend\s+about|read\s+the\s+(text|passage)"
    r"|the\s+reading\s+passage\s+below)\b.*$",
    re.IGNORECASE,
)

# Paragraf harfi: "A", "A." "A)" satr boshida yolg'iz yoki qisqa
_PARA_LETTER = re.compile(r"^\s*([A-M])[\.\)]?\s+(?=[A-Z\"'])")


def split_passage_and_questions(text: str) -> Tuple[str, str]:
    """Matnni (passage_qismi, savol_qismi) ga ajratadi.

    Savol bo'limi topilmasa, hammasi passage deb qaytariladi.
    """
    lines = text.split("\n")
    cut = None
    for i, line in enumerate(lines):
        if _QUESTION_MARKERS.match(line):
            # Juda boshida bo'lsa (passage hali boshlanmagan) — e'tibor bermaymiz
            if i < 2:
                continue
            cut = i
            break
    if cut is None:
        return text.strip(), ""
    passage = "\n".join(lines[:cut]).strip()
    questions = "\n".join(lines[cut:]).strip()
    return passage, questions


def parse_passage(text: str, index: int = 1) -> Passage:
    """Toza passage matnidan `Passage` obyektini quradi."""
    text = text.strip()
    lines = [ln for ln in text.split("\n")]

    # 1) Boshdagi shovqin sarlavhalarni tashlab yuboramiz
    while lines and (not lines[0].strip() or _HEADER_NOISE.match(lines[0])):
        lines.pop(0)

    # 2) Title/subtitle aniqlash: birinchi qisqa, nuqtasiz qatorlar
    title = ""
    subtitle = ""
    if lines:
        first = lines[0].strip()
        if _looks_like_title(first):
            title = first
            lines.pop(0)
            # subtitle: keyingi qisqa, kursiv/izohsimon qator
            if lines:
                nxt = lines[0].strip()
                if nxt and _looks_like_subtitle(nxt):
                    subtitle = nxt
                    lines.pop(0)

    body = "\n".join(lines).strip()
    paragraphs, lettered = _paragraphs(body)

    return Passage(
        index=index,
        title=title,
        subtitle=subtitle,
        paragraphs=paragraphs,
        lettered=lettered,
    )


def _looks_like_title(line: str) -> bool:
    if not line or len(line) > 90:
        return False
    if line.endswith((".", ",", ":", ";")):
        return False
    # ko'p so'zli gap emas, sarlavhasimon
    return len(line.split()) <= 12


def _looks_like_subtitle(line: str) -> bool:
    if not line or len(line) > 160:
        return False
    # Odatda kursiv/izoh: nuqta bilan tugashi mumkin, lekin bitta jumla
    return line.count(".") <= 1 and len(line.split()) <= 24


def _paragraphs(body: str) -> Tuple[List[str], bool]:
    """Matnni paragraflarga bo'ladi va A/B/C belgilanishini aniqlaydi."""
    # Avval bo'sh qator bo'yicha bloklarni ajratamiz
    raw_blocks = re.split(r"\n\s*\n", body)
    blocks = [re.sub(r"\s*\n\s*", " ", b).strip() for b in raw_blocks]
    blocks = [b for b in blocks if b]

    # Agar bo'sh qatorlar yo'q bo'lsa (bitta katta blok), har bir qatorni
    # paragraf deb olamiz (fayl formatiga qarab).
    if len(blocks) <= 1:
        alt = [ln.strip() for ln in body.split("\n") if ln.strip()]
        if len(alt) > len(blocks):
            blocks = alt

    # Paragraf harflarini aniqlaymiz
    lettered = 0
    cleaned: List[str] = []
    for b in blocks:
        m = _PARA_LETTER.match(b)
        if m:
            lettered += 1
            cleaned.append(b[m.end():].strip())
        else:
            cleaned.append(b)

    is_lettered = lettered >= max(2, len(blocks) // 2)
    if is_lettered:
        # harflarni qayta biriktiramiz (A, B, C ...) tartib bo'yicha
        return cleaned, True
    return blocks, False
