import { sql } from "./db";

export type IndexSnapshot = {
  indexid: string;
  close: number;
  changePct: number | null;
  tradeDate: string;
};

export type MarketSnapshot = {
  indices: IndexSnapshot[];
  keyRate: number | null;
  fx: { code: string; rate: number }[];
};

export type DigestRow = {
  id: number;
  digest_date: string;
  content: string;
  created_at: string;
};

export async function getMarketSnapshot(): Promise<MarketSnapshot> {
  const [indices, keyRates, fx] = await Promise.all([
    sql`
      with ranked as (
        select indexid, trade_date, close,
               row_number() over (partition by indexid order by trade_date desc) as rn
        from index_values
      )
      select cur.indexid, cur.trade_date::text as trade_date, cur.close, prev.close as prev_close
      from ranked cur
      left join ranked prev on prev.indexid = cur.indexid and prev.rn = 2
      where cur.rn = 1
      order by cur.indexid
    `,
    sql`select rate from key_rates order by rate_date desc limit 1`,
    sql`
      select distinct on (char_code) char_code, rate
      from fx_rates
      where char_code in ('USD', 'EUR', 'CNY')
      order by char_code, rate_date desc
    `,
  ]);

  return {
    indices: indices.map((r) => ({
      indexid: r.indexid as string,
      close: Number(r.close),
      changePct: r.prev_close ? (Number(r.close) / Number(r.prev_close) - 1) * 100 : null,
      tradeDate: String(r.trade_date),
    })),
    keyRate: keyRates[0] ? Number(keyRates[0].rate) : null,
    fx: fx.map((r) => ({ code: r.char_code as string, rate: Number(r.rate) })),
  };
}

/** Последний дайджест на каждую дату (перегенерации перекрывают старые черновики). */
export async function getDigests(limit = 30): Promise<DigestRow[]> {
  const rows = await sql`
    select distinct on (digest_date) id, digest_date::text as digest_date, content, created_at::text as created_at
    from digests
    order by digest_date desc, id desc
    limit ${limit}
  `;
  return rows as unknown as DigestRow[];
}

export type StockListItem = {
  secid: string;
  shortname: string;
  close: number;
  changePct: number | null;
  valueRub: number;
};

export type StockDetail = {
  secid: string;
  shortname: string;
  name: string | null;
  listLevel: number | null;
  series: { date: string; close: number; valueRub: number; high: number | null; low: number | null }[];
};

/** Все бумаги с последними итогами торгов, ликвидные сверху. */
export async function getStocks(): Promise<StockListItem[]> {
  const rows = await sql`
    with ranked as (
      select secid, trade_date, close, value_rub,
             row_number() over (partition by secid order by trade_date desc) as rn
      from daily_candles
      where close is not null
    )
    select s.secid, s.shortname, cur.close, prev.close as prev_close, cur.value_rub
    from ranked cur
    join securities s on s.secid = cur.secid
    left join ranked prev on prev.secid = cur.secid and prev.rn = 2
    where cur.rn = 1
    order by cur.value_rub desc nulls last
  `;
  return rows.map((r) => ({
    secid: r.secid as string,
    shortname: r.shortname as string,
    close: Number(r.close),
    changePct: r.prev_close ? (Number(r.close) / Number(r.prev_close) - 1) * 100 : null,
    valueRub: Number(r.value_rub ?? 0),
  }));
}

export async function getStock(secid: string): Promise<StockDetail | null> {
  const [secs, series] = await Promise.all([
    sql`select secid, shortname, name, list_level from securities where secid = ${secid}`,
    sql`
      select trade_date::text as trade_date, close, value_rub, high, low
      from daily_candles
      where secid = ${secid} and close is not null
      order by trade_date asc
    `,
  ]);
  if (!secs[0]) return null;
  return {
    secid: secs[0].secid as string,
    shortname: secs[0].shortname as string,
    name: secs[0].name as string | null,
    listLevel: secs[0].list_level === null ? null : Number(secs[0].list_level),
    series: series.map((r) => ({
      date: r.trade_date as string,
      close: Number(r.close),
      valueRub: Number(r.value_rub ?? 0),
      high: r.high === null ? null : Number(r.high),
      low: r.low === null ? null : Number(r.low),
    })),
  };
}

export async function getDigestByDate(date: string): Promise<DigestRow | null> {
  const rows = await sql`
    select id, digest_date::text as digest_date, content, created_at::text as created_at
    from digests
    where digest_date = ${date}::date
    order by id desc
    limit 1
  `;
  return (rows[0] as unknown as DigestRow) ?? null;
}
