"""Javob shablonini parse qilish.

Foydalanuvchi javoblarni tartib raqami bilan yuboradi (mavjud `parsing`
moduli formatlarini qo'llab-quvvatlaydi). Muqobil javoblar `/` bilan
(masalan `24. vegetable / vegetation`) saqlanadi va tekshirishda hisobga olinadi.
"""

from __future__ import annotations

from typing import Dict, Iterable, List, Tuple

from .. import parsing


def parse_answer_key(text: str) -> Dict[int, str]:
    """Matndan {savol_raqami: javob} lug'atini qaytaradi."""
    return parsing.parse_answers(text)


def validate(answers: Dict[int, str], expected: Iterable[int]) -> Tuple[List[int], List[int]]:
    """Kutilgan raqamlarга nisbatan yetishmayotgan/ortiqcha raqamlarni qaytaradi.

    Returns: (missing, extra)
    """
    expected_set = set(expected)
    given = set(answers.keys())
    missing = sorted(expected_set - given)
    extra = sorted(given - expected_set)
    return missing, extra
