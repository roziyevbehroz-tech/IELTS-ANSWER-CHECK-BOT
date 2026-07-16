"""IELTS savollarini parse qilish — AI'siz.

Ikki rejim:
  1) Shablon-grammatika (ishonchli): har bir blok `[type] start-end | options`
     sarlavhasi bilan boshlanadi. Bot foydalanuvchiga aniq shablon beradi.
  2) Auto-aniqlash: agar `[type]` belgilar topilmasa, toza IELTS matnidan
     savol turlarini standart yo'riqnoma jumlalari bo'yicha taniydi.

Barcha 14 tur qo'llab-quvvatlanadi (models.TYPE_TO_KIND ga qarang).
"""

from __future__ import annotations

import re
from typing import Dict, List, Optional, Tuple

from .models import Item, QuestionGroup

# Foydalanuvchi yozishi mumkin bo'lgan nomlar -> kanonik tur
_TYPE_ALIASES: Dict[str, str] = {
    "note": "note", "notes": "note",
    "summary": "summary",
    "sentence": "sentence", "sentences": "sentence",
    "table": "table",
    "flow": "flowchart", "flowchart": "flowchart", "flow-chart": "flowchart",
    "short": "shortanswer", "shortanswer": "shortanswer", "saq": "shortanswer",
    "diagram": "diagram", "label": "diagram",
    "tfng": "tfng", "tf": "tfng", "truefalse": "tfng", "identifying": "tfng",
    "ynng": "ynng", "yn": "ynng", "yesno": "ynng",
    "mcq": "mcq", "choice": "mcq", "multiplechoice": "mcq", "mc": "mcq",
    "mcq2": "mcq_multi", "mcqmulti": "mcq_multi", "multi": "mcq_multi",
    "choosetwo": "mcq_multi", "mcq_multi": "mcq_multi",
    "headings": "headings", "heading": "headings",
    "matching_info": "matching_info", "matchinfo": "matching_info",
    "paragraph": "matching_info", "whichparagraph": "matching_info",
    "whichsection": "matching_info", "info": "matching_info",
    "match": "matching_features", "matching": "matching_features",
    "features": "matching_features", "people": "matching_features",
    "matching_features": "matching_features",
}

GAP_KINDS = {"note", "summary", "sentence", "table", "flowchart",
             "shortanswer", "diagram"}

# Blok sarlavhasi:  [tfng] 8-13   yoki  [matching_info] 14-18 | A-F
_BLOCK_RE = re.compile(
    r"^\s*\[\s*([a-zA-Z_\-]+)\s*\]\s*"
    r"(?:(\d+)\s*[-–—]\s*(\d+))?\s*"
    r"(?:\|\s*(.+))?\s*$"
)
# Matnda blok belgilari bor-yo'qligini aniqlash (har qanday qatorda)
_BLOCK_HINT = re.compile(r"^\s*\[[a-zA-Z_\-]+\]", re.MULTILINE)

_NUM_LINE = re.compile(r"^\s*(\d{1,3})\s*[\.\)\:]?\s+(.*)$")
_OPT_LINE = re.compile(r"^\s*([A-Z])\s*[\.\)]\s+(.+)$")           # A) text / A. text
_OPT_LINE_LOOSE = re.compile(r"^\s*([A-Z])\s+(\S.*)$")            # A text
_ROMAN_LINE = re.compile(
    r"^\s*(x{0,3}(?:ix|iv|v?i{0,3}))\s*[\.\)]?\s+(.+)$", re.IGNORECASE)
_QUESTIONS_HDR = re.compile(
    r"questions?\s+(\d+)\s*(?:[-–—]|and|&|,)\s*(\d+)", re.IGNORECASE)
# Blok chegarasini faqat qator BOSHIDAGI "Questions X-Y" bilan aniqlaymiz
# (yo'riqnoma ichidagi "...next to questions 11-13" soxta bo'linishga sabab bo'lmasin)
_QUESTIONS_HDR_LINE = re.compile(
    r"^\s*questions?\s+(\d+)\s*(?:[-–—]|and|&|,)\s*(\d+)", re.IGNORECASE)
_INSTRUCTION_RE = re.compile(
    r"^\s*(complete|choose|write|do the following|match|label|answer|which|"
    r"the (text|passage|reading)|look at|reading passage|list of headings|"
    r"nb\b|classify|select)",
    re.IGNORECASE)

