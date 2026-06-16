"""Foydalanuvchi yuborgan matndan raqamlangan javoblarni ajratib olish.

Qo'llab-quvvatlanadigan formatlar (moslashuvchan):
    21. cat            21) cat           21 - cat
    21 cat             21:cat            21.cat
Bir nechta qatorda yoki bitta qatorda ham bo'lishi mumkin:
    "21. cat 22. dog 23. true"
"""

from __future__ import annotations

import re
from typing import Dict

# Qator boshidagi "raqam + ajratuvchi + javob"
_LINE_RE = re.compile(r"^\s*(\d{1,3})\s*[\.\)\-:–—]?\s*(.+?)\s*$")

# Bitta qator ichidagi ko'p javoblar: raqamdan keyin majburiy ajratuvchi belgi
_INLINE_RE = re.compile(
    r"(\d{1,3})\s*[\.\)\-:–—]\s*([^\d][^\n]*?)(?=\s+\d{1,3}\s*[\.\)\-:–—]|$)"
)


def parse_answers(text: str) -> Dict[int, str]:
    """Matndan {savol_raqami: javob} lug'atini qaytaradi."""
    text = (text or "").strip()
    if not text:
        return {}

    lines = [ln for ln in text.splitlines() if ln.strip()]
    result: Dict[int, str] = {}

    if len(lines) > 1:
        # Har bir qatorni alohida o'qiymiz
        for line in lines:
            m = _LINE_RE.match(line)
            if m:
                result[int(m.group(1))] = m.group(2).strip()
        if result:
            return result

    # Bitta qator yoki qatorlar bo'yicha topilmadi -> ichki (inline) qidiruv
    for m in _INLINE_RE.finditer(text):
        result[int(m.group(1))] = m.group(2).strip()

    if not result:
        # Oxirgi imkoniyat: yagona "21 cat" ko'rinishi
        m = _LINE_RE.match(text)
        if m:
            result[int(m.group(1))] = m.group(2).strip()

    return result
