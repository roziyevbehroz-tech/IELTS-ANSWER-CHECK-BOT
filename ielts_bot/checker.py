"""Foydalanuvchi javoblarini to'g'ri javoblar bilan solishtirish.

Asosiy g'oya: bot FAQAT to'g'ri javoblarni ko'rsatadi (qaysi raqamlar to'g'ri),
xato javoblarning to'g'ri variantini OSHKOR QILMAYDI. Foydalanuvchi xohlaganda
("Javoblarni ko'rish") barcha to'g'ri javoblar ko'rsatiladi.

Javob kalitidagi belgilar:
  * "/"  — muqobil to'g'ri javoblar:  "10/ten"  -> "10" ham, "ten" ham to'g'ri
  * "(...)" — ixtiyoriy so'z:          "(the) ticket" -> "ticket" ham, "the ticket" ham
  * TRUE/FALSE/NOT GIVEN va YES/NO/NOT GIVEN qisqartmalari qo'llab-quvvatlanadi
  * ko'p tanlovli javoblar (masalan "B,D" yoki "B and D") tartibga bog'liq emas
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from itertools import product
from typing import Dict, List, Set

# So'z/varianti uchun maxsus moslamalar
_TF_NG = {
    "true": "true", "t": "true",
    "false": "false", "f": "false",
    "notgiven": "notgiven", "ng": "notgiven", "ngiven": "notgiven",
    "yes": "yes", "y": "yes",
    "no": "no", "n": "no",
}

# Rim raqami <-> oddiy raqam ekvivalenti (matching headings: "viii" == "8")
_ROMAN = {
    "i": 1, "ii": 2, "iii": 3, "iv": 4, "v": 5, "vi": 6, "vii": 7, "viii": 8,
    "ix": 9, "x": 10, "xi": 11, "xii": 12, "xiii": 13, "xiv": 14, "xv": 15,
    "xvi": 16, "xvii": 17, "xviii": 18, "xix": 19, "xx": 20,
}


def _numeral_val(s: str):
    """Rim raqami (i, ii…) yoki oddiy raqam (1, 2…) -> butun son; aks holda None."""
    t = re.sub(r"[).\s]+$", "", (s or "").strip().lower())
    if re.fullmatch(r"\d+", t):
        return int(t)
    return _ROMAN.get(t)


def _basic_normalize(text: str) -> str:
    """Matnni taqqoslash uchun soddalashtiradi."""
    text = text.lower().strip()
    # punktuatsiyani olib tashlash (so'z ichidagi defis va apostrof saqlanmaydi — soddalik uchun)
    text = re.sub(r"[^\w\s]", " ", text)
    # ortiqcha bo'shliqlar
    text = re.sub(r"\s+", " ", text).strip()
    return text


def _canonical_tokenset(text: str) -> str:
    """Ko'p tanlovli javoblar uchun tartibdan mustaqil kalit yaratadi.

    "b and d" -> "b|d",  "d, b" -> "b|d"  (bir xil bo'ladi).
    """
    norm = _basic_normalize(text)
    # Butun ibora TRUE/FALSE/NOT GIVEN... bo'lsa darrov kanonik shaklga
    collapsed = norm.replace(" ", "")
    if collapsed in _TF_NG:
        return _TF_NG[collapsed]
    # "and" bog'lovchisini ajratuvchi sifatida olib tashlaymiz
    tokens = [t for t in norm.split(" ") if t and t != "and"]
    # TRUE/FALSE/NG kabi qisqartmalarni kanonik shaklga keltirish
    mapped = [_TF_NG.get(t, t) for t in tokens]
    if len(mapped) <= 1:
        return mapped[0] if mapped else ""
    return "|".join(sorted(mapped))


def _expand_optionals(answer: str) -> List[str]:
    """"(the) ticket" kabi ixtiyoriy qismlarni ikkala variantga yoyadi."""
    # har bir "(...)" bloki uchun: bor / yo'q
    segments = re.split(r"(\([^)]*\))", answer)
    choices: List[List[str]] = []
    for seg in segments:
        if seg.startswith("(") and seg.endswith(")"):
            inner = seg[1:-1]
            choices.append([inner, ""])  # so'z bor / yo'q
        else:
            choices.append([seg])
    results = []
    for combo in product(*choices):
        results.append("".join(combo))
    return results


def acceptable_variants(key_answer: str) -> Set[str]:
    """Javob kalitidan barcha qabul qilinadigan (normallashtirilgan) variantlarni qaytaradi."""
    variants: Set[str] = set()
    # yuqori darajadagi muqobillar "/" bilan ajratiladi
    for alt in key_answer.split("/"):
        alt = alt.strip()
        if not alt:
            continue
        for expanded in _expand_optionals(alt):
            canon = _canonical_tokenset(expanded)
            if canon:
                variants.add(canon)
    return variants


def is_correct(user_answer: str, key_answer: str) -> bool:
    """Foydalanuvchi javobi to'g'ri kalit bilan mos kelishini tekshiradi."""
    if not user_answer or not key_answer:
        return False
    if _canonical_tokenset(user_answer) in acceptable_variants(key_answer):
        return True
    # Rim raqami <-> oddiy raqam ekvivalenti (masalan kalit "viii", javob "8")
    uv = _numeral_val(user_answer)
    if uv is not None:
        for alt in key_answer.split("/"):
            if _numeral_val(alt) == uv:
                return True
    return False


@dataclass
class CheckResult:
    correct_numbers: List[int]          # to'g'ri javob berilgan savol raqamlari
    incorrect_numbers: List[int]        # xato (lekin oshkor qilinmaydi)
    unanswered_numbers: List[int]       # foydalanuvchi javob bermagan savollar
    total: int                          # tekshirilgan savollar soni (kalit mavjud)

    @property
    def correct_count(self) -> int:
        return len(self.correct_numbers)


def check_answers(
    user_answers: Dict[int, str],
    key_answers: Dict[int, str],
) -> CheckResult:
    """Foydalanuvchi javoblarini kalit bilan solishtiradi.

    Faqat kaliti mavjud savollar baholanadi.
    """
    correct: List[int] = []
    incorrect: List[int] = []
    unanswered: List[int] = []

    for q in sorted(key_answers.keys()):
        ua = user_answers.get(q)
        if ua is None or not str(ua).strip():
            unanswered.append(q)
        elif is_correct(str(ua), key_answers[q]):
            correct.append(q)
        else:
            incorrect.append(q)

    return CheckResult(
        correct_numbers=correct,
        incorrect_numbers=incorrect,
        unanswered_numbers=unanswered,
        total=len(key_answers),
    )
