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

# IELTS "ishchi yozuvlari" (rabochiy matn) — asl passage emas, olib tashlanadi
_BOILERPLATE = re.compile(
    r"^\s*\d{0,3}\s*("                          # oldida bet raqami bo'lishi mumkin: "1READING PASSAGE 2"
    r"reading\s+passage\b"                     # READING PASSAGE 2 (+ davomi)
    r"|part\s+\d+\s*$"
    r"|section\s+\d+\s*$"
    r"|you\s+should\s+spend\b"                 # "You should spend about 20 minutes..."
    r"|.*\bbased\s+on\s+reading\s+passage\b"   # wrap davomi: "...based on Reading Passage 2 below"
    r"|.*\bwhich\s+are\s+based\s+on\b"
    r"|reading\s+passage\s+\d+\s+has\b"        # "...has seven paragraphs A-G"
    r"|the\s+reading\s+passage\s+below\b"
    r"|turn\s+over\b"                          # "TURN OVER"
    r"|page\s+\d+\b"
    r"|\d{1,3}\s+of\s+\d{1,3}\s*$"
    r")",
    re.IGNORECASE,
)
# Harf-oralig'i (letter-spacing) uchun: "R E A D I N G  P A S S A G E  2" -> "readingpassage2"
_BOILERPLATE_DESPACED = re.compile(r"^\d{0,3}(readingpassage|passage|part|section)\d+$")
# Bet raqami: yolg'iz son ("3", "- 3 -", "• 3")
_PAGENUM = re.compile(r"^\s*[-–—•·|]*\s*\d{1,3}\s*[-–—•·|]*\s*$")
# URL / telegram / reklama yozuvlari
_URLISH = re.compile(r"(https?://|www\.\w|t\.me/|@[A-Za-z0-9_]{3,})", re.IGNORECASE)
# Izohli lug'at (footnote): qator boshida */**/*** + izoh. Reading passage'ning
# muhim qismi — junk emas, alohida saqlanadi va HTML pastida ko'rsatiladi.
_GLOSSARY_RE = re.compile(r"^\s*\*{1,3}\s*\S")


def _extract_glossary(text: str) -> Tuple[str, List[str]]:
    """Passage oxiridagi */** izohli lug'atni ajratib oladi.

    Birinchi */** bilan boshlangan qatordan oxirigacha — lug'at deb olinadi
    (matn ichida qator boshida * bo'lishi amalda uchramaydi). Davomi (yulduzchasiz)
    qatorlar oldingi izohga qo'shiladi. (matn_lug'atsiz, izohlar) qaytaradi.
    """
    lines = text.split("\n")
    start = None
    for i, ln in enumerate(lines):
        if _GLOSSARY_RE.match(ln):
            start = i
            break
    if start is None:
        return text, []
    body_lines = lines[:start]
    # Lug'atdan oldingi ajratuvchi chiziq (____/----) va bo'sh qatorlarni tashlaymiz
    while body_lines and (not body_lines[-1].strip()
                          or re.fullmatch(r"[_\-–—=.·•*\s]{3,}", body_lines[-1].strip())):
        body_lines.pop()
    body = "\n".join(body_lines).rstrip()
    entries: List[str] = []
    for ln in lines[start:]:
        s = ln.strip()
        if not s:
            continue
        if _GLOSSARY_RE.match(s):
            entries.append(s)
        elif entries:
            entries[-1] += " " + s
    return body, entries


def _is_boilerplate_line(s: str) -> bool:
    """Ishchi yozuv qatorimi? (harf-oralig'ini ham hisobga oladi)."""
    if _BOILERPLATE.match(s) or _PAGENUM.match(s):
        return True
    despaced = re.sub(r"[\s.:|·•–—-]+", "", s).lower()
    if len(despaced) <= 22 and _BOILERPLATE_DESPACED.match(despaced):
        return True
    return False


