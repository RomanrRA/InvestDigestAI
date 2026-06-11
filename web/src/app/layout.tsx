import type { Metadata } from "next";
import { Inter } from "next/font/google";
import Link from "next/link";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin", "cyrillic"],
});

export const metadata: Metadata = {
  title: {
    default: "InvestDigest AI — ИИ-аналитика российского рынка",
    template: "%s — InvestDigest AI",
  },
  description:
    "Ежедневный ИИ-дайджест Московской биржи: индексы, ключевая ставка, лидеры роста и падения с объяснением простым языком.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ru" className={`${inter.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col font-sans">
        <header className="border-b border-edge/70 bg-background/80 backdrop-blur sticky top-0 z-10">
          <div className="mx-auto max-w-5xl px-5 h-14 flex items-center justify-between">
            <Link href="/" className="font-semibold tracking-tight">
              Invest<span className="text-accent">Digest</span> AI
            </Link>
            <nav className="flex items-center gap-6 text-sm text-muted">
              <Link href="/digest" className="hover:text-foreground transition-colors">
                Дайджесты
              </Link>
              <Link href="/stocks" className="hover:text-foreground transition-colors">
                Акции
              </Link>
              <Link href="/watchlist" className="hover:text-foreground transition-colors">
                Мои бумаги
              </Link>
              <a
                href="https://t.me/InvestDigestAI"
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-full border border-edge px-4 py-1.5 text-foreground hover:border-accent/60 hover:text-accent transition-colors"
              >
                Telegram-канал
              </a>
            </nav>
          </div>
        </header>
        <main className="flex-1">{children}</main>
        <footer className="border-t border-edge/70 py-8 text-center text-xs text-muted px-5">
          <p className="max-w-3xl mx-auto">
            Информация на сайте носит исключительно аналитический и информационный характер, не
            является индивидуальной инвестиционной рекомендацией. Котировки предоставляются с
            задержкой. © {new Date().getFullYear()} InvestDigest AI
          </p>
        </footer>
      </body>
    </html>
  );
}
