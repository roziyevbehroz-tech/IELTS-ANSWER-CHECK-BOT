"""ReadingTest -> mustaqil CD HTML fayl.

Har bir savol turi mavjud CSS klasslariga mos HTML'ga o'giriladi. Javoblar
`CD_DATA` JSON'iga joylanadi (client-side tekshirish app.js orqali).
"""

from __future__ import annotations

import base64
import html
import json
import re
from pathlib import Path
from typing import Dict, List

from .. import checker
from .models import Passage, QuestionGroup, ReadingTest

_TPL_DIR = Path(__file__).resolve().parent / "templates"
_LOGO_PATH = Path(__file__).resolve().parents[2] / "docs" / "logo.jpg"

# TFNG/YNNG kalitni radio qiymatiga keltirish
_TF_CANON = {
    "t": "TRUE", "true": "TRUE",
    "f": "FALSE", "false": "FALSE",
    "ng": "NOT GIVEN", "notgiven": "NOT GIVEN", "not given": "NOT GIVEN",
    "y": "YES", "yes": "YES",
    "n": "NO", "no": "NO",
}
_TFNG_OPTS = ["TRUE", "FALSE", "NOT GIVEN"]
_YNNG_OPTS = ["YES", "NO", "NOT GIVEN"]


def render_test(test: ReadingTest) -> str:
    tpl = (_TPL_DIR / "base.html").read_text(encoding="utf-8")
    styles = (_TPL_DIR / "styles.css").read_text(encoding="utf-8")
    app_js = (_TPL_DIR / "app.js").read_text(encoding="utf-8")

    passages_html = []
    part_headers = []
    question_sets = []
    part_tabs = []
    for i, p in enumerate(test.passages):
        idx = i + 1                       # pozitsion (element id/part raqami)
        first = idx == 1
        passages_html.append(_render_passage(p, idx, hidden=not first))
        part_headers.append(_render_part_header(p, idx, hidden=not first))
        question_sets.append(_render_question_set(p, idx, hidden=not first))
        part_tabs.append(
            f'<div class="part-tab{" active" if first else ""}" '
            f'data-part="{idx}">Part {idx}</div>'
        )

    data = _build_data(test)
    telegram = ""
    if test.settings.telegram_url:
        telegram = (
            f'<a href="{html.escape(test.settings.telegram_url)}" target="_blank" '
            f'class="telegram-link">{html.escape(test.settings.brand)}</a>'
        )

    out = tpl
    replacements = {
        "{{TITLE}}": html.escape(test.title),
        "{{BRAND}}": html.escape(test.settings.brand),
        "{{LOGO}}": _logo_html(),
        "{{TELEGRAM_LINK}}": telegram,
        "{{TOTAL}}": str(test.total_questions),
        "{{PART_TABS}}": "\n".join(part_tabs),
        "{{PART_HEADERS}}": "\n".join(part_headers),
        "{{PASSAGES}}": "\n".join(passages_html),
        "{{QUESTION_SETS}}": "\n".join(question_sets),
        "{{DATA_JSON}}": json.dumps(data, ensure_ascii=False),
        "{{STYLES}}": styles,
        "{{APP_JS}}": _safe_js(app_js),
    }
    for k, v in replacements.items():
        out = out.replace(k, v)
    return out


def _safe_js(code: str) -> str:
    return code.replace("</script", "<\\/script")


def _logo_html() -> str:
    if _LOGO_PATH.exists():
        b64 = base64.b64encode(_LOGO_PATH.read_bytes()).decode("ascii")
        return f'<img class="brand-logo" src="data:image/jpeg;base64,{b64}" alt="logo">'
    return '<span class="brand-logo" style="font-size:22px">🎓</span>'


# ------------------------------ passage --------------------------------

