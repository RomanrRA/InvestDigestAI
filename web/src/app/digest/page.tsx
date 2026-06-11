import type { Metadata } from "next";
import Link from "next/link";
import { getDigests } from "@/lib/queries";
import { formatDateRu } from "@/lib/format";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Архив дайджестов",
  description: "Все ежедневные ИИ-дайджесты российского фондового рынка.",
};

/** Первая строка дайджеста без тегов — как анонс в списке. */
function headline(content: string): string {
  const first = content.split("\n")[0] ?? "";
  return first.replace(/<[^>]+>/g, "");
}

export default async function DigestListPage() {
  const digests = await getDigests(60);

  return (
    <div className="mx-auto max-w-3xl px-5 py-14">
      <h1 className="text-3xl font-bold mb-8">Дайджесты рынка</h1>
      {digests.length === 0 && <p className="text-muted">Пока пусто — первый выпуск скоро.</p>}
      <ul className="space-y-3">
        {digests.map((d) => (
          <li key={d.id}>
            <Link
              href={`/digest/${d.digest_date}`}
              className="block rounded-xl border border-edge bg-surface p-5 hover:border-accent/50 transition-colors"
            >
              <p className="text-sm text-muted mb-1">{formatDateRu(d.digest_date)}</p>
              <p className="font-medium">{headline(d.content)}</p>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
