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


def test_passage_glossary_footnotes():
    # */** izohli lug'at passage tanasidan ajratiladi, in-text yulduzchalar qoladi
    text = (
        "The Davies Sisters\n\n"
        "The sisters chose to use their inheritance for philanthropic* purposes "
        "and built a large collection over many years of dedicated effort.\n\n"
        "They preferred Old Master** paintings but made few early attempts to "
        "secure such works, buying safer pieces instead for their collection.\n\n"
        "________\n"
        "* philanthropic: seeking to promote the welfare of others\n"
        "** Old Master: a highly respected artist who worked before about 1800\n"
        "16"
    )
    p = passage_mod.parse_passage(text)
    assert len(p.glossary) == 2
    assert p.glossary[0].startswith("* philanthropic:")
    assert p.glossary[1].startswith("** Old Master:")
    # ajratuvchi chiziq va bet raqami passage tanasiga tushmagan
    assert all("___" not in para for para in p.paragraphs)
    assert not any(para.strip() == "16" for para in p.paragraphs)
    # in-text yulduzchalar (philanthropic*, Old Master**) saqlangan
    assert "philanthropic*" in " ".join(p.paragraphs)
    # HTML'da lug'at bloki chiqadi
    from ielts_bot.cd import render as render_mod
    from ielts_bot.cd.models import QuestionGroup, Item
    p.groups = [QuestionGroup(qtype="tfng", start=1, end=1,
                              items=[Item(number=1, text="A statement.")])]
    p.answers = {1: "TRUE"}
    html = render_mod.render_test(
        ReadingTest(title="T", passages=[p], settings=Settings(brand="DZ")))
    assert "passage-glossary" in html
    assert "philanthropic:" in html


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


def test_lettered_inline_markers_and_glued_pagenum():
    # PDF oqim bo'lib chiqqanda markerlar matn ichida; bet raqami markerga
    # yopishgan ("2D The...") — D/E/F ham to'g'ri ajratilishi kerak.
    text = (
        "The history of the biro\n\n"
        "A One chilly autumn morning in 1945, five thousand shoppers crowded "
        "the pavements outside Gimbels Department Store in New York City.\n\n"
        "B In fact, this new pen was not new after all, and was just the "
        "latest development in a long search for a better pen design here.\n\n"
        "C Almost fifty years later, Ladislas and Georg Biro came up with a "
        "solution and fitted the pen with a ball bearing which delivered ink "
        "to the\n\n"
        "1\n\n"
        "2D The first Biro pen relied on gravity for the ink to flow to the "
        "ball bearing. The Biro brothers eventually devised a new design. "
        "E The Biros pen soon came to the attention of American fighter "
        "pilots and the Department of War contacted several companies. "
        "F Meanwhile, the delay ultimately cost them their advantage as a "
        "rival firm set up production first in the United States market.")
    p = passage_mod.parse_passage(text)
    assert p.lettered is True
    assert len(p.paragraphs) == 6
    # "2" bet raqami D ga qo'shilmagan
    assert p.paragraphs[3].startswith("The first Biro pen")
    assert p.paragraphs[4].startswith("The Biros pen soon")
    assert p.paragraphs[5].startswith("Meanwhile")


def test_boilerplate_wrapped_timing_and_title_safety():
    # "You should spend..." ikki qatorga bo'lingan + title himoyasi
    text = ("READING PASSAGE 2\n\n"
            "You should spend about 20 minutes on Questions 14-26,\n"
            "which are based on Reading Passage 2 below.\n\n"
            "Lapis lazuli\n\n"
            "Lapis lazuli is a deep blue metamorphic rock that has been prized "
            "since antiquity for its wonderfully intense blue colour today.\n\n"
            "For centuries it was ground into powder to make the pigment "
            "ultramarine which was used by many Renaissance painters back then.")
    p = passage_mod.parse_passage(text)
    assert p.title == "Lapis lazuli", p.title
    assert not any("READING PASSAGE" in x or "You should spend" in x
                   or "based on Reading" in x for x in p.paragraphs)


