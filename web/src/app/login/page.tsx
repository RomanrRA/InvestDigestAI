"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

type Phase = "idle" | "waiting" | "expired" | "error";

export default function LoginPage() {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("idle");
  const [botUrl, setBotUrl] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPolling = useCallback(() => {
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
  }, []);

  useEffect(() => stopPolling, [stopPolling]);

  async function start() {
    try {
      const res = await fetch("/api/auth/start", { method: "POST" });
      const { token, botUrl } = await res.json();
      setBotUrl(botUrl);
      setPhase("waiting");
      window.open(botUrl, "_blank");

      timer.current = setInterval(async () => {
        const poll = await fetch(`/api/auth/poll?token=${token}`);
        const { status } = await poll.json();
        if (status === "ok") {
          stopPolling();
          router.push("/watchlist");
          router.refresh();
        } else if (status === "expired") {
          stopPolling();
          setPhase("expired");
        }
      }, 2000);
    } catch {
      setPhase("error");
    }
  }

  return (
    <div className="mx-auto max-w-md px-5 py-24 text-center">
      <h1 className="text-3xl font-bold mb-3">Вход</h1>
      <p className="text-muted mb-8">
        Авторизация через Telegram: нажмите кнопку, в открывшемся чате с ботом нажмите{" "}
        <b className="text-foreground">Start</b> — и вы на сайте.
      </p>

      {phase !== "waiting" && (
        <button
          onClick={start}
          className="rounded-full bg-accent text-background font-semibold px-8 py-3 hover:opacity-90 transition-opacity"
        >
          Войти через Telegram
        </button>
      )}

      {phase === "waiting" && (
        <div className="rounded-2xl border border-edge bg-surface p-6">
          <p className="animate-pulse text-accent mb-3">Ждём подтверждения в Telegram…</p>
          <p className="text-sm text-muted">
            Чат не открылся?{" "}
            <a href={botUrl ?? "#"} target="_blank" rel="noopener noreferrer" className="text-accent underline">
              Открыть бота вручную
            </a>
          </p>
        </div>
      )}

      {phase === "expired" && (
        <p className="mt-4 text-sm text-negative">Ссылка устарела — нажмите кнопку ещё раз.</p>
      )}
      {phase === "error" && (
        <p className="mt-4 text-sm text-negative">Что-то пошло не так. Обновите страницу.</p>
      )}
    </div>
  );
}
