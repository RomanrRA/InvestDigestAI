"""Сборщик данных ЦБ РФ: официальные курсы валют (XML) и ключевая ставка (SOAP)."""

import xml.etree.ElementTree as ET
from datetime import date, timedelta

import httpx
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session

from ai_invest.models import FxRate, KeyRate

FX_CODES = ("USD", "EUR", "CNY")

_KEY_RATE_ENVELOPE = """<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <KeyRate xmlns="http://web.cbr.ru/">
      <fromDate>{from_date}</fromDate>
      <ToDate>{to_date}</ToDate>
    </KeyRate>
  </soap:Body>
</soap:Envelope>"""


def collect_fx_rates(session: Session, on_date: date) -> int:
    """Официальные курсы ЦБ на дату (XML_daily). ЦБ отдаёт курс «на завтра» после ~15:00 МСК."""
    resp = httpx.get(
        "https://www.cbr.ru/scripts/XML_daily.asp",
        params={"date_req": on_date.strftime("%d/%m/%Y")},
        timeout=30,
    )
    resp.raise_for_status()
    root = ET.fromstring(resp.content)
    # ЦБ может вернуть курс на ближайшую предыдущую дату — берём её из атрибута
    actual = root.attrib.get("Date")
    actual_date = date(*reversed([int(x) for x in actual.split(".")])) if actual else on_date
    total = 0
    for valute in root.iter("Valute"):
        code = valute.findtext("CharCode")
        if code not in FX_CODES:
            continue
        nominal = int(valute.findtext("Nominal").replace(" ", ""))
        value = float(valute.findtext("VunitRate", "").replace(",", ".") or 0) or (
            float(valute.findtext("Value").replace(",", ".")) / nominal
        )
        stmt = insert(FxRate).values(rate_date=actual_date, char_code=code, rate=value)
        session.execute(
            stmt.on_conflict_do_update(
                index_elements=[FxRate.rate_date, FxRate.char_code], set_={"rate": stmt.excluded.rate}
            )
        )
        total += 1
    session.commit()
    return total


def collect_key_rate(session: Session, on_date: date) -> int:
    """Ключевая ставка через SOAP DailyInfoWebServ. Берём окно 90 дней, чтобы поймать последнее изменение."""
    body = _KEY_RATE_ENVELOPE.format(from_date=(on_date - timedelta(days=90)).isoformat(), to_date=on_date.isoformat())
    resp = httpx.post(
        "https://www.cbr.ru/DailyInfoWebServ/DailyInfo.asmx",
        content=body.encode(),
        headers={"Content-Type": "text/xml; charset=utf-8", "SOAPAction": "http://web.cbr.ru/KeyRate"},
        timeout=30,
    )
    resp.raise_for_status()
    root = ET.fromstring(resp.content)
    total = 0
    for kr in root.iter():
        if not kr.tag.endswith("KR"):
            continue
        dt_text = next((c.text for c in kr if c.tag.endswith("DT")), None)
        rate_text = next((c.text for c in kr if c.tag.endswith("Rate")), None)
        if not dt_text or not rate_text:
            continue
        stmt = insert(KeyRate).values(rate_date=date.fromisoformat(dt_text[:10]), rate=float(rate_text))
        session.execute(
            stmt.on_conflict_do_update(index_elements=[KeyRate.rate_date], set_={"rate": stmt.excluded.rate})
        )
        total += 1
    session.commit()
    return total
