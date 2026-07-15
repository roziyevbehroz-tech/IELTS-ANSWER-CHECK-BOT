"""CD test yaratish tizimi uchun testlar (extract, passage, questions, render)."""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from ielts_bot.cd import (  # noqa: E402
    answers as ans_mod,
    extract,
    passage as passage_mod,
    questions as q_mod,
    render,
)
from ielts_bot.cd.models import ReadingTest, Settings  # noqa: E402


# ------------------------------ extract -------------------------------

def test_extract_txt():
    assert extract.extract_text(b"Hello\nWorld", "a.txt") == "Hello\nWorld"


def test_extract_txt_collapses_blank_lines():
    out = extract.extract_text(b"A\n\n\n\nB", "a.txt")
    assert out == "A\n\nB"


# ------------------------------ passage -------------------------------

def test_passage_title_and_paragraphs():
    text = "The silk industry\n\nPara one here.\n\nPara two here.\n"
    p = passage_mod.parse_passage(text)
    assert p.title == "The silk industry"
    assert len(p.paragraphs) == 2


def test_passage_lettered():
    text = ("Mammoths\n\nA  First paragraph about mammoths here.\n\n"
            "B  Second paragraph about ice age here.\n\n"
            "C  Third paragraph about tusks here.\n")
    p = passage_mod.parse_passage(text)
    assert p.lettered is True
    assert len(p.paragraphs) == 3
    # harf prefiksi olib tashlanган
    assert p.paragraphs[0].startswith("First")


def test_passage_hardwrapped_not_per_line():
    # Qattiq o'ralgan matn (bo'sh qatorsiz) — har qator paragraf BO'LMASLIGI kerak
    lines = ["This is sentence number %d about the brain and sight." % i for i in range(40)]
    text = "The strange world of sight\n" + "\n".join(lines)
    p = passage_mod.parse_passage(text)
    assert p.title == "The strange world of sight"
    assert len(p.paragraphs) <= 12, len(p.paragraphs)   # 40 emas


def test_passage_lettered_no_blank_lines():
    text = ("Mammoths\n"
            "A On a May morning a herder found a baby mammoth\n"
            "frozen in the ice near a river in Siberia here.\n"
            "B Scientists believe mammoths became extinct due\n"
            "to a sharp rise in temperature long ago here.\n"
            "C Analysis of the tusks revealed evidence of the\n"
            "animal's short life and its sudden death here.")
    p = passage_mod.parse_passage(text)
    assert p.lettered is True
    assert len(p.paragraphs) == 3
    assert p.paragraphs[0].startswith("On a May morning")


def test_strip_ielts_boilerplate():
    text = ("READING PASSAGE 1\n\n"
            "You should spend about 20 minutes on Questions 1-13, which are "
            "based on Reading Passage 1 below.\n\n"
            "The history of glass\n\n"
            "From our earliest origins man has been making use of glass in "
            "many different forms throughout history here today.\n\n"
            "Archaeologists found evidence of man-made glass dating back to "
            "the year 4000 BC in that ancient region long ago.\n\n"
            "3\n\nDiyorbek IELTS")
    p = passage_mod.parse_passage(text)
    assert p.title == "The history of glass"
    assert len(p.paragraphs) == 2
    joined = " ".join(p.paragraphs)
    assert "READING PASSAGE" not in joined
    assert "You should spend" not in joined
    assert "Diyorbek" not in joined
    assert "3" not in p.paragraphs


def test_strip_page_numbers_in_lettered():
    text = ("The impact of tourism\n\n"
            "A Tourism has become one of the world's largest industries in "
            "recent decades and employs millions of people worldwide now.\n\n"
            "14\n\n"
            "B Many developing countries rely heavily on tourism income which "
            "can create a degree of economic vulnerability for them here.\n\n"
            "15\n\n"
            "C Environmental concerns about mass tourism have grown a lot and "
            "coastal areas are particularly affected by this trend today.")
    p = passage_mod.parse_passage(text)
    assert p.lettered is True and len(p.paragraphs) == 3
    assert "14" not in p.paragraphs and "15" not in p.paragraphs


def test_url_warning():
    text = ("Some topic\n\n"
            "This is a genuine paragraph about an interesting subject that is "
            "clearly long enough to be counted as real content here today.\n\n"
            "Visit www.example-ielts.uz for more practice tests\n\n"
            "Another real paragraph discussing the topic in enough detail to "
            "qualify as authentic passage content for the reader here now.")
    p = passage_mod.parse_passage(text)
    assert "junk" in p.warnings
    assert not any("www." in x for x in p.paragraphs)


def test_split_passage_and_questions():
    text = ("Title\n\nBody paragraph one.\n\nBody two.\n\n"
            "Questions 1-5\nComplete the notes below.\n1. foo\n")
    passage, qs = passage_mod.split_passage_and_questions(text)
    assert "Questions 1-5" not in passage
    assert "Questions 1-5" in qs


# ----------------------------- questions ------------------------------

def _one(qtext, para_count=6):
    gs = q_mod.parse_questions(qtext, para_count=para_count)
    assert len(gs) == 1, [g.qtype for g in gs]
    return gs[0]


def test_q_note_gaps():
    g = _one("[note] 1-3\nComplete.\n- a ___ b\n- c ___ d\n- e ___ f\n")
    assert g.kind == "gap"
    assert [i.number for i in g.items] == [1, 2, 3]
    assert "{{Q1}}" in g.body and "{{Q3}}" in g.body


