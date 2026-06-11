"""Персональные дайджесты: по watchlist каждого пользователя, доставка в Telegram."""

import json
from datetime import date

from openai import OpenAI
from sqlalchemy import select
from sqlalchemy.orm import Session

from ai_invest.config import settings
from ai_invest.digest.generate import build_market_summary
from ai_invest.models import DailyCandle, Security, User, WatchlistItem

SYSTEM_PROMPT = """Ты — персональный аналитик частного инвестора (рынок РФ).
Тебе дают рыночный контекст и движения бумаг из списка пользователя.

Напиши короткую утреннюю сводку (Telegram HTML, только теги <b> и <i>, до 1500 символов):
- 1 фраза о рынке в целом
- по каждой бумаге пользователя: закрытие, % за день; одной фразой контекст, ТОЛЬКО если уверен
- если какая-то бумага двигалась заметно сильнее рынка — подчеркни это

Жёсткие правила: никаких рекомендаций покупать/продавать; не выдумывай причины движений.
В конце строка: <i>Не является индивидуальной инвестиционной рекомендацией.</i>"""


def _watchlist_moves(session: Session, secids: list[str], on_date: date) -> list[dict]:
    rows = session.execute(
        select(DailyCandle.secid, DailyCandle.trade_date, DailyCandle.close, Security.shortname)
        .join(Security, Security.secid == DailyCandle.secid)
        .where(DailyCandle.secid.in_(secids), DailyCandle.close.isnot(None))
        .order_by(DailyCandle.secid, DailyCandle.trade_date.desc())
    ).all()
    by_sec: dict[str, list] = {}
    for r in rows:
        by_sec.setdefault(r.secid, []).append(r)
    moves = []
    for secid, candles in by_sec.items():
        cur = next((c for c in candles if c.trade_date <= on_date), None)
        prev = next((c for c in candles if cur and c.trade_date < cur.trade_date), None)
        if not cur:
            continue
        moves.append(
            {
                "secid": secid,
                "name": cur.shortname,
                "close": float(cur.close),
                "change_pct": round((float(cur.close) / float(prev.close) - 1) * 100, 2) if prev else None,
            }
        )
    return moves


def send_personal_digests(session: Session, on_date: date) -> int:
    """Шлёт каждому пользователю с непустым watchlist его сводку. Возвращает число отправок."""
    from ai_invest.bot import _send  # локальный импорт: bot тянет polling-зависимости

    users = session.execute(
        select(User).join(WatchlistItem, WatchlistItem.user_id == User.id).distinct()
    ).scalars().all()
    if not users:
        return 0

    market = build_market_summary(session, on_date)
    context = {k: market[k] for k in ("trade_date", "indices", "key_rate", "fx_rates")}
    client = OpenAI(base_url="https://openrouter.ai/api/v1", api_key=settings.openrouter_api_key)

    sent = 0
    for user in users:
        secids = [
            w.secid for w in session.execute(
                select(WatchlistItem).where(WatchlistItem.user_id == user.id)
            ).scalars()
        ]
        moves = _watchlist_moves(session, secids, on_date)
        if not moves:
            continue
        try:
            resp = client.chat.completions.create(
                model=settings.digest_model,
                messages=[
                    {"role": "system", "content": SYSTEM_PROMPT},
                    {
                        "role": "user",
                        "content": "Рынок:\n" + json.dumps(context, ensure_ascii=False)
                        + "\n\nБумаги пользователя:\n" + json.dumps(moves, ensure_ascii=False),
                    },
                ],
                temperature=0.4,
            )
            _send(user.telegram_id, resp.choices[0].message.content.strip())
            sent += 1
        except Exception as e:  # noqa: BLE001 — один пользователь не должен валить рассылку
            print(f"Персональный дайджест для user={user.id} не отправлен: {e}")
    return sent
