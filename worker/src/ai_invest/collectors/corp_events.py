"""Корпоративные события эмитентов из MOEX ISS.

MVP: дивиденды (объявленные размеры и даты закрытия реестра) — официальный
сигнал без капчи. Пишутся в market_events с идемпотентным dedup_key, поэтому
повторный сбор не создаёт дублей и возвращает только реально новые события.

Сделки инсайдеров/существенные факты живут на e-disclosure (капча, особенно с
серверных IP) — отдельный коллектор появится при наличии платного API
Интерфакса/СКРИН; схема market_events это уже поддерживает (другой source/kind).
"""

import time
from datetime import date, datetime

from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session

from ai_invest.collectors.moex import ISS, _get, _rows
from ai_invest.models import DailyCandle, MarketEvent, Security

import httpx


def _to_float(value) -> float | None:
    if value in (None, ""):
        return None
    return float(str(value).replace(",", ".").replace(" ", ""))


def _last_close(session: Session, secid: str) -> float | None:
    return session.scalar(
        select(DailyCandle.close)
        .where(DailyCandle.secid == secid, DailyCandle.close.isnot(None))
        .order_by(DailyCandle.trade_date.desc())
        .limit(1)
    )


def collect_dividends(session: Session, secids: list[str]) -> int:
    """Собирает дивиденды по списку бумаг. Возвращает число новых событий."""
    names = dict(session.execute(select(Security.secid, Security.shortname)).all())
    new_count = 0
    with httpx.Client(timeout=30) as client:
        for secid in secids:
            try:
                payload = _get(client, f"/securities/{secid}/dividends.json", **{"iss.only": "dividends"})
            except (httpx.HTTPStatusError, httpx.TransportError):
                continue
            for r in _rows(payload, "dividends"):
                reg = r.get("registryclosedate")
                value = _to_float(r.get("value"))
                if not reg or value is None:
                    continue
                event_date = date.fromisoformat(reg[:10])
                currency = r.get("currencyid", "RUB")
                close = _last_close(session, secid)
                yield_pct = round(value / float(close) * 100, 2) if close else None
                name = names.get(secid, secid)
                title = f"Дивиденды {name} ({secid}): {value} {currency} на акцию"
                if yield_pct is not None:
                    title += f" — доходность ~{yield_pct}%"

                stmt = insert(MarketEvent).values(
                    source="moex",
                    kind="dividend",
                    dedup_key=f"div:{secid}:{reg[:10]}",
                    secid=secid,
                    title=title,
                    body=f"Дата закрытия реестра: {event_date.strftime('%d.%m.%Y')}.",
                    url=f"https://www.moex.com/ru/issue.aspx?code={secid}",
                    event_date=event_date,
                    raw={"value": value, "currency": currency, "yield_pct": yield_pct, "registryclosedate": reg},
                ).on_conflict_do_nothing(index_elements=[MarketEvent.dedup_key]).returning(MarketEvent.id)
                if session.execute(stmt).first():
                    new_count += 1
            time.sleep(0.1)  # бережём ISS от троттлинга
    session.commit()
    return new_count
