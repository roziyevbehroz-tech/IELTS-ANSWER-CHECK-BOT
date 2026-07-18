"""WordNet'dan offline inglizcha izohli lug'at (CD test uchun) generatsiya qiladi.

Chiqish: ielts_bot/cd/templates/dict_data.js
    window.__CD_DICT_B64 = "<base64(gzip(JSON))>";
JSON tuzilishi: { "d": { so'z: [[pos, izoh], ...] }, "e": { egilgan_shakl: asos } }

Brauzerda (dict.js) shu ma'lumot faqat KERAK bo'lganda (birinchi qidiruvda)
DecompressionStream orqali ochiladi — test fayli tez yuklanadi.

Ishga tushirish (bir marta, WordNet kerak):
    pip install nltk && python -c "import nltk; nltk.download('wordnet')"
    python scripts/build_dictionary.py
"""

import base64
import gzip
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "ielts_bot" / "cd" / "templates" / "dict_data.js"

POS = {"n": "n", "v": "v", "a": "adj", "s": "adj", "r": "adv"}
MAX_SENSE = 4        # har so'zga ko'pi bilan shuncha ma'no
MAX_LEN = 150        # izoh uzunligi chegarasi


def main() -> None:
    from nltk.corpus import wordnet as wn
    wn.morphy("went")   # morfologik istisno xaritalarini yuklaydi

    d: dict = {}
    for syn in wn.all_synsets():
        df = syn.definition()
        if not df:
            continue
        if len(df) > MAX_LEN:
            df = df[: MAX_LEN - 1].rstrip() + "…"
        p = POS.get(syn.pos(), "")
        for lemma in syn.lemma_names():
            w = lemma.replace("_", " ").lower()
            if " " in w or "-" in w or "." in w:   # faqat bitta so'z
                continue
            if not w or any(c.isdigit() for c in w):
                continue
            senses = d.setdefault(w, [])
            if len(senses) < MAX_SENSE and [p, df] not in senses:
                senses.append([p, df])

    exc: dict = {}
    for _pos, m in wn._exception_map.items():   # egilgan shakl -> asos
        for infl, bases in m.items():
            if infl not in exc and bases:
                exc[infl] = bases[0]

    payload = {"d": d, "e": exc}
    raw = json.dumps(payload, ensure_ascii=False, separators=(",", ":"))
    gz = gzip.compress(raw.encode("utf-8"), 9)
    b64 = base64.b64encode(gz).decode("ascii")

    OUT.write_text(
        "// AVTOMATIK generatsiya (scripts/build_dictionary.py). Tahrirlamang.\n"
        "// WordNet 3.x (Princeton) — offline inglizcha izohli lug'at.\n"
        'window.__CD_DICT_B64 = "' + b64 + '";\n',
        encoding="utf-8",
    )
    print(f"✅ {OUT.relative_to(ROOT)}")
    print(f"   so'zlar: {len(d)} · istisnolar: {len(exc)}")
    print(f"   raw: {len(raw)/1e6:.2f} MB · gzip: {len(gz)/1e6:.2f} MB · base64: {len(b64)/1e6:.2f} MB")


if __name__ == "__main__":
    main()
