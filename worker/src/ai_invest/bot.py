"""Telegram-бот: подтверждение входа на сайт и управление watchlist.

Long polling без aiogram — команд мало, простого цикла getUpdates достаточно.
Запуск: ai-invest run-bot (на сервере — отдельный compose-сервис bot).
"""

import time
from datetime import datetime, timedelta, timezone

import httpx
from sqlalchemy import delete, select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session

from ai_invest.config import settings
from ai_invest.db import get_session
from ai_invest.models import LoginToken, Security, User, WatchlistItem

LOGIN_TOKEN_TTL = timedelta(minutes=10)

HELP = (
    "Я бот InvestDigest AI.\n\n"
    "/add ТИКЕР — добавить бумагу в ваш список (напр. /add SBER)\n"
    "/del ТИКЕР — убрать бумагу\n"
    "/list — ваш список бумаг\n\n"
    "Каждое торговое утро пришлю персональный дайджест по вашим бумагам."
)


def _api(method: str, **payload) -> dict:
    resp = httpx.post(
        f"https://api.telegram.org/bot{settings.telegram_bot_token}/{method}", json=payload, timeout=65
    )
    resp.raise_for_status()
    return resp.json()


def _send(chat_id: int, text: str) -> None:
    _api("sendMessage", chat_id=chat_id, text=text, parse_mode="HTML")


def _upsert_user(session: Session, tg_user: dict) -> User:
    stmt = insert(User).values(
        telegram_id=tg_user["id"],
        username=tg_user.get("username"),
        first_name=tg_user.get("first_name"),
    )
    stmt = stmt.on_conflict_do_update(
        index_elements=[User.telegram_id],
        set_={"username": stmt.excluded.username, "first_name": stmt.excluded.first_name},
    )
    session.execute(stmt)
    session.commit()
    return session.scalar(select(User).where(User.telegram_id == tg_user["id"]))


def _handle_start(session: Session, chat_id: int, tg_user: dict, arg: str) -> None:
    _upsert_user(session, tg_user)
    if not arg:
        _send(chat_id, HELP)
        return
    token = session.get(LoginToken, arg)
    fresh = token and token.status == "pending" and (
        datetime.now(timezone.utc) - token.created_at < LOGIN_TOKEN_TTL
    )
    if not fresh:
        _send(chat_id, "Ссылка для входа устарела. Вернитесь на сайт и попробуйте ещё раз.")
        return
    token.status = "confirmed"
    token.telegram_id = tg_user["id"]
    token.confirmed_at = datetime.now(timezone.utc)
    session.commit()
    _send(chat_id, "✅ Вход подтверждён! Вернитесь на сайт — вы уже авторизованы.\n\n" + HELP)


def _handle_add(session: Session, chat_id: int, tg_user: dict, arg: str) -> None:
    user = _upsert_user(session, tg_user)
    secid = arg.upper().strip()
    if not session.get(Security, secid):
        _send(chat_id, f"Не нашёл бумагу <b>{secid}</b> в основном режиме торгов МосБиржи.")
        return
    session.execute(
        insert(WatchlistItem).values(user_id=user.id, secid=secid).on_conflict_do_nothing()
    )
    session.commit()
    _send(chat_id, f"➕ <b>{secid}</b> в вашем списке. /list — посмотреть всё.")


def _handle_del(session: Session, chat_id: int, tg_user: dict, arg: str) -> None:
    user = _upsert_user(session, tg_user)
    secid = arg.upper().strip()
    session.execute(
        delete(WatchlistItem).where(WatchlistItem.user_id == user.id, WatchlistItem.secid == secid)
    )
    session.commit()
    _send(chat_id, f"➖ <b>{secid}</b> убран из списка.")


def _handle_list(session: Session, chat_id: int, tg_user: dict, _arg: str) -> None:
    user = _upsert_user(session, tg_user)
    rows = session.execute(
        select(WatchlistItem.secid, Security.shortname)
        .join(Security, Security.secid == WatchlistItem.secid)
        .where(WatchlistItem.user_id == user.id)
        .order_by(WatchlistItem.secid)
    ).all()
    if not rows:
        _send(chat_id, "Список пуст. Добавьте бумагу: /add SBER")
        return
    lines = "\n".join(f"• <b>{secid}</b> — {name}" for secid, name in rows)
    _send(chat_id, f"Ваши бумаги:\n{lines}")


HANDLERS = {"/start": _handle_start, "/add": _handle_add, "/del": _handle_del, "/list": _handle_list}


def _handle_update(update: dict) -> None:
    msg = update.get("message")
    if not msg or "text" not in msg or "from" not in msg:
        return
    parts = msg["text"].strip().split(maxsplit=1)
    command = parts[0].split("@")[0].lower()
    arg = parts[1] if len(parts) > 1 else ""
    handler = HANDLERS.get(command)
    chat_id = msg["chat"]["id"]
    with get_session() as session:
        if handler:
            handler(session, chat_id, msg["from"], arg)
        else:
            _send(chat_id, HELP)


def run_bot() -> None:
    print("Бот запущен (long polling)")
    offset = 0
    while True:
        try:
            result = _api("getUpdates", timeout=50, offset=offset)
            for update in result.get("result", []):
                offset = update["update_id"] + 1
                try:
                    _handle_update(update)
                except Exception as e:  # noqa: BLE001 — одно сбойное сообщение не валит бота
                    print(f"Ошибка обработки update {update.get('update_id')}: {e}")
        except (httpx.TransportError, httpx.HTTPStatusError) as e:
            print(f"Сетевая ошибка polling: {e}")
            time.sleep(5)
