"""Mini App uchun ma'lumotlarni generatsiya qiladi.

1) supabase/functions/ielts-check/answers.json  — to'liq javob-kalitlar
   (FAQAT serverda, brauzerga hech qachon yuborilmaydi).
2) docs/catalog.js  — javobsiz katalog (qaysi kitob/test/bo'lim/qism mavjud,
   qaysi savol raqamlari bor). Brauzerga yuborilishi xavfsiz.
3) supabase/functions/ielts-app/page.ts  — barcha CSS/JS inline qilingan bitta
   HTML (Edge Function frontendni shu sahifa orqali tarqatadi).

Ishga tushirish:
    python scripts/build_webapp_data.py
"""

import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
ANSWERS_DIR = ROOT / "data" / "answers"
FUNC_DIR = ROOT / "supabase" / "functions" / "ielts-check"
APP_FUNC_DIR = ROOT / "supabase" / "functions" / "ielts-app"
BOT_FUNC_DIR = ROOT / "supabase" / "functions" / "ielts-bot"
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

    answers_json = json.dumps(answers, ensure_ascii=False)
    FUNC_DIR.mkdir(parents=True, exist_ok=True)
    (FUNC_DIR / "answers.json").write_text(answers_json, encoding="utf-8")

    # Telegram bot (webhook) Edge Function ham xuddi shu javob-bazasidan foydalanadi.
    BOT_FUNC_DIR.mkdir(parents=True, exist_ok=True)
    (BOT_FUNC_DIR / "answers.json").write_text(answers_json, encoding="utf-8")

    DOCS_DIR.mkdir(parents=True, exist_ok=True)
    catalog = {"books": BOOKS, "tests": TESTS, "answered": answered}
    (DOCS_DIR / "catalog.js").write_text(
        "// Avtomatik generatsiya qilingan (scripts/build_webapp_data.py). Tahrirlamang.\n"
        "window.IELTS_CATALOG = " + json.dumps(catalog, ensure_ascii=False) + ";\n",
        encoding="utf-8",
    )

    print(f"✅ answers.json — {len(answers)} ta (kitob-test-bo'lim) bloki")
    print(f"✅ docs/catalog.js — {sum(len(v) for v in answered.values())} ta savol")

    build_page()


def build_page() -> None:
    """docs/ dagi HTML/CSS/JS ni bitta inline sahifaga jamlab page.ts yaratadi.

    Bu sahifa ielts-app Edge Function orqali tarqatiladi (GitHub Pages kerak emas).
    Tashqi telegram-web-app.js skripti CDN'dan yuklanadi.
    """
    html = (DOCS_DIR / "index.html").read_text(encoding="utf-8")
    css = (DOCS_DIR / "styles.css").read_text(encoding="utf-8")
    config_js = (DOCS_DIR / "config.js").read_text(encoding="utf-8")
    catalog_js = (DOCS_DIR / "catalog.js").read_text(encoding="utf-8")
    app_js = (DOCS_DIR / "app.js").read_text(encoding="utf-8")

    def safe(code: str) -> str:
        # inline <script> ichida "</script>" bo'lmasligi uchun himoya
        return code.replace("</script", "<\\/script")

    html = re.sub(
        r'<link[^>]*href="styles\.css"[^>]*>',
        f"<style>\n{css}\n</style>",
        html,
    )
    html = html.replace(
        '<script src="config.js"></script>', f"<script>\n{safe(config_js)}\n</script>"
    )
    html = html.replace(
        '<script src="catalog.js"></script>', f"<script>\n{safe(catalog_js)}\n</script>"
    )
    html = html.replace(
        '<script src="app.js"></script>', f"<script>\n{safe(app_js)}\n</script>"
    )

    APP_FUNC_DIR.mkdir(parents=True, exist_ok=True)
    (APP_FUNC_DIR / "page.ts").write_text(
        "// Avtomatik generatsiya (scripts/build_webapp_data.py). Tahrirlamang.\n"
        "export const PAGE = " + json.dumps(html, ensure_ascii=False) + ";\n",
        encoding="utf-8",
    )
    print(f"✅ ielts-app/page.ts — {len(html)} belgi (inline frontend)")


if __name__ == "__main__":
    main()
