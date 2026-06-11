import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getStock, getStockDividends } from "@/lib/queries";
import { getCurrentUser } from "@/lib/auth";
import { sql } from "@/lib/db";
import { formatDateRu, formatPct, formatTurnover } from "@/lib/format";
import { PriceChart } from "@/components/PriceChart";
import { WatchButton } from "@/components/WatchButton";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ secid: string }> };

const SECID_RE = /^[A-Za-z0-9@-]{1,36}$/;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { secid } = await params;
  if (!SECID_RE.test(secid)) return {};
  const stock = await getStock(secid.toUpperCase());
  if (!stock) return {};
  return {
    title: `${stock.shortname} (${stock.secid}) — котировки и динамика`,
    description: `Динамика акций ${stock.name ?? stock.shortname}: цены закрытия, изменение за день, обороты торгов на МосБирже.`,
  };
}

export default async function StockPage({ params }: Props) {
  const { secid: raw } = await params;
  if (!SECID_RE.test(raw)) notFound();

  const stock = await getStock(raw.toUpperCase());
  if (!stock || stock.series.length === 0) notFound();

  const dividends = await getStockDividends(stock.secid);
  const user = await getCurrentUser();
  let watched = false;
  if (user) {
    const rows = await sql`
      select 1 from watchlist_items where user_id = ${user.id} and secid = ${stock.secid}
    `;
    watched = Boolean(rows[0]);
  }

  const last = stock.series[stock.series.length - 1];
  const prev = stock.series.length > 1 ? stock.series[stock.series.length - 2] : null;
  const changePct = prev ? (last.close / prev.close - 1) * 100 : null;
  const closes = stock.series.map((p) => p.close);
  const periodMin = Math.min(...closes);
  const periodMax = Math.max(...closes);

  return (
    <div className="mx-auto max-w-4xl px-5 py-14">
      <Link href="/stocks" className="text-sm text-muted hover:text-accent transition-colors">
        ← Все акции
      </Link>

      <div className="mt-4 mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">
            {stock.shortname} <span className="text-muted font-normal text-xl">{stock.secid}</span>
          </h1>
          {stock.name && <p className="text-muted text-sm mt-1">{stock.name}</p>}
          <div className="mt-3">
            <WatchButton secid={stock.secid} initialWatched={watched} loggedIn={Boolean(user)} />
          </div>
        </div>
        <div className="text-right">
          <p className="text-3xl font-bold tabular-nums">{last.close.toLocaleString("ru-RU")} ₽</p>
          {changePct !== null && (
            <p className={`tabular-nums ${changePct >= 0 ? "text-accent" : "text-negative"}`}>
              {formatPct(changePct)} за день
            </p>
          )}
        </div>
      </div>

      <div className="rounded-2xl border border-edge bg-surface p-6 mb-6">
        <PriceChart series={stock.series} />
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="rounded-xl border border-edge bg-surface p-4">
          <p className="text-xs text-muted mb-1">Оборот за день</p>
          <p className="font-semibold tabular-nums">{formatTurnover(last.valueRub)}</p>
        </div>
        <div className="rounded-xl border border-edge bg-surface p-4">
          <p className="text-xs text-muted mb-1">Диапазон дня</p>
          <p className="font-semibold tabular-nums">
            {last.low?.toLocaleString("ru-RU")} – {last.high?.toLocaleString("ru-RU")}
          </p>
        </div>
        <div className="rounded-xl border border-edge bg-surface p-4">
          <p className="text-xs text-muted mb-1">Мин/макс за период</p>
          <p className="font-semibold tabular-nums">
            {periodMin.toLocaleString("ru-RU")} – {periodMax.toLocaleString("ru-RU")}
          </p>
        </div>
        <div className="rounded-xl border border-edge bg-surface p-4">
          <p className="text-xs text-muted mb-1">Уровень листинга</p>
          <p className="font-semibold">{stock.listLevel ?? "—"}</p>
        </div>
      </div>

      {dividends.length > 0 && (
        <div className="mt-6">
          <h2 className="font-semibold mb-3">Дивиденды</h2>
          <ul className="rounded-2xl border border-edge bg-surface divide-y divide-edge/60 overflow-hidden">
            {dividends.map((d) => (
              <li key={d.eventDate} className="flex items-center justify-between px-5 py-3">
                <span className="text-sm text-muted">Реестр {formatDateRu(d.eventDate)}</span>
                <span className="tabular-nums">
                  {d.value.toLocaleString("ru-RU")} {d.currency}
                  {d.yieldPct !== null && (
                    <span className="text-accent text-sm ml-2">~{d.yieldPct}%</span>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <p className="mt-6 text-xs text-muted">
        Итоги торгов за {formatDateRu(last.date)} · данные МосБиржи · не является индивидуальной
        инвестиционной рекомендацией.
      </p>
    </div>
  );
}