# gap belgilari — chiziqcha, ASCII nuqtalar, Unicode ellipsis (… ‥ ․ · •)
_GAP_ANY = r"(?:_{2,}|…+|\.{4,}|[…․‥·•‧]{2,})"
_GAP_EXPLICIT = re.compile(r"\{\s*(\d{1,3})\s*\}")
_GAP_NUMBERED = re.compile(r"(\d{1,3})\s*(?:" + _GAP_ANY + r")")
_GAP_BARE = re.compile(_GAP_ANY)


# =========================================================================
#  Umumiy kirish
# =========================================================================

def parse_questions(text: str, para_count: int = 0) -> List[QuestionGroup]:
    """Matndan savol bloklarini qaytaradi.

    `para_count` — passage paragraflari soni (matching options'ni inferlash uchun).
    """
    text = (text or "").strip()
    if not text:
        return []
    if _BLOCK_HINT.search(text):
        groups = _parse_blocks(text, para_count)
        if groups:
            return groups
    return _auto_detect(text, para_count)


# =========================================================================
#  Shablon-grammatika
# =========================================================================

def _parse_blocks(text: str, para_count: int) -> List[QuestionGroup]:
    lines = text.split("\n")
    blocks: List[Tuple[str, Optional[int], Optional[int], str, List[str]]] = []
    cur = None
    for line in lines:
        m = _BLOCK_RE.match(line)
        if m:
            qtype = _TYPE_ALIASES.get(_norm_type(m.group(1)))
            if not qtype:
                # noma'lum tur — matn qatori sifatida qoldiramiz
                if cur:
                    cur[4].append(line)
                continue
            start = int(m.group(2)) if m.group(2) else None
            end = int(m.group(3)) if m.group(3) else None
            opts = (m.group(4) or "").strip()
            cur = (qtype, start, end, opts, [])
            blocks.append(cur)
        elif cur is not None:
            cur[4].append(line)
    groups = []
    for qtype, start, end, opts, body_lines in blocks:
        g = _build_group(qtype, start, end, opts, body_lines, para_count)
        if g:
            groups.append(g)
    return groups


def _norm_type(raw: str) -> str:
    return raw.strip().lower().replace("-", "").replace("_", "") \
        if raw else ""


# _TYPE_ALIASES kalitlarini normalizatsiya qilib qayta indekslaymiz
_TYPE_ALIASES = {
    k.replace("-", "").replace("_", ""): v for k, v in _TYPE_ALIASES.items()
}


def _build_group(qtype, start, end, opts_str, body_lines, para_count):
    body_lines = list(body_lines)
    instructions, rest = _split_instructions(body_lines)

    # Range aniqlash
    if start is None or end is None:
        hdr = _QUESTIONS_HDR.search(instructions)
        if hdr:
            start, end = int(hdr.group(1)), int(hdr.group(2))

    kind = qtype
    if kind in GAP_KINDS:
        # Diagram box-variant: "Choose ... from the box A-E" — variant qutisini ajratamiz
        if qtype == "diagram":
            opts = _collect_options(rest)
            if len(opts) >= 3 and opts[0][0] == "A":
                non_opt = [ln for ln in rest if not _looks_like_option(ln)]
                g = _build_gap(qtype, start, end, instructions, non_opt)
                if g:
                    g.options = opts
                    g.options_title = "Options"
                return g
        return _build_gap(qtype, start, end, instructions, rest)
    if kind in ("tfng", "ynng"):
        return _build_statements(qtype, start, end, instructions, rest)
    if kind == "mcq":
        return _build_mcq(qtype, start, end, instructions, rest)
    if kind == "mcq_multi":
        return _build_mcq_multi(qtype, start, end, instructions, rest, opts_str)
    if kind == "headings":
        return _build_headings(qtype, start, end, instructions, rest)
    if kind in ("matching_info", "matching_features"):
        return _build_matching(qtype, start, end, instructions, rest,
                               opts_str, para_count)
    return None


def _split_instructions(body_lines: List[str]) -> Tuple[str, List[str]]:
    """Bosidagi yo'riqnoma qatorlarini rest'dan ajratadi."""
    instr = []
    i = 0
    for i, line in enumerate(body_lines):
        s = line.strip()
        if not s:
            if instr:
                i += 1
                break
            continue
        if _NUM_LINE.match(s) or _OPT_LINE.match(s) or _ROMAN_LINE.match(s):
            break
        if _INSTRUCTION_RE.match(s) or _QUESTIONS_HDR.search(s) or not instr:
            instr.append(s)
        else:
            break
    else:
        i = len(body_lines)
    return " ".join(instr).strip(), body_lines[i:]


