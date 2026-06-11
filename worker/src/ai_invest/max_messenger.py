"""Постинг в канал мессенджера MAX (platform-api.max.ru).

Bot API MAX близок к телеграмному: токен выдаёт @MasterBot, бот должен быть
администратором канала. Дайджест использует только теги <b>/<i> — поддерживаются
обоими мессенджерами, поэтому текст публикуем без преобразований.
"""

import httpx

from ai_invest.config import settings

API = "https://platform-api.max.ru"


def send_to_channel(text: str) -> None:
    resp = httpx.post(
        f"{API}/messages",
        params={"chat_id": settings.max_channel_id},
        headers={"Authorization": settings.max_bot_token},
        json={"text": text, "format": "html"},
        timeout=30,
    )
    resp.raise_for_status()


def list_chats() -> list[dict]:
    """Чаты/каналы, где состоит бот, — чтобы узнать chat_id канала после добавления."""
    resp = httpx.get(f"{API}/chats", headers={"Authorization": settings.max_bot_token}, timeout=30)
    resp.raise_for_status()
    return resp.json().get("chats", [])
