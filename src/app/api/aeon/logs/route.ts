/** GET /api/aeon/logs — recent structured logs, optionally filtered by level. */
import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const level = url.searchParams.get("level");
  const take = Math.min(300, Number(url.searchParams.get("take") ?? 100));

  const logs = await db.logEntry.findMany({
    where: level && level !== "ALL" ? { level } : undefined,
    orderBy: { createdAt: "desc" },
    take,
  });

  return NextResponse.json(
    logs.map((l) => ({ ...l, createdAt: l.createdAt.toISOString() })),
  );
}
