"""Supabase bilan ishlash (ixtiyoriy).

Agar SUPABASE_URL/SUPABASE_SERVICE_KEY sozlanmagan bo'lsa, barcha funksiyalar
xatosiz ishlaydi-yu, hech narsa saqlamaydi (bot baza-siz ishlayveradi).

Jadvallar `ielts_ac_` prefiksi bilan nomlangan, mavjud jadvallar bilan
to'qnashmaydi. Sxema uchun `supabase/migrations/` ga qarang.
"""

from __future__ import annotations

import logging
from typing import Any, Dict, List, Optional

from . import config

logger = logging.getLogger(__name__)

_client = None  # lazy-init qilingan Supabase client


def _get_client():
    global _client
    if _client is not None:
        return _client
    if not config.supabase_enabled():
        return None
    try:
        from supabase import create_client

        _client = create_client(config.SUPABASE_URL, config.SUPABASE_KEY)
        logger.info("Supabase client ulandi.")
    except Exception as exc:  # noqa: BLE001
        logger.warning("Supabase ulanmadi: %s", exc)
        _client = None
    return _client


def upsert_user(
    telegram_id: int,
    username: Optional[str],
    first_name: Optional[str],
    language_code: Optional[str],
) -> None:
    client = _get_client()
    if client is None:
        return
    try:
        client.table("ielts_ac_users").upsert(
            {
                "telegram_id": telegram_id,
                "username": username,
                "first_name": first_name,
                "language_code": language_code,
                "last_active_at": "now()",
            },
            on_conflict="telegram_id",
        ).execute()
    except Exception as exc:  # noqa: BLE001
        logger.warning("upsert_user xato: %s", exc)


def record_attempt(
    telegram_id: int,
    book: int,
    test: int,
    section: str,
    part: str,
    correct: int,
    total: int,
    details: Optional[Dict[str, Any]] = None,
) -> None:
    client = _get_client()
    if client is None:
        return
    try:
        client.table("ielts_ac_attempts").insert(
            {
                "telegram_id": telegram_id,
                "book": book,
                "test": test,
                "section": section,
                "part": part,
                "correct": correct,
                "total": total,
                "details": details or {},
            }
        ).execute()
    except Exception as exc:  # noqa: BLE001
        logger.warning("record_attempt xato: %s", exc)


def get_user_attempts(telegram_id: int, limit: int = 10) -> List[Dict[str, Any]]:
    client = _get_client()
    if client is None:
        return []
    try:
        resp = (
            client.table("ielts_ac_attempts")
            .select("book,test,section,part,correct,total,created_at")
            .eq("telegram_id", telegram_id)
            .order("created_at", desc=True)
            .limit(limit)
            .execute()
        )
        return resp.data or []
    except Exception as exc:  # noqa: BLE001
        logger.warning("get_user_attempts xato: %s", exc)
        return []
