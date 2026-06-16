"""IELTS Answer Check Bot — ishga tushirish nuqtasi.

Ishga tushirish:
    python run.py
"""

import logging
import sys

from telegram.ext import Application

from ielts_bot import config, handlers

logging.basicConfig(
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    level=logging.INFO,
)
logger = logging.getLogger("ielts_bot")


def main() -> None:
    if not config.BOT_TOKEN:
        logger.error(
            "BOT_TOKEN topilmadi. .env faylida BOT_TOKEN ni to'ldiring "
            "(.env.example dan nusxa oling)."
        )
        sys.exit(1)

    if config.supabase_enabled():
        logger.info("Supabase yoqilgan — statistika saqlanadi.")
    else:
        logger.info("Supabase sozlanmagan — bot baza-siz ishlaydi (statistika yo'q).")

    application = Application.builder().token(config.BOT_TOKEN).build()
    handlers.register(application)

    logger.info("Bot ishga tushdi. To'xtatish uchun Ctrl+C.")
    application.run_polling(allowed_updates=["message", "callback_query"])


if __name__ == "__main__":
    main()
