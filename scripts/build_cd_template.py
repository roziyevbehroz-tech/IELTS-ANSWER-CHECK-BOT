"""CD HTML template'ini edge-function (Deno) uchun TS'ga embed qiladi.

ielts_bot/cd/templates/{styles.css, app.js, base.html} ->
supabase/functions/ielts-bot/cd_template.ts  (STYLES, APP_JS, BASE_HTML).

Ishga tushirish:
    python scripts/build_cd_template.py
"""

import base64
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
TPL = ROOT / "ielts_bot" / "cd" / "templates"
LOGO = ROOT / "docs" / "logo.jpg"
OUT = ROOT / "supabase" / "functions" / "ielts-bot" / "cd_template.ts"


def main() -> None:
    styles = (TPL / "styles.css").read_text(encoding="utf-8")
    app_js = (TPL / "app.js").read_text(encoding="utf-8")
    base = (TPL / "base.html").read_text(encoding="utf-8")
    logo = ""
    if LOGO.exists():
        b64 = base64.b64encode(LOGO.read_bytes()).decode("ascii")
        logo = f'<img class="brand-logo" src="data:image/jpeg;base64,{b64}" alt="logo">'
    OUT.write_text(
        "// AVTOMATIK generatsiya (scripts/build_cd_template.py). Tahrirlamang.\n"
        "// Manba: ielts_bot/cd/templates/{styles.css, app.js, base.html}\n"
        "export const STYLES = " + json.dumps(styles, ensure_ascii=False) + ";\n"
        "export const APP_JS = " + json.dumps(app_js, ensure_ascii=False) + ";\n"
        "export const LOGO_HTML = " + json.dumps(logo, ensure_ascii=False) + ";\n"
        "export const BASE_HTML = " + json.dumps(base, ensure_ascii=False) + ";\n",
        encoding="utf-8",
    )
    print(f"✅ {OUT.relative_to(ROOT)} — {OUT.stat().st_size} bayt")


if __name__ == "__main__":
    main()
