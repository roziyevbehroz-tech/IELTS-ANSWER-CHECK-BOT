"""Mini App uchun ma'lumotlarni generatsiya qiladi.

1) supabase/functions/ielts-check/answers.json  — to'liq javob-kalitlar
   (FAQAT serverda, brauzerga hech qachon yuborilmaydi).
2) docs/catalog.js  — javobsiz katalog (qaysi kitob/test/bo'lim/qism mavjud,
   qaysi savol raqamlari bor). Brauzerga yuborilishi xavfsiz.

Ishga tushirish:
    python scripts/build_webapp_data.py
"""

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
ANSWERS_DIR = ROOT / "data" / "answers"
FUNC_DIR = ROOT / "supabase" / "functions" / "ielts-check"
DOCS_DIR = ROOT / "docs"

BOOKS = list(range(10, 21))
TESTS = [1, 2, 3, 4]
SECTIONS = ["listening", "reading"]


def main() -> None:
    answers = {}            # "book-test-section" -> {q: answer}  (server-only)
    answered = {}           # "book-test-section" -> [savol raqamlari]  (katalog)

    for book in BOOKS:
        path = ANSWERS_DIR / f"book_{book}.json"
        if not path.exists():
            continue
        data = json.loads(path.read_text(encoding="utf-8"))
        for test in TESTS:
            sec_map = data.get("tests", {}).get(str(test), {})
            for section in SECTIONS:
                raw = sec_map.get(section, {})
                filled = {
                    q: str(v).strip()
                    for q, v in raw.items()
                    if v is not None and str(v).strip()
                }
                if not filled:
                    continue
                key = f"{book}-{test}-{section}"
                answers[key] = filled
                answered[key] = sorted(int(q) for q in filled)

    FUNC_DIR.mkdir(parents=True, exist_ok=True)
    (FUNC_DIR / "answers.json").write_text(
        json.dumps(answers, ensure_ascii=False), encoding="utf-8"
    )

    DOCS_DIR.mkdir(parents=True, exist_ok=True)
    catalog = {"books": BOOKS, "tests": TESTS, "answered": answered}
    (DOCS_DIR / "catalog.js").write_text(
        "// Avtomatik generatsiya qilingan (scripts/build_webapp_data.py). Tahrirlamang.\n"
        "window.IELTS_CATALOG = " + json.dumps(catalog, ensure_ascii=False) + ";\n",
        encoding="utf-8",
    )

    print(f"✅ answers.json — {len(answers)} ta (kitob-test-bo'lim) bloki")
    print(f"✅ docs/catalog.js — {sum(len(v) for v in answered.values())} ta savol")


if __name__ == "__main__":
    main()
