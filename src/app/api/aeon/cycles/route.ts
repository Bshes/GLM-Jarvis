/**
 * GET /api/aeon/cycles — list recent orchestration cycle history.
 * Optional `?take=N` (default 30, max 100).
 */
import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const take = Math.min(100, Number(url.searchParams.get("take") ?? 30));

  const cycles = await db.cycleHistory.findMany({
    orderBy: { createdAt: "desc" },
    take,
  });

  return NextResponse.json(
    cycles.map((c) => ({
      id: c.id,
      cycleId: c.cycleId,
      input: c.input,
      perception: c.perception,
      thought: c.thought,
      reflection: c.reflection,
      routing: c.routing ? JSON.parse(c.routing) : null,
      route: c.route,
      complexity: c.complexity,
      model: c.model,
      thinking: c.thinking,
      durationMs: c.durationMs,
      actionCount: c.actionCount,
      memoriesCreated: c.memoriesCreated,
      outcome: c.outcome,
      createdAt: c.createdAt.toISOString(),
    })),
  );
}