# --------------------------- gap (completion) ---------------------------

def _build_gap(qtype, start, end, instructions, body_lines) -> QuestionGroup:
    body = "\n".join(body_lines).strip()
    title = ""
    lines = body.split("\n")
    # birinchi qator gap'siz qisqa sarlavha bo'lsa — title
    if lines and lines[0].strip() and not _has_gap(lines[0]) \
            and len(lines[0].split()) <= 8 and not lines[0].strip().startswith(("-", "•", "*", "|")):
        title = lines[0].strip()
        lines = lines[1:]
    body = "\n".join(lines).strip()
    normalized, numbers = _normalize_gaps(body, start)
    if start is None and numbers:
        start = min(numbers)
    if end is None and numbers:
        end = max(numbers)
    start = start or (min(numbers) if numbers else 1)
    end = end or (max(numbers) if numbers else start)
    g = QuestionGroup(qtype=qtype, start=start, end=end,
                     instructions=instructions, body=normalized, title=title)
    g.items = [Item(number=n) for n in numbers]
    return g


def _has_gap(line: str) -> bool:
    return bool(_GAP_EXPLICIT.search(line) or _GAP_BARE.search(line))


def _normalize_gaps(body: str, start: Optional[int]) -> Tuple[str, List[int]]:
    """Barcha gap belgilarini `{{Q<N>}}` tokeniga aylantiradi.

    Tartib: aniq `{N}` -> "N ....." (raqam-oldida) -> qolgan bo'sh joylar ketma-ket.
    Chiziqcha, ASCII nuqtalar va Unicode ellipsis (…) qo'llab-quvvatlanadi.
    """
    numbers: List[int] = []

    # 1) Aniq {N}
    def repl_explicit(m):
        n = int(m.group(1))
        numbers.append(n)
        return f"{{{{Q{n}}}}}"

    body = _GAP_EXPLICIT.sub(repl_explicit, body)

    # 2) "N ....." — raqam gap oldida (summary completion odatda shunday)
    def repl_numbered(m):
        n = int(m.group(1))
        numbers.append(n)
        return f"{n} {{{{Q{n}}}}}"

    body = _GAP_NUMBERED.sub(repl_numbered, body)

    # 3) Qolgan bo'sh joylar — ketma-ket
    counter = {"n": (max(numbers) + 1) if numbers else (start or 1)}

    def repl_seq(m):
        n = counter["n"]
        counter["n"] += 1
        numbers.append(n)
        return f"{{{{Q{n}}}}}"

    body = _GAP_BARE.sub(repl_seq, body)

    numbers = sorted(set(numbers))
    return body, numbers


# --------------------- statements (TFNG / YNNG) -------------------------

def _build_statements(qtype, start, end, instructions, body_lines):
    items = _collect_numbered(body_lines)
    if not items:
        return None
    start = start or items[0].number
    end = end or items[-1].number
    return QuestionGroup(qtype=qtype, start=start, end=end,
                        instructions=instructions, items=items)


def _collect_numbered(body_lines: List[str]) -> List[Item]:
    """`1. matn` qatorlarini yig'adi (ko'p qatorli matnni ham biriktiradi).

    PDF elementlarni yopishtirib qo'ygan bo'lsa ("Corpe Nove2 Nexia...") —
    ketma-ket raqamli glued-splitter bilan ajratadi.
    """
    items: List[Item] = []
    for line in body_lines:
        s = line.strip()
        if not s:
            continue
        m = _NUM_LINE.match(s)
        if m:
            items.append(Item(number=int(m.group(1)), text=m.group(2).strip()))
        elif items:
            # oldingi item matnining davomi
            items[-1].text = (items[-1].text + " " + s).strip()
    # Yopishgan ro'yxat: bitta "element" ichida yana ketma-ket raqamlar bo'lsa
    if len(items) <= 1:
        joined = " ".join(ln.strip() for ln in body_lines if ln.strip())
        glued = _split_glued_numbers(joined)
        if glued and len(glued) > len(items):
            return glued
    return items


