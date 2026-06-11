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
      <section className="mx-auto max-w-5xl px-5 pt-20 pb-14 text-center">
        <p className="inline-flex items-center gap-2 text-sm text-accent mb-5 rounded-full border border-accent/30 bg-accent-dim px-4 py-1.5">
          <span className="size-1.5 rounded-full bg-accent animate-pulse" />
          Каждое утро в 9:00 МСК · рынок РФ
        </p>
        <h1 className="text-4xl sm:text-6xl font-bold tracking-tight leading-[1.05] max-w-4xl mx-auto">
          Перестаньте угадывать.
          <br />
          <span className="text-accent">Начните понимать рынок.</span>
        </h1>
        <p className="mt-6 text-lg sm:text-xl text-muted max-w-2xl mx-auto leading-relaxed">
          Десятки каналов, противоречивые мнения, новости 24/7 — а вы так и не знаете, что из
          этого важно для ваших акций. ИИ читает рынок за вас и каждое утро объясняет простым
          языком: что случилось с вашим портфелем и почему.
        </p>
        <div className="mt-9 flex flex-wrap items-center justify-center gap-4">
          <Link
            href="/login"
            className="rounded-full bg-accent text-background font-semibold px-7 py-3.5 hover:opacity-90 transition-opacity"
          >
            Начать бесплатно
          </Link>
          <a
            href="https://t.me/InvestDigestAI"
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-full border border-edge px-7 py-3.5 hover:border-accent/60 hover:text-accent transition-colors"
          >
            Посмотреть пример в Telegram
          </a>
        </div>
        <p className="mt-5 text-sm text-muted">
          Без карты · без пампа и «иксов» · только факты со ссылками на источник
        </p>
      </section>

      {/* Live market snapshot — доказательство, что продукт работает прямо сейчас */}
      <section className="mx-auto max-w-5xl px-5 pb-20">
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
            Живые данные · итоги торгов за {formatDateRu(snapshot.indices[0].tradeDate)}
          </p>
        )}
      </section>

      {/* Боли — «знакомо?» */}
      <section className="mx-auto max-w-5xl px-5 pb-20">
        <h2 className="text-2xl sm:text-3xl font-semibold text-center mb-3">Знакомо?</h2>
        <p className="text-muted text-center mb-10 max-w-2xl mx-auto">
          80% частных инвесторов теряют деньги. Чаще всего — не из-за рынка, а из-за этих ловушек.
        </p>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { emoji: "😵‍💫", title: "Информационный шум", text: "Десять каналов говорят разное. Что из этого реально касается моих бумаг — непонятно." },
            { emoji: "😰", title: "Паника на просадке", text: "Акция упала на 5% — продал в убыток. А это была обычная коррекция, не обвал." },
            { emoji: "⏰", title: "Пропустил событие", text: "Узнал про дивидендную отсечку или отчёт, когда было уже поздно." },
            { emoji: "🎣", title: "Кому верить?", text: "Каналы пампят, брокеры продают свои продукты, инфоцыгане обещают иксы." },
          ].map((p) => (
            <div key={p.title} className="rounded-2xl border border-edge bg-surface p-6">
              <div className="text-3xl mb-3">{p.emoji}</div>
              <h3 className="font-semibold mb-2">{p.title}</h3>
              <p className="text-sm text-muted leading-relaxed">{p.text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Ценность — что вы получаете (выгоды, не фичи) */}
      <section className="mx-auto max-w-5xl px-5 pb-20">
        <h2 className="text-2xl sm:text-3xl font-semibold text-center mb-10">
          Что вы получаете вместо тревоги
        </h2>
        <div className="grid md:grid-cols-3 gap-5">
          {[
            {
              title: "Ясность за 2 минуты",
              text: "Каждое утро — короткая сводка по вашим бумагам: что выросло, что упало и что это значит. Без воды, на человеческом языке.",
              accent: "Экономия часов в неделю",
            },
            {
              title: "Спокойствие на просадках",
              text: "ИИ подскажет, резкое движение — это шум в пределах обычной волатильности или реальный повод разобраться. Меньше импульсивных решений.",
              accent: "Защита от своих же ошибок",
            },
            {
              title: "Ничего не пропустите",
              text: "Дивиденды, отчёты, ключевые события по вашему списку — заранее и в одном месте.",
              accent: "Контроль над портфелем",
            },
          ].map((v) => (
            <div key={v.title} className="rounded-2xl border border-edge bg-surface p-7">
              <h3 className="font-semibold text-lg mb-3">{v.title}</h3>
              <p className="text-sm text-muted leading-relaxed mb-4">{v.text}</p>
              <p className="text-sm text-accent font-medium">→ {v.accent}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Доверие — почему нам можно верить */}
      <section className="mx-auto max-w-4xl px-5 pb-20">
        <div className="rounded-3xl border border-accent/20 bg-accent-dim p-8 sm:p-10">
          <h2 className="text-2xl font-semibold mb-6 text-center">
            Мы зарабатываем на подписке, а не на ваших сделках
          </h2>
          <div className="grid sm:grid-cols-3 gap-6 text-center">
            {[
              { t: "Не продаём бумаги", d: "Нам всё равно, что вы купите. Нет конфликта интересов — только нейтральная аналитика." },
              { t: "Всё со ссылками", d: "Каждый вывод ИИ ведёт на первоисточник: данные МосБиржи и ЦБ. Проверяйте сами." },
              { t: "Никаких «иксов»", d: "Не обещаем прибыль и не даём сигналов «купи». Помогаем понять, а не угадать." },
            ].map((x) => (
              <div key={x.t}>
                <p className="font-semibold mb-2 text-accent">{x.t}</p>
                <p className="text-sm text-muted leading-relaxed">{x.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Живой дайджест — доказательство качества */}
      {latest && (
        <section className="mx-auto max-w-3xl px-5 pb-20">
          <p className="text-center text-sm text-muted mb-4">Так выглядит сегодняшний дайджест:</p>
          <div className="rounded-2xl border border-edge bg-surface p-7">
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-semibold text-lg">Дайджест рынка</h2>
              <span className="text-sm text-muted">{formatDateRu(latest.digest_date)}</span>
            </div>
            <div
              className="digest-body text-[15px]"
              dangerouslySetInnerHTML={{ __html: digestToHtml(latest.content) }}
            />
          </div>
        </section>
      )}

      {/* Тарифы — тизер */}
      <section className="mx-auto max-w-4xl px-5 pb-20">
        <h2 className="text-2xl sm:text-3xl font-semibold text-center mb-10">Простые тарифы</h2>
        <div className="grid sm:grid-cols-2 gap-5">
          <div className="rounded-2xl border border-edge bg-surface p-7">
            <p className="text-sm text-muted mb-1">Бесплатно</p>
            <p className="text-3xl font-bold mb-5">0 ₽</p>
            <ul className="space-y-3 text-sm mb-7">
              <li className="flex gap-2"><span className="text-accent">✓</span> Утренний дайджест рынка</li>
              <li className="flex gap-2"><span className="text-accent">✓</span> Котировки и графики акций</li>
              <li className="flex gap-2"><span className="text-accent">✓</span> Календарь дивидендов</li>
            </ul>
            <Link
              href="/login"
              className="block text-center rounded-full border border-edge px-6 py-3 hover:border-accent/60 hover:text-accent transition-colors"
            >
              Начать бесплатно
            </Link>
          </div>
          <div className="rounded-2xl border border-accent/40 bg-surface p-7 relative">
            <span className="absolute -top-3 right-6 text-xs bg-accent text-background font-semibold rounded-full px-3 py-1">
              Скоро
            </span>
            <p className="text-sm text-muted mb-1">Pro</p>
            <p className="text-3xl font-bold mb-5">
              490 ₽<span className="text-base font-normal text-muted">/мес</span>
            </p>
            <ul className="space-y-3 text-sm mb-7">
              <li className="flex gap-2"><span className="text-accent">✓</span> Всё из бесплатного</li>
              <li className="flex gap-2"><span className="text-accent">✓</span> Персональный дайджест по вашим бумагам</li>
              <li className="flex gap-2"><span className="text-accent">✓</span> Алерты о резких движениях и событиях</li>
              <li className="flex gap-2"><span className="text-accent">✓</span> ИИ-чат по рынку со ссылками</li>
            </ul>
            <div className="block text-center rounded-full bg-accent/20 text-accent font-medium px-6 py-3 cursor-default">
              Готовим к запуску
            </div>
          </div>
        </div>
      </section>

      {/* Финальный CTA */}
      <section className="mx-auto max-w-3xl px-5 pb-28 text-center">
        <h2 className="text-3xl font-bold mb-4">Попробуйте завтра утром</h2>
        <p className="text-muted mb-8 max-w-xl mx-auto">
          Добавьте свои бумаги — и с завтрашнего дня получайте понятную сводку вместо
          информационного шума. Бесплатно, вход через Telegram за 10 секунд.
        </p>
        <Link
          href="/login"
          className="inline-block rounded-full bg-accent text-background font-semibold px-8 py-4 hover:opacity-90 transition-opacity"
        >
          Начать бесплатно
        </Link>
      </section>
    </div>
  );
}
