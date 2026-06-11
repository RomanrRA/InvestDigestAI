import postgres from "postgres";

declare global {
  // eslint-disable-next-line no-var
  var __sql: ReturnType<typeof postgres> | undefined;
}

// Один клиент на процесс (hot reload в dev пересоздаёт модули)
export const sql =
  globalThis.__sql ??
  postgres(process.env.DATABASE_URL!, {
    max: 5,
    transform: { undefined: null },
  });

if (process.env.NODE_ENV !== "production") globalThis.__sql = sql;