def _split_glued_numbers(text: str) -> Optional[List[Item]]:
    """Ketma-ket raqamli elementlarni (yopishgan bo'lsa ham) ajratadi.

    "1. Corpe Nove2 Nexia Biotechnologies3 Nano-Tex..." -> [1:..., 2:..., 3:...]
    Kamida 3 ketma-ket raqam bo'lsa qaytaradi (soxta mos kelishning oldini olish).
    """
    flat = re.sub(r"\s+", " ", text or "").strip()
    if not flat:
        return None
    first = re.search(r"(?:^|\s)(\d{1,3})[.\):]?\s+\S", flat)
    if not first:
        return None
    expected = int(first.group(1))
    markers: List[Tuple[int, int, int]] = []
    pos = 0
    while expected <= 999:
        # (bosh|bo'shliq|kichik/katta harf|punktuatsiya) + RAQAM + (keyingi raqam emas)
        pat = re.compile(
            r"(?:^|(?<=[\sA-Za-z,;.:\)\-]))" + str(expected)
            + r"(?!\d)[.\):]?\s+(?=\S)")
        m = pat.search(flat, pos)
        if not m:
            break
        markers.append((m.start(), m.end(), expected))
        pos = m.end()
        expected += 1
    if len(markers) < 3:
        return None
    out: List[Item] = []
    for i, (_cut, tstart, num) in enumerate(markers):
        tend = markers[i + 1][0] if i + 1 < len(markers) else len(flat)
        out.append(Item(number=num, text=flat[tstart:tend].strip()))
    return out


def _split_glued_options(text: str) -> List[Tuple[str, str]]:
    """Ketma-ket A, B, C... variantlarni (yopishgan bo'lsa ham) ajratadi.

    "A material ... coolerB clothing ... natureH clothes ..." ->
    [(A,...),(B,...),...,(H,...)]. Kamida 3 ketma-ket harf talab qilinadi.
    """
    flat = re.sub(r"\s+", " ", text or "").strip()
    if not flat:
        return []
    markers: List[Tuple[int, int]] = []
    code = ord("A")
    pos = 0
    while code <= ord("Z"):
        letter = chr(code)
        # (bosh|bo'shliq|kichik harf|punktuatsiya) + HARF + ixtiyoriy [.)] + bo'shliq + kontent
        pat = re.compile(
            r"(?:^|(?<=[\sa-z,;.:\)\-]))" + letter + r"[.\)]?\s+(?=\S)")
        m = pat.search(flat, pos)
        if not m:
            break
        markers.append((m.start(), m.end()))
        pos = m.end()
        code += 1
    if len(markers) < 3:
        return []
    out: List[Tuple[str, str]] = []
    for i, (_cut, tstart) in enumerate(markers):
        tend = markers[i + 1][0] if i + 1 < len(markers) else len(flat)
        out.append((chr(ord("A") + i), flat[tstart:tend].strip()))
    return out


# ------------------------------- MCQ ------------------------------------

def _build_mcq(qtype, start, end, instructions, body_lines):
    items = _collect_mcq_items(body_lines)
    if not items:
        return None
    start = start or items[0].number
    end = end or items[-1].number
    return QuestionGroup(qtype=qtype, start=start, end=end,
                        instructions=instructions, items=items)


def _collect_mcq_items(body_lines: List[str]) -> List[Item]:
    items: List[Item] = []
    cur: Optional[Item] = None
    for line in body_lines:
        s = line.strip()
        if not s:
            continue
        mnum = _NUM_LINE.match(s)
        mopt = _OPT_LINE.match(s) or _OPT_LINE_LOOSE.match(s)
        # Raqam qatori — yangi savol (lekin variant harfi emasligiga ishonch)
        if mnum and not (mopt and cur and len(cur.options) < 2):
            cur = Item(number=int(mnum.group(1)), text=mnum.group(2).strip())
            items.append(cur)
        elif mopt and cur is not None:
            cur.options.append((mopt.group(1).upper(), mopt.group(2).strip()))
        elif cur is not None and not cur.options:
            cur.text = (cur.text + " " + s).strip()
    return [it for it in items if it.options]


def _build_mcq_multi(qtype, start, end, instructions, body_lines, opts_str):
    # Ko'p tanlovli: umumiy variantlar (A-E), start-end oralig'i necha javob
    options = _collect_options(body_lines)
    if not options:
        return None
    # stem = birinchi non-option instruktivdan keyingi savol matni
    stem_lines = []
    for line in body_lines:
        s = line.strip()
        if not s or _OPT_LINE.match(s) or _OPT_LINE_LOOSE.match(s):
            continue
        stem_lines.append(s)
    stem = " ".join(stem_lines).strip()
    start = start or 1
    end = end or start
    g = QuestionGroup(qtype=qtype, start=start, end=end,
                     instructions=(instructions + " " + stem).strip(),
                     options=options)
    g.items = [Item(number=n) for n in range(start, end + 1)]
    return g


