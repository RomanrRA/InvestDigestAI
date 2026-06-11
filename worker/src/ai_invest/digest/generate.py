"""Генерация утреннего дайджеста: сводка из БД → LLM → markdown-текст."""

import json
from datetime import date, timedelta

from openai import OpenAI
from sqlalchemy import desc, select
from sqlalchemy.orm import Session

from ai_invest.config import settings
from ai_invest.models import DailyCandle, Digest, FxRate, IndexValue, KeyRate, Security

# Минимальный дневной оборот, чтобы бумага попала в топ движений (отсекаем неликвид)
MIN_VALUE_RUB = 100_000_000

SYSTEM_PROMPT = """Ты — редактор утреннего дайджеста по российскому фондовому рынку.
Пиши на русском, сжато и по делу, без воды и клише. Аудитория — частные инвесторы.

Формат (Telegram HTML, разрешены только теги <b> и <i>):
- Заголовок с датой и эмодзи 📊
- Блок «Индексы и ставки»: IMOEX/RTSI с изменением в %, ключевая ставка, курсы USD/EUR/CNY
- Блок «Лидеры роста» и «Лидеры падения»: тикер, название, % изменения; одной фразой возможная причина, ТОЛЬКО если уверен, иначе без причины
- Короткий вывод о настроении рынка (1-2 предложения)

Жёсткие правила:
- НЕ давай рекомендаций покупать/продавать. Никаких «стоит присмотреться», «привлекательна для покупки».
- Не выдумывай новости и причины движений. Нет уверенности — не пиши причину.
- Объём ответа — до 2500 символов.
- В конце обязательная строка: <i>Не является индивидуальной инвестиционной рекомендацией.</i>"""


def _pct(new: float | None, old: float | None) -> float | None:
    if not new or not old:
        return None
    return round((float(new) / float(old) - 1) * 100, 2)


def build_market_summary(session: Session, on_date: date) -> dict:
    """Собирает из БД структурированную сводку за торговый день on_date."""
    prev_date = session.scalar(
        select(DailyCandle.trade_date)
        .where(DailyCandle.trade_date < on_date)
        .order_by(desc(DailyCandle.trade_date))
        .limit(1)
    )

    indices = {}
    for indexid in ("IMOEX", "RTSI"):
        cur = session.scalar(select(IndexValue.close).where(IndexValue.indexid == indexid, IndexValue.trade_date == on_date))
        prev = (
            session.scalar(select(IndexValue.close).where(IndexValue.indexid == indexid, IndexValue.trade_date == prev_date))
            if prev_date
            else None
        )
        if cur:
            indices[indexid] = {"close": float(cur), "change_pct": _pct(cur, prev)}

    movers = []
    if prev_date:
        cur_c = {c.secid: c for c in session.scalars(select(DailyCandle).where(DailyCandle.trade_date == on_date))}
        prev_c = {c.secid: c for c in session.scalars(select(DailyCandle).where(DailyCandle.trade_date == prev_date))}
        names = dict(session.execute(select(Security.secid, Security.shortname)).all())
        for secid, c in cur_c.items():
            p = prev_c.get(secid)
            change = _pct(c.close, p.close if p else None)
            if change is None or (c.value_rub or 0) < MIN_VALUE_RUB:
                continue
            movers.append({"secid": secid, "name": names.get(secid, secid), "change_pct": change, "close": float(c.close)})
        movers.sort(key=lambda m: m["change_pct"])

    key_rate = session.scalar(select(KeyRate.rate).order_by(desc(KeyRate.rate_date)).limit(1))
    fx = {}
    for code in ("USD", "EUR", "CNY"):
        rate = session.scalar(
            select(FxRate.rate).where(FxRate.char_code == code).order_by(desc(FxRate.rate_date)).limit(1)
        )
        if rate:
            fx[code] = float(rate)

    return {
        "trade_date": on_date.isoformat(),
        "indices": indices,
        "key_rate": float(key_rate) if key_rate else None,
        "fx_rates": fx,
        "top_gainers": list(reversed(movers[-5:])),
        "top_losers": movers[:5],
    }


def generate_digest(session: Session, on_date: date) -> Digest:
    """Генерирует дайджест по итогам торгов on_date и сохраняет в БД (status=draft)."""
    summary = build_market_summary(session, on_date)
    if not summary["indices"] and not summary["top_gainers"]:
        raise RuntimeError(f"Нет данных за {on_date} — сначала запусти collect")

    client = OpenAI(base_url="https://openrouter.ai/api/v1", api_key=settings.openrouter_api_key)
    resp = client.chat.completions.create(
        model=settings.digest_model,
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": "Данные торгового дня:\n" + json.dumps(summary, ensure_ascii=False, indent=1)},
        ],
        temperature=0.4,
    )
    content = resp.choices[0].message.content.strip()

    digest = Digest(digest_date=on_date, kind="morning", content=content, model=settings.digest_model)
    session.add(digest)
    session.commit()
    return digest
