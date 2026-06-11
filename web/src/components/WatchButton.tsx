"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function WatchButton({
  secid,
  initialWatched,
  loggedIn,
}: {
  secid: string;
  initialWatched: boolean;
  loggedIn: boolean;
}) {
  const router = useRouter();
  const [watched, setWatched] = useState(initialWatched);
  const [busy, setBusy] = useState(false);

  async function toggle() {
    if (!loggedIn) {
      router.push("/login");
      return;
    }
    setBusy(true);
    const res = await fetch("/api/watchlist", {
      method: watched ? "DELETE" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ secid }),
    });
    if (res.ok) setWatched(!watched);
    else if (res.status === 401) router.push("/login");
    setBusy(false);
  }

  return (
    <button
      onClick={toggle}
      disabled={busy}
      className={`rounded-full border px-5 py-2 text-sm font-medium transition-colors disabled:opacity-50 ${
        watched
          ? "border-accent/60 text-accent"
          : "border-edge text-muted hover:border-accent/60 hover:text-accent"
      }`}
    >
      {watched ? "★ В моём списке" : "☆ Следить"}
    </button>
  );
}