# ---------------------------- headings ----------------------------------

def _build_headings(qtype, start, end, instructions, body_lines):
    headings: List[tuple] = []
    items: List[Item] = []
    in_list = False
    for line in body_lines:
        s = line.strip()
        if not s:
            continue
        if re.match(r"^list of headings", s, re.IGNORECASE):
            in_list = True
            continue
        rm = _ROMAN_LINE.match(s)
        nm = _NUM_LINE.match(s)
        if nm:
            in_list = False
            items.append(Item(number=int(nm.group(1)), text=nm.group(2).strip()))
        elif rm and not nm:
            headings.append((rm.group(1).lower(), rm.group(2).strip()))
            in_list = True
    if not items:
        return None
    start = start or items[0].number
    end = end or items[-1].number
    g = QuestionGroup(qtype=qtype, start=start, end=end,
                     instructions=instructions, items=items,
                     options=headings, options_title="List of Headings")
    return g


# ---------------------- matching (info / features) ----------------------

def _build_matching(qtype, start, end, instructions, body_lines, opts_str,
                    para_count):
    options = _collect_options(body_lines)
    items = _collect_numbered(
        [ln for ln in body_lines
         if not (_OPT_LINE.match(ln.strip()) or _looks_like_option(ln))]
    )
    # Agar variantlar body ichida bo'lmasa — opts_str yoki paragraf sonidan
    if not options:
        options = _options_from_spec(opts_str, para_count)
    if not items:
        return None
    start = start or items[0].number
    end = end or items[-1].number
    title = "People" if qtype == "matching_features" else ""
    return QuestionGroup(qtype=qtype, start=start, end=end,
                        instructions=instructions, items=items,
                        options=options, options_title=title)


def _collect_options(body_lines: List[str]) -> List[tuple]:
    opts: List[tuple] = []
    opt_line_texts: List[str] = []
    for line in body_lines:
        s = line.strip()
        m = _OPT_LINE.match(s) or _OPT_LINE_LOOSE.match(s)
        if m:
            opts.append((m.group(1).upper(), m.group(2).strip()))
            opt_line_texts.append(s)
    # Yopishgan variantlar: bitta "A ..." qatori ichida yana B, C, D... bo'lsa.
    # Faqat variant-simon qatorlarni birlashtiramiz (raqamli elementlar emas).
    if len(opts) <= 1 and opt_line_texts:
        glued = _split_glued_options(" ".join(opt_line_texts))
        if len(glued) > len(opts):
            return glued
    return opts


def _looks_like_option(line: str) -> bool:
    s = line.strip()
    return bool(_OPT_LINE.match(s) or _OPT_LINE_LOOSE.match(s))


def _options_from_spec(spec: str, para_count: int) -> List[tuple]:
    """`A-F` yoki `A,B,C` spetsifikatsiyasidan yoki paragraf sonidan variantlar."""
    spec = (spec or "").strip()
    m = re.match(r"^([A-Z])\s*[-–—]\s*([A-Z])$", spec)
    if m:
        lo, hi = ord(m.group(1).upper()), ord(m.group(2).upper())
        return [(chr(c), "") for c in range(lo, hi + 1)]
    if spec:
        letters = [x.strip().upper() for x in re.split(r"[,\s]+", spec)
                   if x.strip()]
        letters = [x for x in letters if len(x) == 1 and x.isalpha()]
        if letters:
            return [(x, "") for x in letters]
    if para_count:
        return [(chr(ord("A") + i), "") for i in range(min(para_count, 13))]
    return [(chr(ord("A") + i), "") for i in range(7)]  # A-G default


# =========================================================================
#  Auto-aniqlash (toza Cambridge matni uchun)
# =========================================================================

def _auto_detect(text: str, para_count: int) -> List[QuestionGroup]:
    """`[type]` belgilarsiz matndan bloklarni ajratadi.

    "Questions X-Y" sarlavhalari bo'yicha bo'laklarga bo'lib, har biriga
    yo'riqnoma jumlasidan tur tayinlaydi.
    """
    lines = text.split("\n")
    # bo'laklarni faqat qator boshidagi "Questions X-Y" bo'yicha ajratamiz
    idxs = [i for i, ln in enumerate(lines) if _QUESTIONS_HDR_LINE.match(ln)]
    groups: List[QuestionGroup] = []
    if not idxs:
        # yagona blok — turini aniqlab ko'ramiz
        g = _auto_one(text, None, None, para_count)
        return [g] if g else []
    idxs.append(len(lines))
    for a, b in zip(idxs, idxs[1:]):
        chunk = "\n".join(lines[a:b]).strip()
        hdr = _QUESTIONS_HDR.search(chunk)
        start, end = (int(hdr.group(1)), int(hdr.group(2))) if hdr else (None, None)
        g = _auto_one(chunk, start, end, para_count)
        if g:
            groups.append(g)
    return groups


