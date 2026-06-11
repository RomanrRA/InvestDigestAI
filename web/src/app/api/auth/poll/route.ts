import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { createSession } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");
  if (!token || !/^[a-f0-9]{48}$/.test(token)) {
    return NextResponse.json({ status: "invalid" }, { status: 400 });
  }

  // used: токен одноразовый — сессию по нему выдаём ровно один раз
  const rows = await sql`
    update login_tokens set status = 'used'
    where token = ${token} and status = 'confirmed'
    returning telegram_id
  `;
  if (!rows[0]?.telegram_id) {
    const pending = await sql`select 1 from login_tokens where token = ${token} and status = 'pending'`;
    return NextResponse.json({ status: pending[0] ? "pending" : "expired" });
  }

  const users = await sql`select id from users where telegram_id = ${rows[0].telegram_id}`;
  if (!users[0]) return NextResponse.json({ status: "expired" });

  await createSession(Number(users[0].id));
  return NextResponse.json({ status: "ok" });
}
