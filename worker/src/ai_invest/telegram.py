"""Постинг в Telegram-канал через Bot API (без aiogram — для этапа 0 хватает одного вызова)."""

import httpx

from ai_invest.config import settings


def send_to_channel(text: str) -> None:
    resp = httpx.post(
        f"https://api.telegram.org/bot{settings.telegram_bot_token}/sendMessage",
        json={
            "chat_id": settings.telegram_channel_id,
            "text": text,
            "parse_mode": "HTML",
            "disable_web_page_preview": True,
        },
        timeout=30,
    )
    resp.raise_for_status()
