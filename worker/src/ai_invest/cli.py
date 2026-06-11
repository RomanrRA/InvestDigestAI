"""CLI worker-сервиса.

Команды:
  ai-invest init-db                          — создать таблицы
  ai-invest sync-securities                  — обновить справочник бумаг TQBR
  ai-invest collect [--date YYYY-MM-DD]      — итоги торгов + индексы + курсы + ставка
  ai-invest digest [--date ...] [--post]     — сгенерировать дайджест (и опционально запостить)
  ai-invest run-morning                      — collect за вчера + digest + post (для cron)
"""

import argparse
import sys
from datetime import date, datetime, timedelta

from ai_invest.collectors import cbr, moex
from ai_invest.db import engine, get_session
from ai_invest.models import Base


def _parse_date(value: str | None, default: date) -> date:
    return datetime.strptime(value, "%Y-%m-%d").date() if value else default


def cmd_init_db(_args) -> None:
    Base.metadata.create_all(engine)
    print("Таблицы созданы")


def cmd_sync_securities(_args) -> None:
    with get_session() as session:
        n = moex.sync_securities(session)
    print(f"Справочник обновлён: {n} бумаг")


def _collect(session, on_date: date) -> None:
    candles = moex.collect_daily_candles(session, on_date)
    indices = moex.collect_index_values(session, on_date)
    fx = cbr.collect_fx_rates(session, on_date)
    kr = cbr.collect_key_rate(session, on_date)
    print(f"{on_date}: свечей {candles}, индексов {indices}, курсов {fx}, точек ставки {kr}")


def cmd_collect(args) -> None:
    on_date = _parse_date(args.date, date.today() - timedelta(days=1))
    with get_session() as session:
        _collect(session, on_date)


def cmd_digest(args) -> None:
    from ai_invest.digest.generate import generate_digest
    from ai_invest.publish import post_digest

    on_date = _parse_date(args.date, date.today() - timedelta(days=1))
    with get_session() as session:
        digest = generate_digest(session, on_date)
        print(f"--- Дайджест за {on_date} (id={digest.id}, model={digest.model}) ---")
        print(digest.content)
        if args.post:
            posted = post_digest(session, digest)
            print(f"--- Опубликован: {', '.join(posted)} ---")


def cmd_max_chats(_args) -> None:
    """Показывает чаты MAX, где состоит бот, — для получения chat_id канала."""
    from ai_invest.max_messenger import list_chats

    for chat in list_chats():
        print(f"{chat.get('chat_id')}: {chat.get('title')} ({chat.get('type')})")


def cmd_backfill(args) -> None:
    """Догрузка истории торгов за период (выходные и праздники дают 0 строк — это нормально)."""
    date_from = _parse_date(args.date_from, None)
    date_till = _parse_date(args.date_till, date.today() - timedelta(days=1))
    with get_session() as session:
        d = date_from
        while d <= date_till:
            if d.weekday() < 5:
                candles = moex.collect_daily_candles(session, d)
                indices = moex.collect_index_values(session, d)
                print(f"{d}: свечей {candles}, индексов {indices}")
            d += timedelta(days=1)
        cbr.collect_fx_rates(session, date_till)
        cbr.collect_key_rate(session, date_till)


def cmd_run_morning(_args) -> None:
    """Полный утренний цикл: данные за вчера → дайджест → пост. Запускать cron'ом ~8:30 МСК."""
    from ai_invest.digest.generate import generate_digest
    from ai_invest.publish import post_digest

    yesterday = date.today() - timedelta(days=1)
    with get_session() as session:
        moex.sync_securities(session)
        _collect(session, yesterday)
        try:
            digest = generate_digest(session, yesterday)
        except RuntimeError as e:
            print(f"Пропуск (выходной?): {e}")
            return
        post_digest(session, digest)
        print(f"Дайджест за {yesterday} опубликован")
        from ai_invest.digest.personal import send_personal_digests

        sent = send_personal_digests(session, yesterday)
        print(f"Персональных дайджестов отправлено: {sent}")


def cmd_run_bot(_args) -> None:
    from ai_invest.bot import run_bot

    run_bot()


def main() -> None:
    parser = argparse.ArgumentParser(prog="ai-invest")
    sub = parser.add_subparsers(dest="command", required=True)

    sub.add_parser("init-db").set_defaults(func=cmd_init_db)
    sub.add_parser("sync-securities").set_defaults(func=cmd_sync_securities)

    p = sub.add_parser("collect")
    p.add_argument("--date")
    p.set_defaults(func=cmd_collect)

    p = sub.add_parser("digest")
    p.add_argument("--date")
    p.add_argument("--post", action="store_true")
    p.set_defaults(func=cmd_digest)

    p = sub.add_parser("backfill")
    p.add_argument("--from", dest="date_from", required=True)
    p.add_argument("--till", dest="date_till")
    p.set_defaults(func=cmd_backfill)

    sub.add_parser("run-morning").set_defaults(func=cmd_run_morning)
    sub.add_parser("run-bot").set_defaults(func=cmd_run_bot)
    sub.add_parser("max-chats").set_defaults(func=cmd_max_chats)

    args = parser.parse_args()
    try:
        args.func(args)
    except Exception as e:  # noqa: BLE001 — CLI: показываем причину без трейсбека
        print(f"Ошибка: {e}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