def test_boilerplate_letter_spaced_header():
    text = ("R E A D I N G   P A S S A G E   2\n\n"
            "Lapis lazuli\n\n"
            "Lapis lazuli is a deep blue rock prized since antiquity for its "
            "wonderful and intense blue colour all around the world today here.\n\n"
            "It was ground to make the pigment ultramarine used widely by very "
            "many famous Renaissance painters across the whole of Europe then.")
    p = passage_mod.parse_passage(text)
    assert p.title == "Lapis lazuli", p.title
    assert not any("READING" in x.upper().replace(" ", "") for x in p.paragraphs)


def test_title_safety_rejects_boilerplate():
    assert passage_mod._looks_like_title("READING PASSAGE 2") is False
    assert passage_mod._looks_like_title("R E A D I N G   P A S S A G E   2") is False
    assert passage_mod._looks_like_title("Lapis lazuli") is True


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


def test_q_summary_unicode_ellipsis_gaps():
    # Unicode ellipsis "…" gaplar + raqam-oldida ("1 …")
    txt = ("Questions 1-3\nComplete the summary below.\n\n"
           "Sport is important, with around 1 ……… participants and it "
           "starts conversations between 2 ……… , the source of everyday "
           "3 ……… .")
    g = q_mod.parse_questions(txt)
    assert len(g) == 1 and g[0].kind == "gap"
    assert [i.number for i in g[0].items] == [1, 2, 3]
    assert "{{Q1}}" in g[0].body and "{{Q3}}" in g[0].body


def test_q_matching_sentence_endings():
    txt = ("Questions 9-11\n"
           "Complete each sentence with the correct ending A-G from the box below.\n\n"
           "9 The change in personnel\n10 Growing interest in health\n"
           "11 Advertising related to sport\n\n"
           "A is unlikely to continue.\nB lies in how sport is explained.\n"
           "C shows a change.\nD makes use of pictures.\nE has resulted in salaries.\n"
           "F is caused by focus.\nG has led to changes.")
    g = q_mod.parse_questions(txt)
    assert len(g) == 1 and g[0].kind == "matching"
    assert len(g[0].items) == 3
    assert [o[0] for o in g[0].options] == list("ABCDEFG")


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

def _build_test():
    p = passage_mod.parse_passage(
        "Silk\n\nPara one about emperor and white silk.\n\n"
        "Para two about taxes and paper.\n")
    p.groups = q_mod.parse_questions(
        "[note] 1-2\n- wore ___ silk\n- payment of ___\n\n"
        "[tfng] 3-3\nTRUE FALSE NOT GIVEN\n3. Silk scared soldiers.\n\n"
        "[mcq] 4-4\nChoose.\n4. stem?\nA a\nB b\nC c\n")
    p.answers = ans_mod.parse_answer_key("1. white\n2. taxes\n3. TRUE\n4. B\n")
    return ReadingTest(title="Silk", passages=[p], settings=Settings())


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


def test_part_number_from_reading_passage_label():
    # Part raqami matndagi "READING PASSAGE N" dan olinadi (pozitsion emas)
    p = passage_mod.parse_passage(
        "READING PASSAGE 2\n\nThe crisis in advertising\n\n"
        "Advertisers have known for a long time about ads and money here today now.\n\n"
        "Second paragraph about media across the country there always now here.")
    assert p.part_no == 2
    p2 = passage_mod.parse_passage(
        "You should spend about 20 minutes on Questions 14-26, which are based "
        "on Reading Passage 2 below.\n\nMarie Curie\n\n"
        "Marie was a scientist who worked very hard in this passage about her life.")
    assert p2.part_no == 2
    # Render: part yorlig'i 2, savol oralig'i real savollardan
    p.groups = q_mod.parse_questions("[tfng] 14-15\nTRUE FALSE NOT GIVEN\n"
                                     "14. Ads waste money.\n15. TV is old.\n")
    p.answers = {14: "TRUE", 15: "FALSE"}
    html = render.render_test(ReadingTest(passages=[p]))
    assert "Part 2" in html and '"partNos": [2]' in html.replace(" ", " ")


