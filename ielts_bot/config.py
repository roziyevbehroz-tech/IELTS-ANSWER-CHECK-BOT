"""Konfiguratsiya — muhit o'zgaruvchilaridan o'qiladi."""

import os
from pathlib import Path

from dotenv import load_dotenv

load_dotenv()

# Telegram
BOT_TOKEN = os.getenv("BOT_TOKEN", "").strip()

# Mini App (Telegram WebApp) manzili — GitHub Pages'da hostlanadi
# (Supabase standart domeni HTML'ni render qildirmaydi, shuning uchun Pages ishlatiladi).
WEBAPP_URL = os.getenv(
    "WEBAPP_URL",
    "https://roziyevbehroz-tech.github.io/IELTS-ANSWER-CHECK-BOT/",
).strip()

# Supabase (ixtiyoriy — bo'lmasa bot baza-siz ishlaydi)
SUPABASE_URL = os.getenv("SUPABASE_URL", "").strip()
SUPABASE_KEY = (
    os.getenv("SUPABASE_SERVICE_KEY")
    or os.getenv("SUPABASE_KEY")
    or ""
).strip()

# Loyihada qamrab olingan Cambridge IELTS Academic kitoblari
FIRST_BOOK = 10
LAST_BOOK = 20
BOOKS = list(range(FIRST_BOOK, LAST_BOOK + 1))

# Har bir kitobdagi testlar soni
TESTS_PER_BOOK = 4

# Javoblar bazasi joylashgan papka
DATA_DIR = Path(__file__).resolve().parent.parent / "data" / "answers"


def supabase_enabled() -> bool:
    """Supabase sozlangan-yo'qligini tekshiradi."""
    return bool(SUPABASE_URL and SUPABASE_KEY)
