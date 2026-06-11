import Link from "next/link";
import { getDigests, getMarketSnapshot } from "@/lib/queries";
import { digestToHtml, formatDateRu, formatPct } from "@/lib/format";

export const dynamic = "force-dynamic";

const INDEX_NAMES: Record<string, string> = { IMOEX: "Индекс МосБиржи", RTSI: "Индекс РТС" };
const FX_SYMBOLS: Record<string, string> = { USD: "$", EUR: "€", CNY: "¥" };

function Pct({ value }: { value: number | null }) {
  if (value === null) return null;
  const cls = value >= 0 ? "text-accent" : "text-negative";
  return <span className={`${cls} text-sm font-medium tabular-nums`}>{formatPct(value)}</span>;
}

export default async function Home() {
  const [snapshot, digests] = await Promise.all([getMarketSnapshot(), getDigests(1)]);
  const latest = digests[0];

  return (
    <div className="glow">
      {/* Hero */}
      <section className="mx-auto max-w-5xl px-5 pt-20 pb-12 text-center">
        <p className="text-sm text-accent mb-4 tracking-wide uppercase">
          Российский фондовый рынок · каждое утро в 9:00 МСК
        </p>
        <h1 className="text-4xl sm:text-5xl font-bold tracking-tight leading-tight max-w-3xl mx-auto">
          ИИ читает рынок за вас — и объясняет простым языком
        </h1>
        <p className="mt-5 text-lg text-muted max-w-2xl mx-auto">
          Каждый торговый день собираем данные МосБиржи и ЦБ, находим главные движения и публикуем
          дайджест: что выросло, что упало и на что смотреть.
        </p>
        <div className="mt-8 flex items-center justify-center gap-4">
          <a
            href="https://t.me/InvestDigestAI"
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-full bg-accent text-background font-semibold px-6 py-3 hover:opacity-90 transition-opacity"
          >
            Читать в Telegram
          </a>
          <Link
            href="/digest"
            className="rounded-full border border-edge px-6 py-3 hover:border-accent/60 hover:text-accent transition-colors"
          >
            Архив дайджестов
          </Link>
        </div>
      </section>

      {/* Market snapshot */}
      <section className="mx-auto max-w-5xl px-5 pb-16">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {snapshot.indices.map((idx) => (
            <div key={idx.indexid} className="rounded-xl border border-edge bg-surface p-4">
              <p className="text-xs text-muted mb-1">{INDEX_NAMES[idx.indexid] ?? idx.indexid}</p>
              <p className="text-xl font-semibold tabular-nums">
                {idx.close.toLocaleString("ru-RU")}
              </p>
              <Pct value={idx.changePct} />
            </div>
          ))}
          {snapshot.keyRate !== null && (
            <div className="rounded-xl border border-edge bg-surface p-4">
              <p className="text-xs text-muted mb-1">Ключевая ставка</p>
              <p className="text-xl font-semibold tabular-nums">{snapshot.keyRate}%</p>
              <span className="text-sm text-muted">ЦБ РФ</span>
            </div>
          )}
          {snapshot.fx.map((f) => (
            <div key={f.code} className="rounded-xl border border-edge bg-surface p-4">
              <p className="text-xs text-muted mb-1">{f.code} / RUB</p>
              <p className="text-xl font-semibold tabular-nums">
                {f.rate.toLocaleString("ru-RU", { maximumFractionDigits: 2 })} ₽
              </p>
              <span className="text-sm text-muted">{FX_SYMBOLS[f.code]} курс ЦБ</span>
            </div>
          ))}
        </div>
        {snapshot.indices[0] && (
          <p className="mt-3 text-xs text-muted text-right">
            Итоги торгов за {formatDateRu(snapshot.indices[0].tradeDate)}
          </p>
        )}
      </section>

      {/* Latest digest */}
      {latest && (
        <section className="mx-auto max-w-3xl px-5 pb-16">
          <div className="rounded-2xl border border-edge bg-surface p-7">
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-semibold text-lg">Свежий дайджест</h2>
              <span className="text-sm text-muted">{formatDateRu(latest.digest_date)}</span>
            </div>
            <div
              className="digest-body text-[15px]"
              dangerouslySetInnerHTML={{ __html: digestToHtml(latest.content) }}
            />
          </div>
        </section>
      )}

      {/* How it works */}
      <section className="mx-auto max-w-5xl px-5 pb-20">
        <h2 className="text-2xl font-semibold text-center mb-10">Как это работает</h2>
        <div className="grid sm:grid-cols-3 gap-5">
          {[
            {
              step: "01",
              title: "Собираем данные",
              text: "Итоги торгов МосБиржи, индексы, ключевая ставка и курсы ЦБ — автоматически, каждый день.",
            },
            {
              step: "02",
              title: "ИИ анализирует",
              text: "Модель находит значимые движения ликвидных бумаг и отсекает шум неликвида.",
            },
            {
              step: "03",
              title: "Вы читаете суть",
              text: "Короткий дайджест без воды к утреннему кофе — на сайте и в Telegram.",
            },
          ].map((item) => (
            <div key={item.step} className="rounded-2xl border border-edge bg-surface p-6">
              <p className="text-accent font-mono text-sm mb-3">{item.step}</p>
              <h3 className="font-semibold mb-2">{item.title}</h3>
              <p className="text-sm text-muted leading-relaxed">{item.text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Roadmap teaser */}
      <section className="mx-auto max-w-5xl px-5 pb-24">
        <div className="rounded-2xl border border-edge bg-surface p-8 text-center">
          <h2 className="text-xl font-semibold mb-3">Скоро</h2>
          <p className="text-muted max-w-2xl mx-auto text-sm leading-relaxed">
            Персональный дайджест по вашему списку бумаг · сигналы по сделкам инсайдеров и
            раскрытию эмитентов · ИИ-чат по рынку со ссылками на источники
          </p>
        </div>
      </section>
    </div>
  );
}
