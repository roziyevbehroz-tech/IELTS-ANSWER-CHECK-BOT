"""Bo'sh javob-kalit shablonlarini yaratadi: data/answers/book_10.json ... book_20.json

Har bir fayl: 4 ta test, har bir testda listening (1-40) va reading (1-40)
maydonlari bo'sh ("") qiymat bilan to'ldiriladi. Keyin siz bu bo'sh joylarni
to'g'ri javoblar bilan to'ldirasiz.

Ishga tushirish:
    python scripts/generate_templates.py
"""

import json
from pathlib import Path

FIRST_BOOK = 10
LAST_BOOK = 20
TESTS = 4

OUT_DIR = Path(__file__).resolve().parent.parent / "data" / "answers"


def empty_section() -> dict:
    return {str(q): "" for q in range(1, 41)}


def build_book(book: int) -> dict:
    return {
        "book": book,
        "tests": {
            str(t): {
                "listening": empty_section(),
                "reading": empty_section(),
            }
            for t in range(1, TESTS + 1)
        },
    }


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    for book in range(FIRST_BOOK, LAST_BOOK + 1):
        path = OUT_DIR / f"book_{book}.json"
        if path.exists():
            print(f"o'tkazib yuborildi (mavjud): {path.name}")
            continue
        with open(path, "w", encoding="utf-8") as f:
            json.dump(build_book(book), f, ensure_ascii=False, indent=2)
        print(f"yaratildi: {path.name}")


if __name__ == "__main__":
    main()