def test_classify_belonging_to_is_matching():
    # "Classify ... as belonging to A/B/C" — matching bo'lishi kerak (mcq emas),
    # A)/B)/C) variant qatorlari bo'lsa ham guruh tashlab yuborilmasin.
    src = (
        "Questions 6-12.\n"
        "Classify the following characteristics as belonging to\n"
        "A) academic intelligence tests\nB) emotional intelligence tests\n"
        "C) practical intelligence tests\n"
        "Write the correct letter A, B or C, next to Questions 6-12 below.\n"
        "6. measures skills which improve with age\n"
        "7. assesses social skills\n8. deals with real-life difficulties\n"
        "9. the oldest of the three tests\n10. high scorers learn from actions\n"
        "11. stay calm in difficult situations\n12. more than one possible answer")
    groups = q_mod.parse_questions(src)
    assert len(groups) == 1
    g = groups[0]
    assert g.kind == "matching"
    assert g.qtype == "matching_features"
    assert len(g.items) == 7
    assert [o[0] for o in g.options] == ["A", "B", "C"]


def test_flowchart_detected_and_rendered_as_boxes():
    src = (
        "Questions 8-10\n"
        "Complete the flow-chart below. Choose NO MORE THAN TWO WORDS.\n"
        "Generating biogas for domestic use in Dunga\n"
        "First, place water hyacinth together with some 8 ________ into a digester\n"
        "Leave the mixture until the 9 ________ is completed\n"
        "Capture the gas and use 10 ________ to transport it to homes\n"
        "Then use the gas for cooking")
    groups = q_mod.parse_questions(src)
    assert len(groups) == 1
    g = groups[0]
    assert g.qtype == "flowchart"
    assert len(g.items) == 3
    html = render.render_test(
        ReadingTest(passages=[_mk_passage(g)]))
    assert "fc-box" in html and "fc-arrow" in html


def test_diagram_box_variant_choose_three_stays_diagram():
    # "Choose THREE" bo'lsa ham "label the diagram" -> diagram (mcq_multi emas)
    src = (
        "Questions 11-13\n"
        "Label the diagram below. Choose THREE answers from the box and write "
        "the correct letter, A-E, next to questions 11-13.\n"
        "A electricity indicator\nB on/off switch\nC reset button\n"
        "D time control\nE warning indicator\n"
        "Water Heater\n11 ________\n12 ________\n13 ________")
    groups = q_mod.parse_questions(src)
    assert len(groups) == 1
    g = groups[0]
    assert g.qtype == "diagram"
    assert len(g.items) == 3
    assert len(g.options) == 5 and g.options[0][0] == "A"
    html = render.render_test(ReadingTest(passages=[_mk_passage(g)]))
    assert "diagram-block" in html and "diagram-row" in html


def _mk_passage(group):
    p = passage_mod.parse_passage("T\n\nSome passage body text here for the test now.\n")
    p.groups = [group]
    p.answers = {n: "x" for n in range(group.start, group.end + 1)}
    return p


def test_mcq_choose_correct_answer_dot_options():
    # "Choose the correct answer, A, B, C or D" + "A." variantlar — mcq bo'lishi kerak
    src = (
        "Questions 7-9\n"
        "Choose the correct answer, A, B, C or D and write in your answer sheet.\n"
        "7. The problem with the ballpoint pens was that\n"
        "A. they cost a great deal.\nB. the technology did not exist.\n"
        "C. they could not write on paper.\nD. they were affected by weather.\n"
        "8. The design of the first pen\n"
        "A. was similar to previous pens.\nB. was based on capillary action.\n"
        "C. worked with heavy inks.\nD. worked when slanted.\n"
        "9. Milton Reynolds copied it because\n"
        "A. the patent was out of date.\nB. it was legal.\n"
        "C. they had no patent for North America.\nD. permission was given.")
    groups = q_mod.parse_questions(src)
    assert len(groups) == 1
    g = groups[0]
    assert g.kind == "mcq"
    assert len(g.items) == 3
    assert all(len(it.options) == 4 for it in g.items)


