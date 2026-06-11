import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { sql } from "@/lib/db";
import { formatPct, formatTurnover } from "@/lib/format";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Мои бумаги" };

export default async function WatchlistPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const rows = await sql`
    with ranked as (
      select secid, close, value_rub,
             row_number() over (partition by secid order by trade_date desc) as rn
      from daily_candles
      where close is not null
    )
    select w.secid, s.shortname, cur.close, prev.close as prev_close, cur.value_rub
    from watchlist_items w
    join securities s on s.secid = w.secid
    left join ranked cur on cur.secid = w.secid and cur.rn = 1
    left join ranked prev on prev.secid = w.secid and prev.rn = 2
    where w.user_id = ${user.id}
    order by w.secid
  `;

  return (
    <div className="mx-auto max-w-4xl px-5 py-14">
      <div className="flex items-center justify-between mb-2">
        <h1 className="text-3xl font-bold">Мои бумаги</h1>
        <form action="/api/auth/logout" method="post">
          <button className="text-sm text-muted hover:text-foreground transition-colors">
            Выйти ({user.firstName ?? user.username ?? "профиль"})
          </button>
        </form>
      </div>
      <p className="text-muted text-sm mb-8">
        Каждое торговое утро бот пришлёт вам персональный дайджест по этим бумагам в Telegram.
        Управлять списком можно и в боте: /add, /del, /list.
      </p>

      {rows.length === 0 ? (
        <div className="rounded-2xl border border-edge bg-surface p-10 text-center">
          <p className="mb-4">Список пуст.</p>
          <Link href="/stocks" className="text-accent hover:underline">
            Выбрать бумаги →
          </Link>
        </div>
      ) : (
        <ul className="rounded-2xl border border-edge bg-surface divide-y divide-edge/60 overflow-hidden">
          {rows.map((r) => {
            const change =
              r.close && r.prev_close ? (Number(r.close) / Number(r.prev_close) - 1) * 100 : null;
            return (
              <li key={r.secid as string}>
                <Link
                  href={`/stocks/${r.secid}`}
                  className="grid grid-cols-[1fr_auto_auto] gap-x-6 items-center px-5 py-3 hover:bg-background/60 transition-colors"
                >
                  <span>
                    <span className="font-medium">{r.secid as string}</span>
                    <span className="text-muted text-sm ml-2">{r.shortname as string}</span>
                  </span>
                  <span className="text-right tabular-nums">
                    {r.close ? `${Number(r.close).toLocaleString("ru-RU")} ₽` : "—"}
                  </span>
                  <span
                    className={`text-right w-20 tabular-nums text-sm ${
                      (change ?? 0) >= 0 ? "text-accent" : "text-negative"
                    }`}
                  >
                    {formatPct(change)}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
