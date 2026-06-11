import type { Metadata } from "next";
import Link from "next/link";
import { getStocks } from "@/lib/queries";
import { formatPct, formatTurnover } from "@/lib/format";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Акции МосБиржи",
  description: "Котировки акций основного режима торгов Московской биржи: цены закрытия, изменение за день, обороты.",
};

export default async function StocksPage() {
  const stocks = await getStocks();

  return (
    <div className="mx-auto max-w-4xl px-5 py-14">
      <h1 className="text-3xl font-bold mb-2">Акции МосБиржи</h1>
      <p className="text-muted text-sm mb-8">
        {stocks.length} бумаг основного режима торгов, отсортированы по обороту. Данные — итоги
        последнего торгового дня.
      </p>
      <div className="rounded-2xl border border-edge bg-surface overflow-hidden">
        <div className="grid grid-cols-[1fr_auto_auto_auto] gap-x-6 px-5 py-3 text-xs text-muted border-b border-edge">
          <span>Бумага</span>
          <span className="text-right w-24">Закрытие</span>
          <span className="text-right w-20">Изм.</span>
          <span className="text-right w-28 hidden sm:block">Оборот</span>
        </div>
        <ul className="divide-y divide-edge/60">
          {stocks.map((s) => (
            <li key={s.secid}>
              <Link
                href={`/stocks/${s.secid}`}
                className="grid grid-cols-[1fr_auto_auto_auto] gap-x-6 items-center px-5 py-3 hover:bg-background/60 transition-colors"
              >
                <span className="min-w-0">
                  <span className="font-medium">{s.secid}</span>
                  <span className="text-muted text-sm ml-2 truncate">{s.shortname}</span>
                </span>
                <span className="text-right w-24 tabular-nums">
                  {s.close.toLocaleString("ru-RU")} ₽
                </span>
                <span
                  className={`text-right w-20 tabular-nums text-sm ${
                    (s.changePct ?? 0) >= 0 ? "text-accent" : "text-negative"
                  }`}
                >
                  {formatPct(s.changePct)}
                </span>
                <span className="text-right w-28 tabular-nums text-sm text-muted hidden sm:block">
                  {formatTurnover(s.valueRub)}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