def _render_passage(p: Passage, idx: int, hidden: bool) -> str:
    cls = "reading-passage" + (" hidden" if hidden else "")
    parts = [f'<div id="passage-text-{idx}" class="{cls}">']
    if p.title:
        parts.append(f'<h4 class="text-center">{html.escape(p.title)}</h4>')
    if p.subtitle:
        parts.append(
            f'<p class="text-center" style="font-style:italic;margin-bottom:20px;">'
            f'{html.escape(p.subtitle)}</p>')
    for i, para in enumerate(p.paragraphs):
        letter = ""
        if p.lettered:
            letter = f'<strong>{chr(ord("A") + i)}</strong>&nbsp;&nbsp;'
        parts.append(f"<p>{letter}{html.escape(para)}</p>")
    parts.append("</div>")
    return "\n".join(parts)


def _render_part_header(p: Passage, idx: int, hidden: bool) -> str:
    cls = "part-header" + (" hidden" if hidden else "")
    rng = f"{p.q_start}-{p.q_end}" if p.q_start else ""
    return (
        f'<div id="part-header-{idx}" class="{cls}">'
        f'<p><strong>Part {idx}</strong></p>'
        f'<p>Read the text and answer questions {rng}.</p></div>'
    )


# ------------------------------ questions ------------------------------

def _render_question_set(p: Passage, idx: int, hidden: bool) -> str:
    cls = "question-set" + (" hidden" if hidden else "")
    inner = [f'<div id="questions-{idx}" class="{cls}">',
             '<div class="questions-container">']
    for g in p.groups:
        inner.append(_render_group(g, p))
    inner.append("</div></div>")
    return "\n".join(inner)


def _render_group(g: QuestionGroup, p: Passage) -> str:
    prompt = _prompt(g)
    if g.kind == "gap":
        body = _render_gap_body(g)
        title = f'<h4 class="text-center" style="font-weight:bold;margin:12px 0;">{html.escape(g.title)}</h4>' if g.title else ""
        return (f'<div class="question" data-q-start="{g.start}" data-q-end="{g.end}">'
                f'{prompt}<div class="notes-content">{title}{body}</div></div>')
    if g.kind in ("tfng", "ynng"):
        return _render_statements(g, prompt)
    if g.kind == "mcq":
        return _render_mcq(g, prompt)
    if g.kind == "mcq_multi":
        return _render_mcq_multi(g, prompt)
    if g.kind == "matching":
        return _render_matching(g, prompt, p)
    return ""


def _prompt(g: QuestionGroup) -> str:
    hdr = f"Questions {g.start}-{g.end}"
    instr = html.escape(g.instructions) if g.instructions else ""
    extra = ""
    if g.kind in ("tfng", "ynng"):
        a, b = ("TRUE", "FALSE") if g.kind == "tfng" else ("YES", "NO")
        extra = (
            '<ul style="list-style:none;padding-left:0;">'
            f'<li><strong>{a}</strong> — agar fikr matnga mos kelsa</li>'
            f'<li><strong>{b}</strong> — agar fikr matnga zid kelsa</li>'
            '<li><strong>NOT GIVEN</strong> — agar bu haqda ma\'lumot bo\'lmasa</li></ul>')
    return (f'<div class="question-prompt"><p><strong>{hdr}</strong></p>'
            f'<p>{instr}</p>{extra}</div>')


# ------- gap (note/summary/sentence/table/flowchart/short/diagram) ------

def _render_gap_body(g: QuestionGroup) -> str:
    body = g.body or ""
    # jadval bo'lsa (| ajratuvchi) — HTML jadval
    if any("|" in ln for ln in body.split("\n")) and g.qtype == "table":
        return _render_table(body)
    lines = body.split("\n")
    out: List[str] = []
    bullets: List[str] = []

    def flush():
        if bullets:
            out.append('<ul style="list-style:disc;margin-left:40px;">'
                       + "".join(f"<li>{b}</li>" for b in bullets) + "</ul>")
            bullets.clear()

    for raw in lines:
        s = raw.strip()
        if not s:
            flush()
            continue
        content = _inject_inputs(s)
        if s.startswith(("-", "•", "*")):
            bullets.append(_inject_inputs(s.lstrip("-•* ").strip()))
        elif not _has_token(s) and len(s.split()) <= 8 and s.endswith(":") is False \
                and s == s and len(s) < 60 and _is_subheading(s):
            flush()
            out.append(f'<h5 style="font-weight:bold;margin-top:12px;">{content}</h5>')
        else:
            flush()
            out.append(f'<p style="line-height:2.2;">{content}</p>')
    flush()
    return "\n".join(out)


