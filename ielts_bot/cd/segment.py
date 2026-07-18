"""Universal fayl/matn ajratkich — AI'siz.

Bir fayl (yoki matn) ichida passage + savol + javob kaliti aralash kelishi mumkin.
Ba'zan bitta faylda 3 tagacha passage ketma-ket keladi (1text-1savol,
2text-2savol, 3text-3savol). Bu modul o'sha aralash matndan:

  * passage(lar)ni topadi va ajratadi,
  * har passagega tegishli savol bloklarini parse qiladi,
  * agar bo'lsa, javob kalitini ("Answer key" / "Answers") ajratib oladi.

Topa olmasa — `note` maydonida ochiq aytadi (bot userga qayta yuborishni yoki
qismlarni alohida yuborishni taklif qiladi).
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import Dict, List, Optional, Tuple

from .models import Passage, QuestionGroup
from .passage import (
    _QUESTION_MARKERS,
    parse_passage,
    split_passage_and_questions,
    strip_boilerplate,
)
from .questions import _NUM_LINE, parse_questions
from .answers import parse_answer_key


@dataclass
class Segment:
    """Bitta passage + unga tegishli savol bloklari."""

    passage: Passage
    groups: List[QuestionGroup] = field(default_factory=list)


@dataclass
class Segmentation:
    """Ajratish natijasi."""

    segments: List[Segment] = field(default_factory=list)
    answer_key: Dict[int, str] = field(default_factory=dict)
    warnings: List[str] = field(default_factory=list)
    note: str = "ok"          # ok | no_questions | no_passage | empty


# "Answer key" / "Answers" / "Javoblar" sarlavhasi (yolg'iz qator)
_ANSWER_HEADER = re.compile(
    r"^\s*(answer\s*keys?|answers?|key\s*answers?"
    r"|javob(?:lar)?(?:\s*kaliti)?|kalit(?:lar)?)\s*[:.\-]?\s*$",
    re.IGNORECASE,
)

# "READING PASSAGE N" sarlavhasi (oldida bet raqami bo'lishi mumkin)
_PASSAGE_HDR = re.compile(r"^\s*\d{0,3}\s*reading\s+passage\s+\d+\b", re.IGNORECASE)
# Harf-oralig'i: "R E A D I N G  P A S S A G E  2"
_PASSAGE_HDR_DESPACED = re.compile(r"^\d{0,3}readingpassage\d+$")


def _is_passage_header(line: str) -> bool:
    if _PASSAGE_HDR.match(line):
        return True
    despaced = re.sub(r"[\s.:|·•–—-]+", "", line).lower()
    return len(despaced) <= 22 and bool(_PASSAGE_HDR_DESPACED.match(despaced))


def _split_off_answer_key(text: str) -> Tuple[str, str]:
    """Matn oxiridagi "Answer key" bo'limini ajratadi. (asosiy, kalit_matni)."""
    lines = text.split("\n")
    # Oxirgi "Answer key" sarlavhasini topamiz (odatda eng oxirida)
    hdr = None
    for i, ln in enumerate(lines):
        if _ANSWER_HEADER.match(ln):
            hdr = i
    if hdr is None or hdr < 2:
        return text, ""
    body = "\n".join(lines[:hdr]).strip()
    key = "\n".join(lines[hdr + 1:]).strip()
    return body, key


def _passage_regions(body: str) -> List[str]:
    """Matnni passage-hududlariga bo'ladi (marker yoki aralash prose bo'yicha)."""
    lines = body.split("\n")
    # 1) Aniq "READING PASSAGE N" markerlari
    marker_idx = [i for i, ln in enumerate(lines) if _is_passage_header(ln)]
    if len(marker_idx) >= 2:
        bounds = marker_idx + [len(lines)]
        regions = []
        # birinchi markergacha kirish bo'lsa (kamdan-kam) — tashlab yuboramiz
        for a, b in zip(bounds, bounds[1:]):
            seg = "\n".join(lines[a:b]).strip()
            if seg:
                regions.append(seg)
        if len(regions) >= 2:
            return regions
    # 2) Markersiz aralash: prose <-> savol almashinuvi bo'yicha
    inter = _interleaved_regions(lines)
    if len(inter) >= 2:
        return inter
    # 3) Yagona hudud
    return [body]


def _interleaved_regions(lines: List[str]) -> List[str]:
    """Markersiz aralash matnni (1text-1savol, 2text-2savol...) hududlarga bo'ladi.

    Har bir savol bloki (Questions X-Y) dan keyin kelgan uzun prose bloki —
    yangi passage boshlanishi deb qabul qilinadi.
    """
    q_idx = [i for i, ln in enumerate(lines) if _QUESTION_MARKERS.match(ln)]
    if len(q_idx) < 2:
        return [""]
    boundaries = [0]
    for a, b in zip(q_idx, q_idx[1:]):
        seg = lines[a + 1:b]
        rel = _find_prose_block_start(seg)
        if rel is not None:
            boundaries.append(a + 1 + rel)
    boundaries.append(len(lines))
    regions = []
    for x, y in zip(boundaries, boundaries[1:]):
        r = "\n".join(lines[x:y]).strip()
        if r:
            regions.append(r)
    return regions if len(regions) >= 2 else [""]


def _find_prose_block_start(seg: List[str]) -> Optional[int]:
    """savol-blok ichida yangi passage prose'i boshlanadigan joyni topadi."""
    n = len(seg)
    i = 0
    pending_title: Optional[int] = None   # prose oldidan kelgan qisqa sarlavha
    while i < n:
        if not seg[i].strip():
            i += 1
            continue
        if _QUESTION_MARKERS.match(seg[i]):
            return None
        j = i
        block = []
        while j < n and seg[j].strip() and not _QUESTION_MARKERS.match(seg[j]):
            block.append(seg[j])
            j += 1
        text = " ".join(x.strip() for x in block)
        numbered = sum(1 for x in block if _NUM_LINE.match(x.strip()))
        # uzun, raqamli qatorlar kam bo'lgan blok — passage prose'i
        if len(text) > 250 and numbered <= max(1, len(block)) * 0.3:
            return pending_title if pending_title is not None else i
        # qisqa, raqamsiz blok — passage sarlavhasi bo'lishi mumkin
        if len(block) <= 2 and len(text) <= 90 and numbered == 0:
            pending_title = i
        else:
            pending_title = None
        i = j + 1
    return None


def segment_material(text: str) -> Segmentation:
    """Aralash matndan passage(lar) + savol + javob kalitini ajratadi."""
    text = (text or "").strip()
    if not text:
        return Segmentation(note="empty")

    body, key_text = _split_off_answer_key(text)
    answer_key = parse_answer_key(key_text) if key_text else {}

    regions = _passage_regions(body)
    segments: List[Segment] = []
    all_warnings: List[str] = []
    for idx, region in enumerate(regions[:3], start=1):
        ptext, qtext = split_passage_and_questions(region)
        p = parse_passage(ptext or region, idx)
        groups = []
        if qtext:
            groups = [g for g in parse_questions(qtext, len(p.paragraphs))
                      if g.numbers]
        for w in p.warnings:
            if w not in all_warnings:
                all_warnings.append(w)
        segments.append(Segment(passage=p, groups=groups))

    note = "ok"
    if not segments or not any(s.passage.paragraphs for s in segments):
        note = "no_passage"
    elif not any(s.groups for s in segments):
        note = "no_questions"
    return Segmentation(segments=segments, answer_key=answer_key,
                        warnings=all_warnings, note=note)