def test_matching_features_glued_options_and_items():
    # PDF variant/elementlarni yopishtirgan (coolerB, natureH, Corpe Nove2)
    src = (
        "Questions 1-6\n"
        "Look at the following list of companies (1-6) and the list of new "
        "materials below. Match each company with the correct material. "
        "Write the correct letter A-H next to the companies 1-6.\n"
        "New materials\n"
        "A material that can make you warmer or coolerB clothing with perfume "
        "addedC material that rarely needs washingD clothes that can change "
        "with heatE material made from banana stalksF material that is "
        "environmentally-friendlyG fibres similar to those in natureH clothes "
        "that can light up in the dark\n"
        "1. Corpe Nove2 Nexia Biotechnologies3 Nano-Tex4 Schoeller Textil5 "
        "Quest International6 Cargill Dow")
    groups = q_mod.parse_questions(src)
    assert len(groups) == 1
    g = groups[0]
    assert g.qtype == "matching_features"
    assert len(g.items) == 6
    assert [it.text for it in g.items][0] == "Corpe Nove"
    assert [it.text for it in g.items][-1] == "Cargill Dow"
    assert len(g.options) == 8
    assert g.options[0] == ("A", "material that can make you warmer or cooler")
    assert g.options[1][0] == "B"
    assert g.options[7] == ("H", "clothes that can light up in the dark")


def test_render_headings_roman_options_arabic_key():
    # Matching headings: variantlar rim raqamlarida (i, ii…) render qilinadi,
    # ammo kalit oddiy raqamlarda (1, 2…) kiritilishi mumkin. HTML ikkalasini
    # ekvivalent deb hisoblaydi (app.js: letterCorrect + numeralVal).
    p = passage_mod.parse_passage("Ads\n\nPara A here.\n\nPara B here.\n")
    p.groups = q_mod.parse_questions(
        "[headings] 1-2\nList of Headings.\n"
        "i First\nii Second\niii Third\niv Fourth\nv Fifth\nvi Sixth\n"
        "1. Statement one\n2. Statement two\n")
    p.answers = {1: "6", 2: "1"}          # oddiy raqamli kalit (vi, i degani)
    html = render.render_test(ReadingTest(passages=[p]))
    # select variantlari rim raqamlarida
    assert 'value="vi"' in html and 'value="i"' in html
    # kalit JSON'ga oddiy raqam sifatida kiritilgan
    assert '"1": "6"' in html.replace(" ", " ")
    # ekvivalentlik mantig'i mavjud (numeralVal helper)
    assert "numeralVal" in html


def test_render_settings_has_duration_only():
    html = render.render_test(_build_test()).replace(" ", "")
    # Vaqt passage soniga qarab: bitta passage -> 20 daqiqa
    assert '"duration":20' in html
    assert "revealMode" not in html
    assert "explanations" not in html


def test_render_duration_scales_with_passages():
    # 1→20, 2→40, 3→60 daqiqa
    p = passage_mod.parse_passage("T\n\nBody one about things here.\n")
    p.groups = q_mod.parse_questions("[note] 1-1\n- eats ___\n")
    p.answers = {1: "x"}
    p2 = passage_mod.parse_passage("T2\n\nBody two about matters here.\n")
    p2.groups = q_mod.parse_questions("[note] 2-2\n- sees ___\n")
    p2.answers = {2: "y"}
    html = render.render_test(ReadingTest(passages=[p, p2])).replace(" ", "")
    assert '"duration":40' in html


# ------------------------- word bank (A-I) -------------------------

def test_summary_word_bank_captured():
    from ielts_bot.cd import segment as seg_mod  # noqa: F401
    qtext = (
        "Questions 33-36\n"
        "Complete the summary using the list of words, A-I, below.\n"
        "The language lacks 33 ....... for counting.\n"
        "Speakers could not perform 34 ....... tasks, which shows 35 ....... "
        "shapes thought though 36 ....... remains debated.\n"
        "A numbers  B culture  C memory\n"
        "D language  E matching  F grammar\n"
        "G colour  H tools  I society\n"
    )
    groups = q_mod.parse_questions(qtext, 7)
    assert len(groups) == 1
    g = groups[0]
    assert g.qtype == "summary"
    assert [it.number for it in g.items] == [33, 34, 35, 36]
    # word bank A-I qo'lga olindi
    assert len(g.options) == 9
    assert g.options[0] == ("A", "numbers")
    assert g.options[-1] == ("I", "society")