def strip_boilerplate(text: str) -> Tuple[str, List[str]]:
    """IELTS ishchi yozuvlari, bet raqamlari, takror kolontitul va URL'larni olib
    tashlaydi. (tozalangan_matn, ogohlantirishlar) qaytaradi."""
    lines = text.split("\n")
    counts: dict = {}
    for ln in lines:
        s = ln.strip()
        if s:
            counts[s] = counts.get(s, 0) + 1

    # 1-bosqich: qator darajasida — ishchi yozuvlar, bet raqami, URL, takror kolontitul
    out: List[str] = []
    warnings: List[str] = []
    for ln in lines:
        s = ln.strip()
        if not s:
            out.append("")
            continue
        if _is_boilerplate_line(s):
            continue
        if _URLISH.search(s):
            if "junk" not in warnings:
                warnings.append("junk")
            continue
        # Takrorlanuvchi qisqa qator = kolontitul (header/footer)
        if counts.get(s, 0) >= 2 and len(s) < 60 and not s.endswith((".", "!", "?", ":", ";", '"')):
            continue
        out.append(ln)

    intermediate = re.sub(r"\n{3,}", "\n\n", "\n".join(out)).strip()

    # 2-bosqich: blok darajasida — asl paragraf boshlangach, qisqa "furnitura"
    # bloklar (footer/watermark/section label) olib tashlanadi. Title/subtitle
    # (matn boshidagi qisqa bloklar) saqlanadi.
    blocks = re.split(r"\n\s*\n", intermediate)
    kept: List[str] = []
    seen_real = False
    for blk in blocks:
        b = blk.strip()
        if not b:
            continue
        is_real = len(b) > 60 or b.rstrip().endswith((".", "!", "?", '"', "”"))
        is_letter_marker = bool(re.match(r"^[A-M]([.\)]|\s|$)", b))
        # Asl kontentdan keyingi qisqa, BIR QATORLI, jumla bo'lmagan, harf-markeri
        # bo'lmagan blok = furnitura (footer/watermark/label) — olib tashlaymiz.
        if (seen_real and not is_real and len(b) < 50
                and "\n" not in b and not is_letter_marker):
            continue
        kept.append(b)
        if is_real:
            seen_real = True

    cleaned = "\n\n".join(kept).strip()
    return cleaned, warnings


def split_passage_and_questions(text: str) -> Tuple[str, str]:
    """Matnni (passage_qismi, savol_qismi) ga ajratadi.

    Savol bo'limi topilmasa, hammasi passage deb qaytariladi.
    """
    text, _ = strip_boilerplate(text)   # ishchi yozuvlar cut'ni chalg'itmasin
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


_PART_NO_RE = re.compile(r"reading\s+passage\s+(\d+)", re.IGNORECASE)


def parse_passage(text: str, index: int = 1) -> Passage:
    """Toza passage matnidan `Passage` obyektini quradi."""
    raw = text.strip()
    # "READING PASSAGE 2" / "...based on Reading Passage 2" -> part raqami
    m = _PART_NO_RE.search(re.sub(r"[\s.:|·•–—-]+", " ", raw))
    part_no = int(m.group(1)) if m else 0
    text, warnings = strip_boilerplate(raw)
    # Izohli lug'atni (footnote */**) ajratib olamiz — passage tanasidan chiqarib,
    # alohida saqlaymiz (HTML pastida ko'rsatiladi).
    text, glossary = _extract_glossary(text)
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

    if len("".join(paragraphs)) < 150 and "short" not in warnings:
        warnings.append("short")

    return Passage(
        index=index,
        part_no=part_no,
        title=title,
        subtitle=subtitle,
        paragraphs=paragraphs,
        lettered=lettered,
        warnings=warnings,
        glossary=glossary,
    )


def _looks_like_title(line: str) -> bool:
    if not line or len(line) > 90:
        return False
    if line.endswith((".", ",", ":", ";")):
        return False
    # Ishchi yozuvni sarlavha deb olmaymiz (himoya to'ri)
    if _is_boilerplate_line(line) or re.search(
            r"reading\s+passage|you\s+should\s+spend|questions?\s+\d", line, re.IGNORECASE):
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
    """Ketma-ket A, B, C... markerlari bo'yicha bo'ladi (>=3 marker bo'lsa).

    Markerlar satr boshida HAM, matn oqimi ichida HAM bo'lishi mumkin (PDF
    matni bir tekis oqim bo'lib chiqqanda). Bet raqami markerga yopishib
    qolgan bo'lsa ("2D The...") ham to'g'ri ajratadi.
    """
    flat = re.sub(r"\s+", " ", body).strip()
    if not flat:
        return None
    # (cut, text_start): cut — markerdan oldingi kesim joyi; text_start — paragraf matni boshi
    markers: List[Tuple[int, int]] = []
    expected = ord("A")
    pos = 0
    while expected <= ord("M"):
        letter = re.escape(chr(expected))
        # (bosh|bo'shliq) + ixtiyoriy bet raqami + MARKER + ixtiyoriy [.)] +
        # bo'shliq(lar) + katta harf/raqam/qo'shtirnoq (paragraf boshi)
        pat = re.compile(
            r"(?:^|\s)\d{0,3}" + letter + r"[.\)]?\s+(?=[\"'‘“(A-Z0-9])")
        m = pat.search(flat, pos)
        if not m:
            break
        markers.append((m.start(), m.end()))
        pos = m.end()
        expected += 1
    if len(markers) < 3:
        return None
    paras: List[str] = []
    for i, (_cut, tstart) in enumerate(markers):
        tend = markers[i + 1][0] if i + 1 < len(markers) else len(flat)
        seg = flat[tstart:tend].strip()
        if seg:
            paras.append(seg)
    return paras if len(paras) >= 3 else None


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
