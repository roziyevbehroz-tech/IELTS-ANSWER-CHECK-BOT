"""Javob shablonini parse qilish.

Foydalanuvchi javoblarni tartib raqami bilan yuboradi (mavjud `parsing`
moduli formatlarini qo'llab-quvvatlaydi). Muqobil javoblar `/` bilan
(masalan `24. vegetable / vegetation`) saqlanadi va tekshirishda hisobga olinadi.
"""

from __future__ import annotations

import re
from typing import Dict, Iterable, List, Tuple

from .. import parsing

# Ko'p tanlovli (Choose TWO/THREE) javoblar: "12-13. C, D"  yoki  "22 & 23. B/E"
# -> {12: "C", 13: "D"} (tartib muhim emas, tekshirgich to'plam sifatida solishtiradi)
_RANGE_LETTERS = re.compile(
    r"^\s*(\d{1,3})\s*[-–—&,/]\s*(\d{1,3})\s*[.\):]?\s*"
    r"([A-Za-z](?:\s*[,/&]?\s*[A-Za-z])*)\s*$"
)


def parse_answer_key(text: str) -> Dict[int, str]:
    """Matndan {savol_raqami: javob} lug'atini qaytaradi.

    Diapazonli ko'p tanlovli javoblarni ham qo'llab-quvvatlaydi:
    `12-13. C, D` -> {12: "C", 13: "D"}. Qolgan qatorlar odatdagidek o'qiladi.
    """
    out: Dict[int, str] = {}
    rest: List[str] = []
    for raw in (text or "").split("\n"):
        line = raw.strip()
        if not line:
            continue
        m = _RANGE_LETTERS.match(line)
        if m:
            s, e = int(m.group(1)), int(m.group(2))
            letters = re.findall(r"[A-Za-z]", m.group(3).upper())
            if e >= s and 2 <= (e - s + 1) <= 11 and letters:
                for i, q in enumerate(range(s, e + 1)):
                    out[q] = letters[i] if i < len(letters) else letters[-1]
                continue
        rest.append(raw)
    base = parsing.parse_answers("\n".join(rest))
    for k, v in base.items():
        out.setdefault(k, v)
    return out


def validate(answers: Dict[int, str], expected: Iterable[int]) -> Tuple[List[int], List[int]]:
    """Kutilgan raqamlarга nisbatan yetishmayotgan/ortiqcha raqamlarni qaytaradi.

    Returns: (missing, extra)
    """
    expected_set = set(expected)
    given = set(answers.keys())
    missing = sorted(expected_set - given)
    extra = sorted(given - expected_set)
    return missing, extra
