import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

const SECID_RE = /^[A-Z0-9@-]{1,36}$/;

async function parseSecid(req: NextRequest): Promise<string | null> {
  const body = await req.json().catch(() => null);
  const secid = typeof body?.secid === "string" ? body.secid.toUpperCase() : "";
  return SECID_RE.test(secid) ? secid : null;
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const secid = await parseSecid(req);
  if (!secid) return NextResponse.json({ error: "bad secid" }, { status: 400 });

  const known = await sql`select 1 from securities where secid = ${secid}`;
  if (!known[0]) return NextResponse.json({ error: "unknown secid" }, { status: 404 });

  await sql`
    insert into watchlist_items (user_id, secid) values (${user.id}, ${secid})
    on conflict do nothing
  `;
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const secid = await parseSecid(req);
  if (!secid) return NextResponse.json({ error: "bad secid" }, { status: 400 });

  await sql`delete from watchlist_items where user_id = ${user.id} and secid = ${secid}`;
  return NextResponse.json({ ok: true });
}