def test_q_tfng():
    g = _one("[tfng] 8-9\nTRUE FALSE NOT GIVEN\n8. one\n9. two\n")
    assert g.kind == "tfng"
    assert len(g.items) == 2


def test_q_mcq():
    g = _one("[mcq] 5-6\nChoose.\n5. stem?\nA a\nB b\nC c\n6. stem2?\nA x\nB y\nC z\n")
    assert g.kind == "mcq"
    assert len(g.items) == 2
    assert g.items[0].options[0] == ("A", "a")


def test_q_mcq_multi():
    g = _one("[mcq_multi] 10-11\nChoose TWO.\nA a\nB b\nC c\nD d\nE e\n")
    assert g.kind == "mcq_multi"
    assert len(g.options) == 5


def test_q_headings():
    g = _one("[headings] 1-2\nList of Headings:\ni one\nii two\niii three\n"
             "1. Paragraph A\n2. Paragraph B\n")
    assert g.qtype == "headings"
    assert len(g.options) == 3
    assert len(g.items) == 2


def test_q_matching_info_options_from_spec():
    g = _one("[matching_info] 14-15 | A-F\nWhich paragraph...\n14. a\n15. b\n")
    assert g.kind == "matching"
    assert [o[0] for o in g.options] == list("ABCDEF")


def test_q_matching_features_options_inline():
    g = _one("[matching_features] 18-19 | A-C\nMatch.\nA Smith\nB Jones\nC Lee\n"
             "18. one\n19. two\n")
    assert g.options[0] == ("A", "Smith")
    assert len(g.items) == 2


def test_q_autodetect_tfng():
    txt = ("Questions 1-3\nDo the following statements agree with the "
           "information? Write TRUE, FALSE or NOT GIVEN.\n"
           "1. one\n2. two\n3. three\n")
    gs = q_mod.parse_questions(txt)
    assert gs and gs[0].kind == "tfng"


def test_q_multiple_blocks():
    txt = ("[note] 1-2\n- a ___\n- b ___\n\n"
           "[tfng] 3-4\nTRUE FALSE NOT GIVEN\n3. x\n4. y\n")
    gs = q_mod.parse_questions(txt)
    assert [g.kind for g in gs] == ["gap", "tfng"]


# ------------------------------ answers -------------------------------

def test_answers_parse_and_validate():
    key = ans_mod.parse_answer_key("1. white\n2. TRUE\n3. B\n")
    assert key == {1: "white", 2: "TRUE", 3: "B"}
    missing, extra = ans_mod.validate(key, [1, 2, 3, 4])
    assert missing == [4] and extra == []


def test_answers_range_multi_two():
    # Choose TWO: "22-23. C, D" -> 22=C, 23=D (tartib muhim emas, tekshirgich to'plamli)
    key = ans_mod.parse_answer_key("1. white\n22-23. C, D\n24. TRUE\n")
    assert key == {1: "white", 22: "C", 23: "D", 24: "TRUE"}


def test_answers_range_multi_three():
    assert ans_mod.parse_answer_key("12-14. B, D, F") == {12: "B", 13: "D", 14: "F"}


def test_answers_range_variants():
    assert ans_mod.parse_answer_key("22 & 23. B/E") == {22: "B", 23: "E"}


def test_q_multi_and_header_autodetect():
    txt = ("Questions 22 and 23\nChoose TWO letters, A-E.\n"
           "Which TWO problems are mentioned?\nA cost\nB noise\nC safety\n"
           "D time\nE space\n")
    g = q_mod.parse_questions(txt)
    assert len(g) == 1
    assert g[0].kind == "mcq_multi"
    assert g[0].start == 22 and g[0].end == 23
    assert [o[0] for o in g[0].options] == list("ABCDE")


# ------------------------------- render -------------------------------

def _build_test(reveal="end"):
    p = passage_mod.parse_passage(
        "Silk\n\nPara one about emperor and white silk.\n\n"
        "Para two about taxes and paper.\n")
    p.groups = q_mod.parse_questions(
        "[note] 1-2\n- wore ___ silk\n- payment of ___\n\n"
        "[tfng] 3-3\nTRUE FALSE NOT GIVEN\n3. Silk scared soldiers.\n\n"
        "[mcq] 4-4\nChoose.\n4. stem?\nA a\nB b\nC c\n")
    p.answers = ans_mod.parse_answer_key("1. white\n2. taxes\n3. TRUE\n4. B\n")
    return ReadingTest(title="Silk", passages=[p],
                       settings=Settings(reveal_mode=reveal))


def test_render_produces_inputs_and_data():
    html = render.render_test(_build_test())
    for token in ('id="q1"', 'name="q3"', 'name="q4"', "CD_DATA",
                  "DREAM ZONE", "results-modal"):
        assert token in html, token


def test_render_answer_alternatives_expanded():
    p = passage_mod.parse_passage("T\n\nBody about vegetables here.\n")
    p.groups = q_mod.parse_questions("[note] 1-1\n- eats ___\n")
    p.answers = {1: "vegetable / vegetation"}
    html = render.render_test(ReadingTest(passages=[p]))
    # gap javob massiv sifatida (muqobil) JSON'ga kiritilgan
    assert "vegetable" in html and "vegetation" in html


def test_render_reveal_mode_flag():
    assert '"revealMode":"instant"' in render.render_test(
        _build_test("instant")).replace(" ", "")
    assert '"revealMode":"end"' in render.render_test(
        _build_test("end")).replace(" ", "")


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