def _is_subheading(s: str) -> bool:
    # gap yo'q, qisqa, bosh harf bilan — sarlavha deb hisoblaymiz
    return not _has_token(s) and (s[:1].isupper() or s.isupper())


_TOKEN_RE = re.compile(r"\{\{Q(\d+)\}\}")


def _has_token(s: str) -> bool:
    return bool(_TOKEN_RE.search(s))


def _inject_inputs(s: str) -> str:
    # avval xavfsiz escape, keyin tokenlarni input bilan almashtiramiz
    esc = html.escape(s)
    def repl(m):
        n = m.group(1)
        return (f'<input type="text" class="answer-input gap-input" '
                f'id="q{n}" placeholder="{n}">')
    # token escape'dan keyin ham o'zgarmaydi ({{Q1}} da maxsus belgi yo'q)
    return _TOKEN_RE.sub(repl, esc)


def _render_table(body: str) -> str:
    rows = [ln for ln in body.split("\n") if ln.strip()]
    out = ['<table class="cd-table">']
    for i, ln in enumerate(rows):
        cells = [c.strip() for c in ln.split("|")]
        tag = "th" if i == 0 else "td"
        out.append("<tr>" + "".join(
            f"<{tag}>{_inject_inputs(c)}</{tag}>" for c in cells) + "</tr>")
    out.append("</table>")
    return "\n".join(out)


# ---------------------------- statements -------------------------------

def _render_statements(g: QuestionGroup, prompt: str) -> str:
    opts = _TFNG_OPTS if g.kind == "tfng" else _YNNG_OPTS
    parts = [f'<div class="question" data-q-start="{g.start}" data-q-end="{g.end}">',
             prompt]
    for it in g.items:
        radios = "".join(
            f'<label class="tf-option"><input type="radio" name="q{it.number}" '
            f'value="{o}"> {o}</label>' for o in opts)
        parts.append(
            f'<div class="tf-question" data-qgroup="q{it.number}" '
            f'data-q-start="{it.number}" data-q-end="{it.number}">'
            f'<div class="tf-question-line"><span class="tf-question-number">{it.number}</span>'
            f'<span class="tf-question-text">{html.escape(it.text)}</span></div>'
            f'<div class="tf-options">{radios}</div></div>')
    parts.append("</div>")
    return "\n".join(parts)


# ------------------------------- MCQ -----------------------------------

def _render_mcq(g: QuestionGroup, prompt: str) -> str:
    parts = [f'<div class="question" data-q-start="{g.start}" data-q-end="{g.end}">',
             prompt]
    for it in g.items:
        opts = "".join(
            f'<div class="multi-choice-option"><label>'
            f'<input type="radio" name="q{it.number}" value="{letter}"> '
            f'<strong>{letter}</strong>&nbsp;{html.escape(text)}</label></div>'
            for letter, text in it.options)
        parts.append(
            f'<div class="multi-choice-question" data-qgroup="q{it.number}" '
            f'data-q-start="{it.number}" data-q-end="{it.number}">'
            f'<div class="question-prompt"><p><strong>{it.number}</strong>&nbsp;'
            f'{html.escape(it.text)}</p></div>{opts}</div>')
    parts.append("</div>")
    return "\n".join(parts)


