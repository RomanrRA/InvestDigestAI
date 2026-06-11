from datetime import date, datetime

from sqlalchemy import BigInteger, Date, DateTime, ForeignKey, Numeric, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


class Base(DeclarativeBase):
    pass


class Security(Base):
    """Бумага основного режима торгов MOEX (TQBR)."""

    __tablename__ = "securities"

    secid: Mapped[str] = mapped_column(String(36), primary_key=True)
    shortname: Mapped[str] = mapped_column(String(64))
    name: Mapped[str | None] = mapped_column(String(256))
    isin: Mapped[str | None] = mapped_column(String(12))
    list_level: Mapped[int | None]
    is_active: Mapped[bool] = mapped_column(default=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class DailyCandle(Base):
    """Дневной итог торгов по бумаге (история ISS)."""

    __tablename__ = "daily_candles"

    secid: Mapped[str] = mapped_column(ForeignKey("securities.secid"), primary_key=True)
    trade_date: Mapped[date] = mapped_column(Date, primary_key=True)
    open: Mapped[float | None] = mapped_column(Numeric(18, 6))
    high: Mapped[float | None] = mapped_column(Numeric(18, 6))
    low: Mapped[float | None] = mapped_column(Numeric(18, 6))
    close: Mapped[float | None] = mapped_column(Numeric(18, 6))
    volume: Mapped[int | None] = mapped_column(BigInteger)
    value_rub: Mapped[float | None] = mapped_column(Numeric(20, 2))  # оборот в рублях


class IndexValue(Base):
    """Дневное значение индекса (IMOEX, RTSI)."""

    __tablename__ = "index_values"

    indexid: Mapped[str] = mapped_column(String(36), primary_key=True)
    trade_date: Mapped[date] = mapped_column(Date, primary_key=True)
    close: Mapped[float | None] = mapped_column(Numeric(18, 4))


class FxRate(Base):
    """Официальный курс ЦБ на дату."""

    __tablename__ = "fx_rates"

    rate_date: Mapped[date] = mapped_column(Date, primary_key=True)
    char_code: Mapped[str] = mapped_column(String(3), primary_key=True)  # USD, EUR, CNY
    rate: Mapped[float] = mapped_column(Numeric(18, 6))  # за 1 единицу валюты


class KeyRate(Base):
    """Ключевая ставка ЦБ (дата начала действия значения)."""

    __tablename__ = "key_rates"

    rate_date: Mapped[date] = mapped_column(Date, primary_key=True)
    rate: Mapped[float] = mapped_column(Numeric(6, 2))


class MarketEvent(Base):
    """Событие рынка из любого источника (e-disclosure, новости — этап 0+)."""

    __tablename__ = "market_events"

    id: Mapped[int] = mapped_column(primary_key=True)
    source: Mapped[str] = mapped_column(String(32))  # moex | e-disclosure | manual ...
    kind: Mapped[str] = mapped_column(String(64))  # dividend | insider_deal | material_fact ...
    # стабильный ключ события для идемпотентного сбора (напр. "div:SBER:2025-07-18")
    dedup_key: Mapped[str] = mapped_column(String(128), unique=True)
    secid: Mapped[str | None] = mapped_column(String(36), index=True)
    title: Mapped[str] = mapped_column(Text)
    body: Mapped[str | None] = mapped_column(Text)
    url: Mapped[str | None] = mapped_column(Text)
    event_date: Mapped[date | None] = mapped_column(Date, index=True)  # дата привязки (отсечка/публикация)
    raw: Mapped[dict | None] = mapped_column(JSONB)
    collected_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    telegram_id: Mapped[int] = mapped_column(BigInteger, unique=True, index=True)
    username: Mapped[str | None] = mapped_column(String(64))
    first_name: Mapped[str | None] = mapped_column(String(128))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class LoginToken(Base):
    """Одноразовый токен входа: сайт создаёт, бот подтверждает по /start <token>."""

    __tablename__ = "login_tokens"

    token: Mapped[str] = mapped_column(String(64), primary_key=True)
    status: Mapped[str] = mapped_column(String(16), default="pending")  # pending | confirmed | used
    telegram_id: Mapped[int | None] = mapped_column(BigInteger)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    confirmed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class WebSession(Base):
    __tablename__ = "sessions"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))


class WatchlistItem(Base):
    __tablename__ = "watchlist_items"

    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), primary_key=True)
    secid: Mapped[str] = mapped_column(ForeignKey("securities.secid"), primary_key=True)
    added_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class Digest(Base):
    """Сгенерированный дайджест."""

    __tablename__ = "digests"

    id: Mapped[int] = mapped_column(primary_key=True)
    digest_date: Mapped[date] = mapped_column(Date, index=True)
    kind: Mapped[str] = mapped_column(String(32), default="morning")
    content: Mapped[str] = mapped_column(Text)
    model: Mapped[str | None] = mapped_column(String(128))
    status: Mapped[str] = mapped_column(String(16), default="draft")  # draft | posted
    posted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
