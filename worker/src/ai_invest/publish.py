"""Публикация дайджеста во все настроенные каналы (Telegram, MAX)."""

from datetime import datetime, timezone

from sqlalchemy.orm import Session

from ai_invest import max_messenger, telegram
from ai_invest.config import settings
from ai_invest.models import Digest


def post_digest(session: Session, digest: Digest) -> list[str]:
    """Постит дайджест в настроенные каналы; возвращает список площадок.

    Ошибка одной площадки не блокирует остальные; digest получает status=posted,
    если опубликован хотя бы где-то.
    """
    posted: list[str] = []
    errors: list[str] = []

    if settings.telegram_bot_token and settings.telegram_channel_id:
        try:
            telegram.send_to_channel(digest.content)
            posted.append("telegram")
        except Exception as e:  # noqa: BLE001
            errors.append(f"telegram: {e}")

    if settings.max_bot_token and settings.max_channel_id:
        try:
            max_messenger.send_to_channel(digest.content)
            posted.append("max")
        except Exception as e:  # noqa: BLE001
            errors.append(f"max: {e}")

    if not posted and not errors:
        raise RuntimeError("Ни один канал не настроен (TELEGRAM_* / MAX_* в .env)")

    if posted:
        digest.status = "posted"
        digest.posted_at = datetime.now(timezone.utc)
        session.commit()

    for err in errors:
        print(f"Ошибка публикации [{err}]")
    if not posted:
        raise RuntimeError("Публикация не удалась ни на одной площадке")
    return posted
