import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getDigestByDate } from "@/lib/queries";
import { digestToHtml, formatDateRu } from "@/lib/format";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ date: string }> };

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { date } = await params;
  if (!DATE_RE.test(date)) return {};
  return {
    title: `Дайджест рынка за ${formatDateRu(date)}`,
    description: `Итоги торгов МосБиржи за ${formatDateRu(date)}: индексы, лидеры роста и падения, ключевая ставка и курсы валют.`,
  };
}

export default async function DigestPage({ params }: Props) {
  const { date } = await params;
  if (!DATE_RE.test(date)) notFound();

  const digest = await getDigestByDate(date);
  if (!digest) notFound();

  return (
    <article className="mx-auto max-w-3xl px-5 py-14">
      <Link href="/digest" className="text-sm text-muted hover:text-accent transition-colors">
        ← Все дайджесты
      </Link>
      <h1 className="text-3xl font-bold mt-4 mb-8">Дайджест за {formatDateRu(date)}</h1>
      <div className="rounded-2xl border border-edge bg-surface p-7">
        <div
          className="digest-body text-[15px]"
          dangerouslySetInnerHTML={{ __html: digestToHtml(digest.content) }}
        />
      </div>
      <p className="mt-6 text-xs text-muted">
        Дайджест сгенерирован ИИ на основе официальных данных МосБиржи и ЦБ РФ. Не является
        индивидуальной инвестиционной рекомендацией.
      </p>
    </article>
  );
}
