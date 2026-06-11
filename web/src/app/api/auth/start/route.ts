import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { BOT_USERNAME, newToken } from "@/lib/auth";

export async function POST() {
  const token = newToken();
  await sql`insert into login_tokens (token, status) values (${token}, 'pending')`;
  return NextResponse.json({
    token,
    botUrl: `https://t.me/${BOT_USERNAME}?start=${token}`,
  });
}