def _detect_qtype(chunk: str, low: str) -> str:
    """Yo'riqnoma matnidan IELTS Reading savol turini aniqlaydi.

    Barcha 14 turni va ularning har xil yozilish ko'rinishlarini qamraydi.
    Tartib muhim — eng aniq (spetsifik) belgilar birinchi tekshiriladi.
    """
    # --- Struktura-belgili turlar (eng aniq — birinchi) ---
    # Bular "choose two/three" (variant qutili) bo'lsa ham o'z turida qoladi.
    if re.search(r"complete the flow[\s-]*chart|flow[\s-]*chart below", low):
        return "flowchart"
    if "label the diagram" in low or ("label the" in low and "diagram" in low) \
            or "label the plan" in low or "label the map" in low:
        return "diagram"
    if "complete the table" in low:
        return "table"
    # --- True/False/Not Given (identifying information) ---
    if ("not given" in low
            and ("true" in low or "false" in low)
            and not ("yes" in low and "no" in low and "claim" in low)):
        if "true" in low and "false" in low:
            return "tfng"
    # --- Yes/No/Not Given (writer's claims/views) ---
    if "not given" in low and re.search(r"\byes\b", low) and re.search(r"\bno\b", low):
        return "ynng"
    if re.search(r"claims?\s+of\s+the\s+writer|views?\s+of\s+the\s+writer", low):
        return "ynng"
    # --- Matching Headings ---
    if ("list of headings" in low or "choose the correct heading" in low
            or re.search(r"suitable heading|appropriate heading", low)
            or (("heading" in low) and re.search(r"paragraph[s]?\s+[a-k]", low))):
        return "headings"
    # --- Matching Paragraph Information ---
    if re.search(r"which (section|paragraph)", low) or re.search(
            r"in which paragraph|paragraph contains|paragraph mentions"
            r"|paragraph refers", low):
        return "matching_info"
    # --- Matching Features / Classification (match X with Y, classify...) ---
    if re.search(
            r"match each|match the following"
            r"|classify (the|each|these|those|them)|classify the following"
            r"|belong(s|ing)?\s+to"
            r"|list of (people|researchers|names|companies|scientists|"
            r"places|dates|options|statements|inventions|theories)"
            r"|correct ending|from the (box|list) below"
            r"|look at the following list"
            r"|match(ing)? .* (with|to) .* (person|people|option|feature|"
            r"category|group|company|researcher)", low):
        return "matching_features"
    # --- Multiple choice II (TWO/THREE answers) ---
    if re.search(r"choose\s+(two|three|four|2|3|4)\b", low):
        return "mcq_multi"
    # --- Multiple choice I (single answer) ---
    if (re.search(r"choose the correct (letter|answer|option)", low)
            or re.search(r"\b[a-d],\s*[a-d],?\s*[a-d]\s*(or|,)\s*[a-d]\b", low)
            or re.search(r"^\s*[A-E][.\)]\s+\S", chunk, re.MULTILINE)):
        return "mcq"
    # --- gap-completion turlari ---
    if "complete the notes" in low or "complete the note" in low:
        return "note"
    if "complete the summary" in low:
        return "summary"
    if re.search(r"answer the questions|write no more than", low) and not _has_gap(chunk):
        return "shortanswer"
    if "complete the sentences" in low or "complete each sentence" in low:
        return "sentence"
    # --- oxirgi chora: gap bo'lsa note, aks holda sentence ---
    if _has_gap(chunk):
        return "note"
    return "sentence"


def _auto_one(chunk: str, start, end, para_count) -> Optional[QuestionGroup]:
    low = chunk.lower()
    body_lines = chunk.split("\n")
    qtype = _detect_qtype(chunk, low)

    # _build_group o'zi yo'riqnomani ajratadi — bu yerda oldindan split qilmaymiz
    # (aks holda birinchi variant/element yo'qoladi).
    return _build_group(qtype, start, end, "", body_lines, para_count)
