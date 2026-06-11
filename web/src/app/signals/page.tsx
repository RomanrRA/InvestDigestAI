import type { Metadata } from "next";
import Link from "next/link";
import { getDividendSignals } from "@/lib/queries";
import { formatDateRu, isPastDate } from "@/lib/format";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Сигналы — дивиденды эмитентов",
  description:
    "Лента дивидендных событий российских эмитентов: размер выплаты на акцию, дивидендная доходность, дата закрытия реестра.",
};

export default async function SignalsPage() {
  const signals = await getDividendSignals(60);

  return (
    <div className="mx-auto max-w-3xl px-5 py-14">
      <h1 className="text-3xl font-bold mb-2">Сигналы: дивиденды</h1>
      <p className="text-muted text-sm mb-8">
        Объявленные дивиденды эмитентов МосБиржи — размер на акцию, ориентировочная доходность к
        последней цене и дата закрытия реестра. Предстоящие отсечки — сверху, ниже — последние
        прошедшие выплаты для истории. Источник — MOEX.
      </p>

      {signals.length === 0 ? (
        <p className="text-muted">Пока нет данных.</p>
      ) : (
        <ul className="space-y-3">
          {signals.map((s) => {
            const past = isPastDate(s.eventDate);
            return (
              <li
                key={`${s.secid}-${s.eventDate}`}
                className={`rounded-xl border border-edge bg-surface p-5 flex items-center justify-between gap-4 ${
                  past ? "opacity-60" : ""
                }`}
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <Link href={`/stocks/${s.secid}`} className="font-semibold hover:text-accent transition-colors">
                      {s.secid}
                    </Link>
                    <span className="text-muted text-sm truncate">{s.shortname}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-xs rounded-full px-2 py-0.5 ${
                        past ? "bg-edge text-muted" : "bg-accent-dim text-accent"
                      }`}
                    >
                      {past ? "реестр закрыт" : "предстоит"}
                    </span>
                    <span className="text-sm text-muted">{formatDateRu(s.eventDate)}</span>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <p className="font-semibold tabular-nums">
                    {s.value.toLocaleString("ru-RU")} {s.currency}
                  </p>
                  {s.yieldPct !== null && (
                    <p className="text-accent text-sm tabular-nums">~{s.yieldPct}% дох.</p>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <p className="mt-8 text-xs text-muted">
        Дивидендная доходность рассчитана к последней известной цене закрытия и носит справочный
        характер. Не является индивидуальной инвестиционной рекомендацией.
      </p>
    </div>
  );
}
