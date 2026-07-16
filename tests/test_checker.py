"""checker va parsing modullari uchun testlar (sintetik ma'lumotlar)."""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from ielts_bot import checker, parsing  # noqa: E402


# ----------------------------- is_correct -----------------------------

def test_case_insensitive():
    assert checker.is_correct("Library", "library")
    assert checker.is_correct("LIBRARY", "library")


def test_extra_spaces_and_punct():
    assert checker.is_correct("  swimming  pool ", "swimming pool")
    assert checker.is_correct("ticket.", "ticket")


def test_roman_arabic_equivalence():
    # Matching headings: kalit rim raqamida ("viii"), o'quvchi oddiy raqam ("8")
    assert checker.is_correct("8", "viii")
    assert checker.is_correct("viii", "viii")
    assert checker.is_correct("VIII", "viii")
    assert checker.is_correct("iv", "4")
    assert checker.is_correct("vi", "6")
    # Soxta mos kelish yo'q
    assert not checker.is_correct("9", "x")      # 9 != 10
    assert not checker.is_correct("B", "viii")   # harf != raqam
    assert not checker.is_correct("cat", "viii")


def test_slash_alternatives():
    assert checker.is_correct("10", "10/ten")
    assert checker.is_correct("ten", "10/ten")
    assert not checker.is_correct("eleven", "10/ten")


def test_optional_parentheses():
    assert checker.is_correct("ticket", "(the) ticket")
    assert checker.is_correct("the ticket", "(the) ticket")


def test_true_false_ng():
    assert checker.is_correct("T", "TRUE")
    assert checker.is_correct("true", "TRUE")
    assert checker.is_correct("NG", "NOT GIVEN")
    assert checker.is_correct("not given", "NOT GIVEN")
    assert not checker.is_correct("FALSE", "TRUE")


def test_multi_select_order_independent():
    assert checker.is_correct("B,D", "D and B")
    assert checker.is_correct("D B", "B,D")
    assert not checker.is_correct("B,C", "B,D")


# --------------------------- check_answers ---------------------------

def test_check_answers_hides_wrong():
    key = {1: "cat", 2: "dog", 3: "10/ten", 4: "TRUE"}
    user = {1: "cat", 2: "bird", 3: "ten"}  # 4 javob berilmagan
    res = checker.check_answers(user, key)
    assert res.correct_numbers == [1, 3]
    assert res.incorrect_numbers == [2]
    assert res.unanswered_numbers == [4]
    assert res.total == 4
    assert res.correct_count == 2


# ------------------------------ parsing ------------------------------

def test_parse_multiline():
    text = "21. cat\n22) dog\n23 - true\n24: B"
    parsed = parsing.parse_answers(text)
    assert parsed == {21: "cat", 22: "dog", 23: "true", 24: "B"}


def test_parse_inline():
    text = "21. cat 22. dog 23. true"
    parsed = parsing.parse_answers(text)
    assert parsed == {21: "cat", 22: "dog", 23: "true"}


def test_parse_no_separator_space():
    parsed = parsing.parse_answers("31 swimming pool\n32 library")
    assert parsed == {31: "swimming pool", 32: "library"}


if __name__ == "__main__":
    import traceback

    funcs = [v for k, v in sorted(globals().items()) if k.startswith("test_")]
    failed = 0
    for fn in funcs:
        try:
            fn()
            print(f"PASS  {fn.__name__}")
        except Exception:  # noqa: BLE001
            failed += 1
            print(f"FAIL  {fn.__name__}")
            traceback.print_exc()
    print(f"\n{len(funcs) - failed}/{len(funcs)} test o'tdi.")
    sys.exit(1 if failed else 0)
