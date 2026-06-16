"""Excel javob-jadvalidan data/answers/book_<N>.json fayllarini to'ldiradi.

Excel formati (1-qator sarlavha):
    Book | Test | Type | 1 | 2 | ... | 40
Har bir qator — bitta (kitob, test, bo'lim) uchun 40 ta javob.
  Type: "Listening" yoki "Reading"
  Test: "Test 1" .. "Test 4"

Ishga tushirish:
    python scripts/import_from_excel.py <fayl.xlsx>
    (standart: data/source/IELTS_answer_data.xlsx)
"""

import json
import sys
from collections import defaultdict
from pathlib import Path

import openpyxl

ROOT = Path(__file__).resolve().parent.parent
OUT_DIR = ROOT / "data" / "answers"
DEFAULT_XLSX = ROOT / "data" / "source" / "IELTS_answer_data.xlsx"

TYPE_MAP = {"listening": "listening", "reading": "reading"}


def conv(value) -> str:
    """Excel katak qiymatini javob-kalit satriga aylantiradi."""
    if value is None:
        return ""
    if isinstance(value, bool):  # bool int-dan oldin tekshirilishi shart
        return "TRUE" if value else "FALSE"
    if isinstance(value, float):
        return str(int(value)) if value.is_integer() else str(value)
    if isinstance(value, int):
        return str(value)
    return str(value).strip()


def parse_test_number(raw) -> int:
    s = str(raw).strip().lower().replace("test", "").strip()
    return int(float(s))


def main() -> None:
    xlsx_path = Path(sys.argv[1]) if len(sys.argv) > 1 else DEFAULT_XLSX
    if not xlsx_path.exists():
        sys.exit(f"Fayl topilmadi: {xlsx_path}")

    wb = openpyxl.load_workbook(xlsx_path, data_only=True)
    ws = wb.active
    rows = list(ws.iter_rows(values_only=True))
    header, data_rows = rows[0], rows[1:]

    # 4-ustundan (index 3) boshlab savol raqamlari
    question_cols = [int(h) for h in header[3:]]

    # book -> test -> section -> {q: answer}
    books = defaultdict(lambda: defaultdict(dict))
    counts = defaultdict(int)

    for row in data_rows:
        if row[0] is None:
            continue
        book = int(float(row[0]))
        test = parse_test_number(row[1])
        section = TYPE_MAP.get(str(row[2]).strip().lower())
        if section is None:
            print(f"⚠️ noma'lum Type: {row[2]} (book {book}, test {test}) — o'tkazildi")
            continue

        answers = {}
        for q, cell in zip(question_cols, row[3:]):
            answers[str(q)] = conv(cell)

        books[book][test][section] = answers
        counts[book] += 1

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    for book in sorted(books):
        # Ba'zi kitoblarda (mas. Cambridge 12) testlar 5-8 deb belgilangan.
        # Har bir kitob ichida testlarni tartib bo'yicha 1..N ga qayta raqamlaymiz.
        ordered = sorted(books[book])
        tests = {}
        for new_no, orig in enumerate(ordered, start=1):
            tests[str(new_no)] = {
                "listening": books[book][orig].get(
                    "listening", {str(q): "" for q in question_cols}
                ),
                "reading": books[book][orig].get(
                    "reading", {str(q): "" for q in question_cols}
                ),
            }
            if new_no != orig:
                print(f"   ↪ book {book}: Excel 'Test {orig}' -> Test {new_no}")
        payload = {"book": book, "tests": tests}
        path = OUT_DIR / f"book_{book}.json"
        with open(path, "w", encoding="utf-8") as f:
            json.dump(payload, f, ensure_ascii=False, indent=2)
        filled = sum(
            1
            for t in tests.values()
            for sec in t.values()
            for v in sec.values()
            if v
        )
        print(f"✅ book_{book}.json — {len(tests)} test, {filled} ta javob")

    total = sum(counts.values())
    print(f"\nJami {len(books)} kitob, {total} ta (test×bo'lim) qator import qilindi.")


if __name__ == "__main__":
    main()
