"""CD Reading test ma'lumot modeli.

Barcha 14 IELTS savol turi kichik render-primitivlariga jamlanadi
(`render_kind`):

    gap        — matn ichida input (note/summary/sentence/table/flow-chart/
                 short-answer/diagram completion)
    tfng       — TRUE / FALSE / NOT GIVEN radiolar (identifying information)
    ynng       — YES / NO / NOT GIVEN radiolar
    mcq        — bitta javobli A–D radiolar (multiple choice)
    mcq_multi  — bir nechta javobli checkboxlar (choose TWO/THREE)
    matching   — harflar to'plamidan tanlanadigan select (matching headings /
                 paragraph information / features)
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Dict, List, Optional

# Foydalanuvchi turi -> ichki render primitivi
TYPE_TO_KIND: Dict[str, str] = {
    "note": "gap",
    "sentence": "gap",
    "summary": "gap",
    "table": "gap",
    "flowchart": "gap",
    "shortanswer": "gap",
    "diagram": "gap",
    "tfng": "tfng",
    "ynng": "ynng",
    "mcq": "mcq",
    "mcq_multi": "mcq_multi",
    "headings": "matching",
    "matching_info": "matching",
    "matching_features": "matching",
}

# Chiroyli o'zbekcha nomlar (foydalanuvchiga ko'rsatish uchun)
TYPE_LABELS: Dict[str, str] = {
    "note": "Note completion",
    "sentence": "Sentence completion",
    "summary": "Summary completion",
    "table": "Table completion",
    "flowchart": "Flow-chart completion",
    "shortanswer": "Short answer",
    "diagram": "Diagram label completion",
    "tfng": "True / False / Not Given",
    "ynng": "Yes / No / Not Given",
    "mcq": "Multiple choice",
    "mcq_multi": "Multiple choice (bir nechta)",
    "headings": "Matching headings",
    "matching_info": "Matching paragraph information",
    "matching_features": "Matching features",
}


@dataclass
class Item:
    """Bitta savol satri (statement, stem, gap yoki matching item)."""

    number: int
    text: str = ""
    # MCQ variantlari: [("A", "matn"), ...]
    options: List[tuple] = field(default_factory=list)


@dataclass
class QuestionGroup:
    """Bir xil turdagi ketma-ket savollar bloki."""

    qtype: str                       # foydalanuvchi turi (note, tfng, ...)
    start: int
    end: int
    instructions: str = ""
    items: List[Item] = field(default_factory=list)
    # Matching/summary-bank uchun variantlar: [("A", "matn"), ...] yoki [("i","..")]
    options: List[tuple] = field(default_factory=list)
    options_title: str = ""          # masalan "List of Headings" yoki "People"
    # gap turi uchun: HTML tayyor body (input'lar {{Q1}} bilan) yoki notes sarlavhasi
    body: str = ""
    title: str = ""                  # blok ichki sarlavhasi (notes/summary nomi)

    @property
    def kind(self) -> str:
        return TYPE_TO_KIND.get(self.qtype, "gap")

    @property
    def label(self) -> str:
        return TYPE_LABELS.get(self.qtype, self.qtype)

    @property
    def numbers(self) -> List[int]:
        return list(range(self.start, self.end + 1))


@dataclass
class Passage:
    """Bitta reading passage (Part) — matn + unga tegishli savol bloklari."""

    index: int                       # 1, 2, 3 (pozitsion)
    part_no: int = 0                 # matndan aniqlangan "READING PASSAGE N" (0 = noma'lum)
    title: str = ""
    subtitle: str = ""
    paragraphs: List[str] = field(default_factory=list)
    lettered: bool = False           # paragraflar A, B, C bilan belgilanganmi
    groups: List[QuestionGroup] = field(default_factory=list)
    answers: Dict[int, str] = field(default_factory=dict)
    warnings: List[str] = field(default_factory=list)  # tozalashda topilgan muammolar
    images: List[str] = field(default_factory=list)    # diagram rasmlari (data URI)

    @property
    def q_start(self) -> int:
        if self.groups:
            return min(g.start for g in self.groups)
        return 0

    @property
    def q_end(self) -> int:
        if self.groups:
            return max(g.end for g in self.groups)
        return 0


@dataclass
class Settings:
    """Test sozlamalari."""

    duration_min: int = 60           # taymer (daqiqa)
    brand: str = "DREAM ZONE"
    telegram_url: str = ""


@dataclass
class ReadingTest:
    """To'liq CD Reading test."""

    title: str = "IELTS Reading Practice"
    passages: List[Passage] = field(default_factory=list)
    settings: Settings = field(default_factory=Settings)

    @property
    def total_questions(self) -> int:
        return sum(len(g.numbers) for p in self.passages for g in p.groups)

    def all_answers(self) -> Dict[int, str]:
        out: Dict[int, str] = {}
        for p in self.passages:
            out.update(p.answers)
        return out
