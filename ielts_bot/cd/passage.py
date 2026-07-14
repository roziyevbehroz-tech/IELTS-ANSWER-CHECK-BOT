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
    # Lettered paragraf markeri (A, B, ...) subtitle emas — paragrafni yutmaslik
    if re.match(r"^[A-M][.\)]?\s+", line):
        return False
    # Odatda kursiv/izoh: nuqta bilan tugashi mumkin, lekin bitta jumla
    return line.count(".") <= 1 and len(line.split()) <= 24


def _paragraphs(body: str) -> Tuple[List[str], bool]:
    """Matnni paragraflarga bo'ladi va A/B/C belgilanishini aniqlaydi.

    Qattiq o'ralgan (har qatorda `\\n`, bo'sh qatorsiz) matnni ham to'g'ri
    tiklaydi — har qatorni alohida paragraf qilib yubormaydi.
    """
    # 1) Lettered paragraflar (A, B, C ...) — bo'sh qatorli yoki qatorsiz
    lettered = _try_lettered_split(body)
    if lettered is not None:
        return lettered, True

    # 2) Bo'sh qator bilan ajratilgan bloklar (ichki o'ralishni yoyamiz)
    raw_blocks = re.split(r"\n\s*\n", body)
    blocks = [re.sub(r"\s*\n\s*", " ", b).strip() for b in raw_blocks]
    blocks = [b for b in blocks if b]
    if len(blocks) >= 2:
        return blocks, False

    # 3) Bo'sh qatorsiz, qattiq o'ralgan yagona blok — yoyib, mazmunli
    # paragraflarga bo'lamiz (gap chegarasida).
    flat = re.sub(r"\s+", " ", body).strip()
    return _chunk_paragraphs(flat), False


def _try_lettered_split(body: str) -> List[str] | None:
    """Ketma-ket A, B, C... markerlari bo'yicha bo'ladi (>=3 marker bo'lsa)."""
    paras: List[str] = []
    cur = ""
    count = 0
    expected = "A"
    for raw in body.split("\n"):
        s = raw.strip()
        if not s:
            continue
        m = re.match(r"^([A-M])[.\)]?\s+(.+)", s)
        if m and m.group(1) == expected:
            if cur:
                paras.append(cur.strip())
            cur = m.group(2)
            count += 1
            expected = chr(ord(expected) + 1)
        else:
            cur = (cur + " " + s) if cur else s
    if cur:
        paras.append(cur.strip())
    return paras if count >= 3 else None


def _chunk_paragraphs(flat: str) -> List[str]:
    """Yoyilgan matnni ~450+ belgidan iborat paragraflarga bo'ladi."""
    sentences = re.findall(r"[^.!?]*[.!?]+[\"')\]]*\s*|[^.!?]+$", flat)
    if not sentences:
        sentences = [flat]
    paras: List[str] = []
    cur = ""
    for s in sentences:
        cur += s
        if len(cur.strip()) >= 450:
            paras.append(cur.strip())
            cur = ""
    if cur.strip():
        paras.append(cur.strip())
    return paras if paras else [flat]
