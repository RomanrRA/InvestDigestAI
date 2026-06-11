"""Сборщик данных MOEX ISS (https://iss.moex.com).

Бесплатный анонимный доступ: итоги торгов (history) доступны без подписки.
Формат ответа ISS: {"<table>": {"columns": [...], "data": [[...], ...]}}.
"""

import time
from datetime import date

import httpx
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session

from ai_invest.models import DailyCandle, IndexValue, Security

ISS = "https://iss.moex.com/iss"
INDICES = ("IMOEX", "RTSI")


def _rows(payload: dict, table: str) -> list[dict]:
    block = payload[table]
    cols = block["columns"]
    return [dict(zip(cols, row)) for row in block["data"]]


def _get(client: httpx.Client, path: str, **params) -> dict:
    # ISS троттлит частые запросы (обрывает соединение) — ретраим с паузой
    last_exc: Exception | None = None
    for attempt in range(4):
        try:
            resp = client.get(f"{ISS}{path}", params={"iss.meta": "off", **params})
            resp.raise_for_status()
            return resp.json()
        except (httpx.TransportError, httpx.HTTPStatusError) as e:
            last_exc = e
            time.sleep(2**attempt)
    raise last_exc


def sync_securities(session: Session) -> int:
    """Обновляет справочник бумаг основного режима TQBR."""
    with httpx.Client(timeout=30) as client:
        payload = _get(
            client,
            "/engines/stock/markets/shares/boards/TQBR/securities.json",
            **{"iss.only": "securities", "securities.columns": "SECID,SHORTNAME,SECNAME,ISIN,LISTLEVEL"},
        )
    rows = _rows(payload, "securities")
    for r in rows:
        stmt = insert(Security).values(
            secid=r["SECID"],
            shortname=r["SHORTNAME"],
            name=r.get("SECNAME"),
            isin=r.get("ISIN"),
            list_level=r.get("LISTLEVEL"),
            is_active=True,
        )
        stmt = stmt.on_conflict_do_update(
            index_elements=[Security.secid],
            set_={
                "shortname": stmt.excluded.shortname,
                "name": stmt.excluded.name,
                "isin": stmt.excluded.isin,
                "list_level": stmt.excluded.list_level,
                "is_active": True,
            },
        )
        session.execute(stmt)
    session.commit()
    return len(rows)


def collect_daily_candles(session: Session, trade_date: date) -> int:
    """Итоги торгов TQBR за дату. История ISS пагинируется блоками по 100."""
    known = {s for (s,) in session.query(Security.secid).all()}
    total = 0
    with httpx.Client(timeout=30) as client:
        start = 0
        while True:
            payload = _get(
                client,
                "/history/engines/stock/markets/shares/boards/TQBR/securities.json",
                **{
                    "date": trade_date.isoformat(),
                    "start": start,
                    "iss.only": "history,history.cursor",
                    "history.columns": "SECID,TRADEDATE,OPEN,HIGH,LOW,CLOSE,VOLUME,VALUE",
                },
            )
            rows = _rows(payload, "history")
            if not rows:
                break
            for r in rows:
                if r["SECID"] not in known:
                    continue  # бумага вне справочника (делистинг между синками)
                stmt = insert(DailyCandle).values(
                    secid=r["SECID"],
                    trade_date=trade_date,
                    open=r["OPEN"],
                    high=r["HIGH"],
                    low=r["LOW"],
                    close=r["CLOSE"],
                    volume=r["VOLUME"],
                    value_rub=r["VALUE"],
                )
                session.execute(
                    stmt.on_conflict_do_update(
                        index_elements=[DailyCandle.secid, DailyCandle.trade_date],
                        set_={c: getattr(stmt.excluded, c) for c in ("open", "high", "low", "close", "volume", "value_rub")},
                    )
                )
                total += 1
            cursor = _rows(payload, "history.cursor")[0]
            start += cursor["PAGESIZE"]
            if start >= cursor["TOTAL"]:
                break
    session.commit()
    return total


def collect_index_values(session: Session, trade_date: date) -> int:
    """Дневные значения IMOEX и RTSI."""
    total = 0
    with httpx.Client(timeout=30) as client:
        for indexid in INDICES:
            # без указания доски: IMOEX живёт на SNDX, RTSI — на одноимённой доске RTSI
            payload = _get(
                client,
                f"/history/engines/stock/markets/index/securities/{indexid}.json",
                **{
                    "from": trade_date.isoformat(),
                    "till": trade_date.isoformat(),
                    "iss.only": "history",
                    "history.columns": "SECID,TRADEDATE,CLOSE",
                },
            )
            for r in _rows(payload, "history")[:1]:
                stmt = insert(IndexValue).values(indexid=indexid, trade_date=trade_date, close=r["CLOSE"])
                session.execute(
                    stmt.on_conflict_do_update(
                        index_elements=[IndexValue.indexid, IndexValue.trade_date],
                        set_={"close": stmt.excluded.close},
                    )
                )
                total += 1
    session.commit()
    return total