def test_word_bank_renders_select():
    p = passage_mod.parse_passage("Topic\n\nA body paragraph long enough here.\n")
    p.groups = q_mod.parse_questions(
        "Complete the summary using the list of words, A-D, below.\n"
        "The main point is 1 ....... and later 2 ....... follows.\n"
        "A alpha  B beta  C gamma  D delta\n"
    )
    p.answers = {1: "A", 2: "C"}
    html = render.render_test(ReadingTest(passages=[p]))
    # gap select bo'lib chiqadi + word bank ko'rinadi
    assert '<select class="answer-input gap-input" id="q1">' in html
    assert "List of Words" in html


def test_normal_notes_not_treated_as_wordbank():
    groups = q_mod.parse_questions(
        "Complete the notes below.\nOrigin: found in 1 .......\nUse: 2 ....... making\n")
    assert groups and not groups[0].options


# ------------------------- segmentation -------------------------

def _long_prose(n=4):
    return ("This substantial passage body describes an interesting subject in "
            "considerable depth and detail. ") * n


def test_segment_single_passage_with_answer_key():
    from ielts_bot.cd.segment import segment_material
    text = (
        "The Lost City\n\n" + _long_prose() + "\n\n" + _long_prose() + "\n\n"
        "Questions 1-3\n"
        "Do the following statements agree? Write TRUE, FALSE or NOT GIVEN.\n"
        "1  Statement one.\n2  Statement two.\n3  Statement three.\n\n"
        "Answer key\n1. NOT GIVEN\n2. TRUE\n3. TRUE\n"
    )
    s = segment_material(text)
    assert s.note == "ok"
    assert len(s.segments) == 1
    assert s.answer_key == {1: "NOT GIVEN", 2: "TRUE", 3: "TRUE"}
    assert s.segments[0].passage.title == "The Lost City"
    assert [(g.qtype, g.start, g.end) for g in s.segments[0].groups] == [("tfng", 1, 3)]


def test_segment_three_passages_with_markers():
    from ielts_bot.cd.segment import segment_material

    def block(n, title, qs):
        return (f"READING PASSAGE {n}\n{title}\n\n" + _long_prose() +
                f"\n\nQuestions {qs}-{qs + 1}\n"
                "Do the following statements agree? Write TRUE, FALSE or NOT GIVEN.\n"
                f"{qs}  First.\n{qs + 1}  Second.\n")
    text = (block(1, "Alpha", 1) + "\n\n" + block(2, "Beta", 14) + "\n\n"
            + block(3, "Gamma", 27) + "\n\nAnswers\n1. TRUE\n14. FALSE\n27. NOT GIVEN\n")
    s = segment_material(text)
    assert len(s.segments) == 3
    assert [seg.groups[0].start for seg in s.segments] == [1, 14, 27]
    assert s.answer_key == {1: "TRUE", 14: "FALSE", 27: "NOT GIVEN"}


def test_segment_interleaved_no_markers():
    from ielts_bot.cd.segment import segment_material

    def block(title, qs):
        return (f"{title}\n\n" + _long_prose() +
                f"\n\nQuestions {qs}-{qs + 1}\n"
                "Do the following statements agree? Write TRUE, FALSE or NOT GIVEN.\n"
                f"{qs}  First.\n{qs + 1}  Second.\n")
    text = block("First Topic", 1) + "\n\n" + block("Second Topic", 3)
    s = segment_material(text)
    assert len(s.segments) == 2
    assert [seg.passage.title for seg in s.segments] == ["First Topic", "Second Topic"]


def test_segment_no_questions_note():
    from ielts_bot.cd.segment import segment_material
    s = segment_material("Just A Title\n\n" + _long_prose())
    assert s.note == "no_questions"


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
