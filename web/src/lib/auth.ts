import { randomBytes } from "crypto";
import { cookies } from "next/headers";
import { sql } from "./db";

export const BOT_USERNAME = "AI_helper_invest_ru_bot";
const SESSION_COOKIE = "sid";
const SESSION_DAYS = 180;

export type CurrentUser = {
  id: number;
  telegramId: number;
  username: string | null;
  firstName: string | null;
};

export function newToken(): string {
  return randomBytes(24).toString("hex");
}

export async function getCurrentUser(): Promise<CurrentUser | null> {
  const jar = await cookies();
  const sid = jar.get(SESSION_COOKIE)?.value;
  if (!sid) return null;
  const rows = await sql`
    select u.id, u.telegram_id, u.username, u.first_name
    from sessions s
    join users u on u.id = s.user_id
    where s.id = ${sid} and s.expires_at > now()
  `;
  if (!rows[0]) return null;
  return {
    id: Number(rows[0].id),
    telegramId: Number(rows[0].telegram_id),
    username: rows[0].username as string | null,
    firstName: rows[0].first_name as string | null,
  };
}

/** Создаёт сессию для пользователя и ставит cookie. */
export async function createSession(userId: number): Promise<void> {
  const sid = randomBytes(24).toString("hex");
  await sql`
    insert into sessions (id, user_id, expires_at)
    values (${sid}, ${userId}, now() + ${`${SESSION_DAYS} days`}::interval)
  `;
  const jar = await cookies();
  jar.set(SESSION_COOKIE, sid, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: SESSION_DAYS * 24 * 3600,
    path: "/",
  });
}

export async function destroySession(): Promise<void> {
  const jar = await cookies();
  const sid = jar.get(SESSION_COOKIE)?.value;
  if (sid) await sql`delete from sessions where id = ${sid}`;
  jar.delete(SESSION_COOKIE);
}