def _render_mcq_multi(g: QuestionGroup, prompt: str) -> str:
    n = g.end - g.start + 1
    hint = f'<p><em>Choose {_num_word(n)} letters.</em></p>'
    boxes = "".join(
        f'<div class="multi-choice-option"><label>'
        f'<input type="checkbox" name="qm{g.start}" value="{letter}"> '
        f'<strong>{letter}</strong>&nbsp;{html.escape(text)}</label></div>'
        for letter, text in g.options)
    return (f'<div class="question" data-q-start="{g.start}" data-q-end="{g.end}">'
            f'{prompt}{hint}<div class="multi-choice-question">{boxes}</div></div>')


def _num_word(n: int) -> str:
    return {2: "TWO", 3: "THREE", 4: "FOUR"}.get(n, str(n))


# ----------------------------- matching --------------------------------

def _render_matching(g: QuestionGroup, prompt: str, p: Passage) -> str:
    # variantlar: agar bo'sh bo'lsa, passage paragraflaridan (A..)
    options = g.options
    if not options:
        count = len(p.paragraphs) or 7
        options = [(chr(ord("A") + i), "") for i in range(count)]

    bank = ""
    if any(txt for _, txt in options):
        title = html.escape(g.options_title) if g.options_title else "Options"
        rows = "".join(
            f'<li><strong>{html.escape(letter)}</strong>&nbsp;{html.escape(txt)}</li>'
            for letter, txt in options)
        bank = (f'<div class="heading-bank"><p><strong>{title}</strong></p>'
                f'<ul class="opt-list">{rows}</ul></div>')

    rows_html = []
    for it in g.items:
        opts = '<option value="">Select</option>' + "".join(
            f'<option value="{letter}">{letter}</option>' for letter, _ in options)
        rows_html.append(
            f'<div class="matching-form-row">'
            f'<span class="matching-form-label"><strong>{it.number}.</strong> '
            f'{html.escape(it.text)}</span>'
            f'<select class="answer-input" id="q{it.number}">{opts}</select></div>')
    return (f'<div class="question" data-q-start="{g.start}" data-q-end="{g.end}">'
            f'{prompt}{bank}<div class="matching-form-container">'
            f'{"".join(rows_html)}</div></div>')


# ------------------------------ CD_DATA --------------------------------

def _build_data(test: ReadingTest) -> Dict:
    answers: Dict[str, object] = {}
    groups = []
    for p in test.passages:
        for g in p.groups:
            groups.append({"kind": g.kind, "start": g.start, "end": g.end})
        for q, ans in p.answers.items():
            g = _group_for(p, q)
            kind = g.kind if g else "gap"
            answers[str(q)] = _answer_value(ans, kind)
    parts = [[p.q_start, p.q_end] for p in test.passages]
    return {
        "answers": answers,
        "groups": groups,
        "parts": parts,
        "settings": {
            "revealMode": "instant" if test.settings.reveal_mode == "instant" else "end",
            "explanations": test.settings.explanations,
            "duration": test.settings.duration_min,
        },
        "explanations": {str(k): v for k, v in test.explanations.items()},
    }


def _group_for(p: Passage, q: int):
    for g in p.groups:
        if g.start <= q <= g.end:
            return g
    return None


def _answer_value(ans: str, kind: str):
    ans = str(ans).strip()
    if kind in ("tfng", "ynng"):
        return _TF_CANON.get(ans.lower(), ans.upper())
    if kind in ("mcq", "matching", "mcq_multi"):
        return ans.upper()
    # gap — muqobil (/) va ixtiyoriy (()) variantlarni yoyamiz (matn taqqoslash)
    variants = []
    for alt in ans.split("/"):
        alt = alt.strip()
        if not alt:
            continue
        for exp in checker._expand_optionals(alt):
            exp = re.sub(r"\s+", " ", exp).strip()
            if exp:
                variants.append(exp)
    if not variants:
        variants = [ans]
    return variants if len(variants) > 1 else variants[0]
